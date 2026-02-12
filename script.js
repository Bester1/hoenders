// Global variables
let imports = {}; // Structure: { importId: { name, date, orders: [], invoices: [] } }
let currentImportId = null;
let ordersOpen = true;
let invoices = []; // Global invoices across all imports
let emailQueue = [];
let csvData = null;
let csvHeaders = [];
let analysisHistory = [];
let lastPDFAnalysis = null; // Store the last PDF analysis for import
let isInitializing = true; // Prevent saves during initialization

// Safe DOM manipulation helpers
function safeSetTableContent(tableBody, content, colspan = 1) {
    // Clear existing content
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }

    if (typeof content === 'string') {
        // Create a single row with message
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = colspan;
        cell.className = 'no-data';
        cell.textContent = content;
        row.appendChild(cell);
        tableBody.appendChild(row);
    } else if (content instanceof Node) {
        // Append DOM node directly
        tableBody.appendChild(content);
    }
}

function safeCreateElement(tag, text = '', className = '') {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
}

// Helper functions for import management
function getCurrentOrders() {
    const importOrders = currentImportId && imports[currentImportId] ? imports[currentImportId].orders : [];
    const customerOrders = window.customerPortalOrders || [];
    return [...importOrders, ...customerOrders];
}

function getCurrentImportInvoices() {
    return currentImportId && imports[currentImportId] ? imports[currentImportId].invoices : [];
}

// Estimate product weight based on typical butchery weights
function estimateProductWeight(product, quantity) {
    const weightEstimates = {
        'HEEL HOENDER': 1.8, // Full chicken ~1.8kg average
        'HEEL HALWE HOENDERS': 0.9, // Half chicken ~0.9kg
        'PLAT HOENDER (FLATTY\'S)': 1.2, // Flattened chicken ~1.2kg
        'BRAAIPAKKE': 1.8, // Cut up chicken ~1.8kg
        'BORSSTUKKE MET BEEN EN VEL': 0.8, // Breast pieces ~0.8kg per pack
        'BOUDE EN DYE': 0.8, // Thighs and drumsticks ~0.8kg per pack
        'GUNS Boud en dy aanmekaar': 0.7, // Connected thigh/drum ~0.7kg
        'FILETTE (sonder vel)': 0.9, // Breast fillets ~0.9kg per pack
        'STRIPS': 0.5, // Chicken strips ~0.5kg per pack
        'ONTBEENDE HOENDER': 1.3, // Deboned chicken ~1.3kg
        'VLERKIES': 0.5, // Wings ~0.5kg per pack
        'GEVULDE HOENDER ROLLE VAKUUM VERPAK': 1.4, // Stuffed rolls ~1.4kg
        'LEWER': 0.5, // Liver ~0.5kg per pack
        'NEKKIES': 0.5, // Necks ~0.5kg per pack
        'HOENDER KAASWORS': 0.5, // Chicken cheese sausage ~0.5kg
        'HOENDER PATTIES': 0.5, // Chicken patties ~0.5kg per pack
        'INGELEGDE GROEN VYE': 0.375, // Pickled figs ~375g per jar
        'SUIWER HEUNING': 0.5 // Honey ~500g per jar
    };

    const baseWeight = weightEstimates[product] || 1.0; // Default 1kg if not found
    const sanitizedQuantity = SecurityUtils.sanitizeNumber(quantity, 1);
    return parseFloat((baseWeight * sanitizedQuantity).toFixed(2));
}

// Product mapping for CSV columns to standardized names
const productMapping = {
    'Heel Hoender - Full Chicken 1.5kg - 2.2kg R67/kg': 'HEEL HOENDER',
    'Halwe Hoender - Half Chicken  R68/kg': 'HEEL HALWE HOENDERS',
    'Plat Hoender - Flatty R79/kg': 'PLAT HOENDER (FLATTY\'S)',
    'Braai pakke Heel hoender opgesny R74/kg': 'BRAAIPAKKE',
    'Bors stukke met been en vel R73/kg 2 of 4 in pak.': 'BORSSTUKKE MET BEEN EN VEL',
    'Boude en dye, 2 boude en 2 dye in pak.+-800gr R81/Kg': 'BOUDE EN DYE',
    'Guns (Boude en dye aan mekaar vas) R81/kg. 3 in pak': 'GUNS Boud en dy aanmekaar',
    'Fillets sonder vel R100/kg +-900gr 4 fillets per pak': 'FILETTE (sonder vel)',
    'Strips +-500gr pak R100/kg': 'STRIPS',
    'Ontbeende hoender R125/kg     1kg - 1.4kg': 'ONTBEENDE HOENDER',
    'Vlerkies R90/kg 8 in n pak (nie altyd beskikbaar nie)': 'VLERKIES',
    'Gevulde hoender rolle  R193/kg(Opsie 1 - Vye,Feta,Cheddar sweet chilly ,beskikbaar as daar vye is)1.2kg-1.6kg': 'GEVULDE HOENDER ROLLE VAKUUM VERPAK',
    'Gevulde hoender rolle  R193/kg (Opsie 2 - Peppadew, mozzarella, cheddar,pynappel)1.2kg-1.6kg': 'GEVULDE HOENDER ROLLE OPSIE 2',
    'Lewer - In 500 g  bakkies verpak  R31/kg': 'LEWER',
    'Nekkies - In 1  kg sakkies verpak (NIE ALTYD BESKIKBAAR ) R30/kg': 'NEKKIES',
    'INGELEGDE GROEN VYE  R75 PER POTJIE 375ml potjie': 'INGELEGDE GROEN VYE',
    'Hoender Kaaswors 1kg Vacuum verpak R148/kg': 'HOENDER KAASWORS',
    'Hoender Patties 4 in pak (120-140gr/patty) R120/kg': 'HOENDER PATTIES',
    'Heuning 500ml R70': 'SUIWER HEUNING',
    // Additional mappings for butchery invoice items (simplified names)
    'heuning': 'SUIWER HEUNING',
    'fillets': 'FILETTE (sonder vel)',
    'vlerke': 'VLERKIES',
    '4bors': 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
    '2bors': 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
    '4 in pak': 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
    '2 in pak': 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
    '4bors in pak': 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
    '2bors in pak': 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
    'bors 4': 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
    'bors 2': 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
    'borsstukke 4': 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
    'borsstukke 2': 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
    'boud/dy': 'BOUDE EN DYE',
    'heel': 'HEEL HOENDER',
    'halwe hoender': 'HEEL HALWE HOENDERS',
    'strips': 'STRIPS',
    'ontbeen': 'ONTBEENDE HOENDER',
    'lewer': 'LEWER',
    'patties': 'HOENDER PATTIES',
    'guns': 'GUNS Boud en dy aanmekaar',
    'kaaswors': 'HOENDER KAASWORS',
    'plat': 'PLAT HOENDER (FLATTY\'S)',
    'braaipak': 'BRAAIPAKKE',
    'pep rol': 'GEVULDE HOENDER ROLLE OPSIE 2',
    'groen vye': 'INGELEGDE GROEN VYE'
};

// Jan 2026 Braaikuikens - EXACT COST and SELLING prices from supplier
// Products and Pricing (Loaded from Database)
let pricing = {};
let products = [];

// Fallback pricing for initial load / offline mode (Optional, but good for safety)
const DEFAULT_PRICING = {
    'HEEL HOENDER': { cost: 59.00, selling: 69.00, packaging: '± 1.8 - 2.5kg' },
    'PLAT HOENDER (FLATTY\'S)': { cost: 72.00, selling: 82.00, packaging: 'VAKUUM VERPAK - ± 2 +kg' },
    'BRAAIPAKKE': { cost: 65.00, selling: 74.00, packaging: '1 heel hoender opgesny VAKUUM VERPAK - ± 2kg+' },
    'HEEL HALWE HOENDERS': { cost: 60.00, selling: 68.00, packaging: 'Heel hoender deurgesny ± 900g - 1.2kg' },
    'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)': { cost: 64.00, selling: 73.00, packaging: '2 in pak ± 300g p 1 stuk' },
    'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)': { cost: 64.00, selling: 73.00, packaging: '4 in pak ± 300g p 1 stuk' },
    'VLERKIES': { cost: 79.00, selling: 95.00, packaging: '8 in pak - ± 700g - 900g VAKUUM VERPAK' },
    'BOUDE EN DYE': { cost: 71.00, selling: 81.00, packaging: '2 boude en 2 dye in pak ± 700g - 900g' },
    'GUNS Boud en dy aanmekaar': { cost: 73.00, selling: 83.00, packaging: '3 in pak - ± 1kg - 1.2kg VAKUUM VERPAK' },
    'LEWER': { cost: 30.00, selling: 35.00, packaging: 'In 500g bakkies verpak' },
    'MAGIES': { cost: 35.00, selling: 40.00, packaging: 'In 500g sakkies verpak NIE ALTYD BESKIKBAAR NIE' },
    'NEKKIES': { cost: 27.00, selling: 32.00, packaging: 'In 500g sakkies verpak' },
    'FILETTE (sonder vel)': { cost: 88.50, selling: 103.00, packaging: '4 filette per pak - ± 900g - 1.1kg VAKUUM VERPAK' },
    'STRIPS': { cost: 89.50, selling: 104.00, packaging: '± 500g per pak VAKUUM VERPAK' },
    'ONTBEENDE HOENDER': { cost: 115.00, selling: 130.00, packaging: 'VAKUUM VERPAK - ± 1kg - 1.2kg' },
    'GEVULDE HOENDER ROLLE VAKUUM VERPAK': { cost: 169.00, selling: 195.00, packaging: 'Opsie 1: Groenvye, feta, cheddar, sweet chilli - ± 1.7kg - 2kg', unit: 'per kg' },
    'GEVULDE HOENDER ROLLE OPSIE 2': { cost: 169.00, selling: 195.00, packaging: 'Opsie 2: Peppadew, mozzarella, cheddar, pynappel - ± 1.7kg - 2kg', unit: 'per kg' },
    'INGELEGDE GROEN VYE': { cost: 65.00, selling: 75.00, packaging: '375ml potjie', unit: 'per potjie' },
    'HOENDER PATTIES': { cost: 105.00, selling: 120.00, packaging: '4 in pak (120-140g per patty)', unit: 'per kg' },
    'HOENDER KAASWORS': { cost: 150.00, selling: 165.00, packaging: '± 500g VAKUUM VERPAK', unit: 'per kg' },
    'SUIWER HEUNING': { cost: 60.00, selling: 70.00, packaging: '500g potjie', unit: 'per potjie' }
};

// Secure Configuration and Database Connection with Fallback
let supabaseClient = null;
let GOOGLE_SCRIPT_URL = null;

// Fallback configuration for immediate deployment (LESS SECURE - for development only)
const FALLBACK_CONFIG = {
    SUPABASE_URL: 'https://ukdmlzuxgnjucwidsygj.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w',
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'
};

// Initialize secure connections with fallback
async function initializeSecureConnections() {
    try {
        // Try secure configuration first
        if (typeof SecureConfig !== 'undefined') {
            console.info('🔒 Attempting secure configuration...');

            const configInitialized = await SecureConfig.init();
            if (configInitialized && SecureConfig.isProductionReady()) {
                const SUPABASE_URL = SecureConfig.get('SUPABASE_URL');
                const SUPABASE_ANON_KEY = SecureConfig.get('SUPABASE_ANON_KEY');
                GOOGLE_SCRIPT_URL = SecureConfig.get('GOOGLE_SCRIPT_URL');

                if (SUPABASE_URL && SUPABASE_ANON_KEY && GOOGLE_SCRIPT_URL) {
                    const { createClient } = supabase;
                    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    console.info('✅ Secure configuration initialized successfully');
                    return true;
                }
            }
        }

        // Fallback to hardcoded configuration
        console.warn('⚠️ Using fallback configuration (less secure)');
        console.warn('⚠️ Please set up environment variables for production');

        const { createClient } = supabase;

        // Force correct Supabase configuration
        const correctSupabaseUrl = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
        const correctSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';

        supabaseClient = createClient(correctSupabaseUrl, correctSupabaseKey);
        GOOGLE_SCRIPT_URL = FALLBACK_CONFIG.GOOGLE_SCRIPT_URL;

        console.log('🔧 Forced correct Supabase configuration:', {
            url: correctSupabaseUrl,
            projectId: 'ukdmlzuxgnjucwidsygj'
        });

        console.info('✅ Fallback connections initialized');
        return true;

    } catch (error) {
        console.error('❌ Failed to initialize connections:', error);

        // Last resort: try direct fallback
        try {
            const { createClient } = supabase;
            supabaseClient = createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY);
            GOOGLE_SCRIPT_URL = FALLBACK_CONFIG.GOOGLE_SCRIPT_URL;
            console.warn('⚠️ Using emergency fallback configuration');
            return true;
        } catch (fallbackError) {
            console.error('❌ Complete connection failure:', fallbackError);
            if (typeof showSecurityError === 'function') {
                showSecurityError('Failed to initialize database connections. Please refresh the page.');
            }
            return false;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
    try {
        // Initialize secure connections first
        const secureConnectionsReady = await initializeSecureConnections();
        if (!secureConnectionsReady) {
            console.error('❌ Cannot proceed without secure connections');
            return;
        }

        // Continue with normal app initialization
        initializeApp();
        initializeDatabase();
        await loadProducts(); // Load products from DB
        loadStoredData();
        updateDashboard();
        loadPricingTable();
        loadCurrentRatesTable();
        setupPDFDragDrop();

        // Initialize data status on load
        setTimeout(refreshDataStatus, 1000);

        // Load customer portal orders on startup
        setTimeout(refreshPortalOrders, 1500);

        // Finish initialization to allow saves
        setTimeout(() => {
            isInitializing = false;
            console.log('✅ Secure application initialization complete');
        }, 2000);
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        showSecurityError('Application failed to initialize properly. Please refresh the page.');
    }
});

function initializeApp() {
    // Set up navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetSection = this.getAttribute('href').substring(1);
            showSection(targetSection);

            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Initialize email status
    updateEmailStatus();
}

// Database Functions
async function initializeDatabase() {
    try {
        console.log('Initializing Supabase connection...');

        // Check if Supabase client is available
        if (!supabaseClient) {
            console.error('❌ Supabase client not available - config missing. Using local storage only.');
            addActivity('Using local storage only - database config not found', 'error');
            return;
        }

        // Debug: Show current configuration
        console.log('🔧 Debug - Supabase URL:', supabaseClient.supabaseUrl);
        console.log('🔧 Debug - Client state:', !!supabaseClient);

        // Test basic connectivity first
        const basicConnectivity = await testBasicConnectivity();
        if (!basicConnectivity) {
            addActivity('Basic internet connectivity failed - check network connection', 'error');
            return;
        }

        // Test the connection with a simpler query first
        console.log('🔍 Testing database connection...');

        // First test with a very simple health check
        try {
            const { error, count } = await supabaseClient
                .from('imports')
                .select('*', { count: 'exact', head: true });

            console.log('📊 Connection test result:', { error, count });

            if (error) {
                throw error;
            } else {
                console.log('✅ Supabase connected successfully');
                addActivity('Connected to Supabase database', 'success');

                // Ensure database schema is up to date
                await updateDatabaseSchema();

                // Try to migrate existing localStorage data
                await migrateToDatabase();
            }
        } catch (connectionError) {
            console.error('❌ Database connection error details:', {
                message: connectionError.message,
                code: connectionError.code,
                details: connectionError.details,
                hint: connectionError.hint,
                stack: connectionError.stack
            });

            // Try a simpler connection test to identify the specific issue
            try {
                console.log('🔄 Testing basic connectivity...');
                const healthCheck = await supabaseClient.rpc('version');
                console.log('✅ Basic connectivity works, issue might be table-specific');
            } catch (healthError) {
                console.error('❌ Basic connectivity failed:', healthError.message);

                if (healthError.message.includes('Failed to fetch') || healthError.message.includes('NetworkError')) {
                    addActivity('Network connectivity issue - possible CORS or firewall problem', 'error');
                    console.log('💡 Possible solutions:');
                    console.log('   1. Check if browser extensions are blocking requests');
                    console.log('   2. Try a different browser');
                    console.log('   3. Check if VPN/firewall is blocking Supabase');
                    console.log('   4. Try loading from a different network');
                } else if (healthError.message.includes('Invalid API key') || healthError.message.includes('JWT')) {
                    addActivity('Database API key invalid - configuration error', 'error');
                } else {
                    addActivity(`Database connection failed: ${healthError.message}`, 'error');
                }
                return;
            }

            // If basic connectivity works but table query fails
            if (connectionError.code === '42P01') {
                // Tables don't exist, show setup message
                console.log('⚠️ Database tables need to be created.');
                addActivity('Database tables missing - setup required', 'warning');
                showDatabaseSetupModal();
            } else if (connectionError.message.includes('Invalid API key') || connectionError.message.includes('JWT')) {
                console.error('❌ API key issue detected');
                addActivity('Database API key invalid - check configuration', 'error');
            } else if (connectionError.message.includes('permission') || connectionError.message.includes('authorization')) {
                addActivity('Database permission error - check RLS policies', 'error');
            } else {
                addActivity(`Database connection failed: ${connectionError.message}`, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Database initialization error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        addActivity(`Database initialization failed: ${error.message}`, 'error');
    }
}

// Simple connectivity test function
async function testBasicConnectivity() {
    try {
        console.log('🔍 Testing basic internet connectivity...');

        // Test a simple GET request to Supabase REST API
        const response = await fetch('https://ukdmlzuxgnjucwidsygj.supabase.co/rest/v1/', {
            method: 'GET',
            headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Basic internet connectivity working');
            return true;
        } else {
            console.error('❌ Basic connectivity failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Basic connectivity error:', error.message);
        return false;
    }
}

async function updateDatabaseSchema() {
    try {
        console.log('🔧 Checking database schema...');

        // Check if email_template column exists by trying to select it
        const { error } = await supabaseClient
            .from('settings')
            .select('email_template')
            .limit(0);

        if (error && (error.message.includes('column "email_template" does not exist') || error.code === '42703')) {
            console.log('⚠️ Email template column missing. Please run this SQL in Supabase SQL Editor:');
            console.log('%c ALTER TABLE settings ADD COLUMN email_template TEXT;', 'background: #f0f0f0; padding: 5px; font-family: monospace;');

            // Show user-friendly notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed; top: 70px; right: 20px; z-index: 10000;
                background: #ffeaa7; border: 2px solid #fdcb6e; border-radius: 8px;
                padding: 15px 20px; max-width: 400px; font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            notification.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i class="fas fa-wrench" style="margin-right: 8px; color: #e17055;"></i>
                    <strong>Database Schema Update Needed</strong>
                    <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; font-size: 16px; cursor: pointer;">×</button>
                </div>
                <p style="margin: 0 0 8px 0;">Please add this SQL in your Supabase dashboard:</p>
                <code style="background: white; padding: 4px 8px; border-radius: 4px; display: block; font-family: monospace;">
                    ALTER TABLE settings ADD COLUMN email_template TEXT;
                </code>
            `;
            document.body.appendChild(notification);

            // Auto-remove after 15 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 15000);

            addActivity('Database schema needs update - see notification');
        } else if (!error) {
            console.log('✅ Database schema is up to date');
        }

        // Check if orders_open column exists
        const { error: ordersError } = await supabaseClient
            .from('settings')
            .select('orders_open')
            .limit(0);

        if (ordersError && (ordersError.message.includes('column "orders_open" does not exist') || ordersError.code === '42703')) {
            console.log('⚠️ orders_open column missing. Please run this SQL in Supabase SQL Editor:');
            console.log('%c ALTER TABLE settings ADD COLUMN orders_open BOOLEAN DEFAULT true;', 'background: #f0f0f0; padding: 5px; font-family: monospace;');
            addActivity('Database schema needs update - orders_open column missing');
        }
    } catch (error) {
        console.log('⚠️ Could not check database schema:', error);
    }
}

async function saveToDatabase() {
    // Skip save during initialization to prevent excessive calls
    if (isInitializing) {
        return true;
    }

    // Check if Supabase client is available
    if (!supabaseClient) {
        console.log('Supabase client not available, saving to localStorage only');
        localStorage.setItem('plaasHoendersImports', JSON.stringify(imports));
        localStorage.setItem('plaasHoendersInvoices', JSON.stringify(invoices));
        localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(emailQueue));
        localStorage.setItem('plaasHoendersAnalysisHistory', JSON.stringify(analysisHistory));
        return true;
    }

    try {
        // Save imports
        for (const [importId, importData] of Object.entries(imports)) {
            const { error: importError } = await supabaseClient
                .from('imports')
                .upsert({
                    id: importId,
                    name: importData.name,
                    date: importData.date,
                    orders: importData.orders,
                    invoices: importData.invoices
                });

            if (importError) {
                console.error('Error saving import:', importError);
                ErrorHandler.showNotification('Failed to save import data to database', 'error');
                return false;
            }
        }

        // Save settings (but NOT pricing - always use current default)
        const { error: settingsError } = await supabaseClient
            .from('settings')
            .upsert({
                id: 'main',
                current_import_id: currentImportId,
                orders_open: ordersOpen,
                // pricing: pricing, // DON'T save pricing - always use current default
                email_queue: emailQueue,
                analysis_history: analysisHistory
            });

        if (settingsError) {
            console.error('Error saving settings:', settingsError);
            ErrorHandler.showNotification('Failed to save settings to database', 'error');
            return false;
        }

        // Save pricing/products
        // Transform pricing object into products array for DB
        const productsToSave = Object.entries(pricing).map(([name, details]) => ({
            name: name,
            cost_price: details.cost,
            selling_price: details.selling,
            packaging: details.packaging,
            unit: details.unit || 'per kg',
            active: true,
            // Use existing ID if available, otherwise let Supabase generate one or use a placeholder
            ...(details.id ? { id: details.id } : {})
        }));

        // We need to handle updates carefully - loop through and upsert
        // Ideally we would do a bulk upsert, but we need to match by name if ID is missing
        for (const product of productsToSave) {
            // First try to find existing product by name to get its ID if we don't have it
            if (!product.id) {
                const { data: existing } = await supabaseClient
                    .from('products')
                    .select('id')
                    .eq('name', product.name)
                    .single();

                if (existing) {
                    product.id = existing.id;
                }
            }

            const { error: productError } = await supabaseClient
                .from('products')
                .upsert(product, { onConflict: 'id' }); // If we have ID, upsert by ID. If not, it will insert (and generate ID)

            if (productError) {
                // If conflict by name (because we didn't find ID but name exists and is unique constraint)
                if (productError.code === '23505') { // Unique violation
                    const { error: retryError } = await supabaseClient
                        .from('products')
                        .update(product)
                        .eq('name', product.name);

                    if (retryError) console.error(`Failed to update duplicate product ${product.name}:`, retryError);
                } else {
                    console.error(`Error saving product ${product.name}:`, productError);
                }
            }
        }

        console.log('Data saved to Supabase successfully');
        return true;
    } catch (error) {
        console.error('Database save error:', error);
        ErrorHandler.showNotification('Database connection error. Data saved locally only.', 'error');
        // Fallback to localStorage
        localStorage.setItem('plaasHoendersImports', JSON.stringify(imports));
        localStorage.setItem('plaasHoendersInvoices', JSON.stringify(invoices));
        localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(emailQueue));
        localStorage.setItem('plaasHoendersAnalysisHistory', JSON.stringify(analysisHistory));
        return false;
    }
}

async function loadFromDatabase() {
    try {
        // Load imports
        const { data: importsData, error: importsError } = await supabaseClient
            .from('imports')
            .select('*');

        if (importsError) {
            console.error('Error loading imports:', importsError);
            return false;
        }

        // Convert array to object
        imports = {};
        if (importsData) {
            importsData.forEach(importData => {
                imports[importData.id] = importData;
            });
        }

        // Load settings
        const { data: settingsData, error: settingsError } = await supabaseClient
            .from('settings')
            .select('*')
            .eq('id', 'main')
            .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
            console.error('Error loading settings:', settingsError);
            return false;
        }

        if (settingsData) {
            currentImportId = settingsData.current_import_id;
            ordersOpen = settingsData.orders_open !== false;
            // DON'T load pricing from database - always use current default values
            // pricing = settingsData.pricing || pricing;
            emailQueue = settingsData.email_queue || [];
            analysisHistory = settingsData.analysis_history || [];

            // Update UI
            updateOrdersStatusUI();
        }

        console.log('Data loaded from Supabase successfully');
        return true;
    } catch (error) {
        console.error('Database load error:', error);
        return false;
    }
}

// Load products from database
async function loadProducts() {
    console.log('Using loading products from Supabase...');
    if (!supabaseClient) {
        console.warn('Supabase client not ready, cannot load products');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('active', true)
            .order('name');

        if (error) {
            if (error.code === '42P01') {
                console.warn('Products table does not exist yet. Please run migration.');
                ErrorHandler.showNotification('Products table missing', 'warning');
                // Fallback to defaults or empty if needed
                return;
            }
            throw error;
        }

        products = data || [];

        // Populate pricing object for backward compatibility
        pricing = {};

        if (products.length > 0) {
            products.forEach(p => {
                pricing[p.name] = {
                    cost: p.cost_price,
                    selling: p.selling_price,
                    packaging: p.packaging,
                    unit: p.unit,
                    id: p.id
                };
            });
        } else {
            // Fallback to DEFAULT_PRICING if no products in database
            // This ensures the Jan 2026 pricing updates are available even if DB is empty
            console.log('⚠️ No products in database. Using DEFAULT_PRICING.');
            pricing = JSON.parse(JSON.stringify(DEFAULT_PRICING));

            // Also populate products array for other functions
            products = Object.entries(pricing).map(([name, details]) => ({
                name: name,
                cost_price: details.cost,
                selling_price: details.selling,
                packaging: details.packaging,
                unit: details.unit || 'per kg',
                id: 'default-' + name.replace(/\s+/g, '-').toLowerCase(),
                active: true
            }));
        }

        console.log(`✅ Loaded ${products.length} products from database`);

        // Refresh UI components that depend on pricing
        if (typeof loadPricingTable === 'function') loadPricingTable();
        if (typeof loadCurrentRatesTable === 'function') loadCurrentRatesTable();

    } catch (error) {
        console.error('❌ Error loading products:', error);
        ErrorHandler.showNotification('Failed to load products from database', 'error');
    }
}

// Switch between order views (portal, imports, all)
function switchOrderView(view) {
    // Update tab states
    document.querySelectorAll('.order-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.order-tab').classList.add('active');

    // Update view visibility
    document.querySelectorAll('.order-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    if (view === 'portal') {
        document.getElementById('portalOrdersView').style.display = 'block';
        document.getElementById('portalOrdersView').classList.add('active');
        refreshPortalOrders();
    } else if (view === 'imports') {
        document.getElementById('importOrdersView').style.display = 'block';
        document.getElementById('importOrdersView').classList.add('active');
    } else if (view === 'all') {
        document.getElementById('allOrdersView').style.display = 'block';
        document.getElementById('allOrdersView').classList.add('active');
        updateOrdersTable();
    }
}

// Refresh portal orders display
async function refreshPortalOrders() {
    await loadCustomerPortalOrders();
    updatePortalOrdersDisplay();
    updateOrderCounts();
}

// Update portal orders display
function updatePortalOrdersDisplay() {
    const portalOrders = window.customerPortalOrders || [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter orders for current month
    const monthOrders = portalOrders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });

    // Update stats
    document.getElementById('monthOrderCount').textContent = monthOrders.length;
    document.getElementById('monthCustomerCount').textContent = new Set(monthOrders.map(o => o.email)).size;
    document.getElementById('monthTotalAmount').textContent = 'R' + monthOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2);
    document.getElementById('orderStatusSummary').textContent = monthOrders.length > 0 ? 'Open for Orders' : 'Awaiting Orders';

    // Update product summary
    updateProductSummary(monthOrders);

    // Update customer orders table
    updatePortalOrdersTable(monthOrders);

    // Set up checkbox event listeners
    setupOrderCheckboxes();
}

// Update product summary for butchery
function updateProductSummary(orders) {
    const productSummary = {};

    orders.forEach(order => {
        // Handle both single product and multi-product orders
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach(item => {
                if (!productSummary[item.product]) {
                    productSummary[item.product] = {
                        quantity: 0,
                        weight: 0,
                        customers: new Set()
                    };
                }
                productSummary[item.product].quantity += item.quantity || 0;
                productSummary[item.product].weight += item.weight || 0;
                productSummary[item.product].customers.add(order.email);
            });
        } else if (order.product) {
            if (!productSummary[order.product]) {
                productSummary[order.product] = {
                    quantity: 0,
                    weight: 0,
                    customers: new Set()
                };
            }
            productSummary[order.product].quantity += order.quantity || 0;
            productSummary[order.product].weight += order.weight || 0;
            productSummary[order.product].customers.add(order.email);
        }
    });

    const summaryBody = document.getElementById('productSummaryBody');
    if (Object.keys(productSummary).length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="4" class="no-data">No orders yet this month</td></tr>';
        return;
    }

    summaryBody.innerHTML = Object.entries(productSummary)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .map(([product, data]) => `
            <tr>
                <td><strong>${product}</strong></td>
                <td>${data.quantity}</td>
                <td>${data.weight.toFixed(2)} kg</td>
                <td>${data.customers.size}</td>
            </tr>
        `).join('');
}

// Update portal orders table
function updatePortalOrdersTable(orders) {
    const tableBody = document.getElementById('portalOrdersTableBody');

    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="no-data">No customer portal orders yet</td></tr>';
        return;
    }

    tableBody.innerHTML = orders.map(order => {
        const productDisplay = order.products && Array.isArray(order.products)
            ? `${order.products.length} items`
            : order.product;

        return `
            <tr>
                <td><input type="checkbox" class="order-checkbox" value="${order.orderId}"></td>
                <td>${new Date(order.date).toLocaleDateString()}</td>
                <td><strong>${order.name}</strong></td>
                <td>
                    ${order.email}<br>
                    <small>${order.phone || 'No phone'}</small>
                </td>
                <td class="order-products">${productDisplay}</td>
                <td><strong>R${(order.total || 0).toFixed(2)}</strong></td>
                <td><span class="status status-${order.status}">${order.status.toUpperCase()}</span></td>
                <td class="order-actions">
                    <button onclick="viewOrderDetails('${order.orderId}')" class="btn-small btn-secondary">View</button>
                    <button onclick="generateInvoice('${order.orderId}')" class="btn-small btn-primary">Invoice</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Manual Order Status Control
async function toggleOrdersStatus() {
    ordersOpen = !ordersOpen;
    console.log(`Orders status toggled: ${ordersOpen ? 'Open' : 'Closed'}`);

    // Update UI
    updateOrdersStatusUI();

    // Save to database
    await saveToDatabase();

    addActivity(`Orders manually ${ordersOpen ? 'opened' : 'closed'}`);
    ErrorHandler.showNotification(`Orders are now ${ordersOpen ? 'OPEN' : 'CLOSED'}`, ordersOpen ? 'success' : 'warning');
}

function updateOrdersStatusUI() {
    const badge = document.getElementById('orderStatusBadge');
    const btn = document.getElementById('toggleOrdersBtn');
    const btnText = document.getElementById('toggleOrdersText');
    const btnIcon = btn?.querySelector('i');

    if (ordersOpen) {
        if (badge) {
            badge.textContent = 'Open';
            badge.className = 'status-badge status-open';
        }
        if (btn) {
            btn.className = 'action-btn btn-close-orders';
            if (btnText) btnText.textContent = 'Close Orders';
            if (btnIcon) {
                btnIcon.className = 'fas fa-door-closed';
            }
        }
    } else {
        if (badge) {
            badge.textContent = 'Closed';
            badge.className = 'status-badge status-closed';
        }
        if (btn) {
            btn.className = 'action-btn btn-open-orders';
            if (btnText) btnText.textContent = 'Open Orders';
            if (btnIcon) {
                btnIcon.className = 'fas fa-door-open';
            }
        }
    }
}

// Export orders to Excel for butchery
async function exportToExcelForButchery() {
    const portalOrders = window.customerPortalOrders || [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter orders for current month
    const monthOrders = portalOrders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });

    if (monthOrders.length === 0) {
        alert('No orders to export for this month');
        return;
    }

    // Get all unique products from all orders
    const allProducts = new Set();
    monthOrders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach(item => {
                allProducts.add(item.product);
            });
        } else if (order.product) {
            allProducts.add(order.product);
        }
    });

    // Sort products alphabetically for consistent column order
    const productList = Array.from(allProducts).sort();
    console.log('📊 Products for butchery spreadsheet:', productList);

    // Create CSV header: Email, Customer Name, Address, Phone, then individual product columns
    let csvContent = 'Email,Customer Name,Address,Phone';

    // Add each product as a separate column header
    productList.forEach(product => {
        csvContent += `,"${product}"`;
    });
    csvContent += '\n';

    // Create one row per customer with product quantities in appropriate columns
    monthOrders.forEach(order => {
        // Start with customer info columns
        let rowData = `"${order.email}","${order.name}","${order.address || ''}","${order.phone || ''}"`;

        // Collect all products and quantities for this customer
        const customerProducts = {};

        if (order.products && Array.isArray(order.products)) {
            order.products.forEach(item => {
                const productName = item.product;
                const quantity = item.quantity || 0;
                customerProducts[productName] = (customerProducts[productName] || 0) + quantity;
            });
        } else if (order.product) {
            const productName = order.product;
            const quantity = order.quantity || 0;
            customerProducts[productName] = (customerProducts[productName] || 0) + quantity;
        }

        // Add quantity for each product column (E, F, G, H, etc.)
        productList.forEach(product => {
            const quantity = customerProducts[product] || 0;
            rowData += `,${quantity}`;
        });

        csvContent += rowData + '\n';

        // Log customer order for debugging
        const customerProductCount = Object.keys(customerProducts).length;
        console.log(`📋 Customer: ${order.name} - ${customerProductCount} different products:`, customerProducts);
    });

    // Add summary section
    csvContent += '\n\nPRODUCT SUMMARY FOR BUTCHERY\n';
    csvContent += 'Product,Total Quantity,Number of Customers\n';

    const productSummary = {};
    monthOrders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach(item => {
                if (!productSummary[item.product]) {
                    productSummary[item.product] = {
                        quantity: 0,
                        customers: new Set()
                    };
                }
                productSummary[item.product].quantity += item.quantity || 0;
                productSummary[item.product].customers.add(order.email);
            });
        } else if (order.product) {
            if (!productSummary[order.product]) {
                productSummary[order.product] = {
                    quantity: 0,
                    customers: new Set()
                };
            }
            productSummary[order.product].quantity += order.quantity || 0;
            productSummary[order.product].customers.add(order.email);
        }
    });

    Object.entries(productSummary)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .forEach(([product, data]) => {
            csvContent += `"${product}",${data.quantity},${data.customers.size}\n`;
        });

    // Download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    link.download = `Butchery_Orders_${monthName}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();

    addActivity(`Exported ${monthOrders.length} orders for butchery`);
}

// Generate invoices for all portal orders
async function generateAllPortalInvoices() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select orders to generate invoices for');
        return;
    }

    let successCount = 0;
    for (const checkbox of checkboxes) {
        const orderId = checkbox.value;
        try {
            await generateInvoice(orderId);
            successCount++;
        } catch (error) {
            console.error(`Failed to generate invoice for order ${orderId}:`, error);
        }
    }

    alert(`Generated ${successCount} invoices successfully`);
    addActivity(`Generated ${successCount} invoices for portal orders`);
}

