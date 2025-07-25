// Global variables
let imports = {}; // Structure: { importId: { name, date, orders: [], invoices: [] } }
let currentImportId = null;
let invoices = []; // Global invoices across all imports
let emailQueue = [];
let csvData = null;
let csvHeaders = [];
let analysisHistory = [];
let lastPDFAnalysis = null; // Store the last PDF analysis for import
let isInitializing = true; // Prevent saves during initialization

// Helper functions for import management
function getCurrentOrders() {
    return currentImportId && imports[currentImportId] ? imports[currentImportId].orders : [];
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
    return parseFloat((baseWeight * quantity).toFixed(2));
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
    'Gevulde hoender rolle  R193/kg (Opsie 2 - Peppadew, mozzarella, cheddar,pynappel)1.2kg-1.6kg': 'GEVULDE HOENDER ROLLE VAKUUM VERPAK',
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
    '4bors': 'BORSSTUKKE MET BEEN EN VEL',
    '2bors': 'BORSSTUKKE MET BEEN EN VEL', 
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
    'pep rol': 'GEVULDE HOENDER ROLLE VAKUUM VERPAK',
    'groen vye': 'INGELEGDE GROEN VYE'
};

// March 2025 Braaikuikens - EXACT COST and SELLING prices from supplier
let pricing = {
    'HEEL HOENDER': { cost: 59.00, selling: 67.00, packaging: '' },
    'PLAT HOENDER (FLATTY\'S)': { cost: 69.00, selling: 79.00, packaging: 'VACUUM VERPAK' },
    'BRAAIPAKKE': { cost: 65.00, selling: 74.00, packaging: '1 Heel hoender opgesnye VACUUM VERPAK' },
    'HEEL HALWE HOENDERS': { cost: 60.00, selling: 68.00, packaging: '1 Heel hoender deurgesny' },
    'BORSSTUKKE MET BEEN EN VEL': { cost: 64.00, selling: 73.00, packaging: '4 in pak OF 2 in pak MELD KEUSE IN BESTELLING' },
    'VLERKIES': { cost: 79.00, selling: 90.00, packaging: '8 IN PAK NIE ALTYD BESKIKBAAR' },
    'BOUDE EN DYE': { cost: 71.00, selling: 81.00, packaging: '2 boude en 2 dye in pak' },
    'GUNS Boud en dy aanmekaar': { cost: 71.00, selling: 81.00, packaging: '3 IN PAK' },
    'LEWER': { cost: 27.00, selling: 31.00, packaging: 'In 500g bakkies verpak' },
    'NEKKIES': { cost: 25.00, selling: 30.00, packaging: 'In 500g sakkies verpak NIE ALTYD BESKIKBAAR' },
    'FILETTE (sonder vel)': { cost: 86.50, selling: 100.00, packaging: '4 fillets per pak' },
    'STRIPS': { cost: 86.50, selling: 100.00, packaging: '± 500g per pak' },
    'ONTBEENDE HOENDER': { cost: 110.00, selling: 125.00, packaging: 'VACUUM VERPAK' },
    'GEVULDE HOENDER ROLLE VAKUUM VERPAK': { cost: 166.00, selling: 193.00, packaging: 'Opsie 1: Vye, feta, cheddar, sweet chilly. Opsie 2: Peppadew, mozzarella, cheddar, pynappel.' },
    'INGELEGDE GROEN VYE': { cost: 55, selling: 75, packaging: '375ml potjie', unit: 'per potjie' },
    'HOENDER PATTIES': { cost: 105.00, selling: 120.00, packaging: '4 in pak (120-140g patty)' },
    'HOENDER KAASWORS': { cost: 140.00, selling: 148.00, packaging: '500gr VACUUM VERPAK' },
    'SUIWER HEUNING': { cost: 60, selling: 70, packaging: '500g potjie', unit: 'per potjie' }
};

// Supabase Configuration
const SUPABASE_URL = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Email Service Configuration - Google Apps Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'; // Paste your Web App URL here after deploying GoogleAppsScript.gs

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeDatabase();
    loadStoredData();
    updateDashboard();
    loadPricingTable();
    loadCurrentRatesTable();
    setupPDFDragDrop();
    // Initialize data status on load
    setTimeout(refreshDataStatus, 1000);
    // Finish initialization to allow saves
    setTimeout(() => {
        isInitializing = false;
        console.log('Application initialization complete');
    }, 2000);
});