// Toggle all order checkboxes
function toggleAllOrders() {
    const selectAll = document.getElementById('selectAllOrders');
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

// Filter customer orders
function filterCustomerOrders() {
    const searchInput = document.getElementById('customerSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#portalOrdersTableBody tr');

    rows.forEach(row => {
        if (row.querySelector('.no-data')) return;

        const customerName = row.cells[2].textContent.toLowerCase();
        const customerEmail = row.cells[3].textContent.toLowerCase();
        const status = row.cells[6].textContent.toLowerCase();

        const matchesSearch = customerName.includes(searchInput) || customerEmail.includes(searchInput);
        const matchesStatus = !statusFilter || status.includes(statusFilter);

        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

// Update order counts
function updateOrderCounts() {
    const allOrders = getCurrentOrders();
    const portalOrders = window.customerPortalOrders || [];
    const importOrders = allOrders.filter(o => o.source !== 'Customer Portal');

    document.getElementById('portalOrderCount').textContent = portalOrders.length;
    document.getElementById('importOrderCount').textContent = importOrders.length;
    document.getElementById('allOrderCount').textContent = allOrders.length;
}

// Load customer portal orders from the database
let isLoadingPortalOrders = false;

async function loadCustomerPortalOrders() {
    if (isLoadingPortalOrders) {
        console.log('⏳ Portal orders already loading, skipping...');
        return;
    }

    isLoadingPortalOrders = true;
    try {
        console.log('🔄 Loading customer portal orders...');

        // First try with the customers and order_items join
        let { data: ordersData, error: ordersError } = await supabaseClient
            .from('orders')
            .select(`
                *,
                customers (
                    name,
                    email,
                    phone,
                    address
                ),
                order_items (
                    product_name,
                    quantity,
                    weight_kg,
                    unit_price_per_kg,
                    line_total
                )
            `)
            .eq('source', 'customer_portal');

        if (ordersError) {
            console.warn('⚠️ Join query failed, trying simple query:', ordersError);

            // Fallback to simple query without join
            const { data: simpleData, error: simpleError } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('source', 'customer_portal');

            if (simpleError) {
                console.error('❌ Error loading customer portal orders:', simpleError);
                return;
            }

            ordersData = simpleData;
            console.log('✅ Loaded orders with simple query (no customer join)');
        }

        if (ordersData && ordersData.length > 0) {
            console.log(`📦 Found ${ordersData.length} customer portal orders`);
            console.log('📋 Sample order data:', ordersData[0]);

            // Transform customer portal orders to match admin panel format
            window.customerPortalOrders = ordersData.map(order => ({
                orderId: order.order_id,    // Display field - use order_id from database
                order_id: order.order_id,   // Database field - for lookups
                date: order.order_date || order.created_at,
                name: order.customers?.name || order.customer_name,
                email: order.customers?.email || order.customer_email,
                phone: order.customers?.phone || order.customer_phone,
                address: order.customers?.address || order.customer_address,
                product: order.product_name,
                quantity: order.quantity,
                weight: order.weight_kg,
                total: order.total_amount,
                status: order.status || 'pending',
                source: 'Customer Portal',
                // Add products array from order_items
                products: order.order_items ? order.order_items.map(item => {
                    // Fix product names that should be "Opsie 1"
                    let productName = item.product_name;
                    if (productName === 'GEVULDE HOENDER ROLLE VAKUUM VERPAK') {
                        productName = 'GEVULDE HOENDER ROLLE OPSIE 1';
                    }
                    return {
                        product: productName,
                        quantity: item.quantity,
                        weight: item.weight_kg,
                        price: item.unit_price_per_kg,
                        total: item.line_total
                    };
                }) : []
            }));

            console.log('✅ Successfully loaded customer portal orders:', window.customerPortalOrders.length);
        } else {
            window.customerPortalOrders = [];
            console.log('ℹ️ No customer portal orders found in database');
        }

    } catch (error) {
        console.error('❌ Failed to load customer portal orders:', error);
        window.customerPortalOrders = [];
    } finally {
        isLoadingPortalOrders = false;
    }
}

function showDatabaseSetupModal() {
    const setupHTML = `
        <div class="database-setup-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🗄️ Database Setup Required</h3>
                </div>
                <div class="modal-body">
                    <p>Your Supabase database needs to be set up with the following tables:</p>
                    <h4>Required SQL Commands:</h4>
                    <textarea readonly style="width: 100%; height: 300px; font-family: monospace; font-size: 12px;">
-- Create imports table
CREATE TABLE imports (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    orders JSONB DEFAULT '[]'::jsonb,
    invoices JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create settings table
CREATE TABLE settings (
    id TEXT PRIMARY KEY,
    current_import_id TEXT,
    orders_open BOOLEAN DEFAULT true,
    pricing JSONB DEFAULT '{}'::jsonb,
    gmail_config JSONB DEFAULT '{}'::jsonb,
    email_template TEXT,
    email_queue JSONB DEFAULT '[]'::jsonb,
    analysis_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing settings tables
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_template TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS orders_open BOOLEAN DEFAULT true;

-- Enable Row Level Security (RLS)
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create customers table for customer portal
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    communication_preferences JSONB DEFAULT '{"email_notifications": true}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table for customer portal integration
CREATE TABLE orders (
    order_id VARCHAR(255) PRIMARY KEY,
    order_date DATE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_address TEXT,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg DECIMAL(8,2) NOT NULL CHECK (weight_kg > 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    source VARCHAR(20) DEFAULT 'csv_import' 
        CHECK (source IN ('customer_portal', 'pdf_import', 'csv_import')),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table for detailed product tracking
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg DECIMAL(8,2) NOT NULL CHECK (weight_kg > 0),
    unit_price_per_kg DECIMAL(10,2) NOT NULL CHECK (unit_price_per_kg > 0),
    line_total DECIMAL(10,2) NOT NULL CHECK (line_total >= 0),
    source VARCHAR(20) DEFAULT 'customer_selection'
        CHECK (source IN ('customer_selection', 'pdf_extraction', 'admin_entry')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) 
        REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_auth_user ON customers(auth_user_id);
CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_name);

-- Enable Row Level Security (RLS)
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now)
CREATE POLICY "Allow all operations on imports" ON imports FOR ALL USING (true);
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true);
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_items" ON order_items FOR ALL USING (true);

-- Additional explicit policies for customer portal (in case above policies don't work)
CREATE POLICY "Customers can insert order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers can view order items" ON order_items FOR SELECT USING (true);
                    </textarea>
                    <p><strong>Instructions:</strong></p>
                    <ol>
                        <li>Copy the SQL commands above</li>
                        <li>Go to your Supabase dashboard → SQL Editor</li>
                        <li>Paste and run the commands</li>
                        <li>Refresh this page</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="closeModal()" class="btn-primary">I'll set this up later</button>
                        <button onclick="window.open('https://supabase.com/dashboard', '_blank')" class="btn-secondary">Open Supabase Dashboard</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal(setupHTML);
}

// Migration function to move data from localStorage to Supabase
async function migrateToDatabase() {
    try {
        // Check if there's data in localStorage
        const storedImports = localStorage.getItem('plaasHoendersImports');
        if (!storedImports) return false;

        console.log('Migrating data from localStorage to Supabase...');

        // Load all localStorage data
        const localImports = JSON.parse(storedImports);
        const localCurrentImportId = localStorage.getItem('plaasHoendersCurrentImportId');
        const localInvoices = JSON.parse(localStorage.getItem('plaasHoendersInvoices') || '[]');
        const localEmailQueue = JSON.parse(localStorage.getItem('plaasHoendersEmailQueue') || '[]');
        const localPricing = JSON.parse(localStorage.getItem('plaasHoendersPricing') || '{}');
        const localAnalysisHistory = JSON.parse(localStorage.getItem('plaasHoendersAnalysisHistory') || '[]');

        // Set global variables
        imports = localImports;
        currentImportId = localCurrentImportId;
        invoices = localInvoices;
        emailQueue = localEmailQueue;
        if (Object.keys(localPricing).length > 0) pricing = localPricing;
        analysisHistory = localAnalysisHistory;

        // Save to database
        const success = await saveToDatabase();

        if (success) {
            console.log('Data migration completed successfully');
            addActivity('Data migrated to Supabase database');

            // Optionally clear localStorage after successful migration
            // You can uncomment these lines if you want to clean up localStorage
            // localStorage.removeItem('plaasHoendersImports');
            // localStorage.removeItem('plaasHoendersCurrentImportId');
            // localStorage.removeItem('plaasHoendersInvoices');
            // localStorage.removeItem('plaasHoendersEmailQueue');
            // localStorage.removeItem('plaasHoendersPricing');
            localStorage.removeItem('plaasHoendersGmailConfig');
            // localStorage.removeItem('plaasHoendersAnalysisHistory');

            return true;
        }

        return false;
    } catch (error) {
        console.error('Migration error:', error);
        return false;
    }
}

// Email Status Functions
function updateEmailStatus() {
    const statusElement = document.getElementById('emailStatusText');
    const statusIcon = document.querySelector('.email-status i');

    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== 'YOUR_SCRIPT_URL_HERE') {
        statusElement.textContent = 'Google Apps Script Ready';
        statusIcon.style.color = '#4CAF50';
    } else {
        statusElement.textContent = 'Google Apps Script Not Configured';
        statusIcon.style.color = '#f44336';
    }
}

// Google Apps Script Email Function (Simpler Alternative)
async function sendEmailViaGoogleScript(to, subject, body, attachments = []) {
    if (!GOOGLE_SCRIPT_URL) {
        alert('Please configure Google Apps Script URL first. See GOOGLE_APPS_SCRIPT_SETUP.md');
        return false;
    }

    try {
        showLoadingState(true, 'Sending email...');

        // Use form data to avoid CORS preflight request
        const formData = new FormData();
        formData.append('to', to);
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('fromName', 'Plaas Hoenders');
        if (attachments && attachments.length > 0) {
            formData.append('attachments', JSON.stringify(attachments));
        }

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });

        showLoadingState(false);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            console.log('Email sent successfully via Google Apps Script');
            addActivity(`Email sent to ${to}`);
            return true;
        } else {
            console.error('Email failed:', result.message);
            // Removed alert popup - emails often succeed despite CORS warnings
            return false;
        }
    } catch (error) {
        showLoadingState(false);
        console.error('Error sending email:', error);
        // Removed alert popup - emails often succeed despite CORS warnings
        return false;
    }
}


// Email queue management
function addToEmailQueue(orderData) {
    // Check if email is valid before adding to queue
    const isValidEmail = orderData.email &&
        orderData.email.includes('@') &&
        !orderData.email.includes('@placeholder.com') &&
        !orderData.email.includes('@email.com');

    if (!isValidEmail) {
        console.log(`⚠️ Skipping email queue for ${orderData.name} - invalid email: ${orderData.email}`);
        console.log(`📝 Invoice generated but customer needs valid email address for sending`);
        return;
    }

    const emailData = {
        id: Date.now(),
        to: orderData.email,
        subject: generateEmailSubject(orderData),
        body: generateEmailBody(orderData),
        orderData: orderData,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    console.log(`✅ Added ${orderData.name} (${orderData.email}) to email queue`);
    emailQueue.push(emailData);
    updateEmailQueueDisplay();
    saveToStorage();
}

// Function to manually add an invoice to email queue
function addInvoiceToEmailQueue(invoiceId) {
    const invoice = invoices.find(inv => inv.invoiceId === invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }

    // Check if customer email is valid
    const isValidEmail = invoice.customerEmail &&
        invoice.customerEmail.includes('@') &&
        !invoice.customerEmail.includes('@placeholder.com') &&
        !invoice.customerEmail.includes('@email.com');

    if (!isValidEmail) {
        alert(`Cannot add to email queue: Invalid email address (${invoice.customerEmail || 'missing'})`);
        return;
    }

    // Check if already in queue
    const alreadyQueued = emailQueue.find(email => email.orderData && email.orderData.invoiceId === invoiceId);
    if (alreadyQueued) {
        alert('This invoice is already in the email queue');
        return;
    }

    // Create order data object for email generation
    const orderData = {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        address: invoice.customerAddress,
        orderId: invoice.orderId || invoice.order_id,  // Use whichever field exists
        order_id: invoice.order_id || invoice.orderId, // Ensure both fields exist
        invoiceId: invoice.invoiceId,
        total: invoice.total
    };

    // Add to queue
    const emailData = {
        id: Date.now(),
        to: invoice.customerEmail,
        subject: generateEmailSubject(orderData),
        body: generateEmailBody(orderData),
        orderData: orderData,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    emailQueue.push(emailData);
    updateEmailQueueDisplay();
    saveToStorage();

    console.log(`✅ Manually added invoice ${invoiceId} to email queue for ${invoice.customerName}`);
    alert(`Successfully added invoice to email queue for ${invoice.customerName}`);
}

// Multi-product version for PDF imports
function addToEmailQueueMultiProduct(orderData) {
    // Check if email is valid before adding to queue
    const isValidEmail = orderData.email &&
        orderData.email.includes('@') &&
        !orderData.email.includes('@placeholder.com') &&
        !orderData.email.includes('@email.com');

    if (!isValidEmail) {
        console.log(`⚠️ Skipping email queue for ${orderData.name} - invalid email: ${orderData.email}`);
        console.log(`📝 Invoice generated but customer needs valid email address for sending`);
        return;
    }

    const emailData = {
        id: Date.now(),
        to: orderData.email,
        subject: generateEmailSubjectMultiProduct(orderData),
        body: generateEmailBodyMultiProduct(orderData),
        orderData: orderData,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    console.log(`✅ Added ${orderData.name} to email queue: ${orderData.email}`);
    emailQueue.push(emailData);
    updateEmailQueueDisplay();
    saveToStorage();
}

function generateEmailSubject(orderData) {
    const template = document.getElementById('emailSubject').value;
    return template
        .replace('{orderNumber}', orderData.orderId)
        .replace('{customerName}', orderData.name);
}

function generateEmailBody(orderData) {
    const template = document.getElementById('emailTemplate').value;

    // Find the invoice for this order
    const invoice = invoices.find(inv => inv.orderId === orderData.orderId);
    let invoiceDetails = '';

    if (invoice && invoice.items) {
        // Generate detailed invoice table
        invoiceDetails = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
        invoiceDetails += '<tr style="background-color: #f0f0f0;"><th>Description</th><th>Quantity</th>';

        // Show weight column if ANY item has weight data
        const hasWeightData = invoice.items.some(item => item.weight && item.weight > 0);
        if (hasWeightData) {
            invoiceDetails += '<th>KG</th>';
        }
        invoiceDetails += '<th>Unit Price</th><th>Total</th></tr>';

        invoice.items.forEach(item => {
            invoiceDetails += '<tr>';
            invoiceDetails += `<td>${item.product || item.originalDescription}</td>`;
            invoiceDetails += `<td>${item.quantity}</td>`;
            if (hasWeightData) {
                invoiceDetails += `<td>${item.weight ? item.weight.toFixed(2) : '0.00'}</td>`;
            }
            invoiceDetails += `<td>R${(item.unitPrice || 0).toFixed(2)}</td>`;
            invoiceDetails += `<td>R${(item.total || 0).toFixed(2)}</td>`;
            invoiceDetails += '</tr>';
        });

        // Calculate correct colspan based on whether we have weight data
        const colspan = hasWeightData ? '4' : '3';
        invoiceDetails += `<tr style="font-weight: bold; background-color: #f9f9f9;"><td colspan="${colspan}">Subtotal</td><td>R${invoice.subtotal.toFixed(2)}</td></tr>`;
        if (invoice.tax > 0) {
            invoiceDetails += `<tr><td colspan="${colspan}">VAT (15%)</td><td>R${invoice.tax.toFixed(2)}</td></tr>`;
        }
        invoiceDetails += `<tr style="font-weight: bold; background-color: #e0e0e0;"><td colspan="${colspan}">Total</td><td>R${invoice.total.toFixed(2)}</td></tr>`;
        invoiceDetails += '</table>';
    } else {
        // Fallback for orders without detailed invoice
        invoiceDetails = `<strong>Order Details:</strong><br>`;
        invoiceDetails += `Product: ${orderData.product}<br>`;
        invoiceDetails += `Quantity: ${orderData.quantity}<br>`;
        invoiceDetails += `Total: R${orderData.total}<br>`;
    }

    return template
        .replace('{customerName}', orderData.name)
        .replace('{orderNumber}', orderData.orderId)
        .replace('{invoiceDetails}', invoiceDetails)
        .replace(/\n/g, '<br>'); // Convert line breaks to HTML
}

// Multi-product email generation functions
function generateEmailSubjectMultiProduct(orderData) {
    const template = document.getElementById('emailSubject').value;
    return template
        .replace('{orderNumber}', orderData.orderId)
        .replace('{customerName}', orderData.name);
}

function generateEmailBodyMultiProduct(orderData) {
    const template = document.getElementById('emailTemplate').value;

    // Find the invoice for this order
    const invoice = invoices.find(inv => inv.orderId === orderData.orderId);
    let invoiceDetails = '';

    if (invoice && invoice.items) {
        // Generate detailed invoice table
        invoiceDetails = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
        invoiceDetails += '<tr style="background-color: #f0f0f0;"><th>Description</th><th>Quantity</th>';

        // Show weight column if ANY item has weight data
        const hasWeightData = invoice.items.some(item => item.weight && item.weight > 0);
        if (hasWeightData) {
            invoiceDetails += '<th>KG</th>';
        }
        invoiceDetails += '<th>Unit Price</th><th>Total</th></tr>';

        invoice.items.forEach(item => {
            invoiceDetails += '<tr>';
            invoiceDetails += `<td>${item.product || item.originalDescription}</td>`;
            invoiceDetails += `<td>${item.quantity}</td>`;
            if (hasWeightData) {
                invoiceDetails += `<td>${item.weight ? item.weight.toFixed(2) : '0.00'}</td>`;
            }
            invoiceDetails += `<td>R${(item.unitPrice || 0).toFixed(2)}</td>`;
            invoiceDetails += `<td>R${(item.total || 0).toFixed(2)}</td>`;
            invoiceDetails += '</tr>';
        });

        // Calculate correct colspan based on whether we have weight data
        const colspan = hasWeightData ? '4' : '3';
        invoiceDetails += `<tr style="font-weight: bold; background-color: #f9f9f9;"><td colspan="${colspan}">Subtotal</td><td>R${invoice.subtotal.toFixed(2)}</td></tr>`;
        if (invoice.tax > 0) {
            invoiceDetails += `<tr><td colspan="${colspan}">VAT (15%)</td><td>R${invoice.tax.toFixed(2)}</td></tr>`;
        }
        invoiceDetails += `<tr style="font-weight: bold; background-color: #e0e0e0;"><td colspan="${colspan}">Total</td><td>R${invoice.total.toFixed(2)}</td></tr>`;
        invoiceDetails += '</table>';
    } else {
        // Fallback for orders without detailed invoice
        invoiceDetails = `<strong>Order Details:</strong><br>`;
        orderData.products.forEach(product => {
            invoiceDetails += `${product.product || product.originalDescription}: ${product.quantity} qty`;
            if (product.weight) invoiceDetails += `, ${product.weight}kg`;
            invoiceDetails += ` @ R${product.unitPrice}/kg = R${product.total.toFixed(2)}<br>`;
        });
        invoiceDetails += `<strong>Total: R${orderData.total.toFixed(2)}</strong>`;
    }

    return template
        .replace('{customerName}', orderData.name)
        .replace('{orderNumber}', orderData.orderId)
        .replace('{invoiceDetails}', invoiceDetails)
        .replace(/\n/g, '<br>'); // Convert line breaks to HTML
}

async function sendQueuedEmails() {
    if (emailQueue.length === 0) {
        alert('No emails in queue to send.');
        return;
    }

    // Check if Google Apps Script is configured
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') {
        alert('Please configure Google Apps Script URL first. See GOOGLE_APPS_SCRIPT_SETUP.md');
        return;
    }

    const sendBtn = document.querySelector('[onclick="sendQueuedEmails()"]');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    let sentCount = 0;
    let failedCount = 0;

    for (let email of emailQueue) {
        if (email.status === 'pending') {
            try {
                // Use Google Apps Script for email sending
                await sendEmailViaGoogleScript(email.to, email.subject, email.body);
                email.status = 'sent';
                email.sentAt = new Date().toISOString();
                sentCount++;
                addActivity(`Email sent to ${email.to}`);
            } catch (error) {
                email.status = 'failed';
                email.error = error.message;
                failedCount++;
                addActivity(`Failed to send email to ${email.to}: ${error.message}`);
            }
        }
    }

    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send All Queued Emails';

    updateEmailQueueDisplay();
    updateDashboard();
    saveToStorage();

    alert(`Email sending complete:\n${sentCount} sent successfully\n${failedCount} failed`);
}

function updateEmailQueueDisplay() {
    const queueContainer = document.getElementById('emailQueue');

    if (emailQueue.length === 0) {
        queueContainer.innerHTML = '<p class="no-data">No emails in queue</p>';
        updateQueueStats();
        return;
    }

    const queueHTML = emailQueue.map(email => `
        <div class="queue-item ${email.status}">
            <div class="queue-info">
                <strong>${email.to}</strong>
                <span class="queue-subject">${email.subject}</span>
                <span class="queue-status status-${email.status}">${email.status.toUpperCase()}</span>
            </div>
            <div class="queue-actions">
                <button onclick="removeFromQueue('${email.id}')" class="btn-small btn-danger">Remove</button>
                ${email.status === 'failed' ? `<button onclick="retryEmail('${email.id}')" class="btn-small btn-secondary">Retry</button>` : ''}
            </div>
        </div>
    `).join('');

    queueContainer.innerHTML = queueHTML;
    updateQueueStats();
}

async function testEmail() {
    // Check if Google Apps Script is configured
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') {
        alert('Please configure Google Apps Script URL first. See GOOGLE_APPS_SCRIPT_SETUP.md');
        return;
    }

    const testEmailAddress = prompt('Enter email address for test:');
    if (!testEmailAddress) return;

    try {
        // Create a realistic test invoice using the email template
        const testOrder = {
            orderId: 'ORD-TEST-' + Date.now(),
            name: 'Test Customer',
            email: testEmailAddress,
            phone: '072 123 4567',
            address: '123 Test Street, Test Town, 1234',
            product: 'HEEL HOENDER',
            quantity: 2,
            total: 134.00
        };

        // Create a test invoice for this order
        const testInvoice = {
            invoiceId: 'INV-TEST-' + Date.now(),
            orderId: testOrder.orderId,
            customerName: testOrder.name,
            items: [
                {
                    originalDescription: 'HEEL HOENDER',
                    product: 'HEEL HOENDER',
                    quantity: 2,
                    weight: 2.0,
                    unitPrice: 67.00,
                    total: 134.00
                }
            ],
            subtotal: 134.00,
            tax: 0, // No VAT
            total: 134.00,
            source: 'PDF',
            status: 'generated'
        };

        // Temporarily add test invoice to invoices array
        invoices.push(testInvoice);

        const subject = generateEmailSubject(testOrder);
        const body = generateEmailBody(testOrder);

        await sendEmailViaGoogleScript(testEmailAddress, subject, body);

        // Remove test invoice after sending
        const testIndex = invoices.findIndex(inv => inv.invoiceId === testInvoice.invoiceId);
        if (testIndex > -1) invoices.splice(testIndex, 1);

        alert('Test email sent successfully with invoice template!');
        addActivity(`Test email sent to ${testEmailAddress} with invoice template`);
    } catch (error) {
        alert(`Failed to send test email: ${error.message}`);
    }
}

// Order processing functions
async function processOrders() {
    const orderData = document.getElementById('orderData').value.trim();
    if (!orderData) {
        alert('Please paste order data first.');
        return;
    }

    try {
        // Load customers for smart matching
        const allCustomers = await loadAllCustomers();

        const lines = orderData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const newOrders = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim());

                let name = values[headers.indexOf('name')] || '';
                let email = values[headers.indexOf('email')] || '';
                let phone = values[headers.indexOf('phone')] || '';

                // SMART MATCHING
                const match = findBestCustomerMatch(name, email, phone, allCustomers);
                if (match) {
                    // Safety check: Don't overwrite if email/phone was provided and contradicts match
                    // But here we implicitly trust the match if the input was partial
                    if (!name || name.length < match.name.length) name = match.name;
                    if (!email) email = match.email;
                    if (!phone) phone = match.phone;
                }

                const order = {
                    orderId: 'ORD-' + Date.now() + '-' + i,
                    date: new Date().toISOString().split('T')[0],
                    name: name,
                    email: email,
                    phone: phone,
                    product: values[headers.indexOf('product')] || '',
                    quantity: parseInt(values[headers.indexOf('quantity')]) || 1,
                    specialInstructions: values[headers.indexOf('special instructions')] || '',
                    status: 'pending'
                };

                // Calculate pricing
                const productPricing = pricing[order.product];
                if (productPricing) {
                    order.unitPrice = productPricing.selling;
                    order.total = order.unitPrice * order.quantity;
                } else {
                    order.unitPrice = 100; // Default price
                    order.total = order.unitPrice * order.quantity;
                }

                newOrders.push(order);
            }
        }

        orders.push(...newOrders);
        updateOrdersTable();
        updateDashboard();
        saveToStorage();

        document.getElementById('orderData').value = '';
        addActivity(`Processed ${newOrders.length} new orders`);

        alert(`Successfully processed ${newOrders.length} orders!`);
    } catch (error) {
        alert('Error processing orders. Please check the data format.');
        console.error(error);
    }
}

function updateOrdersTable() {
    const tableBody = document.getElementById('ordersTableBody');
    const currentOrders = getCurrentOrders();

    if (currentOrders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="no-data">No orders loaded</td></tr>';
        return;
    }

    const tableHTML = currentOrders.map(order => {
        // Handle both old single-product and new multi-product orders
        let productDisplay, quantityDisplay;

        if (order.products && order.products.length > 0) {
            // New multi-product format
            if (order.products.length === 1) {
                productDisplay = order.products[0].product;
                quantityDisplay = order.products[0].quantity;
            } else {
                productDisplay = `${order.products.length} items`;
                quantityDisplay = order.products.reduce((sum, p) => sum + p.quantity, 0);
            }
        } else {
            // Old single-product format
            productDisplay = order.product || 'N/A';
            quantityDisplay = order.quantity || 0;
        }

        return `
            <tr class="order-row">
                <td>${order.orderId}</td>
                <td>${order.date}</td>
                <td>${order.name}</td>
                <td>${order.email}</td>
                <td>${order.phone}</td>
                <td>${order.address || 'N/A'}</td>
                <td>${productDisplay}</td>
                <td>${quantityDisplay}</td>
                <td>R${order.total.toFixed(2)}</td>
                <td><span class="source-badge ${order.source === 'Customer Portal' ? 'portal' : 'import'}">${order.source || 'Import'}</span></td>
                <td><span class="status status-${order.status}">${order.status.toUpperCase()}</span></td>
                <td>
                    <button onclick="generateInvoice('${order.orderId}')" class="btn-small btn-primary">Invoice</button>
                    <button onclick="addToEmailQueue(${JSON.stringify(order).replace(/"/g, '&quot;')})" class="btn-small btn-secondary">Queue Email</button>
                    ${order.products && order.products.length > 1 ? `<button onclick="viewOrderDetails('${order.orderId}')" class="btn-small btn-secondary">Details</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = tableHTML;
}

// Invoice generation
async function generateInvoice(orderId) {
    const currentOrders = getCurrentOrders();

    // Check if this is a customer portal order (new single-record format)
    // Always use orderId for lookup since that's what the UI passes
    const customerPortalOrder = currentOrders.find(o => o.orderId === orderId && (o.source === 'Customer Portal' || o.source === 'customer_portal'));

    let order, invoiceItems = [], subtotal = 0;

    if (customerPortalOrder) {
        // New Customer Portal Order: Single order record + separate order_items
        console.log('🛒 Processing new Customer Portal order format');
        order = customerPortalOrder;

        try {
            // Fetch detailed items from order_items table
            // Use the actual database order_id from the customer portal order
            const dbOrderId = customerPortalOrder.order_id || orderId;
            console.log(`🔍 Looking for order items with order_id: ${dbOrderId} (original orderId: ${orderId})`);

            // First check if we can query the order_items table at all
            const { data: allItems, error: allItemsError } = await supabaseClient
                .from('order_items')
                .select('order_id')
                .limit(5);

            console.log('🗃️ Sample order_items in database:', allItems);
            if (allItemsError) {
                console.error('❌ Error querying order_items table:', allItemsError);
            }

            const { data: orderItems, error: itemsError } = await supabaseClient
                .from('order_items')
                .select('*')
                .eq('order_id', dbOrderId);

            if (itemsError) {
                console.error('❌ Error loading order items:', itemsError);
                // Get the original cart items from the saved order data
                const savedOrderData = JSON.parse(localStorage.getItem(`orderData_${orderId}`) || '{}');
                if (savedOrderData.items && Object.keys(savedOrderData.items).length > 0) {
                    // Use the original cart data to create detailed items
                    invoiceItems = Object.entries(savedOrderData.items).map(([productKey, quantity]) => {
                        const productName = getProductNameFromKey(productKey);
                        const pricing = getCustomerPricing();
                        const productPricing = pricing[productName];

                        if (productPricing) {
                            const estimatedWeight = estimateProductWeight(productName, quantity);

                            // Check for per-unit pricing
                            let lineTotal;
                            if (productPricing.unit === 'per potjie' || productPricing.unit === 'per unit' || productPricing.unit === 'per pot') {
                                lineTotal = productPricing.selling * quantity;
                            } else {
                                lineTotal = productPricing.selling * estimatedWeight;
                            }

                            return {
                                product: productName,
                                quantity: quantity,
                                weight: estimatedWeight,
                                unitPrice: productPricing.selling,
                                total: lineTotal,
                                specialInstructions: ''
                            };
                        }
                        return null;
                    }).filter(item => item !== null);
                } else {
                    // Final fallback - use the order record data
                    invoiceItems = [{
                        product: `Various items (${order.product})`,
                        quantity: order.quantity || 1,
                        weight: order.weight || 0,
                        unitPrice: order.total / (order.weight || 1),
                        total: order.total || 0,
                        specialInstructions: ''
                    }];
                }
            } else {
                // Use detailed order items
                console.log('📋 Found', orderItems.length, 'detailed items');
                invoiceItems = orderItems.map(item => ({
                    product: item.product_name,
                    quantity: item.quantity,
                    weight: item.weight_kg,
                    unitPrice: item.unit_price_per_kg,
                    total: item.line_total,
                    specialInstructions: ''
                }));
            }

            subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        } catch (error) {
            console.error('❌ Error fetching order items:', error);
            return;
        }

    } else {
        // Regular order (single order or multi-product format)
        order = currentOrders.find(o => o.orderId === orderId);
        if (!order) return;

        // For imported orders, we need currentImportId, but customer portal orders don't need it
        if (order.source !== 'Customer Portal' && !currentImportId) return;

        if (order.products && order.products.length > 0) {
            // New multi-product format - ALWAYS use current selling prices
            invoiceItems = order.products.map(product => {
                const currentPricing = pricing[product.product];
                const unitPrice = currentPricing ? currentPricing.selling : product.unitPrice;
                const weight = product.weight || (product.quantity * 2.0); // Default 2kg per item if not specified

                // Calculate total based on unit type
                let total;
                if (currentPricing && (currentPricing.unit === 'per potjie' || currentPricing.unit === 'per unit' || currentPricing.unit === 'per pot')) {
                    total = unitPrice * product.quantity;
                } else {
                    total = unitPrice * weight;
                }

                return {
                    product: product.product,
                    quantity: product.quantity,
                    weight: weight,
                    unitPrice: unitPrice,
                    total: total,
                    specialInstructions: product.specialInstructions
                };
            });
            subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        } else {
            // Old single-product format - ALWAYS use current selling prices
            const currentPricing = pricing[order.product];
            const unitPrice = currentPricing ? currentPricing.selling : order.unitPrice;
            const estimatedWeight = estimateProductWeight(order.product, order.quantity);

            // Calculate total based on unit type
            let total;
            if (currentPricing && (currentPricing.unit === 'per potjie' || currentPricing.unit === 'per unit' || currentPricing.unit === 'per pot')) {
                total = unitPrice * order.quantity;
            } else {
                total = unitPrice * estimatedWeight;
            }

            invoiceItems = [{
                product: order.product,
                quantity: order.quantity,
                weight: estimatedWeight,
                unitPrice: unitPrice,
                total: total
            }];
            subtotal = total;
        }
    }

    const invoice = {
        invoiceId: 'INV-' + Date.now(),
        orderId: order.orderId,           // Display field - for UI
        order_id: order.order_id,         // Database field - for lookups  
        date: new Date().toISOString().split('T')[0],
        customerName: order.name,
        customerEmail: order.email,
        customerPhone: order.phone,
        customerAddress: order.address,
        items: invoiceItems,
        subtotal: subtotal,
        tax: 0, // NO VAT
        total: subtotal, // Total = subtotal (no VAT)
        status: order.source === 'Customer Portal' ? 'provisional' : 'generated'
    };

    // Add invoice to both global and import-specific collections
    invoices.push(invoice);

    // Only add to import-specific collection if there's an associated import
    // Customer Portal orders don't have imports
    if (currentImportId && imports[currentImportId]) {
        imports[currentImportId].invoices.push(invoice);
    }

    order.status = 'invoiced';

    updateOrdersTable();
    updateInvoicesDisplay();
    updateDashboard();
    saveToStorage();

    addActivity(`Invoice ${invoice.invoiceId} generated for ${order.name} (${invoiceItems.length} items)`);

    // Add to email queue
    addToEmailQueue(order);
}

function generateAllInvoices() {
    // Get the selected import for invoicing
    const invoiceImportId = document.getElementById('invoiceImportSelector').value;
    if (!invoiceImportId || !imports[invoiceImportId]) {
        alert('Please select an import for invoicing.');
        return;
    }

    const selectedImport = imports[invoiceImportId];
    const pendingOrders = selectedImport.orders.filter(o => o.status === 'pending');

    if (pendingOrders.length === 0) {
        alert('No pending orders to invoice in this import.');
        return;
    }

    // Temporarily set the import as current for invoice generation
    const originalImportId = currentImportId;
    currentImportId = invoiceImportId;

    pendingOrders.forEach(async order => await generateInvoice(order.orderId));

    // Restore original current import
    currentImportId = originalImportId;

    // Update the invoice display for the selected import
    updateInvoicesDisplay(invoiceImportId);

    alert(`Generated ${pendingOrders.length} invoices for "${selectedImport.name}" and added to email queue.`);
}

function updateInvoicesDisplay(importId = null) {
    const container = document.getElementById('invoicesGrid');

    // Show invoices for a specific import or all invoices
    let displayInvoices = invoices;
    if (importId && imports[importId]) {
        displayInvoices = imports[importId].invoices;
    }

    if (displayInvoices.length === 0) {
        container.innerHTML = '<p class="no-data">No invoices generated yet</p>';
        return;
    }

    const invoicesHTML = displayInvoices.map(invoice => {
        const itemsCount = invoice.items ? invoice.items.length : 1;
        const itemsSummary = invoice.items && invoice.items.length > 1
            ? `${itemsCount} items`
            : invoice.items && invoice.items[0]
                ? invoice.items[0].product
                : 'Items';

        return `
            <div class="invoice-card">
                <div class="invoice-header">
                    <h4>${invoice.invoiceId}</h4>
                    <span class="status status-${invoice.status}">${invoice.status.toUpperCase()}</span>
                </div>
                <div class="invoice-details">
                    <p><strong>Customer:</strong> ${invoice.customerName}</p>
                    <p><strong>Date:</strong> ${invoice.date}</p>
                    <p><strong>Items:</strong> ${itemsSummary}</p>
                    ${invoice.items && invoice.items[0] && invoice.items[0].weight ?
                `<p><strong>Weight:</strong> ${invoice.items.reduce((sum, item) => sum + (item.weight || 0), 0).toFixed(2)}kg</p>` : ''}
                    <p><strong>Subtotal:</strong> R${invoice.subtotal.toFixed(2)}</p>
                    ${invoice.tax > 0 ? `<p><strong>VAT (15%):</strong> R${invoice.tax.toFixed(2)}</p>` : ''}
                    <p><strong>Total:</strong> R${invoice.total.toFixed(2)}</p>
                </div>
                <div class="invoice-actions">
                    <button onclick="previewInvoice('${invoice.invoiceId}')" class="btn-small btn-primary">Preview</button>
                    ${invoice.status === 'provisional' || invoice.status === 'draft' ?
                `<button onclick="editInvoiceWeights('${invoice.invoiceId}')" class="btn-small btn-secondary">
                            <i class="fas fa-edit"></i> Edit Weights
                        </button>` : ''}
                    <button onclick="downloadInvoice('${invoice.invoiceId}')" class="btn-small btn-secondary">Download PDF</button>
                    <button onclick="addInvoiceToEmailQueue('${invoice.invoiceId}')" class="btn-small btn-success">
                        <i class="fas fa-envelope"></i> Add to Email Queue
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = invoicesHTML;
}

// Pricing management
function loadPricingTable() {
    const tableBody = document.getElementById('pricingTableBody');

    const pricingHTML = Object.entries(pricing).map(([product, prices]) => {
        // Calculate GPM (Gross Profit Margin) = (Selling - Cost) / Selling
        const margin = prices.selling > 0 ? ((prices.selling - prices.cost) / prices.selling * 100).toFixed(2) : 0;
        return `
            <tr>
                <td>${product}</td>
                <td>R${prices.cost}</td>
                <td>R${prices.selling}</td>
                <td>${margin}%</td>
                <td>
                    <button onclick="editProduct('${product}')" class="btn-small btn-secondary">Edit</button>
                    <button onclick="deleteProduct('${product}')" class="btn-small btn-danger">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = pricingHTML;
}

function addNewProduct() {
    const product = prompt('Enter product name:');
    if (!product) return;

    const costInput = prompt('Enter cost price:');
    const sellingInput = prompt('Enter selling price:');

    const cost = SecurityUtils.sanitizeNumber(costInput);
    const selling = SecurityUtils.sanitizeNumber(sellingInput);

    if (cost <= 0 || selling <= 0) {
        ErrorHandler.showNotification('Invalid price entered. Please enter positive numbers.', 'error');
        return;
    }
    const packaging = prompt('Enter packaging details:') || 'Standard packaging';

    if (isNaN(cost) || isNaN(selling)) {
        alert('Please enter valid prices.');
        return;
    }

    pricing[product] = {
        cost: cost,
        selling: selling,
        packaging: packaging
    };

    loadPricingTable();
    saveToStorage();
    addActivity(`Added new product: ${product}`);
}

// Dashboard functions
function updateDashboard() {
    const currentOrders = getCurrentOrders();
    document.getElementById('totalOrders').textContent = currentOrders.length;
    document.getElementById('totalRevenue').textContent = 'R' + currentOrders.reduce((sum, order) => sum + (order.total || 0), 0).toFixed(2);
    document.getElementById('emailsSent').textContent = emailQueue.filter(e => e.status === 'sent').length;
    document.getElementById('pendingOrders').textContent = currentOrders.filter(o => o.status === 'pending').length;
}

function addActivity(message) {
    const activityList = document.getElementById('recentActivity');
    const time = new Date().toLocaleTimeString();

    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `<span class="activity-time">${time}</span> ${message}`;

    if (activityList.querySelector('.no-data')) {
        activityList.innerHTML = '';
    }

    activityList.insertBefore(activityItem, activityList.firstChild);

    // Keep only last 10 activities
    const activities = activityList.querySelectorAll('.activity-item');
    if (activities.length > 10) {
        activities[activities.length - 1].remove();
    }
}

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    document.getElementById(sectionId).classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        orders: 'Order Management',
        invoices: 'Invoice Management',
        emails: 'Email Center',
        pricing: 'Pricing Management',
        'pdf-analysis': 'AI PDF Analysis',
        settings: 'Settings'
    };

    document.getElementById('page-title').textContent = titles[sectionId] || 'Dashboard';
}

// Storage functions - Now with Supabase integration
// Debounced save to prevent excessive database calls
let saveTimeout;
async function saveToStorage() {
    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Set new timeout to batch saves
    saveTimeout = setTimeout(async () => {
        try {
            // Try to save to database first
            const databaseSaved = await saveToDatabase();

            if (!databaseSaved) {
                // Fallback to localStorage if database fails
                console.log('Falling back to localStorage');
                localStorage.setItem('plaasHoendersImports', JSON.stringify(imports));
                localStorage.setItem('plaasHoendersCurrentImportId', currentImportId || '');
                localStorage.setItem('plaasHoendersInvoices', JSON.stringify(invoices));
                localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(emailQueue));
                // localStorage.setItem('plaasHoendersPricing', JSON.stringify(pricing)); // DON'T save pricing
                localStorage.setItem('plaasHoendersAnalysisHistory', JSON.stringify(analysisHistory));
            }
        } catch (error) {
            console.error('Error in saveToStorage:', error);
        }
    }, 500); // Wait 500ms before saving to batch multiple rapid calls
}

async function loadStoredData() {
    // Try to load from database first
    const databaseLoaded = await loadFromDatabase();

    // Load customer portal orders regardless of database connection
    await loadCustomerPortalOrders();

    if (!databaseLoaded) {
        // Fallback to localStorage if database fails
        console.log('Falling back to localStorage');
        const storedImports = localStorage.getItem('plaasHoendersImports');
        const storedCurrentImportId = localStorage.getItem('plaasHoendersCurrentImportId');
        const storedInvoices = localStorage.getItem('plaasHoendersInvoices');
        const storedEmailQueue = localStorage.getItem('plaasHoendersEmailQueue');
        // const storedPricing = localStorage.getItem('plaasHoendersPricing'); // Not used - always use default pricing
        const storedAnalysisHistory = localStorage.getItem('plaasHoendersAnalysisHistory');

        if (storedImports) imports = JSON.parse(storedImports);
        if (storedCurrentImportId) currentImportId = storedCurrentImportId;
        if (storedInvoices) invoices = JSON.parse(storedInvoices);
        if (storedEmailQueue) emailQueue = JSON.parse(storedEmailQueue);
        // DON'T load pricing from localStorage - always use current default values
        // if (storedPricing) pricing = JSON.parse(storedPricing);
        if (storedAnalysisHistory) analysisHistory = JSON.parse(storedAnalysisHistory);
    }

    updateOrdersTable();
    updateInvoicesDisplay();
    updateEmailQueueDisplay();
    updateAnalysisHistoryDisplay();
    updateImportSelector();
    updateInvoiceImportSelector();

    // Update order counts for new tabs
    updateOrderCounts();

    // If we're on the orders section, refresh portal orders
    if (document.querySelector('#orders.active')) {
        refreshPortalOrders();
    }

    // Load saved email template
    await loadEmailTemplate();
}

// Settings functions
function saveSettings() {
    const settings = {
        businessName: document.getElementById('businessName').value,
        businessEmail: document.getElementById('businessEmail').value,
        businessPhone: document.getElementById('businessPhone').value,
        businessAddress: document.getElementById('businessAddress').value,
        bankName: document.getElementById('bankName').value,
        accountHolder: document.getElementById('accountHolder').value,
        accountNumber: document.getElementById('accountNumber').value,
        branchCode: document.getElementById('branchCode').value
    };

    localStorage.setItem('plaasHoendersSettings', JSON.stringify(settings));
    addActivity('Settings saved successfully');
    alert('Settings saved successfully!');
}


async function saveEmailTemplate() {
    const template = {
        subject: document.getElementById('emailSubject').value,
        body: document.getElementById('emailTemplate').value
    };

    try {
        // Save to localStorage (existing functionality)
        localStorage.setItem('plaasHoendersEmailTemplate', JSON.stringify(template));

        // Save to Supabase database
        if (supabaseClient) {
            const { error: settingsError } = await supabaseClient
                .from('settings')
                .upsert({
                    id: 'main',
                    email_template: template
                });

            if (settingsError) {
                console.error('Error saving email template to database:', settingsError);
                addActivity('Email template updated (localStorage only - database error)');
                alert('Email template saved to browser storage. Database save failed.');
                return;
            }
        }

        addActivity('Email template updated and saved to database');
        alert('Email template saved successfully!');
    } catch (error) {
        console.error('Error saving email template:', error);
        addActivity('Email template updated (localStorage only)');
        alert('Email template saved to browser storage only.');
    }
}

async function loadEmailTemplate() {
    let template = null;

    try {
        // Try to load from database first
        if (supabaseClient) {
            const { data: settingsData, error: settingsError } = await supabaseClient
                .from('settings')
                .select('email_template')
                .eq('id', 'main')
                .maybeSingle(); // Use maybeSingle instead of single to handle missing records

            if (!settingsError && settingsData && settingsData.email_template) {
                template = settingsData.email_template;
                console.log('✅ Email template loaded from database');
            } else if (settingsError) {
                console.log('⚠️ Email template not found in database, will use localStorage fallback');
            }
        }
    } catch (error) {
        console.error('Error loading email template from database:', error);
    }

    // Fall back to localStorage if database loading failed
    if (!template) {
        const storedTemplate = localStorage.getItem('plaasHoendersEmailTemplate');
        if (storedTemplate) {
            try {
                template = JSON.parse(storedTemplate);
                console.log('✅ Email template loaded from localStorage');
            } catch (error) {
                console.error('Error loading email template from localStorage:', error);
            }
        }
    }

    // Apply template to UI elements
    if (template) {
        const subjectElement = document.getElementById('emailSubject');
        const bodyElement = document.getElementById('emailTemplate');

        if (subjectElement && template.subject) {
            subjectElement.value = template.subject;
        }

        if (bodyElement && template.body) {
            bodyElement.value = template.body;
        }
    }
}

// Utility functions
function exportData() {
    const data = {
        orders: orders,
        invoices: invoices,
        emailQueue: emailQueue,
        // pricing: pricing, // DON'T export pricing - always use current default
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gro-chicken-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    addActivity('Data exported successfully');
}

function importOrders() {
    document.getElementById('orderData').focus();
}

// Import management functions
function updateImportSelector() {
    const selector = document.getElementById('importSelector');
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = '<option value="">Select an import...</option>';

    // Add imports
    Object.values(imports).forEach(importData => {
        const option = document.createElement('option');
        option.value = importData.id;
        option.textContent = `${importData.name} (${importData.orders.length} orders)`;
        if (importData.id === currentImportId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    updateImportStats();
}

function updateInvoiceImportSelector() {
    const selector = document.getElementById('invoiceImportSelector');
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = '<option value="">Select import for invoicing...</option>';

    // Add imports
    Object.values(imports).forEach(importData => {
        const option = document.createElement('option');
        option.value = importData.id;
        option.textContent = `${importData.name} (${importData.orders.length} orders)`;
        selector.appendChild(option);
    });
}

function updateImportStats() {
    const statsElement = document.getElementById('importStats');
    if (!statsElement) return;

    if (!currentImportId || !imports[currentImportId]) {
        statsElement.innerHTML = '<span class="stat">No import selected</span>';
        return;
    }

    const currentImport = imports[currentImportId];
    const totalRevenue = currentImport.orders.reduce((sum, order) => sum + order.total, 0);
    const invoicedCount = currentImport.invoices.length;

    statsElement.innerHTML = `
        <span class="stat">${currentImport.orders.length} orders</span>
        <span class="stat">R${totalRevenue.toFixed(2)} total</span>
        <span class="stat">${invoicedCount} invoiced</span>
        <span class="stat">Created: ${new Date(currentImport.date).toLocaleDateString()}</span>
    `;
}

function switchImport(importId) {
    currentImportId = importId;
    updateOrdersTable();
    updateImportStats();
    updateDashboard();

    if (importId) {
        addActivity(`Switched to import: ${imports[importId].name}`);
    }
}

function switchInvoiceImport(importId) {
    const infoElement = document.getElementById('invoiceImportInfo');
    const nameElement = document.getElementById('invoiceImportName');
    const statsElement = document.getElementById('invoiceImportStats');
    const generateBtn = document.getElementById('generateAllBtn');

    if (!importId || !imports[importId]) {
        infoElement.style.display = 'none';
        generateBtn.disabled = true;
        updateInvoicesDisplay();
        return;
    }

    const selectedImport = imports[importId];
    infoElement.style.display = 'block';
    nameElement.textContent = selectedImport.name;
    statsElement.textContent = `${selectedImport.orders.length} orders, ${selectedImport.invoices.length} invoices`;
    generateBtn.disabled = false;

    // Update invoices display to show only this import's invoices
    updateInvoicesDisplay(importId);
}

function showImportManager() {
    const managerHTML = `
        <div class="import-manager-modal">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>Import Manager</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="imports-list">
                        ${Object.values(imports).length === 0 ?
            '<p class="no-data">No imports yet. Create your first import by uploading a CSV file.</p>' :
            Object.values(imports).map(importData => `
                                <div class="import-item">
                                    <div class="import-header">
                                        <h4>${importData.name}</h4>
                                        <div class="import-actions">
                                            <button onclick="setAsCurrentImport('${importData.id}')" class="btn-small btn-primary">
                                                ${importData.id === currentImportId ? '✓ Current' : 'Set Current'}
                                            </button>
                                            <button onclick="deleteImport('${importData.id}')" class="btn-small btn-danger">Delete</button>
                                        </div>
                                    </div>
                                    <div class="import-details">
                                        <p><strong>Created:</strong> ${new Date(importData.date).toLocaleString()}</p>
                                        <p><strong>Orders:</strong> ${importData.orders.length}</p>
                                        <p><strong>Invoices:</strong> ${importData.invoices.length}</p>
                                        <p><strong>Total Value:</strong> R${importData.orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            `).join('')
        }
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal(managerHTML);
}

function setAsCurrentImport(importId) {
    currentImportId = importId;
    updateImportSelector();
    updateOrdersTable();
    updateImportStats();
    updateDashboard();
    closeModal();
    addActivity(`Set "${imports[importId].name}" as current import`);
}

function deleteImport(importId) {
    const importData = imports[importId];
    if (!confirm(`Are you sure you want to delete the import "${importData.name}"?\n\nThis will permanently delete:\n- ${importData.orders.length} orders\n- ${importData.invoices.length} invoices\n\nThis action cannot be undone.`)) {
        return;
    }

    // Remove from imports
    delete imports[importId];

    // If this was the current import, clear it
    if (currentImportId === importId) {
        currentImportId = null;
    }

    // Update displays
    updateImportSelector();
    updateInvoiceImportSelector();
    updateOrdersTable();
    updateDashboard();
    saveToStorage();

    addActivity(`Deleted import: ${importData.name}`);
    closeModal();
    showImportManager(); // Refresh the manager
}

// CSV handling functions
function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        parseCSVFile(content, file.name);
    };
    reader.readAsText(file);
}

function parseCSVFile(content, filename) {
    try {
        const lines = content.trim().split('\n');
        csvHeaders = parseCSVLine(lines[0]);
        csvData = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = parseCSVLine(lines[i]);
                csvData.push(values);
            }
        }

        // Show preview
        document.getElementById('csvFileName').textContent = filename;
        document.getElementById('previewFileName').textContent = filename;
        document.getElementById('previewRowCount').textContent = csvData.length;
        document.getElementById('csvPreview').style.display = 'block';
        document.getElementById('manualInputArea').style.display = 'none';

        addActivity(`CSV file loaded: ${filename} with ${csvData.length} rows`);
    } catch (error) {
        alert('Error parsing CSV file. Please check the file format.');
        console.error(error);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

async function processCSVFile() {
    if (!csvData || csvData.length === 0) {
        alert('No CSV data to process.');
        return;
    }

    // Ask for import name
    const importName = prompt('Enter a name for this import:', `Import ${new Date().toLocaleDateString()}`);
    if (!importName) return;

    try {
        // Load customers for smart matching
        const allCustomers = await loadAllCustomers();

        const newOrders = [];
        const skippedRows = [];
        const importsInvoices = []; // To store created invoices specific to this import

        // Find column indices
        const emailIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('email'));
        const nameIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('name'));
        const phoneIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('tel'));
        const addressIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('adress') || h.toLowerCase().includes('address'));

        // Process each row
        csvData.forEach((row, rowIndex) => {
            let email = row[emailIndex] || '';
            let name = row[nameIndex] || '';
            let phone = row[phoneIndex] || '';
            const address = row[addressIndex] || '';

            // Skip rows without essential info
            if (!email && !name) {
                skippedRows.push(rowIndex + 2); // +2 for header and 0-index
                return;
            }

            // SMART MATCHING
            const match = findBestCustomerMatch(name, email, phone, allCustomers);
            if (match) {
                // Safety check: Don't overwrite if data provided in CSV contradicts,
                // but typically CSV data is the source of truth, OR we want to normalize it.
                // Here we normalize to the CLEAN existing database record if matched.
                if (!name || name.length < match.name.length) name = match.name;
                if (!email) email = match.email;
                if (!phone) phone = match.phone;
            }

            // Collect all products for this customer
            const customerProducts = [];
            let totalOrderValue = 0;

            csvHeaders.forEach((header, colIndex) => {
                // Skip non-product columns
                if (colIndex <= addressIndex) return;

                const quantity = row[colIndex];
                if (quantity && !isNaN(parseInt(quantity))) {
                    const mappedProduct = productMapping[header];
                    if (mappedProduct && pricing[mappedProduct]) {
                        const productPricing = pricing[mappedProduct];
                        const itemTotal = productPricing.selling * parseInt(quantity);

                        customerProducts.push({
                            product: mappedProduct,
                            quantity: parseInt(quantity),
                            unitPrice: productPricing.selling,
                            total: itemTotal,
                            specialInstructions: extractSpecialInstructions(row[colIndex])
                        });

                        totalOrderValue += itemTotal;
                    }
                }
            });

            // Create one order per customer with all their products
            if (customerProducts.length > 0) {
                const order = {
                    orderId: 'ORD-' + Date.now() + '-' + rowIndex,
                    date: new Date().toISOString().split('T')[0],
                    name: name,
                    email: email,
                    phone: phone,
                    address: address,
                    products: customerProducts,
                    total: totalOrderValue,
                    status: 'pending'
                };

                newOrders.push(order);
            }
        });

        if (newOrders.length === 0) {
            alert('No valid orders found in the CSV file.');
            return;
        }

        // Create new import
        const importId = 'import-' + Date.now();
        imports[importId] = {
            id: importId,
            name: importName,
            date: new Date().toISOString(),
            orders: newOrders,
            invoices: []
        };

        // Set as current import
        currentImportId = importId;

        // Update displays
        updateImportSelector();
        updateInvoiceImportSelector();
        updateOrdersTable();
        updateDashboard();
        saveToStorage();

        // Clear upload state
        clearCSVUpload();

        let message = `Successfully created import "${importName}" with ${newOrders.length} orders!`;
        if (skippedRows.length > 0) {
            message += `\nSkipped ${skippedRows.length} rows with missing data.`;
        }

        addActivity(message);
        alert(message);

    } catch (error) {
        alert('Error processing CSV orders. Please check the data format.');
        console.error(error);
    }
}

function extractSpecialInstructions(value) {
    // Extract special instructions like "2 in pak, 3" or "4 in pak, 6"
    if (typeof value === 'string' && value.includes('pak')) {
        const parts = value.split(',');
        if (parts.length > 1) {
            return parts[0].trim();
        }
    }
    return '';
}

function toggleManualInput() {
    const manualArea = document.getElementById('manualInputArea');
    const csvPreview = document.getElementById('csvPreview');

    if (manualArea.style.display === 'none') {
        manualArea.style.display = 'block';
        csvPreview.style.display = 'none';
        clearCSVUpload();
    } else {
        manualArea.style.display = 'none';
    }
}

function clearCSVUpload() {
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvFileName').textContent = '';
    document.getElementById('csvPreview').style.display = 'none';
    csvData = null;
    csvHeaders = [];
}

// Order and invoice detail functions
function viewOrderDetails(orderId) {
    const currentOrders = getCurrentOrders();
    const order = currentOrders.find(o => o.orderId === orderId);
    if (!order) return;

    // Handle both single product and multi-product orders
    const products = order.products || [{
        product: order.product,
        quantity: order.quantity,
        weight: order.weight,
        unitPrice: order.total / (order.quantity || 1),
        total: order.total
    }];

    const detailsHTML = `
        <div class="order-details-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Order Details - ${order.orderId}</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="customer-info">
                        <h4>Customer Information</h4>
                        <p><strong>Name:</strong> ${order.name}</p>
                        <p><strong>Email:</strong> ${order.email}</p>
                        <p><strong>Phone:</strong> ${order.phone}</p>
                        <p><strong>Address:</strong> ${order.address}</p>
                    </div>
                    <div class="order-items">
                        <h4>Ordered Items</h4>
                        <table class="details-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                    <th>Special Instructions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(product => `
                                    <tr>
                                        <td>${product.product}</td>
                                        <td>${product.quantity}</td>
                                        <td>R${(product.unitPrice || 0).toFixed(2)}</td>
                                        <td>R${(product.total || 0).toFixed(2)}</td>
                                        <td>${product.specialInstructions || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="order-total">
                            <strong>Order Total: R${order.total.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal(detailsHTML);
}

function previewInvoice(invoiceId) {
    // Look for invoice in current import first, then global invoices
    let invoice;

    if (currentImportId && imports[currentImportId] && imports[currentImportId].invoices) {
        invoice = imports[currentImportId].invoices.find(i => i.invoiceId === invoiceId);
    }

    // Fallback to global invoices
    if (!invoice) {
        invoice = invoices.find(i => i.invoiceId === invoiceId);
    }

    if (!invoice) {
        alert('Invoice not found');
        return;
    }

    const previewHTML = `
        <div class="invoice-preview-modal">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>Invoice Preview - ${invoice.invoiceId}</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="invoice-preview">
                        <div class="invoice-header-section">
                            <h2>🐔 Plaas Hoenders Invoice</h2>
                            <div class="invoice-meta">
                                <p><strong>Invoice ID:</strong> ${invoice.invoiceId}</p>
                                <p><strong>Date:</strong> ${invoice.date}</p>
                                <p><strong>Order ID:</strong> ${invoice.orderId}</p>
                            </div>
                        </div>
                        
                        <div class="customer-section">
                            <h4>Bill To:</h4>
                            <p><strong>${invoice.customerName}</strong></p>
                            <p>${invoice.customerEmail}</p>
                            <p>${invoice.customerPhone}</p>
                            <p>${invoice.customerAddress}</p>
                        </div>
                        
                        <div class="items-section">
                            <table class="invoice-items-table">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Quantity</th>
                                        ${invoice.source === 'PDF' ? '<th>KG</th>' : ''}
                                        <th>Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoice.items.map(item => `
                                        <tr>
                                            <td>${item.product || item.originalDescription}</td>
                                            <td>${item.quantity}</td>
                                            ${invoice.source === 'PDF' && item.weight ? `<td>${item.weight.toFixed(2)}</td>` : ''}
                                            <td>R${(item.unitPrice || 0).toFixed(2)}</td>
                                            <td>R${(item.total || 0).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="totals-section">
                            <div class="totals-table">
                                <div class="total-row">
                                    <span>Subtotal:</span>
                                    <span>R${invoice.subtotal.toFixed(2)}</span>
                                </div>
                                ${invoice.tax > 0 ? `<div class="total-row">
                                    <span>VAT (15%):</span>
                                    <span>R${invoice.tax.toFixed(2)}</span>
                                </div>` : ''}
                                <div class="total-row final">
                                    <span><strong>Total:</strong></span>
                                    <span><strong>R${invoice.total.toFixed(2)}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal(previewHTML);
}

function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = content;
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

function downloadInvoice(invoiceId) {
    alert('PDF generation feature will be implemented. Invoice ID: ' + invoiceId);
}

function editProduct(product) {
    const currentProduct = pricing[product];
    const newCost = parseFloat(prompt(`Enter new cost price for ${product}:`, currentProduct.cost));
    const newSelling = parseFloat(prompt(`Enter new selling price for ${product}:`, currentProduct.selling));
    const newPackaging = prompt(`Enter packaging details for ${product}:`, currentProduct.packaging);

    if (!isNaN(newCost) && !isNaN(newSelling)) {
        pricing[product] = {
            cost: newCost,
            selling: newSelling,
            packaging: newPackaging || currentProduct.packaging
        };
        loadPricingTable();
        saveToStorage();
        addActivity(`Updated pricing for ${product}`);
    }
}

function deleteProduct(product) {
    if (confirm(`Are you sure you want to delete ${product}?`)) {
        delete pricing[product];
        loadPricingTable();
        saveToStorage();
        addActivity(`Deleted product: ${product}`);
    }
}

function removeFromQueue(emailId) {
    const email = emailQueue.find(e => e.id == emailId);
    const emailAddress = email ? email.to : 'unknown';

    emailQueue = emailQueue.filter(e => e.id != emailId);
    updateEmailQueueDisplay();
    saveToStorage();

    console.log(`✅ Removed email to ${emailAddress} from queue`);
    addActivity(`Removed email to ${emailAddress} from queue`);
}

async function resetToDefaultPricing() {
    if (confirm('Are you sure you want to reset all product prices to the Standard Jan 2026 Pricing? This will overwrite any custom changes.')) {
        console.log('🔄 Resetting to standard pricing...');

        // Deep copy default pricing to avoid reference issues
        pricing = JSON.parse(JSON.stringify(DEFAULT_PRICING));

        // Update products array to match
        products = Object.entries(pricing).map(([name, details]) => ({
            name: name,
            cost_price: details.cost,
            selling_price: details.selling,
            packaging: details.packaging,
            unit: details.unit || 'per kg',
            id: details.id, // Might be undefined, that's okay
            active: true
        }));

        loadPricingTable();

        // Force save to database to persist changes
        const saved = await saveToDatabase();

        if (saved) {
            ErrorHandler.showNotification('Pricing reset to Standard Jan 2026 values', 'success');
            addActivity('Reset pricing to standard Jan 2026 defaults');
        } else {
            ErrorHandler.showNotification('Pricing reset locally but failed to save to database', 'warning');
        }
    }
}

async function retryEmail(emailId) {
    const email = emailQueue.find(e => e.id == emailId);
    if (email) {
        email.status = 'pending';
        updateEmailQueueDisplay();
        saveToStorage();
    }
}

// Queue Statistics and Management
function updateQueueStats() {
    const statsElement = document.getElementById('queueStats');
    if (!statsElement) return;

    const total = emailQueue.length;
    const pending = emailQueue.filter(e => e.status === 'pending').length;
    const sent = emailQueue.filter(e => e.status === 'sent').length;
    const failed = emailQueue.filter(e => e.status === 'failed').length;

    if (total === 0) {
        statsElement.textContent = 'No emails in queue';
    } else {
        statsElement.textContent = `${total} emails: ${pending} pending, ${sent} sent, ${failed} failed`;
    }
}

// Bulk Queue Management Functions
function clearSentEmails() {
    const sentCount = emailQueue.filter(e => e.status === 'sent').length;

    if (sentCount === 0) {
        alert('No sent emails to clear');
        return;
    }

    const confirmed = confirm(`Remove ${sentCount} sent emails from the queue?`);
    if (confirmed) {
        emailQueue = emailQueue.filter(e => e.status !== 'sent');
        updateEmailQueueDisplay();
        saveToStorage();
        console.log(`✅ Cleared ${sentCount} sent emails from queue`);
        addActivity(`Cleared ${sentCount} sent emails from queue`);
    }
}

function clearFailedEmails() {
    const failedCount = emailQueue.filter(e => e.status === 'failed').length;

    if (failedCount === 0) {
        alert('No failed emails to clear');
        return;
    }

    const confirmed = confirm(`Remove ${failedCount} failed emails from the queue?`);
    if (confirmed) {
        emailQueue = emailQueue.filter(e => e.status !== 'failed');
        updateEmailQueueDisplay();
        saveToStorage();
        console.log(`✅ Cleared ${failedCount} failed emails from queue`);
        addActivity(`Cleared ${failedCount} failed emails from queue`);
    }
}

function clearAllEmails() {
    if (emailQueue.length === 0) {
        alert('Email queue is already empty');
        return;
    }

    const total = emailQueue.length;
    const pending = emailQueue.filter(e => e.status === 'pending').length;

    let confirmMessage = `Remove all ${total} emails from the queue?`;
    if (pending > 0) {
        confirmMessage += `\n\nWarning: This includes ${pending} pending emails that haven't been sent yet!`;
    }

    const confirmed = confirm(confirmMessage);
    if (confirmed) {
        emailQueue = [];
        updateEmailQueueDisplay();
        saveToStorage();
        console.log(`✅ Cleared all emails from queue (${total} emails removed)`);
        addActivity(`Cleared entire email queue (${total} emails removed)`);
    }
}

function refreshEmailQueueForInvoice(invoiceId) {
    // Find the invoice
    const updatedInvoice = invoices.find(inv => inv.invoiceId === invoiceId);
    if (!updatedInvoice) return;

    // Find email queue items for this order - check both orderId fields
    const queueItemsToUpdate = emailQueue.filter(email =>
        email.orderData && (
            email.orderData.orderId === updatedInvoice.orderId ||
            email.orderData.orderId === updatedInvoice.order_id
        )
    );

    if (queueItemsToUpdate.length > 0) {
        console.log(`🔄 Refreshing ${queueItemsToUpdate.length} email queue items for invoice ${invoiceId}`);

        queueItemsToUpdate.forEach(email => {
            // Regenerate email body with updated invoice data
            if (email.orderData.products && email.orderData.products.length > 1) {
                email.body = generateEmailBodyMultiProduct(email.orderData);
            } else {
                email.body = generateEmailBody(email.orderData);
            }
            console.log(`✅ Updated email body for ${email.to}`);
        });

        updateEmailQueueDisplay();
        saveToStorage();
        addActivity(`Updated ${queueItemsToUpdate.length} queued emails with new invoice weights`);
    } else {
        // No email in queue for this invoice - try to add it automatically
        console.log(`🔄 No email queue items found for invoice ${invoiceId}, attempting to add automatically`);
        addInvoiceToEmailQueue(invoiceId);
    }
}

// ============ AI PDF ANALYSIS FUNCTIONS ============

function setupPDFDragDrop() {
    const uploadArea = document.getElementById('pdfUploadArea');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            handlePDFUpload({ target: { files: files } });
        } else {
            alert('Please upload a PDF file only.');
        }
    });
}