function initializeApp() {
    // Set up navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
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
        
        // Test the connection
        const { error } = await supabaseClient
            .from('imports')
            .select('count', { count: 'exact', head: true });
        
        if (error && error.code === '42P01') {
            // Tables don't exist, show setup message
            console.log('Database tables need to be created.');
            showDatabaseSetupModal();
        } else if (error) {
            console.error('Database connection error:', error);
            addActivity('Database connection failed - using local storage');
        } else {
            console.log('Supabase connected successfully');
            addActivity('Connected to Supabase database');
            
            // Try to migrate existing localStorage data
            await migrateToDatabase();
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        addActivity('Database initialization failed - using local storage');
    }
}

async function saveToDatabase() {
    // Skip save during initialization to prevent excessive calls
    if (isInitializing) {
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
                return false;
            }
        }
        
        // Save settings
        const { error: settingsError } = await supabaseClient
            .from('settings')
            .upsert({
                id: 'main',
                current_import_id: currentImportId,
                pricing: pricing,
                email_queue: emailQueue,
                analysis_history: analysisHistory
            });
        
        if (settingsError) {
            console.error('Error saving settings:', settingsError);
            return false;
        }
        
        console.log('Data saved to Supabase successfully');
        return true;
    } catch (error) {
        console.error('Database save error:', error);
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
            // DON'T load pricing from database - always use current default values
            // pricing = settingsData.pricing || pricing;
            emailQueue = settingsData.email_queue || [];
            analysisHistory = settingsData.analysis_history || [];
        }
        
        console.log('Data loaded from Supabase successfully');
        return true;
    } catch (error) {
        console.error('Database load error:', error);
        return false;
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
    pricing JSONB DEFAULT '{}'::jsonb,
    gmail_config JSONB DEFAULT '{}'::jsonb,
    email_queue JSONB DEFAULT '[]'::jsonb,
    analysis_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now)
CREATE POLICY "Allow all operations on imports" ON imports FOR ALL USING (true);
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true);
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
            alert(`Failed to send email: ${result.message}`);
            return false;
        }
    } catch (error) {
        showLoadingState(false);
        console.error('Error sending email:', error);
        alert(`Error sending email: ${error.message}`);
        return false;
    }
}