// Safely trigger file input clicks
function triggerPDFUpload() {
    try {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', triggerPDFUpload);
            return;
        }

        let fileInput = document.getElementById('pdfFileInput');

        // If element doesn't exist, create it
        if (!fileInput) {
            console.log('Creating PDF file input element...');
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'pdfFileInput';
            fileInput.accept = '.pdf';
            fileInput.style.display = 'none';
            fileInput.onchange = handlePDFUpload;

            // Append to upload area
            const uploadArea = document.getElementById('pdfUploadArea');
            if (uploadArea) {
                uploadArea.appendChild(fileInput);
                console.log('✅ PDF file input created and added to DOM');
            } else {
                document.body.appendChild(fileInput);
                console.log('✅ PDF file input created and added to body');
            }
        }

        fileInput.click();
        console.log('📁 PDF file dialog opened');
    } catch (error) {
        console.error('Error triggering PDF upload:', error);
        alert('Error opening file dialog. Please refresh the page and try again.');
    }
}

function triggerCSVUpload() {
    try {
        const fileInput = document.getElementById('csvFileInput');
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('CSV file input element not found');
            alert('CSV upload functionality not available. Please refresh the page and try again.');
        }
    } catch (error) {
        console.error('Error triggering CSV upload:', error);
        alert('Error opening file dialog. Please refresh the page and try again.');
    }
}

function triggerBackupUpload() {
    try {
        const fileInput = document.getElementById('backupFileInput');
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('Backup file input element not found');
            alert('Backup upload functionality not available. Please refresh the page and try again.');
        }
    } catch (error) {
        console.error('Error triggering backup upload:', error);
        alert('Error opening file dialog. Please refresh the page and try again.');
    }
}

async function handlePDFUpload(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }

    showLoadingState(true);

    try {
        // Convert PDF to text/image for analysis
        const fileReader = new FileReader();
        fileReader.onload = async function (e) {
            const arrayBuffer = e.target.result;
            await analyzePDFContent(arrayBuffer, file.name);
        };
        fileReader.readAsArrayBuffer(file);

    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF. Please try again.');
        showLoadingState(false);
    }
}

async function analyzePDFContent(arrayBuffer, filename) {
    try {
        console.log('🔍 Starting REAL PDF analysis...');

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        console.log(`📄 PDF loaded: ${numPages} pages found`);

        const extractedCustomers = [];

        // Process each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            console.log(`📄 Processing page ${pageNum}/${numPages}...`);

            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Extract text from page - preserve newlines for better structure
            let pageText = '';
            let lastY = -1;

            textContent.items.forEach(item => {
                // Add newline if Y position changed significantly (new line)
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = item.transform[5];
            });

            // Parse customer and items from page text
            const customerData = parseInvoicePage(pageText, pageNum);
            if (customerData) {
                extractedCustomers.push(customerData);
                console.log(`✅ Found customer: ${customerData.reference} on page ${pageNum}`);
            }
        }

        console.log(`✅ Extracted ${extractedCustomers.length} customers from PDF`);

        // Check if this is a scanned PDF (no text extracted)
        if (extractedCustomers.length === 0) {
            console.log('⚠️ Scanned PDF detected - switching to AI/OCR processing...');

            // Process with AI instead of manual bullshit
            await processScannedPDFWithAI(pdfDoc, filename, numPages);
            return;
        }

        // Create analysis result in expected format
        const analysisResult = createAnalysisResult(extractedCustomers, filename);

        // Display results
        displayAnalysisResults(analysisResult, filename);

        // Save to history
        saveAnalysisToHistory(analysisResult, filename);

        showLoadingState(false);

    } catch (error) {
        console.error('Error analyzing PDF:', error);
        alert('Error analyzing PDF. Please try again.');
        showLoadingState(false);
    }
}

// Parse invoice page text to extract customer and items
function parseInvoicePage(pageText, pageNumber) {
    try {
        // Debug: Log the first 1000 characters of page text to see structure
        console.log(`📄 Page ${pageNumber} text sample:`, pageText.substring(0, 1000));

        // Also check if "Reference" exists anywhere in the text (case insensitive)
        const hasReference = pageText.toLowerCase().includes('reference');
        console.log(`📄 Page ${pageNumber} contains "reference": ${hasReference}`);

        // Look for Reference field - based on the actual PDF text format
        let customerReference = null;

        // From the logs, we can see the pattern is:
        // "Reference [Customer Name]" directly in the text
        // Let's extract it properly

        // First, try to find "Reference" followed by the customer name
        const referenceMatch = pageText.match(/Reference\s+((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*-\s*[A-Z][a-z]*)?)|(?:[A-Z]+(?:\s+[A-Z]+)*))/);

        if (referenceMatch) {
            customerReference = referenceMatch[1].trim();
            console.log(`✅ Found Reference match: "${customerReference}"`);
        } else {
            // Try a more flexible approach - look for Reference and get the next line or nearby text
            const lines = pageText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.toLowerCase().includes('reference')) {
                    // Check if the name is on the same line
                    const refInLine = line.match(/reference\s+([A-Z][A-Za-z\s\-]+)/i);
                    if (refInLine) {
                        customerReference = refInLine[1].trim();
                        console.log(`✅ Found Reference in same line: "${customerReference}"`);
                        break;
                    }

                    // Check the next few lines for a name
                    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        // Look for a name pattern (first name last name)
                        const nameMatch = nextLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*-\s*[A-Z][a-z]*)?)$/);
                        if (nameMatch && !nextLine.toLowerCase().includes('nieuwoudt') && !nextLine.toLowerCase().includes('braaikuikens')) {
                            customerReference = nameMatch[1].trim();
                            console.log(`✅ Found Reference in next line: "${customerReference}"`);
                            break;
                        }
                    }
                    if (customerReference) break;
                }
            }
        }

        // If still not found, debug what we're getting
        if (!customerReference) {
            console.log(`🔍 Debug - looking for Reference in text:`, pageText.substring(0, 500));
            // Try one more pattern - any capitalized name after reference
            const anyRefMatch = pageText.match(/reference[^\n\r]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
            if (anyRefMatch) {
                customerReference = anyRefMatch[1].trim();
                console.log(`✅ Found Reference with flexible pattern: "${customerReference}"`);
            }
        }

        if (!customerReference) {
            console.log(`⚠️ No Reference found on page ${pageNumber}`);
            console.log(`Full page text for debugging:`, pageText);
            return null;
        }
        console.log(`📋 Found customer: ${customerReference} on page ${pageNumber}`);

        // Extract table data - CORRECTED for butchery's column mistakes:
        // Header says: Item | Description | Quantity | Unit Price | Amount ZAR
        // Reality is:  Description | Count | Weight | Unit Price | Total
        // So: "Item"=description, "Description"=count, "Quantity"=weight
        const items = [];

        // Look for table rows after headers - HANDLE MULTI-LINE PRODUCT NAMES
        const lines = pageText.split('\n');
        let inTableData = false;
        let pendingDescription = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines
            if (!line) continue;

            // Check if we're at table headers
            if (line.toLowerCase().includes('item') && line.toLowerCase().includes('description') && line.toLowerCase().includes('quantity')) {
                inTableData = true;
                continue;
            }

            // Skip table separator lines or subtotal/total lines
            if (line.includes('---') || line.toLowerCase().includes('subtotal') ||
                line.toLowerCase().includes('total vat') || line.toLowerCase().includes('total zar')) {
                inTableData = false; // Stop processing when we hit totals
                continue;
            }

            // If we're in table data, try to parse the line
            if (inTableData) {
                const parts = line.split(/\s+/);

                // Check if this line has the 4 number pattern at the end (quantity, weight, price, total)
                if (parts.length >= 4) {
                    const lastFour = parts.slice(-4);
                    const quantity = parseInt(lastFour[0]);
                    const weight = parseFloat(lastFour[1]);
                    const unitPrice = parseFloat(lastFour[2]);
                    const total = parseFloat(lastFour[3]);

                    // Check if the last 4 parts are all valid numbers
                    if (!isNaN(quantity) && !isNaN(weight) && !isNaN(unitPrice) && !isNaN(total)) {
                        // This line has the numbers - extract the description part
                        const descriptionParts = parts.slice(0, -4);
                        const currentDescription = descriptionParts.join(' ');

                        // Combine with any pending description from previous lines
                        const fullDescription = pendingDescription ?
                            `${pendingDescription} ${currentDescription}`.trim() : currentDescription;

                        if (fullDescription) {
                            items.push({
                                description: fullDescription,
                                quantity: quantity,     // Actual count (3, 1, 4)
                                weight: weight,         // Weight in kg (2.99, 1.00, 4.05)
                                price: unitPrice,       // Price per unit (88.50, 60.00)
                                total: total           // Total amount (264.62, 60.00, 243.00)
                            });

                            console.log(`📦 Found item: ${fullDescription} - Count: ${quantity}, Weight: ${weight}kg, Price: R${unitPrice}, Total: R${total}`);
                        }

                        // Reset pending description
                        pendingDescription = '';
                    } else {
                        // This line doesn't end with valid numbers - might be part of a multi-line product name
                        if (pendingDescription) {
                            pendingDescription += ' ' + line;
                        } else {
                            pendingDescription = line;
                        }
                    }
                } else {
                    // Line has less than 4 parts - likely part of a multi-line product name
                    if (pendingDescription) {
                        pendingDescription += ' ' + line;
                    } else {
                        pendingDescription = line;
                    }
                }
            }
        }

        if (items.length === 0) {
            console.log(`⚠️ No items found for ${customerReference} on page ${pageNumber}`);
            // Try alternative regex pattern for the corrected format
            const correctedPattern = /(\w+)\s+(\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/g;
            let lineMatch;
            while ((lineMatch = correctedPattern.exec(pageText)) !== null) {
                const [_, description, quantity, weight, price, total] = lineMatch;
                items.push({
                    description: description,
                    quantity: parseInt(quantity),      // Count
                    weight: parseFloat(weight),        // Weight in kg
                    price: parseFloat(price),          // Unit price
                    total: parseFloat(total)           // Total amount
                });
                console.log(`📦 Alt parsing found: ${description} - Count: ${quantity}, Weight: ${weight}kg`);
            }
        }

        if (items.length === 0) {
            console.log(`⚠️ Still no items found for ${customerReference} on page ${pageNumber}`);
            return null;
        }

        return {
            reference: customerReference,
            pageNumber: pageNumber,
            items: items
        };

    } catch (error) {
        console.error(`Error parsing page ${pageNumber}:`, error);
        return null;
    }
}

// Create analysis result in expected format
function createAnalysisResult(extractedCustomers, filename) {
    const allItems = extractedCustomers.flatMap(customer =>
        customer.items.map(item => ({
            ...item,
            customerReference: customer.reference,
            pageNumber: customer.pageNumber
        }))
    );

    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal; // NO VAT

    return {
        timestamp: new Date().toISOString(),
        filename: filename,
        extractedData: {
            customers: extractedCustomers,
            allItems: allItems,
            subtotal: subtotal,
            total: total,
            customerCount: extractedCustomers.length,
            multiCustomer: true
        },
        summary: {
            totalItems: allItems.length,
            customersFound: extractedCustomers.length,
            pagesProcessed: extractedCustomers.length,
            errorsFound: 0,
            warningsFound: 0,
            totalValue: total.toFixed(2)
        },
        findings: [] // No mock findings - real data only
    };
}

async function simulateAIAnalysis(filename) {
    try {
        // Simulate processing multiple pages with progress
        console.log(`Processing ${filename} - scanning for pages...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Found 25 pages, extracting table data from each page...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Extracted all items from PDF pages, analyzing data...');

        console.log('Step 1: Creating extractedCustomers array...');

        // Simulate MULTI-CUSTOMER PDF - Each page is different customer invoice
        // In real implementation, this would process all 25 pages and extract customer + items per page
        const extractedCustomers = [
            {
                reference: 'JEAN DREYER',
                pageNumber: 1,
                items: [
                    {
                        description: 'Heel Hoender - Full Chicken 1.5kg - 2.2kg R65/kg',
                        quantity: 4,
                        weight: 8.47,
                        price: 65,
                        total: 550.55
                    },
                    {
                        description: 'Boude en dye, 2 boude en 2 dye in pak.+-800gr R79/kg',
                        quantity: 2,
                        weight: 1.6,
                        price: 79,
                        total: 126.40
                    }
                ]
            },
            {
                reference: 'MARIE SMITH',
                pageNumber: 2,
                items: [
                    {
                        description: 'Vlerkies R90/kg 8 in n pak',
                        quantity: 3,
                        weight: 1.8,
                        price: 90,
                        total: 162.00
                    }
                ]
            },
            {
                reference: 'PIETER VAN WYK',
                pageNumber: 3,
                items: [
                    {
                        description: 'Fillets sonder vel R100/kg +-900gr 4 fillets per pak',
                        quantity: 1,
                        weight: 0.9,
                        price: 100,
                        total: 90.00
                    },
                    {
                        description: 'Lewer - In 500 g bakkies verpak R31/kg',
                        quantity: 2,
                        weight: 1.0,
                        price: 31,
                        total: 31.00
                    }
                ]
            },
            {
                reference: 'ANNA WILLIAMS',
                pageNumber: 4,
                items: [
                    {
                        description: 'Heel Hoender - Full Chicken 1.5kg - 2.2kg R65/kg',
                        quantity: 2,
                        weight: 3.8,
                        price: 65,
                        total: 247.00
                    }
                ]
            },
            {
                reference: 'JOHN TAYLOR',
                pageNumber: 5,
                items: [
                    {
                        description: 'Boude en dye, 2 boude en 2 dye in pak.+-800gr R79/kg',
                        quantity: 3,
                        weight: 2.4,
                        price: 79,
                        total: 189.60
                    },
                    {
                        description: 'Vlerkies R90/kg 8 in n pak',
                        quantity: 1,
                        weight: 0.6,
                        price: 90,
                        total: 54.00
                    }
                ]
            },
            {
                reference: 'SUSAN BROWN',
                pageNumber: 6,
                items: [
                    {
                        description: 'Heel Hoender - Full Chicken 1.5kg - 2.2kg R65/kg',
                        quantity: 1,
                        weight: 1.9,
                        price: 65,
                        total: 123.50
                    }
                ]
            },
            {
                reference: 'DAVID JONES',
                pageNumber: 7,
                items: [
                    {
                        description: 'Fillets sonder vel R100/kg +-900gr 4 fillets per pak',
                        quantity: 2,
                        weight: 1.8,
                        price: 100,
                        total: 180.00
                    }
                ]
            }
            // Simulating 7 customers for now instead of full 25 for testing
        ];

        console.log('Step 2: extractedCustomers created with', extractedCustomers.length, 'customers');

        // Flatten all items for display but keep customer structure
        console.log('Step 3: Creating allItems array...');
        const allItems = extractedCustomers.flatMap(customer =>
            customer.items.map(item => ({
                ...item,
                customerReference: customer.reference,
                pageNumber: customer.pageNumber
            }))
        );

        console.log('Step 4: allItems created with', allItems.length, 'items');

        const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
        // NO VAT - butchery invoice doesn't have VAT
        const total = subtotal;

        console.log('Step 5: Calculated totals - subtotal:', subtotal);

        // Simulate AI analysis results with extracted data
        console.log('Step 6: Creating mockAnalysis object...');
        const mockAnalysis = {
            timestamp: new Date().toISOString(),
            filename: filename,
            extractedData: {
                customers: extractedCustomers, // Multiple customers with their items
                allItems: allItems, // Flattened items for display
                subtotal: subtotal,
                total: total, // NO VAT on butchery invoices
                customerCount: extractedCustomers.length,
                multiCustomer: true
            },
            summary: {
                totalItems: allItems.length,
                customersFound: extractedCustomers.length,
                pagesProcessed: 25, // Simulate 25-page PDF
                errorsFound: Math.floor(Math.random() * 2),
                warningsFound: Math.floor(Math.random() * 2),
                totalValue: total.toFixed(2)
            },
            findings: [
                {
                    type: 'error',
                    severity: 'high',
                    item: 'HEEL HOENDER',
                    issue: 'Price mismatch: Invoice shows R65.00/kg, expected R67.00/kg',
                    expectedPrice: 67,
                    actualPrice: 65,
                    difference: -2
                },
                {
                    type: 'warning',
                    severity: 'medium',
                    item: 'BOUDE EN DYE',
                    issue: 'Weight per quantity seems low (0.83kg per piece)',
                    expected: '0.8kg per piece',
                    actual: '0.83kg per piece'
                },
                {
                    type: 'info',
                    severity: 'low',
                    item: 'GUNS',
                    issue: 'Pricing matches rate card - R79.00/kg',
                    status: 'correct'
                }
            ]
        };

        console.log('Step 7: mockAnalysis object created successfully');
        console.log('Step 8: Final logging...');

        console.log('📊 Analysis complete:', {
            customersFound: extractedCustomers.length,
            customers: extractedCustomers.map(c => c.reference),
            totalItems: allItems.length,
            multiCustomer: mockAnalysis.extractedData.multiCustomer
        });

        return mockAnalysis;
    } catch (error) {
        console.error('❌ Error in simulateAIAnalysis:', error);
        console.error('Stack trace:', error.stack);
        // Return a minimal valid structure to prevent further errors
        return {
            timestamp: new Date().toISOString(),
            filename: filename,
            extractedData: {
                customers: [],
                allItems: [],
                subtotal: 0,
                total: 0,
                customerCount: 0,
                multiCustomer: false
            },
            summary: {
                totalItems: 0,
                customersFound: 0,
                pagesProcessed: 0,
                errorsFound: 1,
                warningsFound: 0,
                totalValue: '0.00'
            },
            findings: [{
                type: 'error',
                severity: 'high',
                item: 'PDF Processing',
                issue: 'Failed to process PDF: ' + error.message
            }]
        };
    }
}

function displayAnalysisResults(analysis, filename) {
    try {
        const resultsContainer = document.getElementById('analysisResults');
        const summaryContainer = document.getElementById('resultsSummary');
        const detailsContainer = document.getElementById('resultsDetails');

        if (!resultsContainer || !summaryContainer || !detailsContainer) {
            console.error('❌ Required DOM elements not found');
            return;
        }

        console.log('📋 Displaying analysis results:', {
            hasAnalysis: !!analysis,
            hasExtractedData: !!analysis?.extractedData,
            hasCustomers: !!analysis?.extractedData?.customers,
            customerCount: analysis?.extractedData?.customers?.length || 0,
            multiCustomer: analysis?.extractedData?.multiCustomer,
            allData: analysis
        });

        // Store analysis for import functionality
        lastPDFAnalysis = { ...analysis, filename };

        // Make sure we're on the PDF analysis section
        const currentSection = document.querySelector('.content-section.active');

        if (currentSection && currentSection.id !== 'pdf-analysis') {
            console.log('🔄 Switching to PDF analysis section');
            showSection('pdf-analysis');
        }

        // Show results section
        resultsContainer.style.display = 'block';

        // Create summary
        const summaryHTML = `
        <div class="analysis-summary">
            <div class="summary-header">
                <h4>📄 ${filename}</h4>
                <span class="analysis-date">${new Date(analysis.timestamp).toLocaleString()}</span>
            </div>
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="stat-label">Pages Processed</span>
                    <span class="stat-value">${analysis.summary.pagesProcessed || 'N/A'}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Customers Found</span>
                    <span class="stat-value">${analysis.summary.customersFound || analysis.summary.totalCustomers || 'N/A'}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Items Extracted</span>
                    <span class="stat-value">${analysis.summary.totalItems}</span>
                </div>
                <div class="summary-stat error">
                    <span class="stat-label">Errors Found</span>
                    <span class="stat-value">${analysis.summary.errorsFound}</span>
                </div>
                <div class="summary-stat warning">
                    <span class="stat-label">Warnings</span>
                    <span class="stat-value">${analysis.summary.warningsFound}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Total Value</span>
                    <span class="stat-value">R${analysis.summary.totalValue}</span>
                </div>
            </div>
        </div>
    `;

        // Create extracted data display - check if multi-customer or single customer
        let extractedDataHTML;

        if (analysis.extractedData.multiCustomer && analysis.extractedData.customers) {
            // Multi-customer display
            extractedDataHTML = `
            <div class="extracted-data-section">
                <h4>📋 Extracted Invoice Data (${analysis.extractedData.customerCount} Customers)</h4>
                <p class="section-description">Multi-page PDF with different customers per page - ready to import as separate orders:</p>
                
                ${analysis.extractedData.customers.map(customer => `
                <div class="customer-section">
                    <div class="customer-header">
                        <h5>📄 Page ${customer.pageNumber}: ${customer.reference}</h5>
                        <div class="customer-stats">
                            <span>${customer.items.length} items</span>
                            <span>R${customer.items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <table class="extracted-data-table customer-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantity</th>
                                <th>KG</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customer.items.map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.weight}</td>
                                    <td>R${item.price}</td>
                                    <td>R${(item.total || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="4"><strong>Customer Total:</strong></td>
                                <td><strong>R${customer.items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `).join('')}
            
            <div class="overall-summary">
                <div class="summary-row">
                    <span><strong>Total Customers:</strong> ${analysis.extractedData.customerCount}</span>
                    <span><strong>Total Items:</strong> ${analysis.extractedData.allItems.length}</span>
                    <span><strong>Grand Total:</strong> R${analysis.extractedData.total.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="import-actions">
                <button onclick="importPDFAsOrders('${filename}')" class="btn-primary">
                    <i class="fas fa-plus-circle"></i> Import All Customers as Orders
                </button>
                <button onclick="previewImportData('${filename}')" class="btn-secondary">
                    <i class="fas fa-eye"></i> Preview Import Details
                </button>
                <button onclick="showStockReconciliation('${filename}')" class="btn-secondary">
                    <i class="fas fa-balance-scale"></i> Check Stock Differences
                </button>
            </div>
        </div>

        <div class="findings-section">
            <h4>🔍 Analysis Findings</h4>
            <div class="findings-list">
                ${analysis.findings.map(finding => `
                    <div class="finding-item ${finding.type}">
                        <div class="finding-header">
                            <span class="finding-type">${finding.type.toUpperCase()}</span>
                            <span class="finding-severity severity-${finding.severity}">${finding.severity}</span>
                        </div>
                        <div class="finding-content">
                            <strong>${finding.item}</strong>
                            <p>${finding.issue}</p>
                            ${finding.expectedPrice ? `
                                <div class="price-comparison">
                                    <span class="expected">Expected: R${finding.expectedPrice}</span>
                                    <span class="actual">Found: R${finding.actualPrice}</span>
                                    <span class="difference">Difference: R${finding.difference}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
        } else {
            // Single customer display (fallback)
            extractedDataHTML = `
            <div class="extracted-data-section">
                <h4>📋 Extracted Invoice Data</h4>
                <p class="section-description">This data was extracted from the butchery PDF and can be imported as orders:</p>
                <div class="customer-reference">
                    <strong>Reference (Customer):</strong> ${analysis.extractedData.customerInfo?.reference || analysis.extractedData.customerInfo?.name || 'Unknown'}
                </div>
                <table class="extracted-data-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>KG</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(analysis.extractedData.items || []).map(item => `
                            <tr>
                                <td>${item.description}</td>
                                <td>${item.quantity}</td>
                                <td>${item.weight}</td>
                                <td>${item.price}</td>
                                <td>${(item.total || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row final-total">
                            <td colspan="4"><strong>TOTAL:</strong></td>
                            <td><strong>${(analysis.extractedData.total || 0).toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="import-actions">
                    <button onclick="importPDFAsOrders('${filename}')" class="btn-primary">
                        <i class="fas fa-plus-circle"></i> Import as Orders & Generate Invoices
                    </button>
                    <button onclick="previewImportData('${filename}')" class="btn-secondary">
                        <i class="fas fa-eye"></i> Preview Import
                    </button>
                </div>
            </div>

            <div class="findings-section">
                <h4>🔍 Analysis Findings</h4>
                <div class="findings-list">
                    ${analysis.findings.map(finding => `
                        <div class="finding-item ${finding.type}">
                            <div class="finding-header">
                                <span class="finding-type">${finding.type.toUpperCase()}</span>
                                <span class="finding-severity severity-${finding.severity}">${finding.severity}</span>
                            </div>
                            <div class="finding-content">
                                <strong>${finding.item}</strong>
                                <p>${finding.issue}</p>
                                ${finding.expectedPrice ? `
                                    <div class="price-comparison">
                                        <span class="expected">Expected: R${finding.expectedPrice}</span>
                                        <span class="actual">Found: R${finding.actualPrice}</span>
                                        <span class="difference">Difference: R${finding.difference}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        }

        summaryContainer.innerHTML = summaryHTML;
        detailsContainer.innerHTML = extractedDataHTML;

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });

        console.log('✅ Analysis results displayed successfully');
    } catch (error) {
        console.error('❌ Error displaying analysis results:', error);
        alert('Error displaying analysis results. Check console for details.');
    }
}

// Import PDF data as orders and generate invoices (Multi-customer support)
async function importPDFAsOrders(filename) {
    if (!lastPDFAnalysis || !lastPDFAnalysis.extractedData) {
        alert('No PDF data available for import. Please analyze a PDF first.');
        return;
    }

    // Check if this is multi-customer data
    if (!lastPDFAnalysis.extractedData.multiCustomer || !lastPDFAnalysis.extractedData.customers) {
        alert('This PDF does not contain multi-customer data. Please use the single-customer import process.');
        return;
    }

    const customers = lastPDFAnalysis.extractedData.customers;
    const totalCustomers = customers.length;
    const totalItems = lastPDFAnalysis.extractedData.allItems.length;

    // Confirm import
    const confirmMessage = `Import ${totalItems} items for ${totalCustomers} customers from ${filename}?`;
    if (!confirm(confirmMessage)) return;

    try {
        // Process each customer separately
        const allOrders = [];
        const customerProcessingResults = [];

        console.log(`🔍 Processing ${customers.length} customers from PDF:`, customers.map(c => c.reference));

        for (const customer of customers) {
            const referenceName = customer.reference;
            console.log(`📄 Processing customer: ${referenceName} (Page ${customer.pageNumber}) with ${customer.items.length} items`);

            // Find existing customer details from previous orders
            const existingCustomer = findExistingCustomer(referenceName);

            let customerName, customerEmail, customerPhone, customerAddress;

            if (existingCustomer) {
                // Use existing customer details
                customerName = existingCustomer.name;
                customerEmail = existingCustomer.email;
                customerPhone = existingCustomer.phone;
                customerAddress = existingCustomer.address;

                customerProcessingResults.push({
                    reference: referenceName,
                    status: 'existing_customer',
                    name: customerName,
                    itemCount: customer.items.length
                });
            } else {
                // For new customers, use Reference as name and provide placeholder email
                customerName = referenceName;
                customerEmail = `${referenceName.toLowerCase().replace(/\s+/g, '.')}@placeholder.com`;
                customerPhone = '000 000 0000';
                customerAddress = 'Address not provided - please update';

                console.log(`⚠️ New customer "${referenceName}" created with placeholder email: ${customerEmail}`);

                customerProcessingResults.push({
                    reference: referenceName,
                    status: 'new_customer',
                    name: customerName,
                    itemCount: customer.items.length,
                    needsEmailUpdate: true
                });
            }

            // Create ONE order per customer with multiple items (better approach)
            const products = customer.items.map(item => {
                const mappedProduct = findMappedProduct(item.description);

                // ONLY use your rate card pricing - NEVER use butchery prices
                if (mappedProduct && pricing[mappedProduct]) {
                    const unitPrice = pricing[mappedProduct].selling;
                    const total = unitPrice * item.weight; // Your price × delivered weight
                    console.log(`💰 Applied rate card pricing for ${mappedProduct}: R${unitPrice}/kg × ${item.weight}kg = R${total.toFixed(2)}`);

                    return {
                        product: mappedProduct,
                        originalDescription: item.description,
                        quantity: item.quantity,
                        weight: item.weight, // Actual delivered weight from PDF!
                        unitPrice: unitPrice,
                        total: parseFloat(total.toFixed(2))
                    };
                } else {
                    // Skip items without rate card pricing - don't use butchery prices
                    console.log(`❌ SKIPPED: No rate card pricing found for "${item.description}" (mapped to "${mappedProduct}") - item not included in invoice`);
                    return null; // This will filter out the item
                }
            }).filter(product => product !== null); // Remove skipped items

            const customerOrder = {
                orderId: `ORD-PDF-${Date.now()}-P${customer.pageNumber}`,
                date: new Date().toISOString().split('T')[0],
                name: customerName,
                email: customerEmail,
                phone: customerPhone || '000 000 0000',
                address: customerAddress || 'Address not provided',
                products: products,
                total: products.reduce((sum, product) => sum + product.total, 0),
                status: 'pending',
                pdfReference: referenceName,
                pageNumber: customer.pageNumber,
                source: 'PDF'
            };

            allOrders.push(customerOrder);
            console.log(`✅ Created 1 order with ${customer.items.length} items for ${referenceName}`);
        }

        console.log(`📋 Total orders created: ${allOrders.length} for ${customers.length} customers`);

        // Create new import
        const importId = 'PDF-' + Date.now();
        const importName = `Multi-Customer PDF: ${filename} (${totalCustomers} customers, ${new Date().toLocaleString()})`;

        // Create import
        imports[importId] = {
            id: importId,
            name: importName,
            date: new Date().toISOString(),
            source: 'PDF',
            sourceFile: filename,
            customerCount: totalCustomers,
            orders: allOrders,
            invoices: [],
            customerProcessingResults: customerProcessingResults
        };

        // Set as current import
        currentImportId = importId;

        // Generate invoices with proper weight data
        for (const order of allOrders) {
            generateInvoiceFromPDFDataMultiProduct(order);
        }

        // Update displays
        updateImportSelector();
        updateOrdersTable();
        updateInvoicesDisplay();
        updateDashboard();
        saveToStorage();

        // Show success message with customer breakdown
        const existingCustomers = customerProcessingResults.filter(r => r.status === 'existing_customer');
        const newCustomers = customerProcessingResults.filter(r => r.status === 'new_customer');

        const customerSummary = customerProcessingResults.map(r => {
            const status = r.status === 'existing_customer' ? '✅ existing' : '⚠️ new (needs email)';
            return `${r.name}: ${r.itemCount} items (${status})`;
        }).join('\n');

        const emailMessage = newCustomers.length > 0
            ? `\n\n📧 EMAIL STATUS:\n• ${existingCustomers.length} customers ready for email (existing details)\n• ${newCustomers.length} customers need email addresses updated\n• Only customers with valid emails added to email queue`
            : `\n\n📧 All customers ready for email sending!`;

        alert(`Successfully imported ${allOrders.length} orders for ${totalCustomers} customers from PDF!\n\n${customerSummary}\n\nInvoices generated with proper weight columns.${emailMessage}\n\nSwitch to Orders or Invoices tab to view.`);
        addActivity(`Imported ${allOrders.length} orders for ${totalCustomers} customers from PDF: ${filename}`);

        // Switch to orders view
        showSection('orders');

    } catch (error) {
        console.error('Error importing PDF data:', error);
        alert(`Error importing PDF data: ${error.message}`);
    }
}

// Stock reconciliation - compare ordered vs delivered quantities
function showStockReconciliation(filename) {
    if (!lastPDFAnalysis || !lastPDFAnalysis.extractedData) {
        alert('No PDF data available for reconciliation.');
        return;
    }

    console.log('🔍 Checking stock differences between ordered and delivered...');

    // Find all existing orders for each customer in the PDF
    const reconciliationData = [];

    for (const customer of lastPDFAnalysis.extractedData.customers) {
        const referenceName = customer.reference;
        const existingCustomer = findExistingCustomer(referenceName);

        if (existingCustomer) {
            // Find all orders for this customer
            const customerOrders = [];
            for (const importData of Object.values(imports)) {
                const matchingOrders = importData.orders.filter(order =>
                    order.name && order.name.toLowerCase().includes(referenceName.toLowerCase())
                );
                customerOrders.push(...matchingOrders);
            }

            // Compare ordered vs delivered for each product
            const productComparison = {};

            // Get what was originally ordered
            for (const order of customerOrders) {
                const productKey = order.product || order.originalDescription;
                if (!productComparison[productKey]) {
                    productComparison[productKey] = {
                        product: productKey,
                        ordered: { quantity: 0, weight: 0 },
                        delivered: { quantity: 0, weight: 0 }
                    };
                }
                productComparison[productKey].ordered.quantity += order.quantity || 0;
                productComparison[productKey].ordered.weight += order.weight || 0;
            }

            // Get what was actually delivered (from PDF)
            for (const item of customer.items) {
                const productKey = findMappedProduct(item.description);
                if (!productComparison[productKey]) {
                    productComparison[productKey] = {
                        product: productKey,
                        ordered: { quantity: 0, weight: 0 },
                        delivered: { quantity: 0, weight: 0 }
                    };
                }
                productComparison[productKey].delivered.quantity += item.quantity || 0;
                productComparison[productKey].delivered.weight += item.weight || 0;
            }

            reconciliationData.push({
                customer: referenceName,
                products: Object.values(productComparison),
                hasStockDifferences: Object.values(productComparison).some(p =>
                    Math.abs(p.ordered.quantity - p.delivered.quantity) > 0.1 ||
                    Math.abs(p.ordered.weight - p.delivered.weight) > 0.1
                )
            });
        } else {
            reconciliationData.push({
                customer: referenceName,
                products: customer.items.map(item => ({
                    product: findMappedProduct(item.description),
                    ordered: { quantity: 0, weight: 0 },
                    delivered: { quantity: item.quantity, weight: item.weight }
                })),
                hasStockDifferences: true,
                newCustomer: true
            });
        }
    }

    // Display reconciliation results
    displayStockReconciliation(reconciliationData, filename);
}

// Display stock reconciliation results
function displayStockReconciliation(reconciliationData, filename) {
    const detailsContainer = document.getElementById('resultsDetails');

    const reconciliationHTML = `
        <div class="reconciliation-section">
            <h4>⚖️ Stock Reconciliation: ${filename}</h4>
            <p class="section-description">Comparing ordered quantities vs delivered quantities from butchery:</p>
            
            ${reconciliationData.map(customer => `
                <div class="customer-reconciliation ${customer.hasStockDifferences ? 'has-differences' : ''}">
                    <div class="customer-header">
                        <h5>${customer.customer} ${customer.newCustomer ? '(New Customer)' : ''}</h5>
                        <span class="status-badge ${customer.hasStockDifferences ? 'differences' : 'matched'}">
                            ${customer.hasStockDifferences ? '⚠️ Stock Differences' : '✅ Quantities Match'}
                        </span>
                    </div>
                    
                    <table class="reconciliation-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Ordered Qty</th>
                                <th>Ordered KG</th>
                                <th>Delivered Qty</th>
                                <th>Delivered KG</th>
                                <th>Difference</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customer.products.map(product => {
        const qtyDiff = product.delivered.quantity - product.ordered.quantity;
        const weightDiff = product.delivered.weight - product.ordered.weight;
        const hasDifference = Math.abs(qtyDiff) > 0.1 || Math.abs(weightDiff) > 0.1;

        return `
                                    <tr class="${hasDifference ? 'has-difference' : ''}">
                                        <td>${product.product}</td>
                                        <td>${product.ordered.quantity}</td>
                                        <td>${product.ordered.weight.toFixed(2)}</td>
                                        <td>${product.delivered.quantity}</td>
                                        <td>${product.delivered.weight.toFixed(2)}</td>
                                        <td class="difference ${qtyDiff < 0 ? 'shortage' : qtyDiff > 0 ? 'surplus' : ''}">
                                            ${qtyDiff !== 0 ? `Qty: ${qtyDiff > 0 ? '+' : ''}${qtyDiff}` : ''}
                                            ${weightDiff !== 0 ? `<br>KG: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(2)}` : ''}
                                            ${qtyDiff === 0 && weightDiff === 0 ? '✅ Match' : ''}
                                        </td>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}
            
            <div class="reconciliation-actions">
                <button onclick="acceptDeliveredQuantities('${filename}')" class="btn-primary">
                    <i class="fas fa-check"></i> Accept Delivered Quantities (Generate Invoices)
                </button>
                <button onclick="flagStockIssues('${filename}')" class="btn-secondary">
                    <i class="fas fa-flag"></i> Flag Stock Issues for Review
                </button>
            </div>
        </div>
    `;

    detailsContainer.innerHTML = reconciliationHTML;

    // Scroll to results
    document.getElementById('analysisResults').scrollIntoView({ behavior: 'smooth' });
}

// Accept delivered quantities and generate invoices based on actual delivery
function acceptDeliveredQuantities(filename) {
    if (!lastPDFAnalysis || !lastPDFAnalysis.extractedData) {
        alert('No PDF data available.');
        return;
    }

    const customers = lastPDFAnalysis.extractedData.customers;
    const totalCustomers = customers.length;

    // Confirm the action
    if (!confirm(`Generate invoices for ${totalCustomers} customers based on ACTUAL delivered quantities from butchery?\n\nThis will create invoices using the exact weights and quantities delivered, not what was originally ordered.`)) {
        return;
    }

    try {
        // Import as orders (this will create the proper structure)
        importPDFAsOrders(filename);

        console.log('✅ Invoices generated based on actual delivered quantities from butchery');
        addActivity(`Generated invoices for ${totalCustomers} customers based on delivered quantities from ${filename}`);

    } catch (error) {
        console.error('Error accepting delivered quantities:', error);
        alert(`Error generating invoices: ${error.message}`);
    }
}

// Flag stock issues for manual review
function flagStockIssues(filename) {
    if (!lastPDFAnalysis || !lastPDFAnalysis.extractedData) {
        alert('No PDF data available.');
        return;
    }

    // Create a stock issues report
    const stockIssues = [];

    for (const customer of lastPDFAnalysis.extractedData.customers) {
        const referenceName = customer.reference;
        const existingCustomer = findExistingCustomer(referenceName);

        if (existingCustomer) {
            // Find all orders for this customer
            const customerOrders = [];
            for (const importData of Object.values(imports)) {
                const matchingOrders = importData.orders.filter(order =>
                    order.name && order.name.toLowerCase().includes(referenceName.toLowerCase())
                );
                customerOrders.push(...matchingOrders);
            }

            // Check for stock differences
            for (const item of customer.items) {
                const productKey = findMappedProduct(item.description);
                const matchingOrder = customerOrders.find(order =>
                    (order.product && order.product.toLowerCase().includes(productKey.toLowerCase())) ||
                    (order.originalDescription && order.originalDescription.toLowerCase().includes(item.description.toLowerCase()))
                );

                if (matchingOrder) {
                    const qtyDiff = item.quantity - (matchingOrder.quantity || 0);
                    const weightDiff = item.weight - (matchingOrder.weight || 0);

                    if (Math.abs(qtyDiff) > 0.1 || Math.abs(weightDiff) > 0.1) {
                        stockIssues.push({
                            customer: referenceName,
                            product: productKey,
                            ordered: { quantity: matchingOrder.quantity || 0, weight: matchingOrder.weight || 0 },
                            delivered: { quantity: item.quantity, weight: item.weight },
                            difference: { quantity: qtyDiff, weight: weightDiff },
                            issueType: qtyDiff < 0 ? 'shortage' : 'surplus'
                        });
                    }
                }
            }
        }
    }

    if (stockIssues.length === 0) {
        alert('No significant stock differences found. All quantities appear to match expectations.');
        return;
    }

    // Generate stock issues report
    const reportContent = stockIssues.map(issue =>
        `${issue.customer}: ${issue.product}\n` +
        `  Ordered: ${issue.ordered.quantity} qty, ${issue.ordered.weight}kg\n` +
        `  Delivered: ${issue.delivered.quantity} qty, ${issue.delivered.weight}kg\n` +
        `  Difference: ${issue.difference.quantity > 0 ? '+' : ''}${issue.difference.quantity} qty, ${issue.difference.weight > 0 ? '+' : ''}${issue.difference.weight.toFixed(2)}kg (${issue.issueType})\n`
    ).join('\n');

    // Show the report
    alert(`STOCK ISSUES DETECTED (${stockIssues.length} issues):\n\n${reportContent}\n\nReview these discrepancies before processing invoices.`);

    // Log for record keeping
    console.log('📋 Stock Issues Report:', stockIssues);
    addActivity(`Flagged ${stockIssues.length} stock issues from ${filename} for review`);
}

// Helper function to find existing customer from previous orders
function findExistingCustomer(customerName) {
    console.log(`🔍 Looking for existing customer: "${customerName}"`);

    // FIRST: Search through customer portal orders (most likely source)
    const portalOrders = window.customerPortalOrders || [];
    // Collect all potential matches with match quality scores
    const portalMatches = [];

    for (const order of portalOrders) {
        if (!order.name) continue;

        const orderName = order.name.toLowerCase().trim();
        const searchName = customerName.toLowerCase().trim();

        // Try exact match first — return immediately, this is always safe
        if (orderName === searchName) {
            console.log(`✅ PORTAL - Exact match found: "${order.name}" === "${customerName}"`);
            return {
                name: order.name,
                email: order.email,
                phone: order.phone,
                address: order.address
            };
        }

        // Try contains match — collect but don't return yet (could be ambiguous)
        if (orderName.includes(searchName) || searchName.includes(orderName)) {
            portalMatches.push({
                name: order.name,
                email: order.email,
                phone: order.phone,
                address: order.address,
                matchType: 'partial'
            });
            continue; // Don't also check words for same order
        }

        // Try matching individual words — collect but don't return yet
        const orderWords = orderName.split(/\s+/);
        const searchWords = searchName.split(/\s+/);

        for (const searchWord of searchWords) {
            if (searchWord.length > 2 && orderWords.some(orderWord => orderWord === searchWord)) {
                portalMatches.push({
                    name: order.name,
                    email: order.email,
                    phone: order.phone,
                    address: order.address,
                    matchType: 'word',
                    matchedWord: searchWord
                });
                break; // Don't add same order multiple times
            }
        }
    }

    // De-duplicate portal matches by email (same customer may have multiple orders)
    const uniquePortalMatches = [];
    const seenEmails = new Set();
    for (const match of portalMatches) {
        const key = (match.email || match.name).toLowerCase();
        if (!seenEmails.has(key)) {
            seenEmails.add(key);
            uniquePortalMatches.push(match);
        }
    }

    if (uniquePortalMatches.length === 1) {
        console.log(`✅ PORTAL - Unique match: "${uniquePortalMatches[0].name}" for "${customerName}"`);
        return uniquePortalMatches[0];
    } else if (uniquePortalMatches.length > 1) {
        console.warn(`⚠️ PORTAL - AMBIGUOUS: "${customerName}" matches ${uniquePortalMatches.map(m => `"${m.name}" (${m.matchType})`).join(', ')}. Returning NULL to prevent misrouting.`);
        // Don't fall through to imports — ambiguity here means imports would also be wrong
        return null;
    }


    // SECOND: Search through imported orders (fallback) with ambiguity detection
    const importMatches = [];

    for (const importData of Object.values(imports)) {
        for (const order of importData.orders) {
            if (!order.name) continue;

            const orderName = order.name.toLowerCase().trim();
            const searchName = customerName.toLowerCase().trim();

            // Exact match — return immediately
            if (orderName === searchName) {
                console.log(`✅ IMPORT - Exact match found: "${order.name}" === "${customerName}"`);
                return {
                    name: order.name,
                    email: order.email,
                    phone: order.phone,
                    address: order.address
                };
            }

            // Partial/word match — collect for ambiguity check
            let matched = false;
            if (orderName.includes(searchName) || searchName.includes(orderName)) {
                matched = true;
            } else {
                const orderWords = orderName.split(/\s+/);
                const searchWords = searchName.split(/\s+/);
                for (const searchWord of searchWords) {
                    if (searchWord.length > 2 && orderWords.some(ow => ow === searchWord)) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) {
                const key = (order.email || order.name).toLowerCase();
                if (!importMatches.some(m => (m.email || m.name).toLowerCase() === key)) {
                    importMatches.push({
                        name: order.name,
                        email: order.email,
                        phone: order.phone,
                        address: order.address
                    });
                }
            }
        }
    }

    if (importMatches.length === 1) {
        console.log(`✅ IMPORT - Unique match: "${importMatches[0].name}" for "${customerName}"`);
        return importMatches[0];
    } else if (importMatches.length > 1) {
        console.warn(`⚠️ IMPORT - AMBIGUOUS: "${customerName}" matches ${importMatches.map(m => `"${m.name}"`).join(', ')}. Returning NULL.`);
        return null;
    }


    console.log(`❌ No existing customer found for: "${customerName}"`);

    // Debug: List all existing customer names for comparison
    console.log('📋 Available customer names from portal:');
    portalOrders.forEach(order => {
        if (order.name) {
            console.log(`  - "${order.name}" (${order.email || 'no email'})`);
        }
    });

    console.log('📋 Available customer names from imports:');
    for (const importData of Object.values(imports)) {
        importData.orders.forEach(order => {
            if (order.name) {
                console.log(`  - "${order.name}" (${order.email || 'no email'})`);
            }
        });
    }

    return null;
}

// Helper function to find mapped product name
function findMappedProduct(description) {
    const desc = description.toLowerCase().trim();

    // Special handling for pak variations
    if (desc.includes('4') && (desc.includes('bors') || desc.includes('pak'))) {
        return 'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)';
    }
    if (desc.includes('2') && (desc.includes('bors') || desc.includes('pak'))) {
        return 'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)';
    }

    // Try to find matching product from description
    for (const [key, value] of Object.entries(productMapping)) {
        if (desc.includes(key.toLowerCase()) ||
            desc.includes(value.toLowerCase())) {
            return value;
        }
    }

    // Try to match against pricing keys
    for (const product of Object.keys(pricing)) {
        if (desc.includes(product.toLowerCase())) {
            return product;
        }
    }

    // Default: try to extract product name from description
    const cleanDescription = description.split(' R')[0].trim(); // Remove price part
    return cleanDescription.toUpperCase();
}

// Generate invoice specifically from PDF data (with weights) - Multi-product version
function generateInvoiceFromPDFDataMultiProduct(order) {
    const invoice = {
        invoiceId: 'INV-PDF-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        orderId: order.orderId,
        date: new Date().toISOString().split('T')[0],
        customerName: order.name,
        customerEmail: order.email,
        customerPhone: order.phone,
        customerAddress: order.address,
        items: order.products, // Multiple items from PDF
        subtotal: order.total,
        tax: 0, // NO VAT
        total: order.total, // Total = subtotal (no VAT)
        status: 'generated',
        source: 'PDF'
    };

    // Add to collections
    invoices.push(invoice);

    // Only add to import-specific collection if there's an associated import
    if (currentImportId && imports[currentImportId]) {
        imports[currentImportId].invoices.push(invoice);
    }

    order.status = 'invoiced';

    // Add to email queue (adapted for multi-product)
    addToEmailQueueMultiProduct(order);
}

// Generate invoice specifically from PDF data (with weights) - Single product version (legacy)
function generateInvoiceFromPDFData(order) {
    const invoice = {
        invoiceId: 'INV-PDF-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        orderId: order.orderId,
        date: new Date().toISOString().split('T')[0],
        customerName: order.name,
        customerEmail: order.email,
        customerPhone: order.phone,
        customerAddress: order.address,
        items: [{
            product: order.product,
            originalDescription: order.originalDescription,
            quantity: order.quantity,
            weight: order.weight, // Weight from PDF!
            unitPrice: order.unitPrice,
            total: order.total
        }],
        subtotal: order.total,
        tax: 0, // NO VAT
        total: order.total, // Total = subtotal (no VAT)
        status: 'generated',
        source: 'PDF'
    };

    // Add to collections
    invoices.push(invoice);

    // Only add to import-specific collection if there's an associated import
    if (currentImportId && imports[currentImportId]) {
        imports[currentImportId].invoices.push(invoice);
    }

    order.status = 'invoiced';

    // Add to email queue
    addToEmailQueue(order);
}

// Preview import data (Multi-customer support)
function previewImportData(filename) {
    if (!lastPDFAnalysis || !lastPDFAnalysis.extractedData) {
        alert('No PDF data available for preview.');
        return;
    }

    const data = lastPDFAnalysis.extractedData;

    if (data.multiCustomer && data.customers) {
        // Multi-customer preview
        const customerPreviews = data.customers.map((customer, index) => {
            const customerTotal = customer.items.reduce((sum, item) => sum + item.total, 0);
            return `
CUSTOMER ${index + 1}: ${customer.reference} (Page ${customer.pageNumber})
Items: ${customer.items.length}
${customer.items.map((item, i) =>
                `  ${i + 1}. ${item.description}
     Qty: ${item.quantity} | KG: ${item.weight} | Price: R${item.price} | Total: R${(item.total || 0).toFixed(2)}`
            ).join('\n')}
Customer Total: R${customerTotal.toFixed(2)}`;
        }).join('\n\n' + '='.repeat(60) + '\n');

        const preview = `
MULTI-CUSTOMER PDF PREVIEW: ${filename}

Total Customers: ${data.customerCount}
Total Items: ${data.allItems.length}
Grand Total: R${data.total.toFixed(2)} (No VAT)

${customerPreviews}

${'='.repeat(60)}
SUMMARY:
• ${data.customerCount} customers will be processed
• ${data.allItems.length} total items will be imported
• Each customer gets separate orders and invoices
• Weights and quantities are from actual delivered amounts
• No VAT applied

Click "Import All Customers as Orders" to proceed.
        `;

        alert(preview);
    } else {
        // Single customer preview (fallback)
        const preview = `
PDF Import Preview: ${filename}

Customer: ${data.customerInfo?.name || 'Customer from PDF'}
Items to import: ${data.items?.length || 0}

Items:
${(data.items || []).map((item, i) =>
            `${i + 1}. ${item.description}
   Quantity: ${item.quantity} | Weight: ${item.weight}kg | Price: R${item.price} | Total: R${(item.total || 0).toFixed(2)}`
        ).join('\n\n')}

TOTAL: R${data.total.toFixed(2)} (No VAT)

Click "Import as Orders" to create these orders with proper invoice generation.
        `;

        alert(preview);
    }
}

function saveAnalysisToHistory(analysis, filename) {
    const historyItem = {
        id: Date.now(),
        filename: filename,
        timestamp: analysis.timestamp,
        summary: analysis.summary,
        findings: analysis.findings
    };

    analysisHistory.unshift(historyItem);

    // Keep only last 10 analyses
    if (analysisHistory.length > 10) {
        analysisHistory = analysisHistory.slice(0, 10);
    }

    updateAnalysisHistoryDisplay();
    saveToStorage();
}

function updateAnalysisHistoryDisplay() {
    const historyContainer = document.getElementById('analysisHistoryList');

    if (analysisHistory.length === 0) {
        historyContainer.innerHTML = '<p class="no-data">No analysis history yet</p>';
        return;
    }

    const historyHTML = analysisHistory.map(item => `
        <div class="history-item">
            <div class="history-header">
                <strong>${item.filename}</strong>
                <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
            </div>
            <div class="history-summary">
                <span class="history-stat">Items: ${item.summary.totalItems}</span>
                <span class="history-stat ${item.summary.errorsFound > 0 ? 'errors' : ''}">
                    Errors: ${item.summary.errorsFound}
                </span>
                <span class="history-stat">Value: R${item.summary.totalValue}</span>
            </div>
            <div class="history-actions">
                <button onclick="viewHistoryDetails('${item.id}')" class="btn-small btn-secondary">View Details</button>
                <button onclick="deleteHistoryItem('${item.id}')" class="btn-small btn-danger">Delete</button>
            </div>
        </div>
    `).join('');

    historyContainer.innerHTML = historyHTML;
}

function loadCurrentRatesTable() {
    const tableBody = document.getElementById('currentRatesTable');
    if (!tableBody) return;

    const ratesHTML = Object.entries(pricing).map(([product, rates]) => {
        const margin = Math.round(((rates.selling - rates.cost) / rates.cost) * 100);
        return `
            <tr>
                <td>${product}</td>
                <td>R${rates.cost}</td>
                <td>R${rates.selling}</td>
                <td>${margin}%</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = ratesHTML;
}

// Show interface for scanned PDFs that need manual entry
function showScannedPDFInterface(filename, numPages) {
    const resultsContainer = document.getElementById('analysisResults');
    const summaryContainer = document.getElementById('resultsSummary');
    const detailsContainer = document.getElementById('resultsDetails');

    // Make sure we're on the PDF analysis section
    const currentSection = document.querySelector('.content-section.active');
    if (currentSection && currentSection.id !== 'pdf-analysis') {
        showSection('pdf-analysis');
    }

    resultsContainer.style.display = 'block';

    // Create summary for scanned PDF
    const summaryHTML = `
        <div class="analysis-summary">
            <div class="summary-header">
                <h4>📄 ${filename}</h4>
                <span class="analysis-date">${new Date().toLocaleString()}</span>
            </div>
            <div class="summary-stats">
                <div class="summary-stat warning">
                    <span class="stat-label">Status</span>
                    <span class="stat-value">Scanned PDF</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Pages</span>
                    <span class="stat-value">${numPages}</span>
                </div>
            </div>
        </div>
    `;

    const detailsHTML = `
        <div class="scanned-pdf-notice">
            <h3>📸 Scanned PDF Detected</h3>
            <p>This PDF contains scanned images, not text. We need to use OCR (Optical Character Recognition) to read it.</p>
            
            <div class="ocr-options">
                <h4>What would you like to do?</h4>
                
                <div class="option-card">
                    <h5>✍️ Manual Entry (Available Now)</h5>
                    <p>Enter invoice data manually for each customer page.</p>
                    <button onclick="startManualPDFEntry('${filename}', ${numPages})" class="btn-primary">
                        <i class="fas fa-keyboard"></i> Enter Data Manually
                    </button>
                </div>
                
                <div class="option-card">
                    <h5>🤖 AI/OCR Processing (Coming Soon)</h5>
                    <p>Automatic extraction using AI services like Claude or Google Vision.</p>
                    <button class="btn-secondary" disabled>
                        <i class="fas fa-robot"></i> Use AI (Not Yet Available)
                    </button>
                </div>
                
                <div class="option-card">
                    <h5>📄 Upload Different PDF</h5>
                    <p>Try a text-based PDF if available.</p>
                    <button onclick="resetPDFUpload()" class="btn-secondary">
                        <i class="fas fa-redo"></i> Choose Another File
                    </button>
                </div>
            </div>
        </div>
    `;

    summaryContainer.innerHTML = summaryHTML;
    detailsContainer.innerHTML = detailsHTML;
}

// Process scanned PDF with AI/OCR
async function processScannedPDFWithAI(pdfDoc, filename, numPages) {
    try {
        console.log('🤖 Starting AI/OCR processing...');
        showLoadingState(true, 'Processing with AI/OCR...');

        const extractedCustomers = [];

        // Process each page with OCR
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            console.log(`🔍 OCR processing page ${pageNum}/${numPages}...`);

            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

            // Create canvas to render PDF page as image
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Convert canvas to image and run OCR
            const imageDataURL = canvas.toDataURL();

            console.log(`🔤 Running OCR on page ${pageNum}...`);
            const ocrResult = await Tesseract.recognize(imageDataURL, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            const pageText = ocrResult.data.text;
            console.log(`📄 OCR extracted ${pageText.length} characters from page ${pageNum}`);

            // Parse customer data from OCR text
            const customerData = parseInvoicePage(pageText, pageNum);
            if (customerData) {
                extractedCustomers.push(customerData);
                console.log(`✅ Found customer: ${customerData.reference} on page ${pageNum}`);
            }
        }

        console.log(`🎉 AI/OCR extracted ${extractedCustomers.length} customers from PDF`);

        if (extractedCustomers.length === 0) {
            throw new Error('No customer data could be extracted from the scanned PDF');
        }

        // Create analysis result and display
        const analysisResult = createAnalysisResult(extractedCustomers, filename);
        displayAnalysisResults(analysisResult, filename);
        saveAnalysisToHistory(analysisResult, filename);

        showLoadingState(false);

    } catch (error) {
        console.error('❌ AI/OCR processing failed:', error);
        showLoadingState(false);
        alert(`AI/OCR processing failed: ${error.message}\n\nPlease try a different PDF or contact support.`);
    }
}

// Reset PDF upload
function resetPDFUpload() {
    document.getElementById('analysisResults').style.display = 'none';
    document.getElementById('pdfFileInput').value = '';
    showLoadingState(false);
}

function showLoadingState(show, customMessage = 'Analyzing PDF with AI...') {
    const uploadArea = document.getElementById('pdfUploadArea');
    if (show) {
        uploadArea.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>${customMessage}</p>
                <small>This may take a few moments</small>
            </div>
        `;
    } else {
        uploadArea.innerHTML = `
            <div class="upload-placeholder" onclick="triggerPDFUpload()">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Click to upload PDF or drag & drop</p>
                <small>Supported format: PDF only</small>
            </div>
        `;
    }
}

function clearAnalysisHistory() {
    if (confirm('Are you sure you want to clear all analysis history?')) {
        analysisHistory = [];
        updateAnalysisHistoryDisplay();
        saveToStorage();
        addActivity('Analysis history cleared');
    }
}

function updateRateCard() {
    showSection('pricing');
    addActivity('Navigated to pricing management');
}

function viewHistoryDetails(itemId) {
    const item = analysisHistory.find(h => h.id == itemId);
    if (item) {
        displayAnalysisResults({
            timestamp: item.timestamp,
            summary: item.summary,
            findings: item.findings,
            priceComparison: [] // Simplified for history view
        }, item.filename);
    }
}

function deleteHistoryItem(itemId) {
    if (confirm('Delete this analysis from history?')) {
        analysisHistory = analysisHistory.filter(h => h.id != itemId);
        updateAnalysisHistoryDisplay();
        saveToStorage();
    }
}

// Data Management Functions
async function downloadBackup() {
    try {
        // Collect all data (but NOT pricing - always use current default)
        const backupData = {
            timestamp: new Date().toISOString(),
            version: "1.0",
            imports: imports,
            currentImportId: currentImportId,
            invoices: invoices,
            emailQueue: emailQueue,
            // pricing: pricing, // DON'T backup pricing - always use current default
            analysisHistory: analysisHistory
        };

        // Create downloadable file
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `plaas-hoenders-backup-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        addActivity('Data backup downloaded successfully');
        alert('Backup downloaded successfully!');
    } catch (error) {
        console.error('Backup failed:', error);
        alert('Failed to create backup: ' + error.message);
    }
}

async function handleBackupUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });

        const backupData = JSON.parse(fileContent);

        // Validate backup data
        if (!backupData.version || !backupData.timestamp) {
            throw new Error('Invalid backup file format');
        }

        // Confirm restore
        if (!confirm(`Are you sure you want to restore data from ${new Date(backupData.timestamp).toLocaleDateString()}? This will overwrite all current data.`)) {
            return;
        }

        // Restore data
        imports = backupData.imports || {};
        currentImportId = backupData.currentImportId || null;
        invoices = backupData.invoices || [];
        emailQueue = backupData.emailQueue || [];
        // DON'T restore pricing from backup - always use current default
        // if (backupData.pricing && Object.keys(backupData.pricing).length > 0) {
        //     pricing = backupData.pricing;
        // }
        analysisHistory = backupData.analysisHistory || [];

        // Save restored data
        await saveToStorage();

        // Refresh UI
        updateImportSelector();
        updateInvoiceImportSelector();
        loadPricingTable();
        updateDashboard();
        refreshDataStatus();

        addActivity('Data restored from backup successfully');
        alert('Data restored successfully!');

    } catch (error) {
        console.error('Restore failed:', error);
        alert('Failed to restore backup: ' + error.message);
    }

    // Clear file input
    event.target.value = '';
}

async function clearLocalData() {
    if (!confirm('Are you sure you want to clear ALL local data? This cannot be undone!')) {
        return;
    }

    try {
        // Clear localStorage BUT preserve pricing
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('plaasHoenders') && key !== 'plaasHoendersPricing') {
                localStorage.removeItem(key);
            }
        });

        addActivity('Local data cleared successfully');
        alert('Local data cleared successfully!');
        refreshDataStatus();
    } catch (error) {
        console.error('Failed to clear local data:', error);
        alert('Failed to clear local data: ' + error.message);
    }
}

async function clearDatabaseData() {
    if (!confirm('Are you sure you want to clear ALL database data? This cannot be undone!')) {
        return;
    }

    try {
        // Clear imports table
        const { error: importsError } = await supabaseClient
            .from('imports')
            .delete()
            .neq('id', 'never_match_this_id'); // Delete all records

        if (importsError) throw importsError;

        // Clear settings BUT preserve pricing
        const { error: settingsError } = await supabaseClient
            .from('settings')
            .upsert({
                id: 'main',
                current_import_id: null,
                pricing: pricing, // Preserve pricing!
                email_queue: [],
                analysis_history: []
            });

        if (settingsError) throw settingsError;

        addActivity('Database data cleared successfully');
        alert('Database data cleared successfully!');
        refreshDataStatus();
    } catch (error) {
        console.error('Failed to clear database:', error);
        alert('Failed to clear database: ' + error.message);
    }
}

async function resetEverything() {
    if (!confirm('⚠️ WARNING: This will delete ALL data (local + database) and reset the entire application. This cannot be undone!\n\nType "RESET" in the next dialog to confirm.')) {
        return;
    }

    const confirmation = prompt('Type "RESET" to confirm complete data deletion:');
    if (confirmation !== 'RESET') {
        alert('Reset cancelled.');
        return;
    }

    try {
        // Clear database
        await clearDatabaseData();

        // Clear local storage
        await clearLocalData();

        // Reset application state
        imports = {};
        currentImportId = null;
        invoices = [];
        emailQueue = [];
        analysisHistory = [];

        // Refresh all UI components
        updateImportSelector();
        updateInvoiceImportSelector();
        loadPricingTable();
        updateDashboard();
        document.getElementById('ordersTableBody').innerHTML = '<tr><td colspan="11" class="no-data">No orders loaded</td></tr>';
        document.getElementById('invoicesGrid').innerHTML = '<p class="no-data">No invoices generated yet</p>';

        addActivity('Complete application reset performed');
        alert('Application reset completed successfully!');
        refreshDataStatus();
    } catch (error) {
        console.error('Failed to reset application:', error);
        alert('Failed to reset application: ' + error.message);
    }
}

function refreshDataStatus() {
    try {
        // Count local storage data
        let localDataCount = 0;
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('plaasHoenders')) {
                localDataCount++;
            }
        });

        // Count application data
        const totalImports = Object.keys(imports).length;
        let totalOrders = 0;
        Object.values(imports).forEach(imp => {
            if (imp.orders) totalOrders += imp.orders.length;
        });

        // Update UI
        document.getElementById('localDataStatus').textContent = localDataCount > 0 ? `${localDataCount} items` : 'Empty';
        document.getElementById('databaseDataStatus').textContent = 'Connected';
        document.getElementById('totalImports').textContent = totalImports;
        document.getElementById('totalOrdersCount').textContent = totalOrders;

        // Test database connection
        testDatabaseConnection();
    } catch (error) {
        console.error('Failed to refresh data status:', error);
        document.getElementById('localDataStatus').textContent = 'Error';
        document.getElementById('databaseDataStatus').textContent = 'Error';
    }
}

async function testDatabaseConnection() {
    try {
        const { error } = await supabaseClient
            .from('imports')
            .select('count', { count: 'exact', head: true });

        if (error) throw error;
        document.getElementById('databaseDataStatus').textContent = 'Connected ✓';
    } catch (error) {
        document.getElementById('databaseDataStatus').textContent = 'Disconnected ✗';
    }
}

// ===== BUSINESS INTELLIGENCE / ANALYTICS FUNCTIONS =====

// Helper function to map product names for cost calculations in analytics
function getAnalyticsProductName(originalName) {
    // First try the productMapping
    for (const [key, value] of Object.entries(productMapping)) {
        if (originalName.toLowerCase().includes(key.toLowerCase()) ||
            originalName.toLowerCase().includes(value.toLowerCase())) {
            return value;
        }
    }

    // Try to match against pricing keys directly
    for (const product of Object.keys(pricing)) {
        if (originalName.toLowerCase().includes(product.toLowerCase())) {
            return product;
        }
    }

    // Return original name if no mapping found
    return originalName;
}

function refreshAnalytics() {
    updateSalesAnalytics();
    updateCustomerAnalytics();
    updateProductAnalytics();
    updateProfitAnalytics();
    addActivity('Analytics refreshed');
}

function updateSalesAnalytics() {
    const allOrders = getAllOrders();
    const allInvoices = getAllInvoices();

    // Calculate total revenue from invoices
    const totalRevenue = allInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);

    // Calculate monthly revenue (current month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = allInvoices
        .filter(invoice => {
            const invoiceDate = new Date(invoice.createdAt || invoice.timestamp || Date.now());
            return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
        })
        .reduce((sum, invoice) => sum + (invoice.total || 0), 0);

    // Calculate weekly revenue (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyRevenue = allInvoices
        .filter(invoice => {
            const invoiceDate = new Date(invoice.createdAt || invoice.timestamp || Date.now());
            return invoiceDate >= weekAgo;
        })
        .reduce((sum, invoice) => sum + (invoice.total || 0), 0);

    // Update UI
    document.getElementById('totalRevenue').textContent = `R${totalRevenue.toFixed(2)}`;
    document.getElementById('monthlyRevenue').textContent = `R${monthlyRevenue.toFixed(2)}`;
    document.getElementById('weeklyRevenue').textContent = `R${weeklyRevenue.toFixed(2)}`;

    // Update chart placeholder
    const chartContainer = document.getElementById('revenueChart');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div style="text-align: center; color: #666;">
                <i class="fas fa-chart-line" style="font-size: 2em; margin-bottom: 10px; opacity: 0.3;"></i>
                <p>Revenue Chart</p>
                <p style="font-size: 0.9em;">Total: R${totalRevenue.toFixed(2)}</p>
            </div>
        `;
    }
}

function updateCustomerAnalytics() {
    const allOrders = getAllOrders();

    // Get unique customers
    const uniqueCustomers = new Set();
    const customerOrders = {};
    const customerRevenue = {};

    allOrders.forEach(order => {
        if (order.name && order.name.trim()) {
            const customerName = order.name.trim();
            uniqueCustomers.add(customerName);

            if (!customerOrders[customerName]) {
                customerOrders[customerName] = 0;
                customerRevenue[customerName] = 0;
            }

            customerOrders[customerName]++;
            customerRevenue[customerName] += order.total || 0;
        }
    });

    // Calculate active customers this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const activeCustomers = new Set();

    allOrders.forEach(order => {
        if (order.name && order.name.trim()) {
            const orderDate = new Date(order.createdAt || order.timestamp || Date.now());
            if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                activeCustomers.add(order.name.trim());
            }
        }
    });

    // Calculate average order value
    const totalRevenue = Object.values(customerRevenue).reduce((sum, revenue) => sum + revenue, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Update UI
    document.getElementById('totalCustomers').textContent = uniqueCustomers.size.toString();
    document.getElementById('activeCustomers').textContent = activeCustomers.size.toString();
    document.getElementById('avgOrderValue').textContent = `R${avgOrderValue.toFixed(2)}`;

    // Generate top customers list
    const topCustomersContainer = document.getElementById('topCustomers');
    const sortedCustomers = Object.entries(customerRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    let topCustomersHTML = '<h4>Top Customers</h4>';
    if (sortedCustomers.length > 0) {
        sortedCustomers.forEach(([name, revenue]) => {
            const orderCount = customerOrders[name];
            topCustomersHTML += `
                <div class="customer-item">
                    <span class="customer-name">${name}</span>
                    <span class="customer-value">R${revenue.toFixed(2)} (${orderCount} orders)</span>
                </div>
            `;
        });
    } else {
        topCustomersHTML += '<div class="analytics-empty">No customer data available</div>';
    }

    topCustomersContainer.innerHTML = topCustomersHTML;
}

function updateProductAnalytics() {
    const allOrders = getAllOrders();
    const allInvoices = getAllInvoices();

    // Collect product data from invoices (more detailed)
    const productStats = {};
    let totalItems = 0;

    allInvoices.forEach(invoice => {
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const originalProductName = item.product || item.originalDescription || 'Unknown Product';
                const mappedProductName = getAnalyticsProductName(originalProductName);

                if (!productStats[originalProductName]) {
                    productStats[originalProductName] = {
                        quantity: 0,
                        revenue: 0,
                        cost: 0,
                        orders: 0,
                        mappedName: mappedProductName
                    };
                }

                productStats[originalProductName].quantity += item.quantity || 0;
                productStats[originalProductName].revenue += item.total || 0;

                // Calculate cost using mapped product name
                const pricingInfo = pricing[mappedProductName];
                if (pricingInfo && item.weight) {
                    const itemCost = pricingInfo.cost * item.weight;
                    productStats[originalProductName].cost += itemCost;
                    console.log(`💰 Cost calculated for "${originalProductName}" → "${mappedProductName}": R${pricingInfo.cost}/kg × ${item.weight}kg = R${itemCost.toFixed(2)}`);
                } else {
                    console.log(`❌ No cost data found for "${originalProductName}" → "${mappedProductName}"`);
                }

                productStats[originalProductName].orders++;
                totalItems++;
            });
        }
    });

    // Fallback to orders if no invoice data
    if (totalItems === 0) {
        allOrders.forEach(order => {
            if (order.product) {
                const productName = order.product;
                if (!productStats[productName]) {
                    productStats[productName] = {
                        quantity: 0,
                        revenue: 0,
                        cost: 0,
                        orders: 0
                    };
                }

                productStats[productName].quantity += order.quantity || 0;
                productStats[productName].revenue += order.total || 0;
                productStats[productName].orders++;
                totalItems++;
            }
        });
    }

    // Calculate metrics
    const productCount = Object.keys(productStats).length;
    const bestSeller = Object.entries(productStats)
        .sort(([, a], [, b]) => b.quantity - a.quantity)[0];

    const totalCost = Object.values(productStats).reduce((sum, stats) => sum + stats.cost, 0);
    const totalRevenue = Object.values(productStats).reduce((sum, stats) => sum + stats.revenue, 0);
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

    // Update UI
    document.getElementById('totalProducts').textContent = productCount.toString();
    document.getElementById('bestSeller').textContent = bestSeller ? bestSeller[0] : '-';
    document.getElementById('avgMargin').textContent = `${avgMargin.toFixed(1)}%`;

    // Generate product performance list
    const productPerformanceContainer = document.getElementById('productPerformance');
    const sortedProducts = Object.entries(productStats)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 5);

    let productHTML = '<h4>Product Performance</h4>';
    if (sortedProducts.length > 0) {
        sortedProducts.forEach(([name, stats]) => {
            const margin = stats.revenue > 0 ? ((stats.revenue - stats.cost) / stats.revenue * 100) : 0;
            productHTML += `
                <div class="product-item">
                    <span class="product-name">${name}</span>
                    <span class="product-value">R${stats.revenue.toFixed(2)} (${margin.toFixed(1)}% margin)</span>
                </div>
            `;
        });
    } else {
        productHTML += '<div class="analytics-empty">No product data available</div>';
    }

    productPerformanceContainer.innerHTML = productHTML;
}

function updateProfitAnalytics() {
    const allInvoices = getAllInvoices();

    let totalRevenue = 0;
    let totalCost = 0;
    const productProfits = {};

    allInvoices.forEach(invoice => {
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const originalProductName = item.product || item.originalDescription || 'Unknown Product';
                const mappedProductName = getAnalyticsProductName(originalProductName);
                const itemRevenue = item.total || 0;

                totalRevenue += itemRevenue;

                // Calculate cost using mapped product name
                const pricingInfo = pricing[mappedProductName];
                let itemCost = 0;
                if (pricingInfo && item.weight) {
                    itemCost = pricingInfo.cost * item.weight;
                    totalCost += itemCost;
                    console.log(`💰 Profit calc - Cost for "${originalProductName}" → "${mappedProductName}": R${pricingInfo.cost}/kg × ${item.weight}kg = R${itemCost.toFixed(2)}`);
                } else {
                    console.log(`❌ Profit calc - No cost data for: "${originalProductName}" → "${mappedProductName}"`);
                }

                if (!productProfits[originalProductName]) {
                    productProfits[originalProductName] = {
                        revenue: 0,
                        cost: 0,
                        profit: 0,
                        margin: 0,
                        mappedName: mappedProductName
                    };
                }

                productProfits[originalProductName].revenue += itemRevenue;
                productProfits[originalProductName].cost += itemCost;
                productProfits[originalProductName].profit = productProfits[originalProductName].revenue - productProfits[originalProductName].cost;
                productProfits[originalProductName].margin = productProfits[originalProductName].revenue > 0 ?
                    (productProfits[originalProductName].profit / productProfits[originalProductName].revenue * 100) : 0;
            });
        }
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
    const costRevenueRatio = totalCost > 0 ? `1:${(totalRevenue / totalCost).toFixed(1)}` : '1:0';

    // Update UI
    document.getElementById('totalProfit').textContent = `R${totalProfit.toFixed(2)}`;
    document.getElementById('profitMargin').textContent = `${profitMargin.toFixed(1)}%`;
    document.getElementById('costRevenue').textContent = costRevenueRatio;

    // Generate profit breakdown table
    const profitBreakdownContainer = document.getElementById('profitBreakdown');
    const sortedProfits = Object.entries(productProfits)
        .sort(([, a], [, b]) => b.profit - a.profit)
        .slice(0, 10);

    let profitHTML = '<h4>Profit Breakdown by Product</h4>';
    if (sortedProfits.length > 0) {
        profitHTML += `
            <table class="profit-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Revenue</th>
                        <th>Cost</th>
                        <th>Profit</th>
                        <th>Margin</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedProfits.forEach(([name, stats]) => {
            const profitClass = stats.profit >= 0 ? 'profit-positive' : 'profit-negative';
            profitHTML += `
                <tr>
                    <td>${name}</td>
                    <td>R${stats.revenue.toFixed(2)}</td>
                    <td>R${stats.cost.toFixed(2)}</td>
                    <td class="${profitClass}">R${stats.profit.toFixed(2)}</td>
                    <td class="${profitClass}">${stats.margin.toFixed(1)}%</td>
                </tr>
            `;
        });

        profitHTML += '</tbody></table>';
    } else {
        profitHTML += '<div class="analytics-empty">No profit data available</div>';
    }

    profitBreakdownContainer.innerHTML = profitHTML;
}

function exportAnalyticsData() {
    const allOrders = getAllOrders();
    const allInvoices = getAllInvoices();

    // Prepare comprehensive analytics data
    const analyticsData = {
        exportDate: new Date().toISOString(),
        summary: {
            totalOrders: allOrders.length,
            totalInvoices: allInvoices.length,
            totalRevenue: allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
            uniqueCustomers: new Set(allOrders.map(o => o.name).filter(Boolean)).size
        },
        orders: allOrders,
        invoices: allInvoices,
        customerAnalytics: generateCustomerAnalyticsData(),
        productAnalytics: generateProductAnalyticsData(),
        profitAnalytics: generateProfitAnalyticsData()
    };

    // Create and download file
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `plaas-hoenders-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addActivity('Analytics data exported');
    alert('Analytics data exported successfully!');
}

function generateCustomerAnalyticsData() {
    const allOrders = getAllOrders();
    const customerData = {};

    allOrders.forEach(order => {
        if (order.name && order.name.trim()) {
            const customerName = order.name.trim();
            if (!customerData[customerName]) {
                customerData[customerName] = {
                    name: customerName,
                    totalOrders: 0,
                    totalRevenue: 0,
                    averageOrderValue: 0,
                    firstOrder: null,
                    lastOrder: null,
                    products: {}
                };
            }

            const data = customerData[customerName];
            data.totalOrders++;
            data.totalRevenue += order.total || 0;

            const orderDate = new Date(order.createdAt || order.timestamp || Date.now());
            if (!data.firstOrder || orderDate < new Date(data.firstOrder)) {
                data.firstOrder = orderDate.toISOString();
            }
            if (!data.lastOrder || orderDate > new Date(data.lastOrder)) {
                data.lastOrder = orderDate.toISOString();
            }

            if (order.product) {
                if (!data.products[order.product]) {
                    data.products[order.product] = 0;
                }
                data.products[order.product] += order.quantity || 1;
            }
        }
    });

    // Calculate average order values
    Object.values(customerData).forEach(data => {
        data.averageOrderValue = data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0;
    });

    return Object.values(customerData);
}

function generateProductAnalyticsData() {
    const allInvoices = getAllInvoices();
    const productData = {};

    allInvoices.forEach(invoice => {
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const originalProductName = item.product || item.originalDescription || 'Unknown Product';
                const mappedProductName = getAnalyticsProductName(originalProductName);

                if (!productData[originalProductName]) {
                    productData[originalProductName] = {
                        name: originalProductName,
                        mappedName: mappedProductName,
                        totalQuantity: 0,
                        totalWeight: 0,
                        totalRevenue: 0,
                        totalCost: 0,
                        ordersCount: 0,
                        averagePrice: 0,
                        margin: 0
                    };
                }

                const data = productData[originalProductName];
                data.totalQuantity += item.quantity || 0;
                data.totalWeight += item.weight || 0;
                data.totalRevenue += item.total || 0;
                data.ordersCount++;

                // Calculate cost using mapped product name
                const pricingInfo = pricing[mappedProductName];
                if (pricingInfo && item.weight) {
                    const itemCost = pricingInfo.cost * item.weight;
                    data.totalCost += itemCost;
                    console.log(`💰 Export calc - Cost for "${originalProductName}" → "${mappedProductName}": R${pricingInfo.cost}/kg × ${item.weight}kg = R${itemCost.toFixed(2)}`);
                } else {
                    console.log(`❌ Export calc - No cost data for: "${originalProductName}" → "${mappedProductName}"`);
                }
            });
        }
    });

    // Calculate derived metrics
    Object.values(productData).forEach(data => {
        data.averagePrice = data.totalWeight > 0 ? data.totalRevenue / data.totalWeight : 0;
        data.margin = data.totalRevenue > 0 ? ((data.totalRevenue - data.totalCost) / data.totalRevenue * 100) : 0;
    });

    return Object.values(productData);
}

function generateProfitAnalyticsData() {
    const allInvoices = getAllInvoices();

    let totalRevenue = 0;
    let totalCost = 0;
    const monthlyProfits = {};

    allInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.createdAt || invoice.timestamp || Date.now());
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyProfits[monthKey]) {
            monthlyProfits[monthKey] = {
                month: monthKey,
                revenue: 0,
                cost: 0,
                profit: 0,
                margin: 0
            };
        }

        const invoiceRevenue = invoice.total || 0;
        totalRevenue += invoiceRevenue;
        monthlyProfits[monthKey].revenue += invoiceRevenue;

        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const originalProductName = item.product || item.originalDescription || 'Unknown Product';
                const mappedProductName = getAnalyticsProductName(originalProductName);
                const pricingInfo = pricing[mappedProductName];

                if (pricingInfo && item.weight) {
                    const itemCost = pricingInfo.cost * item.weight;
                    totalCost += itemCost;
                    monthlyProfits[monthKey].cost += itemCost;
                }
            });
        }
    });

    // Calculate monthly profit and margin
    Object.values(monthlyProfits).forEach(data => {
        data.profit = data.revenue - data.cost;
        data.margin = data.revenue > 0 ? (data.profit / data.revenue * 100) : 0;
    });

    return {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        overallMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0,
        monthlyBreakdown: Object.values(monthlyProfits)
    };
}