// Email queue management
function addToEmailQueue(orderData) {
    const emailData = {
        id: Date.now(),
        to: orderData.email,
        subject: generateEmailSubject(orderData),
        body: generateEmailBody(orderData),
        orderData: orderData,
        status: 'pending',
        timestamp: new Date().toISOString()
    };
    
    emailQueue.push(emailData);
    updateEmailQueueDisplay();
    saveToStorage();
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
    return template
        .replace('{customerName}', orderData.name)
        .replace('{orderNumber}', orderData.orderId)
        .replace('{productName}', orderData.product)
        .replace('{quantity}', orderData.quantity)
        .replace('{total}', orderData.total);
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
    
    // Build product list for multi-product orders
    const productList = orderData.products.map(product => 
        `- ${product.originalDescription || product.product}: ${product.quantity} qty, ${product.weight}kg @ R${product.unitPrice}/kg = R${product.total.toFixed(2)}`
    ).join('\n');
    
    return template
        .replace('{customerName}', orderData.name)
        .replace('{orderNumber}', orderData.orderId)
        .replace('{productName}', `Multiple items:\n${productList}`)
        .replace('{quantity}', orderData.products.length + ' items')
        .replace('{total}', orderData.total.toFixed(2));
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
                ${email.status === 'pending' ? `<button onclick="removeFromQueue('${email.id}')" class="btn-small btn-danger">Remove</button>` : ''}
                ${email.status === 'failed' ? `<button onclick="retryEmail('${email.id}')" class="btn-small btn-secondary">Retry</button>` : ''}
            </div>
        </div>
    `).join('');

    queueContainer.innerHTML = queueHTML;
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
            total: 'R268.00'
        };

        const subject = generateEmailSubject(testOrder);
        const body = generateEmailBody(testOrder);
        
        await sendEmailViaGoogleScript(testEmailAddress, subject, body);
        
        alert('Test email sent successfully with invoice template!');
        addActivity(`Test email sent to ${testEmailAddress} with invoice template`);
    } catch (error) {
        alert(`Failed to send test email: ${error.message}`);
    }
}

// Order processing functions
function processOrders() {
    const orderData = document.getElementById('orderData').value.trim();
    if (!orderData) {
        alert('Please paste order data first.');
        return;
    }

    try {
        const lines = orderData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const newOrders = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim());
                const order = {
                    orderId: 'ORD-' + Date.now() + '-' + i,
                    date: new Date().toISOString().split('T')[0],
                    name: values[headers.indexOf('name')] || '',
                    email: values[headers.indexOf('email')] || '',
                    phone: values[headers.indexOf('phone')] || '',
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
        tableBody.innerHTML = '<tr><td colspan="11" class="no-data">No orders loaded</td></tr>';
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
function generateInvoice(orderId) {
    const currentOrders = getCurrentOrders();
    const order = currentOrders.find(o => o.orderId === orderId);
    if (!order || !currentImportId) return;
    
    // Handle both old single-product and new multi-product orders
    let invoiceItems = [];
    let subtotal = 0;
    
    if (order.products && order.products.length > 0) {
        // New multi-product format - ALWAYS use current selling prices
        invoiceItems = order.products.map(product => {
            const currentPricing = pricing[product.product];
            const unitPrice = currentPricing ? currentPricing.selling : product.unitPrice;
            const weight = product.weight || (product.quantity * 2.0); // Default 2kg per item if not specified
            const total = unitPrice * weight; // Recalculate with current selling price
            
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
        const total = unitPrice * estimatedWeight; // Recalculate with current selling price
        
        invoiceItems = [{
            product: order.product,
            quantity: order.quantity,
            weight: estimatedWeight,
            unitPrice: unitPrice,
            total: total
        }];
        subtotal = total;
    }
    
    const invoice = {
        invoiceId: 'INV-' + Date.now(),
        orderId: order.orderId,
        date: new Date().toISOString().split('T')[0],
        customerName: order.name,
        customerEmail: order.email,
        customerPhone: order.phone,
        customerAddress: order.address,
        items: invoiceItems,
        subtotal: subtotal,
        tax: subtotal * 0.15, // 15% VAT
        total: subtotal * 1.15,
        status: 'generated'
    };
    
    // Add invoice to both global and import-specific collections
    invoices.push(invoice);
    imports[currentImportId].invoices.push(invoice);
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
    
    pendingOrders.forEach(order => generateInvoice(order.orderId));
    
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
                    <button onclick="downloadInvoice('${invoice.invoiceId}')" class="btn-small btn-secondary">Download PDF</button>
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
        const margin = Math.round(((prices.selling - prices.cost) / prices.cost) * 100);
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
    
    const cost = parseFloat(prompt('Enter cost price:'));
    const selling = parseFloat(prompt('Enter selling price:'));
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
                localStorage.setItem('plaasHoendersPricing', JSON.stringify(pricing));
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


function saveEmailTemplate() {
    const template = {
        subject: document.getElementById('emailSubject').value,
        body: document.getElementById('emailTemplate').value
    };
    
    localStorage.setItem('plaasHoendersEmailTemplate', JSON.stringify(template));
    addActivity('Email template updated');
    alert('Email template saved!');
}

// Utility functions
function exportData() {
    const data = {
        orders: orders,
        invoices: invoices,
        emailQueue: emailQueue,
        pricing: pricing,
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
    reader.onload = function(e) {
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

function processCSVFile() {
    if (!csvData || csvData.length === 0) {
        alert('No CSV data to process.');
        return;
    }
    
    // Ask for import name
    const importName = prompt('Enter a name for this import:', `Import ${new Date().toLocaleDateString()}`);
    if (!importName) return;
    
    try {
        const newOrders = [];
        const skippedRows = [];
        
        // Find column indices
        const emailIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('email'));
        const nameIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('name'));
        const phoneIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('tel'));
        const addressIndex = csvHeaders.findIndex(h => h.toLowerCase().includes('adress') || h.toLowerCase().includes('address'));
        
        // Process each row
        csvData.forEach((row, rowIndex) => {
            const email = row[emailIndex] || '';
            const name = row[nameIndex] || '';
            const phone = row[phoneIndex] || '';
            const address = row[addressIndex] || '';
            
            // Skip rows without essential info
            if (!email || !name) {
                skippedRows.push(rowIndex + 2); // +2 for header and 0-index
                return;
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
    if (!order || !order.products) return;
    
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
                                ${order.products.map(product => `
                                    <tr>
                                        <td>${product.product}</td>
                                        <td>${product.quantity}</td>
                                        <td>R${product.unitPrice}</td>
                                        <td>R${product.total.toFixed(2)}</td>
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
                                            <td>${item.originalDescription || item.product}</td>
                                            <td>${item.quantity}</td>
                                            ${invoice.source === 'PDF' && item.weight ? `<td>${item.weight.toFixed(2)}</td>` : ''}
                                            <td>R${item.unitPrice.toFixed(2)}</td>
                                            <td>R${item.total.toFixed(2)}</td>
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
    modal.addEventListener('click', function(e) {
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
    emailQueue = emailQueue.filter(e => e.id != emailId);
    updateEmailQueueDisplay();
    saveToStorage();
}

async function retryEmail(emailId) {
    const email = emailQueue.find(e => e.id == emailId);
    if (email) {
        email.status = 'pending';
        updateEmailQueueDisplay();
        saveToStorage();
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
        fileReader.onload = async function(e) {
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
        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
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
        
        // Look for table rows after headers
        const lines = pageText.split('\n');
        let inTableData = false;
        
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
                continue;
            }
            
            // If we're in table data, try to parse the line
            if (inTableData) {
                // Parse OCR line format: Fillets 3 2.99 88.50 264.62
                const parts = line.split(/\s+/);
                
                if (parts.length >= 5) {
                    // Extract fields based on ACTUAL meaning (not headers):
                    const description = parts[0];           // "Item" column = product name
                    const quantity = parseInt(parts[1]);    // "Description" column = count
                    const weight = parseFloat(parts[2]);    // "Quantity" column = weight in kg
                    const unitPrice = parseFloat(parts[3]); // "Unit Price" column = correct
                    const total = parseFloat(parts[4]);     // "Amount ZAR" column = correct
                    
                    if (description && !isNaN(quantity) && !isNaN(weight) && !isNaN(unitPrice) && !isNaN(total)) {
                        items.push({
                            description: description,
                            quantity: quantity,     // Actual count (3, 1)
                            weight: weight,         // Weight in kg (2.99, 1.00)
                            price: unitPrice,       // Price per unit (88.50, 60.00)
                            total: total           // Total amount (264.62, 60.00)
                        });
                        
                        console.log(`📦 Found item: ${description} - Count: ${quantity}, Weight: ${weight}kg, Price: R${unitPrice}, Total: R${total}`);
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
                                    <td>R${item.total.toFixed(2)}</td>
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
                                <td>${item.total.toFixed(2)}</td>
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
    
    // Search through all imports for a customer with matching name
    for (const importData of Object.values(imports)) {
        console.log(`📂 Checking import: ${importData.name} (${importData.orders.length} orders)`);
        
        const matchingOrder = importData.orders.find(order => {
            if (!order.name) return false;
            
            const orderName = order.name.toLowerCase().trim();
            const searchName = customerName.toLowerCase().trim();
            
            // Try exact match first
            if (orderName === searchName) {
                console.log(`✅ Exact match found: "${order.name}" === "${customerName}"`);
                return true;
            }
            
            // Try contains match
            if (orderName.includes(searchName) || searchName.includes(orderName)) {
                console.log(`✅ Partial match found: "${order.name}" ~= "${customerName}"`);
                return true;
            }
            
            // Try matching individual words (first name, last name)
            const orderWords = orderName.split(/\s+/);
            const searchWords = searchName.split(/\s+/);
            
            for (const searchWord of searchWords) {
                if (searchWord.length > 2 && orderWords.some(orderWord => orderWord.includes(searchWord))) {
                    console.log(`✅ Word match found: "${order.name}" contains "${searchWord}" from "${customerName}"`);
                    return true;
                }
            }
            
            return false;
        });
        
        if (matchingOrder) {
            console.log(`✅ Customer match found: "${matchingOrder.name}" (${matchingOrder.email})`);
            return {
                name: matchingOrder.name,
                email: matchingOrder.email,
                phone: matchingOrder.phone,
                address: matchingOrder.address
            };
        }
    }
    
    console.log(`❌ No existing customer found for: "${customerName}"`);
    
    // Debug: List all existing customer names for comparison
    console.log('📋 Available customer names:');
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
    // Try to find matching product from description
    for (const [key, value] of Object.entries(productMapping)) {
        if (description.toLowerCase().includes(key.toLowerCase()) || 
            description.toLowerCase().includes(value.toLowerCase())) {
            return value;
        }
    }
    
    // Try to match against pricing keys
    for (const product of Object.keys(pricing)) {
        if (description.toLowerCase().includes(product.toLowerCase())) {
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
    imports[currentImportId].invoices.push(invoice);
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
    imports[currentImportId].invoices.push(invoice);
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
    `  ${i+1}. ${item.description}
     Qty: ${item.quantity} | KG: ${item.weight} | Price: R${item.price} | Total: R${item.total.toFixed(2)}`
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
    `${i+1}. ${item.description}
   Quantity: ${item.quantity} | Weight: ${item.weight}kg | Price: R${item.price} | Total: R${item.total.toFixed(2)}`
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
        // Collect all data
        const backupData = {
            timestamp: new Date().toISOString(),
            version: "1.0",
            imports: imports,
            currentImportId: currentImportId,
            invoices: invoices,
            emailQueue: emailQueue,
            pricing: pricing,
            analysisHistory: analysisHistory
        };

        // Create downloadable file
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
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
        if (backupData.pricing && Object.keys(backupData.pricing).length > 0) {
            pricing = backupData.pricing;
        }
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