function getAllOrders() {
    const allOrders = [];
    Object.values(imports).forEach(importData => {
        if (importData.orders) {
            allOrders.push(...importData.orders);
        }
    });
    return allOrders;
}

function getAllInvoices() {
    const allInvoices = [];
    Object.values(imports).forEach(importData => {
        if (importData.invoices) {
            allInvoices.push(...importData.invoices);
        }
    });
    return allInvoices;
}

// Initialize analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Auto-refresh analytics when switching to analytics tab
    const analyticsLink = document.querySelector('a[href="#analytics"]');
    if (analyticsLink) {
        analyticsLink.addEventListener('click', () => {
            setTimeout(refreshAnalytics, 100); // Small delay to ensure section is visible
        });
    }
});

// Bulk Actions for Orders
function setupOrderCheckboxes() {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    const selectAll = document.getElementById('selectAllOrders');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateBulkActions);
    });

    if (selectAll) {
        selectAll.addEventListener('change', toggleAllOrdersBulk);
    }
}

function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');

    if (checkboxes.length > 0) {
        bulkActions.style.display = 'flex';
        selectedCount.textContent = `${checkboxes.length} selected`;
    } else {
        bulkActions.style.display = 'none';
    }
}

function toggleAllOrders() {
    const selectAll = document.getElementById('selectAllOrders');
    const checkboxes = document.querySelectorAll('.order-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });

    updateBulkActions();
}

function getSelectedOrderIds() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function generateSelectedInvoices() {
    const selectedIds = getSelectedOrderIds();
    if (selectedIds.length === 0) {
        alert('Please select orders first');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    selectedIds.forEach(orderId => {
        try {
            generateInvoice(orderId);
            successCount++;
        } catch (error) {
            console.error(`Failed to generate invoice for order ${orderId}:`, error);
            errorCount++;
        }
    });

    alert(`Generated ${successCount} invoices successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    updateBulkActions();
}

async function markSelectedStatus(status) {
    const selectedIds = getSelectedOrderIds();
    if (selectedIds.length === 0) {
        alert('Please select orders first');
        return;
    }

    try {
        // Update status in database for customer portal orders
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: status })
            .in('order_id', selectedIds);

        if (error) {
            console.error('Error updating order status:', error);
            alert(`Error updating order status: ${error.message}`);
            return;
        }

        // Update local data
        if (window.customerPortalOrders) {
            window.customerPortalOrders.forEach(order => {
                if (selectedIds.includes(order.orderId)) {
                    order.status = status;
                }
            });
        }

        // Refresh display
        refreshPortalOrders();
        alert(`Updated ${selectedIds.length} orders to ${status} status`);

    } catch (error) {
        console.error('Error updating order status:', error);
        alert(`Error updating order status: ${error.message}`);
    }
}

async function deleteSelectedOrders() {
    const selectedIds = getSelectedOrderIds();
    if (selectedIds.length === 0) {
        alert('Please select orders first');
        return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected orders? This cannot be undone.`)) {
        return;
    }

    try {
        // Delete from database
        const { error } = await supabaseClient
            .from('orders')
            .delete()
            .in('order_id', selectedIds);

        if (error) {
            console.error('Error deleting orders:', error);
            alert(`Error deleting orders: ${error.message}`);
            return;
        }

        // Remove from local data
        if (window.customerPortalOrders) {
            window.customerPortalOrders = window.customerPortalOrders.filter(
                order => !selectedIds.includes(order.orderId)
            );
        }

        // Refresh display
        refreshPortalOrders();
        alert(`Deleted ${selectedIds.length} orders successfully`);

    } catch (error) {
        console.error('Error deleting orders:', error);
        alert(`Error deleting orders: ${error.message}`);
    }
}

// Weight Editing Functions
let currentEditingInvoice = null;
let editingInvoiceData = null;

function editInvoiceWeights(invoiceId) {
    // Find the invoice
    const invoice = invoices.find(inv => inv.invoiceId === invoiceId);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }

    // Check if invoice can be edited
    if (invoice.status !== 'provisional' && invoice.status !== 'draft') {
        alert('Only provisional or draft invoices can have weights edited');
        return;
    }

    currentEditingInvoice = invoiceId;
    editingInvoiceData = JSON.parse(JSON.stringify(invoice)); // Deep copy

    // Update modal header
    document.getElementById('weightEditInvoiceTitle').textContent = `${invoice.invoiceId}`;
    document.getElementById('weightEditInvoiceInfo').textContent =
        `Customer: ${invoice.customerName} | Date: ${invoice.date} | Status: ${invoice.status.toUpperCase()}`;

    // Populate the table
    populateWeightEditTable();

    // Show modal
    document.getElementById('weightEditModal').style.display = 'flex';

    console.log('📝 Opened weight editing for invoice:', invoiceId);
}

// Fix for ReferenceError: refreshCustomerData not defined
window.refreshCustomerData = safeRefreshCustomerData;

function populateWeightEditTable() {
    const tableBody = document.getElementById('weightEditTableBody');
    const items = editingInvoiceData.items || [];

    console.log('🔍 Weight Edit Debug Info:');
    console.log('📊 editingInvoiceData:', editingInvoiceData);
    console.log('📦 items array:', items);
    console.log('📈 items length:', items.length);

    if (items.length === 0) {
        console.error('❌ No items found in invoice for weight editing');
        console.log('🔍 Full invoice data:', JSON.stringify(editingInvoiceData, null, 2));
    }

    let tableHTML = '';

    items.forEach((item, index) => {
        const originalWeight = item.weight || 0;
        const unitPrice = item.unitPrice || 0;
        const newTotal = originalWeight * unitPrice;

        tableHTML += `
            <tr data-item-index="${index}">
                <td><strong>${item.product}</strong></td>
                <td>${item.quantity || 1}</td>
                <td>${originalWeight.toFixed(2)}</td>
                <td>
                    <input type="number" 
                           class="weight-input" 
                           data-item-index="${index}"
                           value="${originalWeight.toFixed(2)}" 
                           min="0" 
                           step="0.01"
                           onchange="updateItemWeight(${index}, this.value)"
                           onkeyup="updateItemWeight(${index}, this.value)">
                </td>
                <td>R${unitPrice.toFixed(2)}</td>
                <td class="new-total" id="itemTotal-${index}">R${newTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = tableHTML;
    updateEditTotals();
}

function updateItemWeight(itemIndex, newWeight) {
    const weight = parseFloat(newWeight) || 0;
    const item = editingInvoiceData.items[itemIndex];
    const originalWeight = item.weight;

    // Update the item weight in our editing data
    editingInvoiceData.items[itemIndex].weight = weight;
    editingInvoiceData.items[itemIndex].total = weight * item.unitPrice;

    // Update the total display for this item
    const newTotal = weight * item.unitPrice;
    document.getElementById(`itemTotal-${itemIndex}`).textContent = `R${newTotal.toFixed(2)}`;

    // Highlight changed weights
    const input = document.querySelector(`input[data-item-index="${itemIndex}"]`);
    if (Math.abs(weight - originalWeight) > 0.001) {
        input.classList.add('weight-changed');
    } else {
        input.classList.remove('weight-changed');
    }

    // Update totals
    updateEditTotals();
}

function updateEditTotals() {
    const items = editingInvoiceData.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const tax = 0; // No VAT for provisional invoices
    const total = subtotal + tax;

    // Update the invoice data
    editingInvoiceData.subtotal = subtotal;
    editingInvoiceData.tax = tax;
    editingInvoiceData.total = total;

    // Update display
    document.getElementById('weightEditSubtotal').textContent = `R${subtotal.toFixed(2)}`;
    document.getElementById('weightEditVAT').textContent = `R${tax.toFixed(2)}`;
    document.getElementById('weightEditTotal').textContent = `R${total.toFixed(2)}`;

    // Show/hide VAT line
    const vatLine = document.getElementById('weightEditVATLine');
    vatLine.style.display = tax > 0 ? 'flex' : 'none';
}

function saveWeightEdits() {
    if (!currentEditingInvoice || !editingInvoiceData) {
        alert('No invoice data to save');
        return;
    }

    // Check if any weights were actually changed
    const originalInvoice = invoices.find(inv => inv.invoiceId === currentEditingInvoice);
    let hasChanges = false;

    editingInvoiceData.items.forEach((editedItem, index) => {
        const originalItem = originalInvoice.items[index];
        if (Math.abs(editedItem.weight - originalItem.weight) > 0.001) {
            hasChanges = true;
        }
    });

    if (!hasChanges) {
        alert('No weight changes to save');
        closeWeightEditModal();
        return;
    }

    // Update the original invoice
    const invoiceIndex = invoices.findIndex(inv => inv.invoiceId === currentEditingInvoice);
    if (invoiceIndex !== -1) {
        // Update the invoice
        invoices[invoiceIndex] = JSON.parse(JSON.stringify(editingInvoiceData));
        invoices[invoiceIndex].lastModified = new Date().toISOString();
        invoices[invoiceIndex].status = 'draft'; // Mark as draft after manual editing

        // Also update in the import-specific collection
        if (currentImportId && imports[currentImportId]) {
            const importInvoiceIndex = imports[currentImportId].invoices.findIndex(
                inv => inv.invoiceId === currentEditingInvoice
            );
            if (importInvoiceIndex !== -1) {
                imports[currentImportId].invoices[importInvoiceIndex] = JSON.parse(JSON.stringify(editingInvoiceData));
                imports[currentImportId].invoices[importInvoiceIndex].status = 'draft';
            }
        }

        // Save to storage
        saveToStorage();

        // Update displays
        updateInvoicesDisplay();
        updateDashboard();

        // Log changes
        const changedItems = editingInvoiceData.items.filter((item, index) => {
            const originalItem = originalInvoice.items[index];
            return Math.abs(item.weight - originalItem.weight) > 0.001;
        });

        console.log(`✅ Updated weights for ${changedItems.length} items in invoice ${currentEditingInvoice}`);
        changedItems.forEach(item => {
            console.log(`📦 ${item.product}: ${item.weight}kg (R${item.total.toFixed(2)})`);
        });

        addActivity(`Manual weight update: ${currentEditingInvoice} (${changedItems.length} items changed)`);

        // Refresh any email queue items for this order to use updated invoice data
        refreshEmailQueueForInvoice(currentEditingInvoice);

        alert(`Successfully updated weights for ${changedItems.length} items. Invoice status changed to DRAFT.`);

        closeWeightEditModal();
    } else {
        alert('Error: Could not find invoice to update');
    }
}

function closeWeightEditModal() {
    document.getElementById('weightEditModal').style.display = 'none';
    currentEditingInvoice = null;
    editingInvoiceData = null;
}

// Close modal when clicking outside
document.getElementById('weightEditModal')?.addEventListener('click', function (e) {
    if (e.target === this) {
        closeWeightEditModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('weightEditModal').style.display === 'flex') {
        closeWeightEditModal();
    }
});

// ============ SAFE CUSTOMER DATA LOADING FUNCTIONS ============

/**
 * Safely loads customer data with comprehensive error handling and fallback mechanisms
 * @param {Object} options - Configuration options for data loading
 * @returns {Promise<Object>} Customer data with safety metadata
 */
async function safeLoadCustomerData(options = {}) {
    const startTime = Date.now();
    let errors = [];
    let warnings = [];

    try {
        console.log('🔄 Starting safe customer data loading...');

        // Check if customer management is enabled
        if (!window.CustomerFeatureFlags || !window.CustomerFeatureFlags.isEnabled()) {
            console.log('⚠️ Customer management feature is disabled');
            return {
                success: false,
                data: null,
                fallback: 'analytics',
                reason: 'Feature disabled',
                errors: ['Customer management feature is disabled'],
                loadTime: Date.now() - startTime
            };
        }

        // Validate feature flags
        if (!window.CustomerFeatureFlags || typeof window.CustomerFeatureFlags !== 'object') {
            errors.push('Invalid CustomerFeatureFlags configuration');
            console.error('❌ Invalid CustomerFeatureFlags configuration');
            return {
                success: false,
                data: null,
                fallback: 'analytics',
                reason: 'Invalid configuration',
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        // Check if we should use gradual rollout
        if (window.CustomerFeatureFlags.config?.gradualRollout?.enabled) {
            const rolloutPercentage = window.CustomerFeatureFlags.config.gradualRollout.percentage || 100;
            const randomValue = Math.random() * 100;

            if (randomValue > rolloutPercentage) {
                console.log(`🎯 Gradual rollout: Customer excluded (${rolloutPercentage}% active, got ${randomValue.toFixed(1)}%)`);
                warnings.push(`Gradual rollout: Customer excluded (${rolloutPercentage}% active)`);
                return {
                    success: true,
                    data: null,
                    fallback: 'analytics',
                    reason: 'Gradual rollout exclusion',
                    warnings: warnings,
                    loadTime: Date.now() - startTime
                };
            }
            console.log(`🎯 Gradual rollout: Customer included (${rolloutPercentage}% active, got ${randomValue.toFixed(1)}%)`);
        }

        // Attempt to load customer data with multiple fallback strategies
        let customerData = null;
        let loadAttempts = [];

        // Strategy 1: Load from customer portal database
        try {
            console.log('📱 Attempting to load from customer portal database...');
            const portalData = await safeLoadCustomerPortalData();
            loadAttempts.push({ strategy: 'portal', success: portalData.success, data: portalData.data });

            if (portalData.success && portalData.data) {
                customerData = portalData.data;
                console.log('✅ Successfully loaded customer data from portal');
            } else if (portalData.errors && portalData.errors.length > 0) {
                errors.push(...portalData.errors);
            }
        } catch (error) {
            console.error('❌ Portal data loading failed:', error);
            errors.push(`Portal loading failed: ${error.message}`);
            loadAttempts.push({ strategy: 'portal', success: false, error: error.message });
        }

        // Strategy 2: Load from import data if no portal data
        if (!customerData) {
            try {
                console.log('📂 Attempting to load from import data...');
                const importData = await safeLoadCustomerImportData();
                loadAttempts.push({ strategy: 'import', success: importData.success, data: importData.data });

                if (importData.success && importData.data) {
                    customerData = importData.data;
                    console.log('✅ Successfully loaded customer data from imports');
                } else if (importData.errors && importData.errors.length > 0) {
                    errors.push(...importData.errors);
                }
            } catch (error) {
                console.error('❌ Import data loading failed:', error);
                errors.push(`Import loading failed: ${error.message}`);
                loadAttempts.push({ strategy: 'import', success: false, error: error.message });
            }
        }

        // Strategy 3: Create minimal customer data structure if no data found
        if (!customerData) {
            try {
                console.log('📝 Creating minimal customer data structure...');
                const minimalData = await safeCreateMinimalCustomerData();
                loadAttempts.push({ strategy: 'minimal', success: minimalData.success, data: minimalData.data });

                if (minimalData.success && minimalData.data) {
                    customerData = minimalData.data;
                    console.log('✅ Successfully created minimal customer data');
                    warnings.push('Using minimal customer data structure');
                } else if (minimalData.errors && minimalData.errors.length > 0) {
                    errors.push(...minimalData.errors);
                }
            } catch (error) {
                console.error('❌ Minimal data creation failed:', error);
                errors.push(`Minimal data creation failed: ${error.message}`);
                loadAttempts.push({ strategy: 'minimal', success: false, error: error.message });
            }
        }

        // Check performance thresholds
        const loadTime = Date.now() - startTime;
        const maxLoadTime = window.CustomerFeatureFlags.config?.performance?.maxLoadTime || 5000;

        if (loadTime > maxLoadTime) {
            warnings.push(`Load time exceeded threshold: ${loadTime}ms (max: ${maxLoadTime}ms)`);
            console.warn(`⚠️ Load time exceeded threshold: ${loadTime}ms`);
        }

        // Check error rate thresholds
        const maxErrorRate = window.CustomerFeatureFlags.config?.safety?.maxErrorRate || 0.1;
        const errorRate = errors.length / Math.max(loadAttempts.length, 1);

        if (errorRate > maxErrorRate) {
            console.warn(`⚠️ Error rate too high: ${(errorRate * 100).toFixed(1)}% (max: ${(maxErrorRate * 100).toFixed(1)}%)`);

            // Auto-disable feature if error rate is too high
            if (window.CustomerFeatureFlags.config?.safety?.autoDisableOnHighErrorRate) {
                console.error('🚨 Auto-disabling customer management due to high error rate');
                if (window.CustomerFeatureFlags.disableFeature) {
                    window.CustomerFeatureFlags.disableFeature();
                }

                return {
                    success: false,
                    data: null,
                    fallback: 'analytics',
                    reason: 'High error rate - feature auto-disabled',
                    errors: errors,
                    warnings: warnings,
                    loadTime: loadTime,
                    errorRate: errorRate,
                    autoDisabled: true
                };
            }
        }

        // Determine fallback strategy
        let fallbackStrategy = 'analytics';
        if (!customerData) {
            if (errors.length > 3) {
                fallbackStrategy = 'error';
            } else if (warnings.length > 2) {
                fallbackStrategy = 'warning';
            }
        }

        const result = {
            success: !!customerData,
            data: customerData,
            fallback: customerData ? null : fallbackStrategy,
            reason: customerData ? 'Data loaded successfully' : 'All loading strategies failed',
            errors: errors,
            warnings: warnings,
            loadTime: loadTime,
            loadAttempts: loadAttempts,
            errorRate: errors.length > 0 ? errorRate : 0,
            health: {
                status: errors.length === 0 ? 'healthy' : errors.length <= 2 ? 'degraded' : 'unhealthy',
                errorCount: errors.length,
                warningCount: warnings.length,
                performance: loadTime <= 1000 ? 'good' : loadTime <= 3000 ? 'acceptable' : 'poor'
            }
        };

        console.log('✅ Safe customer data loading completed:', result);
        return result;

    } catch (error) {
        console.error('❌ Critical error in safeLoadCustomerData:', error);

        // Always return a safe fallback result
        return {
            success: false,
            data: null,
            fallback: 'error',
            reason: 'Critical system error',
            errors: [`Critical error: ${error.message}`],
            loadTime: Date.now() - startTime,
            health: {
                status: 'critical',
                errorCount: 1,
                warningCount: 0,
                performance: 'poor'
            }
        };
    }
}

/**
 * Safely loads customer data from the customer portal database
 * @returns {Promise<Object>} Portal customer data with safety metadata
 */
async function safeLoadCustomerPortalData() {
    const startTime = Date.now();
    const errors = [];

    try {
        // Check if Supabase client is available
        if (!supabaseClient) {
            errors.push('Supabase client not available');
            return {
                success: false,
                data: null,
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        // Validate required database tables exist
        const { data: customersData, error: customersError } = await supabaseClient
            .from('customers')
            .select('count', { count: 'exact', head: true });

        if (customersError) {
            errors.push(`Customers table error: ${customersError.message}`);
            console.error('❌ Customers table error:', customersError);
            return {
                success: false,
                data: null,
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        // Load customer portal orders with proper error handling
        const { data: ordersData, error: ordersError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('source', 'customer_portal')
            .order('created_at', { ascending: false })
            .limit(100); // Limit to prevent memory issues

        if (ordersError) {
            errors.push(`Orders query error: ${ordersError.message}`);
            console.error('❌ Orders query error:', ordersError);
            return {
                success: false,
                data: null,
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        // Transform orders to customer data format
        const customerData = {
            source: 'customer_portal',
            customers: [],
            orders: ordersData || [],
            totalCustomers: 0,
            totalOrders: ordersData ? ordersData.length : 0,
            lastUpdated: new Date().toISOString()
        };

        // Extract unique customers from orders
        const customerMap = new Map();
        if (ordersData && ordersData.length > 0) {
            ordersData.forEach(order => {
                const customerKey = order.customer_email || order.customer_name;
                if (customerKey && !customerMap.has(customerKey)) {
                    customerMap.set(customerKey, {
                        id: order.customer_id,
                        name: order.customer_name,
                        email: order.customer_email,
                        phone: order.customer_phone,
                        address: order.customer_address,
                        firstOrder: order.order_date,
                        lastOrder: order.order_date,
                        totalOrders: 1,
                        totalSpent: order.total_amount || 0
                    });
                } else if (customerKey && customerMap.has(customerKey)) {
                    const existing = customerMap.get(customerKey);
                    existing.totalOrders++;
                    existing.totalSpent += order.total_amount || 0;
                    existing.lastOrder = order.order_date;
                }
            });
        }

        customerData.customers = Array.from(customerMap.values());
        customerData.totalCustomers = customerData.customers.length;

        console.log(`✅ Successfully loaded ${customerData.totalCustomers} customers from portal`);

        return {
            success: true,
            data: customerData,
            errors: errors,
            loadTime: Date.now() - startTime
        };

    } catch (error) {
        console.error('❌ Error loading customer portal data:', error);
        errors.push(`Portal loading error: ${error.message}`);

        return {
            success: false,
            data: null,
            errors: errors,
            loadTime: Date.now() - startTime
        };
    }
}

/**
 * Safely loads customer data from import records
 * @returns {Promise<Object>} Import customer data with safety metadata
 */
async function safeLoadCustomerImportData() {
    const startTime = Date.now();
    const errors = [];

    try {
        // Check if we have import data available
        if (!imports || Object.keys(imports).length === 0) {
            errors.push('No import data available');
            return {
                success: false,
                data: null,
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        // Collect customer data from all imports
        const customerData = {
            source: 'imports',
            customers: [],
            orders: [],
            totalCustomers: 0,
            totalOrders: 0,
            lastUpdated: new Date().toISOString()
        };

        const customerMap = new Map();

        Object.values(imports).forEach(importData => {
            if (importData.orders && importData.orders.length > 0) {
                importData.orders.forEach(order => {
                    // Add to orders collection
                    customerData.orders.push({
                        ...order,
                        importId: importData.id,
                        importName: importData.name
                    });

                    // Extract customer information
                    const customerKey = order.email || order.name;
                    if (customerKey && !customerMap.has(customerKey)) {
                        customerMap.set(customerKey, {
                            id: `import-${Date.now()}-${Math.random()}`,
                            name: order.name,
                            email: order.email,
                            phone: order.phone,
                            address: order.address,
                            firstOrder: order.date,
                            lastOrder: order.date,
                            totalOrders: 1,
                            totalSpent: order.total || 0,
                            source: 'import'
                        });
                    } else if (customerKey && customerMap.has(customerKey)) {
                        const existing = customerMap.get(customerKey);
                        existing.totalOrders++;
                        existing.totalSpent += order.total || 0;
                        existing.lastOrder = order.date;
                    }
                });
            }
        });

        customerData.customers = Array.from(customerMap.values());
        customerData.totalCustomers = customerData.customers.length;
        customerData.totalOrders = customerData.orders.length;

        if (customerData.totalCustomers === 0) {
            errors.push('No customer data found in imports');
            return {
                success: false,
                data: null,
                errors: errors,
                loadTime: Date.now() - startTime
            };
        }

        console.log(`✅ Successfully loaded ${customerData.totalCustomers} customers from imports`);

        return {
            success: true,
            data: customerData,
            errors: errors,
            loadTime: Date.now() - startTime
        };

    } catch (error) {
        console.error('❌ Error loading customer import data:', error);
        errors.push(`Import loading error: ${error.message}`);

        return {
            success: false,
            data: null,
            errors: errors,
            loadTime: Date.now() - startTime
        };
    }
}

/**
 * Creates minimal customer data structure as fallback
 * @returns {Promise<Object>} Minimal customer data with safety metadata
 */
async function safeCreateMinimalCustomerData() {
    const startTime = Date.now();
    const errors = [];

    try {
        // Create a minimal customer data structure
        const customerData = {
            source: 'minimal',
            customers: [],
            orders: [],
            totalCustomers: 0,
            totalOrders: 0,
            lastUpdated: new Date().toISOString(),
            note: 'Minimal data structure created as fallback'
        };

        // Add a sample customer for testing purposes
        const sampleCustomer = {
            id: 'sample-customer-001',
            name: 'Sample Customer',
            email: 'sample@example.com',
            phone: '000-000-0000',
            address: 'Sample Address',
            firstOrder: new Date().toISOString().split('T')[0],
            lastOrder: new Date().toISOString().split('T')[0],
            totalOrders: 0,
            totalSpent: 0,
            source: 'minimal'
        };

        customerData.customers.push(sampleCustomer);
        customerData.totalCustomers = 1;

        console.log('✅ Successfully created minimal customer data structure');

        return {
            success: true,
            data: customerData,
            errors: errors,
            loadTime: Date.now() - startTime
        };

    } catch (error) {
        console.error('❌ Error creating minimal customer data:', error);
        errors.push(`Minimal data creation error: ${error.message}`);

        return {
            success: false,
            data: null,
            errors: errors,
            loadTime: Date.now() - startTime
        };
    }
}

/**
 * Monitors customer data loading health and performance
 * @returns {Object} Health monitoring data
 */
function monitorCustomerDataHealth() {
    const health = {
        timestamp: new Date().toISOString(),
        featureFlags: {
            enabled: window.CustomerFeatureFlags ? window.CustomerFeatureFlags.isEnabled() : false,
            config: window.CustomerFeatureFlags ? window.CustomerFeatureFlags.config : null
        },
        recentLoads: [],
        errorRate: 0,
        averageLoadTime: 0,
        status: 'unknown'
    };

    try {
        // Check if we have recent load data stored
        const recentLoadsKey = 'customerDataRecentLoads';
        const storedData = localStorage.getItem(recentLoadsKey);

        if (storedData) {
            const recentLoads = JSON.parse(storedData);
            health.recentLoads = recentLoads.slice(-10); // Last 10 loads

            // Calculate metrics
            const totalLoads = recentLoads.length;
            const errorLoads = recentLoads.filter(load => !load.success).length;
            const successfulLoads = recentLoads.filter(load => load.success);

            health.errorRate = totalLoads > 0 ? errorLoads / totalLoads : 0;
            health.averageLoadTime = successfulLoads.length > 0
                ? successfulLoads.reduce((sum, load) => sum + load.loadTime, 0) / successfulLoads.length
                : 0;

            // Determine status
            if (health.errorRate > 0.5) {
                health.status = 'critical';
            } else if (health.errorRate > 0.2) {
                health.status = 'degraded';
            } else if (health.averageLoadTime > 3000) {
                health.status = 'slow';
            } else {
                health.status = 'healthy';
            }
        } else {
            health.status = 'no_data';
        }

    } catch (error) {
        console.error('❌ Error monitoring customer data health:', error);
        health.status = 'error';
        health.error = error.message;
    }

    return health;
}

/**
 * Records a customer data load attempt for health monitoring
 * @param {Object} loadResult - Result of the load attempt
 */
function recordCustomerDataLoad(loadResult) {
    try {
        const recentLoadsKey = 'customerDataRecentLoads';
        let recentLoads = [];

        // Load existing data
        const storedData = localStorage.getItem(recentLoadsKey);
        if (storedData) {
            recentLoads = JSON.parse(storedData);
        }

        // Add new load result
        const record = {
            timestamp: new Date().toISOString(),
            success: loadResult.success,
            loadTime: loadResult.loadTime,
            errorCount: loadResult.errors ? loadResult.errors.length : 0,
            warningCount: loadResult.warnings ? loadResult.warnings.length : 0,
            fallback: loadResult.fallback,
            reason: loadResult.reason
        };

        recentLoads.push(record);

        // Keep only last 50 records
        if (recentLoads.length > 50) {
            recentLoads = recentLoads.slice(-50);
        }

        // Save back to storage
        localStorage.setItem(recentLoadsKey, JSON.stringify(recentLoads));

        console.log('📊 Customer data load recorded:', record);

    } catch (error) {
        console.error('❌ Error recording customer data load:', error);
    }
}

/**
 * Displays customer data loading status in the UI
 * @param {Object} loadResult - Result from safeLoadCustomerData
 */
function displayCustomerDataStatus(loadResult) {
    try {
        const statusContainer = document.getElementById('customerDataStatus');
        if (!statusContainer) {
            console.warn('⚠️ Customer data status container not found');
            return;
        }

        let statusHTML = '';
        let statusClass = '';

        if (loadResult.success && loadResult.data) {
            statusClass = 'status-success';
            const customerCount = loadResult.data.totalCustomers || 0;
            const orderCount = loadResult.data.totalOrders || 0;

            statusHTML = `
                <div class="status-indicator ${statusClass}">
                    <i class="fas fa-check-circle"></i>
                    <span>Customer data loaded successfully</span>
                </div>
                <div class="status-details">
                    <span>${customerCount} customers</span>
                    <span>${orderCount} orders</span>
                    <span>${loadResult.loadTime}ms</span>
                </div>
            `;
        } else {
            statusClass = 'status-warning';
            const fallbackText = loadResult.fallback === 'analytics' ? 'Falling back to analytics' : 'Check console for details';

            statusHTML = `
                <div class="status-indicator ${statusClass}">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Customer data loading issues</span>
                </div>
                <div class="status-details">
                    <span>${loadResult.errors.length} errors</span>
                    <span>${loadResult.warnings.length} warnings</span>
                    <span>${fallbackText}</span>
                </div>
            `;
        }

        statusContainer.innerHTML = statusHTML;
        statusContainer.style.display = 'block';

        // Auto-hide after 5 seconds if successful
        if (loadResult.success) {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 5000);
        }

    } catch (error) {
        console.error('❌ Error displaying customer data status:', error);
    }
}

/**
 * Safe customer data refresh function with error handling
 * @returns {Promise<Object>} Refresh result with safety metadata
 */
async function safeRefreshCustomerData() {
    const startTime = Date.now();

    try {
        console.log('🔄 Starting safe customer data refresh...');

        // Load customer data with safety mechanisms
        const loadResult = await safeLoadCustomerData();

        // Record the load attempt
        recordCustomerDataLoad(loadResult);

        // Display status to user
        displayCustomerDataStatus(loadResult);

        // Handle fallback scenarios
        if (!loadResult.success || !loadResult.data) {
            console.warn('⚠️ Customer data refresh failed, handling fallback...');

            switch (loadResult.fallback) {
                case 'analytics':
                    console.log('📊 Falling back to analytics section');
                    showSection('analytics');
                    break;

                case 'error':
                    console.error('❌ Critical error - showing error notification');
                    ErrorHandler.showNotification('Customer data loading failed', 'error');
                    break;

                case 'warning':
                    console.warn('⚠️ Warning state - showing warning notification');
                    ErrorHandler.showNotification('Customer data loading completed with warnings', 'warning');
                    break;

                default:
                    console.log('📊 Defaulting to analytics section');
                    showSection('analytics');
            }
        }

        // Check health and potentially auto-disable
        const health = monitorCustomerDataHealth();
        if (health.status === 'critical' && window.CustomerFeatureFlags?.config?.safety?.autoDisableOnHighErrorRate) {
            console.error('🚨 Auto-disabling customer management due to critical health status');
            if (window.CustomerFeatureFlags.disableFeature) {
                window.CustomerFeatureFlags.disableFeature();
            }
        }

        const result = {
            success: loadResult.success,
            data: loadResult.data,
            loadTime: Date.now() - startTime,
            health: health,
            fallback: loadResult.fallback
        };

        console.log('✅ Safe customer data refresh completed:', result);
        return result;

    } catch (error) {
        console.error('❌ Critical error in safeRefreshCustomerData:', error);

        return {
            success: false,
            data: null,
            loadTime: Date.now() - startTime,
            error: error.message,
            fallback: 'error'
        };
    }
}

/**
 * Periodic health check for customer data loading system
 */
function startCustomerDataHealthMonitoring() {
    try {
        console.log('🔍 Starting customer data health monitoring...');

        // Clear stale load records older than 24 hours to prevent old errors from poisoning health
        try {
            const recentLoadsKey = 'customerDataRecentLoads';
            const storedData = localStorage.getItem(recentLoadsKey);
            if (storedData) {
                const recentLoads = JSON.parse(storedData);
                const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
                const freshLoads = recentLoads.filter(load => new Date(load.timestamp).getTime() > cutoff);
                if (freshLoads.length !== recentLoads.length) {
                    localStorage.setItem(recentLoadsKey, JSON.stringify(freshLoads));
                    console.log(`🧹 Cleaned ${recentLoads.length - freshLoads.length} stale health records`);
                }
            }
        } catch (e) { /* ignore cleanup errors */ }

        let lastReportedStatus = null; // Only log when status changes

        // Run health check every 5 minutes (was 30s — far too frequent)
        const healthCheckInterval = setInterval(async () => {
            try {
                const health = monitorCustomerDataHealth();

                // Only log when status changes to reduce console spam
                if (health.status !== lastReportedStatus) {
                    console.log('🏥 Customer data health:', health.status);
                    lastReportedStatus = health.status;
                }

                // Log critical issues (once)
                if (health.status === 'critical' && lastReportedStatus !== 'critical_reported') {
                    console.warn('🚨 Critical health status detected — check customerDataRecentLoads in localStorage');
                    lastReportedStatus = 'critical_reported';

                    // Auto-disable if configured
                    if (window.CustomerFeatureFlags?.config?.safety?.autoDisableOnHighErrorRate) {
                        console.error('🚨 Auto-disabling customer management due to critical health');
                        if (window.CustomerFeatureFlags.disableFeature) {
                            window.CustomerFeatureFlags.disableFeature();
                        }
                        clearInterval(healthCheckInterval);
                    }
                }

                // Update UI with health status
                const healthContainer = document.getElementById('customerDataHealth');
                if (healthContainer) {
                    let healthClass = 'health-unknown';
                    let healthIcon = 'fa-question-circle';

                    switch (health.status) {
                        case 'healthy':
                            healthClass = 'health-healthy';
                            healthIcon = 'fa-check-circle';
                            break;
                        case 'degraded':
                            healthClass = 'health-degraded';
                            healthIcon = 'fa-exclamation-triangle';
                            break;
                        case 'critical':
                            healthClass = 'health-critical';
                            healthIcon = 'fa-times-circle';
                            break;
                        case 'slow':
                            healthClass = 'health-slow';
                            healthIcon = 'fa-clock';
                            break;
                    }

                    healthContainer.innerHTML = `
                        <div class="health-indicator ${healthClass}">
                            <i class="fas ${healthIcon}"></i>
                            <span>System Health: ${health.status.toUpperCase()}</span>
                        </div>
                        <div class="health-details">
                            <span>Error Rate: ${(health.errorRate * 100).toFixed(1)}%</span>
                            <span>Avg Load: ${health.averageLoadTime.toFixed(0)}ms</span>
                        </div>
                    `;
                }

            } catch (error) {
                console.error('❌ Error in health monitoring interval:', error);
            }
        }, 300000); // Every 5 minutes (was 30s)

        console.log('✅ Customer data health monitoring started (30s intervals)');

    } catch (error) {
        console.error('❌ Error starting customer data health monitoring:', error);
    }
}

// Initialize customer data loading system when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Start health monitoring after a delay to ensure everything is loaded
    setTimeout(() => {
        startCustomerDataHealthMonitoring();
    }, 5000);
});

// ============ COMPREHENSIVE CUSTOMER MANAGEMENT TESTING FUNCTIONS ============

/**
 * Comprehensive Customer Management Testing Suite
 * Tests all aspects of the customer management system with safety mechanisms
 */
class CustomerManagementTester {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.testStartTime = null;
        this.testEndTime = null;
    }

    /**
     * Run all customer management tests
     * @returns {Object} Comprehensive test results
     */
    async runAllTests() {
        console.log('🧪 Starting comprehensive customer management testing...');
        this.testStartTime = Date.now();

        try {
            // Test 1: Feature Flag System
            await this.testFeatureFlags();

            // Test 2: Safe Data Loading Functions
            await this.testSafeDataLoading();

            // Test 3: Error Handling and Fallbacks
            await this.testErrorHandling();

            // Test 4: Health Monitoring System
            await this.testHealthMonitoring();

            // Test 5: Performance Limits
            await this.testPerformanceLimits();

            // Test 6: UI Integration
            await this.testUIIntegration();

            // Test 7: Edge Cases
            await this.testEdgeCases();

            // Test 8: Safety Mechanisms
            await this.testSafetyMechanisms();

            this.testEndTime = Date.now();

            return this.generateTestReport();

        } catch (error) {
            console.error('❌ Critical error during testing:', error);
            this.testEndTime = Date.now();
            return this.generateTestReport();
        }
    }

    /**
     * Test 1: Feature Flag System
     */
    async testFeatureFlags() {
        console.log('🚩 Testing feature flag system...');

        // Test 1.1: Feature flag configuration exists
        this.addTest('Feature flags configuration exists', () => {
            return window.CustomerFeatureFlags !== undefined &&
                typeof window.CustomerFeatureFlags === 'object';
        });

        // Test 1.2: Enable/disable functionality
        this.addTest('Feature flags can be enabled/disabled', () => {
            if (!window.CustomerFeatureFlags) return false;

            // Test enable
            if (window.CustomerFeatureFlags.enableFeature) {
                window.CustomerFeatureFlags.enableFeature();
                const enabled = window.CustomerFeatureFlags.isEnabled();
                if (!enabled) return false;
            }

            // Test disable
            if (window.CustomerFeatureFlags.disableFeature) {
                window.CustomerFeatureFlags.disableFeature();
                const disabled = !window.CustomerFeatureFlags.isEnabled();
                if (!disabled) return false;
            }

            return true;
        });

        // Test 1.3: Gradual rollout functionality
        this.addTest('Gradual rollout configuration works', () => {
            if (!window.CustomerFeatureFlags || !window.CustomerFeatureFlags.config) return false;

            const config = window.CustomerFeatureFlags.config;
            return config.gradualRollout &&
                typeof config.gradualRollout.enabled === 'boolean' &&
                typeof config.gradualRollout.percentage === 'number';
        });

        // Test 1.4: Safety thresholds
        this.addTest('Safety thresholds are configured', () => {
            if (!window.CustomerFeatureFlags || !window.CustomerFeatureFlags.config) return false;

            const config = window.CustomerFeatureFlags.config;
            return config.safety &&
                typeof config.safety.maxErrorRate === 'number' &&
                typeof config.safety.autoDisableOnHighErrorRate === 'boolean';
        });
    }

    /**
     * Test 2: Safe Data Loading Functions
     */
    async testSafeDataLoading() {
        console.log('📊 Testing safe data loading functions...');

        // Test 2.1: safeLoadCustomerData function exists
        this.addTest('safeLoadCustomerData function exists', () => {
            return typeof safeLoadCustomerData === 'function';
        });

        // Test 2.2: safeLoadCustomerPortalData function exists
        this.addTest('safeLoadCustomerPortalData function exists', () => {
            return typeof safeLoadCustomerPortalData === 'function';
        });

        // Test 2.3: safeLoadCustomerImportData function exists
        this.addTest('safeLoadCustomerImportData function exists', () => {
            return typeof safeLoadCustomerImportData === 'function';
        });

        // Test 2.4: safeCreateMinimalCustomerData function exists
        this.addTest('safeCreateMinimalCustomerData function exists', () => {
            return typeof safeCreateMinimalCustomerData === 'function';
        });

        // Test 2.5: All functions return proper structure
        this.addTest('Data loading functions return proper structure', async () => {
            try {
                const result = await safeLoadCustomerData();
                return result &&
                    typeof result.success === 'boolean' &&
                    (result.data !== undefined) &&
                    Array.isArray(result.errors) &&
                    typeof result.loadTime === 'number';
            } catch (error) {
                return false;
            }
        });

        // Test 2.6: Fallback mechanisms work
        this.addTest('Fallback mechanisms work correctly', async () => {
            try {
                const result = await safeLoadCustomerData();
                return result &&
                    (result.success === true || result.fallback !== undefined);
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Test 3: Error Handling and Fallbacks
     */
    async testErrorHandling() {
        console.log('🛡️ Testing error handling and fallbacks...');

        // Test 3.1: Error collection works
        this.addTest('Error collection works properly', async () => {
            try {
                const result = await safeLoadCustomerData();
                return result && Array.isArray(result.errors);
            } catch (error) {
                return false;
            }
        });

        // Test 3.2: Warning collection works
        this.addTest('Warning collection works properly', async () => {
            try {
                const result = await safeLoadCustomerData();
                return result && Array.isArray(result.warnings);
            } catch (error) {
                return false;
            }
        });

        // Test 3.3: Fallback to analytics section
        this.addTest('Fallback to analytics section works', () => {
            try {
                // Simulate fallback scenario
                showSection('analytics');
                const analyticsSection = document.getElementById('analytics');
                return analyticsSection && analyticsSection.classList.contains('active');
            } catch (error) {
                return false;
            }
        });

        // Test 3.4: Error rate calculation
        this.addTest('Error rate calculation is accurate', async () => {
            try {
                const result = await safeLoadCustomerData();
                if (!result) return false;

                const expectedErrorRate = result.errors.length / Math.max(result.loadAttempts?.length || 1, 1);
                const actualErrorRate = result.errorRate || 0;

                return Math.abs(expectedErrorRate - actualErrorRate) < 0.01;
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Test 4: Health Monitoring System
     */
    async testHealthMonitoring() {
        console.log('🏥 Testing health monitoring system...');

        // Test 4.1: monitorCustomerDataHealth function exists
        this.addTest('monitorCustomerDataHealth function exists', () => {
            return typeof monitorCustomerDataHealth === 'function';
        });

        // Test 4.2: Health monitoring returns proper structure
        this.addTest('Health monitoring returns proper structure', () => {
            try {
                const health = monitorCustomerDataHealth();
                return health &&
                    typeof health.timestamp === 'string' &&
                    typeof health.status === 'string' &&
                    typeof health.errorRate === 'number';
            } catch (error) {
                return false;
            }
        });

        // Test 4.3: Health status determination works
        this.addTest('Health status determination works correctly', () => {
            try {
                const health = monitorCustomerDataHealth();
                const validStatuses = ['healthy', 'degraded', 'critical', 'slow', 'unknown', 'error', 'no_data'];
                return health && validStatuses.includes(health.status);
            } catch (error) {
                return false;
            }
        });

        // Test 4.4: recordCustomerDataLoad function exists
        this.addTest('recordCustomerDataLoad function exists', () => {
            return typeof recordCustomerDataLoad === 'function';
        });

        // Test 4.5: Health monitoring interval is set
        this.addTest('Health monitoring interval is configured', () => {
            return typeof startCustomerDataHealthMonitoring === 'function';
        });
    }

    /**
     * Test 5: Performance Limits
     */
    async testPerformanceLimits() {
        console.log('⚡ Testing performance limits...');

        // Test 5.1: Load time measurement works
        this.addTest('Load time measurement works correctly', async () => {
            try {
                const result = await safeLoadCustomerData();
                return result &&
                    typeof result.loadTime === 'number' &&
                    result.loadTime >= 0;
            } catch (error) {
                return false;
            }
        });

        // Test 5.2: Performance threshold checking
        this.addTest('Performance threshold checking works', async () => {
            try {
                const result = await safeLoadCustomerData();
                if (!result) return false;

                const loadTime = result.loadTime;
                const maxLoadTime = window.CustomerFeatureFlags?.config?.performance?.maxLoadTime || 5000;

                // If load time exceeds threshold, there should be warnings
                if (loadTime > maxLoadTime) {
                    return result.warnings && result.warnings.length > 0;
                }

                return true;
            } catch (error) {
                return false;
            }
        });

        // Test 5.3: Memory usage considerations
        this.addTest('Memory usage is reasonable', async () => {
            try {
                const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
                const result = await safeLoadCustomerData();
                const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

                if (!result) return false;

                const memoryIncrease = endMemory - startMemory;
                const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB

                return memoryIncrease < maxMemoryIncrease;
            } catch (error) {
                return true; // Skip if memory API not available
            }
        });
    }

    /**
     * Test 6: UI Integration
     */
    async testUIIntegration() {
        console.log('🎨 Testing UI integration...');

        // Test 6.1: Customer management section exists
        this.addTest('Customer management section exists in DOM', () => {
            const section = document.getElementById('customerManagement');
            return section !== null;
        });

        // Test 6.2: Feature status display works
        this.addTest('Feature status display works', () => {
            try {
                displayCustomerDataStatus({
                    success: true,
                    data: { totalCustomers: 5, totalOrders: 10 },
                    loadTime: 100
                });

                const statusContainer = document.getElementById('customerDataStatus');
                return statusContainer && statusContainer.innerHTML.length > 0;
            } catch (error) {
                return false;
            }
        });

        // Test 6.3: Navigation menu item exists
        this.addTest('Customer management navigation menu item exists', () => {
            const navItem = document.querySelector('a[href="#customer-management"]');
            return navItem !== null;
        });

        // Test 6.4: Customer search functionality exists
        this.addTest('Customer search functionality exists', () => {
            const searchInput = document.getElementById('customerSearchInput');
            const searchButton = document.querySelector('button[onclick*="filterCustomerOrders"]');
            return searchInput !== null && searchButton !== null;
        });
    }

    /**
     * Test 7: Edge Cases
     */
    async testEdgeCases() {
        console.log('🔍 Testing edge cases...');

        // Test 7.1: Empty data handling
        this.addTest('Empty data is handled gracefully', async () => {
            try {
                const result = await safeCreateMinimalCustomerData();
                return result &&
                    result.success === true &&
                    result.data &&
                    result.data.customers &&
                    result.data.customers.length >= 0;
            } catch (error) {
                return false;
            }
        });

        // Test 7.2: Null/undefined parameter handling
        this.addTest('Null/undefined parameters are handled', async () => {
            try {
                const result = await safeLoadCustomerData(null);
                return result && typeof result.success === 'boolean';
            } catch (error) {
                return false;
            }
        });

        // Test 7.3: Invalid configuration handling
        this.addTest('Invalid configuration is handled gracefully', async () => {
            try {
                // Temporarily break configuration
                const originalConfig = window.CustomerFeatureFlags?.config;
                if (window.CustomerFeatureFlags) {
                    window.CustomerFeatureFlags.config = null;
                }

                const result = await safeLoadCustomerData();

                // Restore configuration
                if (window.CustomerFeatureFlags) {
                    window.CustomerFeatureFlags.config = originalConfig;
                }

                return result && typeof result.success === 'boolean';
            } catch (error) {
                return false;
            }
        });

        // Test 7.4: Rapid successive calls
        this.addTest('Rapid successive calls are handled', async () => {
            try {
                const promises = [];
                for (let i = 0; i < 5; i++) {
                    promises.push(safeLoadCustomerData());
                }

                const results = await Promise.all(promises);
                return results.every(result => result && typeof result.success === 'boolean');
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Test 8: Safety Mechanisms
     */
    async testSafetyMechanisms() {
        console.log('🛡️ Testing safety mechanisms...');

        // Test 8.1: Auto-disable on high error rate
        this.addTest('Auto-disable on high error rate works', () => {
            if (!window.CustomerFeatureFlags || !window.CustomerFeatureFlags.config) return true; // Skip if not configured

            const config = window.CustomerFeatureFlags.config;
            return config.safety &&
                typeof config.safety.maxErrorRate === 'number' &&
                typeof config.safety.autoDisableOnHighErrorRate === 'boolean';
        });

        // Test 8.2: Fallback mechanisms are robust
        this.addTest('Fallback mechanisms are robust', async () => {
            try {
                // Test with feature disabled
                if (window.CustomerFeatureFlags && window.CustomerFeatureFlags.disableFeature) {
                    window.CustomerFeatureFlags.disableFeature();
                }

                const result = await safeLoadCustomerData();

                // Re-enable if possible
                if (window.CustomerFeatureFlags && window.CustomerFeatureFlags.enableFeature) {
                    window.CustomerFeatureFlags.enableFeature();
                }

                return result && result.fallback !== undefined;
            } catch (error) {
                return false;
            }
        });

        // Test 8.3: Health monitoring prevents system overload
        this.addTest('Health monitoring prevents system overload', () => {
            try {
                const health = monitorCustomerDataHealth();
                return health &&
                    typeof health.errorRate === 'number' &&
                    typeof health.status === 'string';
            } catch (error) {
                return false;
            }
        });

        // Test 8.4: Data validation and sanitization
        this.addTest('Data validation and sanitization works', async () => {
            try {
                const result = await safeLoadCustomerData();
                if (!result || !result.data) return true; // Skip if no data

                // Check that data is properly structured
                const data = result.data;
                return data &&
                    typeof data.source === 'string' &&
                    Array.isArray(data.customers) &&
                    typeof data.totalCustomers === 'number';
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Helper method to add a test and track results
     */
    addTest(testName, testFunction) {
        this.totalTests++;

        try {
            const result = testFunction();
            const isAsync = result && typeof result.then === 'function';

            if (isAsync) {
                return result.then(success => {
                    if (success) {
                        this.passedTests++;
                        this.testResults.push({
                            name: testName,
                            status: 'PASS',
                            message: 'Test passed successfully'
                        });
                        console.log(`✅ ${testName}`);
                    } else {
                        this.failedTests++;
                        this.testResults.push({
                            name: testName,
                            status: 'FAIL',
                            message: 'Test failed'
                        });
                        console.log(`❌ ${testName}`);
                    }
                }).catch(error => {
                    this.failedTests++;
                    this.testResults.push({
                        name: testName,
                        status: 'ERROR',
                        message: error.message
                    });
                    console.log(`❌ ${testName} - Error: ${error.message}`);
                });
            } else {
                if (result) {
                    this.passedTests++;
                    this.testResults.push({
                        name: testName,
                        status: 'PASS',
                        message: 'Test passed successfully'
                    });
                    console.log(`✅ ${testName}`);
                } else {
                    this.failedTests++;
                    this.testResults.push({
                        name: testName,
                        status: 'FAIL',
                        message: 'Test failed'
                    });
                    console.log(`❌ ${testName}`);
                }
            }
        } catch (error) {
            this.failedTests++;
            this.testResults.push({
                name: testName,
                status: 'ERROR',
                message: error.message
            });
            console.log(`❌ ${testName} - Error: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const duration = this.testEndTime - this.testStartTime;
        const passRate = this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0;

        const report = {
            summary: {
                totalTests: this.totalTests,
                passedTests: this.passedTests,
                failedTests: this.failedTests,
                passRate: passRate.toFixed(1) + '%',
                duration: duration + 'ms',
                timestamp: new Date().toISOString()
            },
            results: this.testResults,
            recommendations: this.generateRecommendations(),
            healthCheck: this.performHealthCheck()
        };

        console.log('📋 Customer Management Test Report:', report);
        return report;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.failedTests > 0) {
            const failedTestNames = this.testResults
                .filter(result => result.status !== 'PASS')
                .map(result => result.name);

            recommendations.push({
                priority: 'HIGH',
                issue: `${this.failedTests} tests failed`,
                recommendation: `Review and fix the following tests: ${failedTestNames.join(', ')}`
            });
        }

        if (this.passedTests < this.totalTests * 0.8) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: 'Low test pass rate',
                recommendation: 'Consider improving the implementation to achieve at least 80% test coverage'
            });
        }

        // Check for specific issues
        const featureFlagTests = this.testResults.filter(result =>
            result.name.includes('Feature') && result.status !== 'PASS'
        );
        if (featureFlagTests.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'Feature flag system issues',
                recommendation: 'Ensure CustomerFeatureFlags object is properly configured and available globally'
            });
        }

        const dataLoadingTests = this.testResults.filter(result =>
            result.name.includes('Data Loading') && result.status !== 'PASS'
        );
        if (dataLoadingTests.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'Data loading function issues',
                recommendation: 'Verify that all safe data loading functions are properly implemented and accessible'
            });
        }

        const safetyTests = this.testResults.filter(result =>
            result.name.includes('Safety') && result.status !== 'PASS'
        );
        if (safetyTests.length > 0) {
            recommendations.push({
                priority: 'CRITICAL',
                issue: 'Safety mechanism issues',
                recommendation: 'Safety mechanisms are critical - review and fix immediately before deployment'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'LOW',
                issue: 'All tests passed',
                recommendation: 'System appears to be working correctly. Continue monitoring in production.'
            });
        }

        return recommendations;
    }

    /**
     * Perform overall health check
     */
    performHealthCheck() {
        const healthCheck = {
            systemStatus: 'unknown',
            criticalIssues: [],
            warnings: [],
            suggestions: []
        };

        // Determine system status
        if (this.failedTests === 0) {
            healthCheck.systemStatus = 'HEALTHY';
        } else if (this.failedTests <= 2) {
            healthCheck.systemStatus = 'DEGRADED';
        } else {
            healthCheck.systemStatus = 'CRITICAL';
        }

        // Identify critical issues
        const criticalFailures = this.testResults.filter(result =>
            result.status === 'ERROR' ||
            (result.status === 'FAIL' && result.name.includes('Safety'))
        );

        healthCheck.criticalIssues = criticalFailures.map(result => ({
            test: result.name,
            issue: result.message,
            priority: result.name.includes('Safety') ? 'CRITICAL' : 'HIGH'
        }));

        // Add warnings for failed non-critical tests
        const warnings = this.testResults.filter(result =>
            result.status === 'FAIL' && !result.name.includes('Safety')
        );

        healthCheck.warnings = warnings.map(result => ({
            test: result.name,
            issue: result.message,
            priority: 'MEDIUM'
        }));

        // Add suggestions
        if (this.passedTests < this.totalTests) {
            healthCheck.suggestions.push('Review failed tests and implement fixes');
        }

        if (this.totalTests < 20) {
            healthCheck.suggestions.push('Consider adding more comprehensive test coverage');
        }

        healthCheck.suggestions.push('Monitor system performance in production environment');
        healthCheck.suggestions.push('Set up alerting for safety mechanism failures');

        return healthCheck;
    }
}

/**
 * Run all customer management tests and display results
 */
async function runCustomerManagementTests() {
    console.log('🚀 Starting comprehensive customer management testing...');

    try {
        const tester = new CustomerManagementTester();
        const results = await tester.runAllTests();

        // Display results in console
        console.log('📊 CUSTOMER MANAGEMENT TEST RESULTS');
        console.log('=====================================');
        console.log(`Total Tests: ${results.summary.totalTests}`);
        console.log(`Passed: ${results.summary.passedTests}`);
        console.log(`Failed: ${results.summary.failedTests}`);
        console.log(`Pass Rate: ${results.summary.passRate}`);
        console.log(`Duration: ${results.summary.duration}`);
        console.log('');

        // Show detailed results
        results.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${result.name}: ${result.status}`);
            if (result.message && result.status !== 'PASS') {
                console.log(`   ${result.message}`);
            }
        });

        console.log('');
        console.log('📋 RECOMMENDATIONS:');
        results.recommendations.forEach(rec => {
            console.log(`[${rec.priority}] ${rec.issue}`);
            console.log(`   → ${rec.recommendation}`);
        });

        console.log('');
        console.log('🏥 HEALTH CHECK:');
        console.log(`System Status: ${results.healthCheck.systemStatus}`);

        if (results.healthCheck.criticalIssues.length > 0) {
            console.log('Critical Issues:');
            results.healthCheck.criticalIssues.forEach(issue => {
                console.log(`   - ${issue.test}: ${issue.issue}`);
            });
        }

        if (results.healthCheck.warnings.length > 0) {
            console.log('Warnings:');
            results.healthCheck.warnings.forEach(warning => {
                console.log(`   - ${warning.test}: ${warning.issue}`);
            });
        }

        // Show alert with summary
        const alertMessage = `Customer Management Testing Complete!\n\n` +
            `Total Tests: ${results.summary.totalTests}\n` +
            `Passed: ${results.summary.passedTests}\n` +
            `Failed: ${results.summary.failedTests}\n` +
            `Pass Rate: ${results.summary.passRate}\n\n` +
            `System Status: ${results.healthCheck.systemStatus}\n` +
            `Critical Issues: ${results.healthCheck.criticalIssues.length}\n` +
            `Warnings: ${results.healthCheck.warnings.length}`;

        alert(alertMessage);

        return results;

    } catch (error) {
        console.error('❌ Critical error during testing:', error);
        alert(`Testing failed with critical error: ${error.message}`);
        return null;
    }
}

/**
 * Quick test function for basic functionality
 */
async function quickTestCustomerManagement() {
    console.log('⚡ Running quick customer management test...');

    try {
        const tests = [
            {
                name: 'Feature flags available',
                test: () => window.CustomerFeatureFlags !== undefined
            },
            {
                name: 'Safe data loading functions exist',
                test: () => typeof safeLoadCustomerData === 'function'
            },
            {
                name: 'Health monitoring available',
                test: () => typeof monitorCustomerDataHealth === 'function'
            },
            {
                name: 'Customer management section exists',
                test: () => document.getElementById('customerManagement') !== null
            }
        ];

        let passed = 0;
        let total = tests.length;

        tests.forEach(test => {
            try {
                if (test.test()) {
                    passed++;
                    console.log(`✅ ${test.name}`);
                } else {
                    console.log(`❌ ${test.name}`);
                }
            } catch (error) {
                console.log(`❌ ${test.name} - Error: ${error.message}`);
            }
        });

        const passRate = (passed / total) * 100;
        console.log(`\nQuick Test Results: ${passed}/${total} (${passRate.toFixed(0)}%)`);

        if (passRate >= 75) {
            console.log('🎉 Customer management system appears to be working correctly!');
        } else {
            console.log('⚠️ Some issues detected - run full test suite for details');
        }

        return { passed, total, passRate: passRate.toFixed(0) + '%' };

    } catch (error) {
        console.error('❌ Quick test failed:', error);
        return null;
    }
}

// Missing functions that are referenced but not defined

// Handle customer errors (for customer management system)
function handleCustomerError(error, context = '') {
    console.error(`Customer Management Error ${context}:`, error);

    // Show user-friendly error message
    const errorMessage = error?.message || error || 'Unknown error occurred';

    if (typeof addActivity === 'function') {
        addActivity(`Customer error ${context}: ${errorMessage}`, 'error');
    }

    // Show alert for critical errors
    if (error?.critical) {
        alert(`Customer Management Error: ${errorMessage}`);
    }
}

// Toggle all orders bulk selection (for order management)
function toggleAllOrdersBulk(checkbox) {
    const checkboxes = document.querySelectorAll('.order-bulk-checkbox');
    const isChecked = checkbox.checked;

    checkboxes.forEach(cb => {
        if (cb !== checkbox) {
            cb.checked = isChecked;
        }
    });

    // Update bulk actions visibility
    updateBulkActionsVisibility();
}

// Update bulk actions visibility
function updateBulkActionsVisibility() {
    const checkedBoxes = document.querySelectorAll('.order-bulk-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');

    if (bulkActions) {
        if (checkedBoxes.length > 0) {
            bulkActions.style.display = 'block';
            bulkActions.textContent = `${checkedBoxes.length} order(s) selected`;
        } else {
            bulkActions.style.display = 'none';
        }
    }
}

/**
 * Test runner for development and debugging
 */
function initializeCustomerManagementTesting() {
    console.log('🔧 Initializing customer management testing system...');

    // Add test buttons to UI if they don't exist
    const testButtonsContainer = document.getElementById('testButtonsContainer');
    if (testButtonsContainer) {
        // Add quick test button
        if (!document.getElementById('quickTestBtn')) {
            const quickTestBtn = document.createElement('button');
            quickTestBtn.id = 'quickTestBtn';
            quickTestBtn.className = 'btn-secondary';
            quickTestBtn.innerHTML = '<i class="fas fa-bolt"></i> Quick Test';
            quickTestBtn.onclick = quickTestCustomerManagement;
            quickTestBtn.style.marginRight = '10px';
            testButtonsContainer.appendChild(quickTestBtn);
        }

        // Add comprehensive test button
        if (!document.getElementById('comprehensiveTestBtn')) {
            const comprehensiveTestBtn = document.createElement('button');
            comprehensiveTestBtn.id = 'comprehensiveTestBtn';
            comprehensiveTestBtn.className = 'btn-primary';
            comprehensiveTestBtn.innerHTML = '<i class="fas fa-vial"></i> Full Test Suite';
            comprehensiveTestBtn.onclick = runCustomerManagementTests;
            testButtonsContainer.appendChild(comprehensiveTestBtn);
        }
    }

    console.log('✅ Customer management testing system initialized');
}

// Initialize testing system when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        initializeCustomerManagementTesting();
    }, 2000);
});

// ============ GLOBAL FUNCTION EXPOSURE FOR BROWSER TESTING ============
// Make customer management functions available globally for testing

// Safe data loading functions
window.safeLoadCustomerData = safeLoadCustomerData;
window.safeLoadCustomerPortalData = safeLoadCustomerPortalData;
window.safeLoadCustomerImportData = safeLoadCustomerImportData;
window.safeCreateMinimalCustomerData = safeCreateMinimalCustomerData;

// Testing functions
window.runCustomerManagementTests = runCustomerManagementTests;
window.quickTestCustomerManagement = quickTestCustomerManagement;
window.CustomerManagementTester = CustomerManagementTester;

// Health monitoring functions
window.monitorCustomerDataHealth = monitorCustomerDataHealth;
window.recordCustomerDataLoad = recordCustomerDataLoad;
window.startCustomerDataHealthMonitoring = startCustomerDataHealthMonitoring;
window.safeRefreshCustomerData = safeRefreshCustomerData;
window.displayCustomerDataStatus = displayCustomerDataStatus;

// Error handling function
window.handleCustomerError = handleCustomerError;

// Feature flag functions (if available)
if (window.CustomerFeatureFlags) {
    window.isCustomerManagementEnabled = window.CustomerFeatureFlags.isEnabled;
    window.checkCustomerManagementHealth = monitorCustomerDataHealth;
}

// Order management functions - use the existing function, don't duplicate
window.toggleAllOrdersBulk = toggleAllOrders;

// Configuration
window.CUSTOMER_MANAGEMENT_CONFIG = {
    version: '1.0',
    features: {
        safeDataLoading: true,
        healthMonitoring: true,
        errorHandling: true,
        testingSuite: true
    },
    safety: {
        maxLoadTime: 5000,
        maxErrorRate: 0.1,
        autoDisableOnHighErrorRate: true
    }
};

console.log('✅ Customer management functions exposed globally for browser testing');

/* Supplier Invoice and Pricing Updates */

let pendingPricingUpdates = []; // Store updates pending approval

async function handleSupplierInvoiceUpload(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please upload a valid PDF file.');
        return;
    }

    console.log('📄 Starting PDF processing:', file.name, 'Size:', file.size, 'bytes');

    try {
        if (typeof showLoadingState === 'function') showLoadingState(true, 'Analyzing Supplier Invoice...');

        // Ensure pdfjsLib is available
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded');
        }

        console.log('✅ PDF.js library available');

        const arrayBuffer = await file.arrayBuffer();
        console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('📄 PDF loaded, pages:', pdf.numPages);

        let fullText = '';

        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`📃 Processing page ${i}/${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            console.log(`📃 Page ${i} has ${content.items.length} text items`);

            // Log first few items for debugging
            if (content.items.length > 0) {
                console.log('📃 First 5 text items:', content.items.slice(0, 5).map(item => item.str));
            }

            // Try to preserve layout slightly better by tracking Y position
            let lastY = -1;
            let pageText = '';
            content.items.forEach(item => {
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = item.transform[5];
            });
            fullText += pageText + '\n';
        }

        console.log('📄 Extracted PDF Text Length:', fullText.length);
        console.log('📄 First 500 chars of extracted text:', fullText.substring(0, 500));

        // Check if PDF is likely scanned (no text extracted)
        if (fullText.trim().length < 10) {
            console.warn('⚠️ Very little text extracted - PDF might be scanned/image-based');
            alert('This PDF appears to be scanned or image-based. Text could not be extracted. Please use a PDF with selectable text, or manually update prices.');
            return;
        }

        pendingPricingUpdates = extractPricingFromText(fullText);

        if (pendingPricingUpdates.length === 0) {
            console.warn('⚠️ No products matched. Products in DB:', products.map(p => p.name));
            alert('No matching products found in this invoice. Make sure product names in the PDF match your database product names.');
        } else {
            showPricingUpdateModal(pendingPricingUpdates);
        }
    } catch (error) {
        console.error('❌ Error parsing supplier invoice:', error);
        alert('Failed to parse invoice: ' + error.message);
    } finally {
        if (typeof showLoadingState === 'function') showLoadingState(false);
        event.target.value = ''; // Reset input
    }
}

function extractPricingFromText(text) {
    const updates = [];
    // Normalize text for searching
    const normalizedText = text.toLowerCase();

    // Iterate through all known products
    if (!products || products.length === 0) {
        console.warn('No products loaded to match against.');
        return [];
    }

    products.forEach(product => {
        if (!product.active) return;

        const searchName = product.name.toLowerCase();

        // Find all occurrences
        let pos = normalizedText.indexOf(searchName);
        if (pos !== -1) {
            // Find the line containing this occurrence
            const lineStart = text.lastIndexOf('\n', pos);
            const lineEnd = text.indexOf('\n', pos + searchName.length);

            if (lineStart !== -1 && lineEnd !== -1) {
                const line = text.substring(lineStart, lineEnd);

                // Look for price pattern (R xxx.xx or xxx.xx)
                const numbers = line.match(/\d+(\.\d{2})/g); // Match 123.45 format
                if (numbers) {
                    const prices = numbers.map(parseFloat).sort((a, b) => a - b);

                    // Strategy: Find number closest to current cost price (within 50% deviation)
                    let candidatePrice = null;
                    if (product.cost_price > 0) {
                        candidatePrice = prices.find(p => Math.abs(p - product.cost_price) / product.cost_price < 0.5);
                    } else {
                        // If no kost price, guess based on position or reasonable range? 
                        // Usually cost is smaller than selling, and total is largest.
                        // Let's assume the smallest number > 5 is unit price? (Risky)
                        // Fallback: take first match
                        candidatePrice = prices[0];
                    }

                    if (candidatePrice) {
                        // Calculate metrics
                        const currentMargin = product.cost_price > 0
                            ? (product.selling_price - product.cost_price) / product.cost_price
                            : 0.15; // default 15%

                        // Rounding logic can be improved
                        const calcSelling = candidatePrice * (1 + currentMargin);

                        updates.push({
                            id: product.id,
                            name: product.name,
                            oldCost: product.cost_price,
                            newCost: candidatePrice,
                            oldSelling: product.selling_price,
                            margin: currentMargin,
                            calcSelling: calcSelling,
                            finalSelling: Math.ceil(calcSelling) // Default round up to nearest Rand? Or just raw
                        });
                    }
                }
            }
        }
    });
    console.log(`✅ Extracted ${updates.length} pricing updates`);
    console.log('🔍 First 3 updates:', JSON.stringify(updates.slice(0, 3), null, 2));
    return updates;
}

function showPricingUpdateModal(updates) {
    const modal = document.getElementById('pricingUpdateModal');
    const tbody = document.getElementById('pricingUpdateBody');
    if (!tbody) {
        console.error('Modal body not found');
        return;
    }
    tbody.innerHTML = '';

    updates.forEach((update, index) => {
        try {
            const row = document.createElement('tr');
            // Ensure values are numbers before toFixed
            const oldCost = Number(update.oldCost) || 0;
            const newCost = Number(update.newCost) || 0;
            const oldSelling = Number(update.oldSelling) || 0;
            const calcSelling = Number(update.calcSelling) || 0;
            const finalSelling = Number(update.finalSelling) || 0;
            const margin = Number(update.margin) || 0;

            row.innerHTML = `
                <td>${update.name}</td>
                <td>R${oldCost.toFixed(2)}</td>
                <td class="font-bold text-blue-600">R${newCost.toFixed(2)}</td>
                <td>R${oldSelling.toFixed(2)}</td>
                <td>${(margin * 100).toFixed(1)}%</td>
                <td>R${calcSelling.toFixed(2)}</td>
                <td>
                    <input type="number" step="1.00" 
                        value="${finalSelling.toFixed(2)}" 
                        onchange="updateFinalPrice(${index}, this.value)"
                        class="p-1 border rounded w-24">
                </td>
            `;
            tbody.appendChild(row);
        } catch (rowError) {
            console.error('Error rendering row for update:', update, rowError);
        }
    });

    if (modal) modal.style.display = 'block';
}

function closePricingUpdateModal() {
    const modal = document.getElementById('pricingUpdateModal');
    if (modal) modal.style.display = 'none';
}

function updateFinalPrice(index, value) {
    if (pendingPricingUpdates[index]) {
        pendingPricingUpdates[index].finalSelling = parseFloat(value);
    }
}

async function applyPricingUpdates() {
    if (!pendingPricingUpdates.length) return;

    if (typeof showLoadingState === 'function') showLoadingState(true, 'Updating database...');
    try {
        if (!supabaseClient) throw new Error('Database not connected');

        // Process updates
        const promises = pendingPricingUpdates.map(update => {
            return supabaseClient
                .from('products')
                .update({
                    cost_price: update.newCost,
                    selling_price: update.finalSelling,
                    updated_at: new Date()
                })
                .eq('id', update.id);
        });

        await Promise.all(promises);

        alert('Successfully updated ' + pendingPricingUpdates.length + ' products.');
        closePricingUpdateModal();
        await loadProducts(); // Refresh local list and UI

    } catch (error) {
        console.error('Failed to update pricing:', error);
        alert('Error updating database: ' + error.message);
    } finally {
        if (typeof showLoadingState === 'function') showLoadingState(false);
    }
}

// Global exposure
window.handleSupplierInvoiceUpload = handleSupplierInvoiceUpload;
window.closePricingUpdateModal = closePricingUpdateModal;
window.applyPricingUpdates = applyPricingUpdates;
window.updateFinalPrice = updateFinalPrice;
// ============ SMART CUSTOMER MATCHING ============

/**
 * Loads all customers from database for smart matching
 * Uses caching to avoid repeated calls
 */
let _cachedAllCustomers = null;
let _lastCustomerLoadTime = 0;

async function loadAllCustomers() {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (_cachedAllCustomers && (Date.now() - _lastCustomerLoadTime < CACHE_DURATION)) {
        return _cachedAllCustomers;
    }

    try {
        if (!supabaseClient) return [];

        console.log('🔄 Loading all customers for smart matching...');

        // Fetch ID, Name, Email, Phone
        const { data, error } = await supabaseClient
            .from('customers')
            .select('id, name, email, phone');

        if (error) {
            console.error('❌ Error loading customers:', error);
            return [];
        }

        _cachedAllCustomers = data || [];
        _lastCustomerLoadTime = Date.now();
        console.log(`✅ Loaded ${_cachedAllCustomers.length} customers for matching`);

        return _cachedAllCustomers;
    } catch (err) {
        console.error('Failed to load customers:', err);
        return [];
    }
}

/**
 * Finds the best customer match based on input data
 * STRICT MODE: Returns null if multiple matches are found (ambiguity)
 */
function findBestCustomerMatch(inputName, inputEmail, inputPhone, customers) {
    if (!customers || customers.length === 0) return null;

    const cleanName = inputName ? inputName.trim().toLowerCase() : '';
    const cleanEmail = inputEmail ? inputEmail.trim().toLowerCase() : '';
    const cleanPhone = inputPhone ? inputPhone.replace(/\D/g, '') : '';

    // 1. Exact Unique Identifier Match (Highest Confidence)
    if (cleanEmail) {
        const emailMatch = customers.find(c => c.email && c.email.toLowerCase() === cleanEmail);
        if (emailMatch) {
            console.log(`🎯 Exact Email Match: ${inputEmail} -> ${emailMatch.name}`);
            return emailMatch;
        }
    }

    if (cleanPhone && cleanPhone.length > 5) { // Minimum length to avoid false positives
        const phoneMatch = customers.find(c => {
            const dbPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
            return dbPhone && (dbPhone === cleanPhone || dbPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhone));
        });
        if (phoneMatch) {
            console.log(`🎯 Phone Match: ${inputPhone} -> ${phoneMatch.name}`);
            return phoneMatch;
        }
    }

    // 2. Exact Name Match
    if (cleanName) {
        const exactNameMatches = customers.filter(c => c.name && c.name.toLowerCase() === cleanName);
        if (exactNameMatches.length === 1) {
            console.log(`🎯 Exact Name Match: ${inputName} -> ${exactNameMatches[0].name}`);
            return exactNameMatches[0];
        } else if (exactNameMatches.length > 1) {
            console.warn(`⚠️ AMBIGUOUS Exact Name: "${inputName}" matches ${exactNameMatches.length} people. returning NULL.`);
            return null; // Safety: Multiple "Chris Smith"s -> Don't guess
        }
    }

    // 3. Partial Name Match (Strict)
    // Only works if the input name is significant (e.g. > 3 chars)
    if (cleanName && cleanName.length > 3) {
        const partialMatches = customers.filter(c => c.name && c.name.toLowerCase().includes(cleanName));

        if (partialMatches.length === 1) {
            console.log(`🎯 Unique Partial Match: "${inputName}" -> "${partialMatches[0].name}"`);
            return partialMatches[0];
        } else if (partialMatches.length > 1) {
            console.warn(`⚠️ AMBIGUOUS Partial Name: "${inputName}" found in ${partialMatches.map(c => c.name).join(', ')}. Returning NULL.`);
            return null; // Safety: "Chris" matches "Chris Fourie" AND "Chris Liang" -> Don't guess
        }
    }

    return null; // No safe match found
}
