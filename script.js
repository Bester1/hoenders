// Global variables
let imports = {}; // Structure: { importId: { name, date, orders: [], invoices: [] } }
let currentImportId = null;
let invoices = []; // Global invoices across all imports
let emailQueue = [];
let gmailConfig = {};
let csvData = null;
let csvHeaders = [];
let analysisHistory = [];
let isInitializing = true; // Prevent saves during initialization

// Helper functions for import management
function getCurrentOrders() {
    return currentImportId && imports[currentImportId] ? imports[currentImportId].orders : [];
}

function getCurrentImportInvoices() {
    return currentImportId && imports[currentImportId] ? imports[currentImportId].invoices : [];
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
    'Heuning 500ml R70': 'SUIWER HEUNING'
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

// Gmail API Configuration
// Email Service Configuration
// Option 1: Google Apps Script (RECOMMENDED - Much easier!)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'; // Paste your Web App URL here after deploying GoogleAppsScript.gs

// Option 2: Gmail API (Complex - requires OAuth)
const GMAIL_API_KEY = 'YOUR_API_KEY_HERE'; // Get from Google Cloud Console > Credentials > API Keys
const GMAIL_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'; // Get from OAuth 2.0 Client ID
const GMAIL_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.send';

let gapi;
let tokenClient;
let isGmailInitialized = false;
let useGoogleScript = true; // Set to false to use Gmail API instead

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

    // Initialize Gmail API
    initializeGmailAPI();
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
                gmail_config: gmailConfig,
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
            pricing = settingsData.pricing || pricing;
            gmailConfig = settingsData.gmail_config || {};
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
        const localGmailConfig = JSON.parse(localStorage.getItem('plaasHoendersGmailConfig') || '{}');
        const localAnalysisHistory = JSON.parse(localStorage.getItem('plaasHoendersAnalysisHistory') || '[]');
        
        // Set global variables
        imports = localImports;
        currentImportId = localCurrentImportId;
        invoices = localInvoices;
        emailQueue = localEmailQueue;
        if (Object.keys(localPricing).length > 0) pricing = localPricing;
        gmailConfig = localGmailConfig;
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
            // localStorage.removeItem('plaasHoendersGmailConfig');
            // localStorage.removeItem('plaasHoendersAnalysisHistory');
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Migration error:', error);
        return false;
    }
}

// Gmail API Functions
async function initializeGmailAPI() {
    try {
        // Check if Gmail API script is loaded
        if (typeof gapi === 'undefined') {
            console.log('Gmail API script not loaded, skipping Gmail initialization');
            updateGmailStatus(false, 'API not loaded');
            return;
        }

        await new Promise((resolve, reject) => {
            gapi.load('client', {
                callback: resolve,
                onerror: reject
            });
        });
        
        await gapi.client.init({
            apiKey: GMAIL_API_KEY,
            discoveryDocs: [GMAIL_DISCOVERY_DOC],
        });

        if (typeof google !== 'undefined' && google.accounts) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GMAIL_CLIENT_ID,
                scope: GMAIL_SCOPES,
                callback: (response) => {
                    if (response.access_token) {
                        updateGmailStatus(true);
                        addActivity('Gmail connected successfully');
                    }
                },
            });
        }

        isGmailInitialized = true;
        console.log('Gmail API initialized successfully');
    } catch (error) {
        console.error('Gmail API initialization failed:', error);
        updateGmailStatus(false, 'Initialization failed');
    }
}

function connectGmail() {
    if (!isGmailInitialized) {
        alert('Gmail API is not initialized. Please check your configuration.');
        return;
    }

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function updateGmailStatus(connected, message = '') {
    const statusElement = document.getElementById('gmailStatusText');
    const statusIcon = document.querySelector('.gmail-status i');
    
    if (connected) {
        statusElement.textContent = 'Gmail Connected';
        statusIcon.style.color = '#4CAF50';
    } else {
        statusElement.textContent = message || 'Gmail Disconnected';
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
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                body: body,
                fromName: 'Plaas Hoenders',
                attachments: attachments
            })
        });

        const result = await response.json();
        
        showLoadingState(false);
        
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

async function sendEmailViaGmail(to, subject, body) {
    if (!gapi.client.getToken()) {
        throw new Error('Gmail not connected. Please connect Gmail first.');
    }

    try {
        // Create the email message
        const email = [
            `To: ${to}`,
            `Subject: ${subject}`,
            `Content-Type: text/html; charset=utf-8`,
            '',
            body
        ].join('\n');

        // Encode the email
        const encodedEmail = btoa(String.fromCharCode(...new TextEncoder().encode(email)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Send the email
        const response = await gapi.client.gmail.users.messages.send({
            userId: 'me',
            resource: {
                raw: encodedEmail
            }
        });

        console.log('Email sent successfully:', response);
        return response;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
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

async function sendQueuedEmails() {
    if (emailQueue.length === 0) {
        alert('No emails in queue to send.');
        return;
    }

    // Check which email service to use
    if (useGoogleScript && !GOOGLE_SCRIPT_URL) {
        alert('Please configure Google Apps Script URL first. See GOOGLE_APPS_SCRIPT_SETUP.md');
        return;
    } else if (!useGoogleScript && !gapi.client.getToken()) {
        alert('Please connect Gmail first.');
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
                // Use Google Apps Script or Gmail API based on configuration
                if (useGoogleScript) {
                    await sendEmailViaGoogleScript(email.to, email.subject, email.body);
                } else {
                    await sendEmailViaGmail(email.to, email.subject, email.body);
                }
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
    // Check which email service to use
    if (useGoogleScript && !GOOGLE_SCRIPT_URL) {
        alert('Please configure Google Apps Script URL first. See GOOGLE_APPS_SCRIPT_SETUP.md');
        return;
    } else if (!useGoogleScript && !gapi.client.getToken()) {
        alert('Please connect Gmail first.');
        return;
    }

    const testEmailAddress = prompt('Enter email address for test:');
    if (!testEmailAddress) return;

    try {
        const subject = 'Test Email from Plaas Hoenders Admin';
        const body = '<h2>Test Email</h2><p>This is a test email from your Plaas Hoenders admin panel. Email integration is working correctly!</p>';
        
        if (useGoogleScript) {
            await sendEmailViaGoogleScript(testEmailAddress, subject, body);
        } else {
            await sendEmailViaGmail(testEmailAddress, subject, body);
        }
        
        alert('Test email sent successfully!');
        addActivity(`Test email sent to ${testEmailAddress}`);
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
        // New multi-product format
        invoiceItems = order.products.map(product => ({
            product: product.product,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            total: product.total,
            specialInstructions: product.specialInstructions
        }));
        subtotal = order.total;
    } else {
        // Old single-product format
        invoiceItems = [{
            product: order.product,
            quantity: order.quantity,
            unitPrice: order.unitPrice,
            total: order.total
        }];
        subtotal = order.total;
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
                    <p><strong>Subtotal:</strong> R${invoice.subtotal.toFixed(2)}</p>
                    <p><strong>VAT (15%):</strong> R${invoice.tax.toFixed(2)}</p>
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
async function saveToStorage() {
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
        localStorage.setItem('plaasHoendersGmailConfig', JSON.stringify(gmailConfig));
        localStorage.setItem('plaasHoendersAnalysisHistory', JSON.stringify(analysisHistory));
    }
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
        const storedPricing = localStorage.getItem('plaasHoendersPricing');
        const storedGmailConfig = localStorage.getItem('plaasHoendersGmailConfig');
        const storedAnalysisHistory = localStorage.getItem('plaasHoendersAnalysisHistory');
        
        if (storedImports) imports = JSON.parse(storedImports);
        if (storedCurrentImportId) currentImportId = storedCurrentImportId;
        if (storedInvoices) invoices = JSON.parse(storedInvoices);
        if (storedEmailQueue) emailQueue = JSON.parse(storedEmailQueue);
        if (storedPricing) pricing = JSON.parse(storedPricing);
        if (storedGmailConfig) gmailConfig = JSON.parse(storedGmailConfig);
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

function saveGmailConfig() {
    gmailConfig = {
        email: document.getElementById('gmailAddress').value,
        password: document.getElementById('gmailPassword').value
    };
    
    saveToStorage();
    addActivity('Gmail configuration updated');
    alert('Gmail configuration saved!');
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
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Unit Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoice.items.map(item => `
                                        <tr>
                                            <td>${item.product}</td>
                                            <td>${item.quantity}</td>
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
                                <div class="total-row">
                                    <span>VAT (15%):</span>
                                    <span>R${invoice.tax.toFixed(2)}</span>
                                </div>
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

async function analyzePDFContent(_, filename) {
    try {
        // Simulate AI analysis (in a real implementation, you'd send this to an AI service)
        const analysisResult = await simulateAIAnalysis(filename);
        
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

async function simulateAIAnalysis(filename) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate AI analysis results based on common patterns
    const mockAnalysis = {
        timestamp: new Date().toISOString(),
        filename: filename,
        summary: {
            totalItems: Math.floor(Math.random() * 15) + 5,
            errorsFound: Math.floor(Math.random() * 3),
            warningsFound: Math.floor(Math.random() * 2),
            totalValue: (Math.random() * 5000 + 1000).toFixed(2)
        },
        findings: [
            {
                type: 'error',
                severity: 'high',
                item: 'HEEL HOENDER',
                issue: 'Price mismatch: Invoice shows R75.00/kg, expected R67.00/kg',
                expectedPrice: 67,
                actualPrice: 75,
                difference: 8
            },
            {
                type: 'warning',
                severity: 'medium',
                item: 'VLERKIES',
                issue: 'Description mismatch: "8 stuks per pak" vs expected "8 IN PAK"',
                expected: '8 IN PAK',
                actual: '8 stuks per pak'
            },
            {
                type: 'info',
                severity: 'low',
                item: 'BRAAIPAKKE',
                issue: 'Packaging correctly specified as VAKUUM VERPAK',
                status: 'correct'
            }
        ],
        priceComparison: Object.keys(pricing).slice(0, 5).map(product => ({
            product: product,
            expectedCost: pricing[product].cost,
            foundCost: pricing[product].cost + (Math.random() * 10 - 5),
            variance: ((Math.random() * 10 - 5) / pricing[product].cost * 100).toFixed(1)
        }))
    };
    
    return mockAnalysis;
}

function displayAnalysisResults(analysis, filename) {
    const resultsContainer = document.getElementById('analysisResults');
    const summaryContainer = document.getElementById('resultsSummary');
    const detailsContainer = document.getElementById('resultsDetails');
    
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
                    <span class="stat-label">Items Analyzed</span>
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
    
    // Create detailed findings
    const findingsHTML = `
        <div class="findings-section">
            <h4>🔍 Detailed Findings</h4>
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
        
        <div class="price-comparison-section">
            <h4>💰 Price Comparison</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Expected Cost</th>
                        <th>Found Cost</th>
                        <th>Variance</th>
                    </tr>
                </thead>
                <tbody>
                    ${analysis.priceComparison.map(item => `
                        <tr class="${Math.abs(parseFloat(item.variance)) > 5 ? 'variance-high' : ''}">
                            <td>${item.product}</td>
                            <td>R${item.expectedCost.toFixed(2)}</td>
                            <td>R${item.foundCost.toFixed(2)}</td>
                            <td class="${parseFloat(item.variance) > 0 ? 'positive' : 'negative'}">${item.variance}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    summaryContainer.innerHTML = summaryHTML;
    detailsContainer.innerHTML = findingsHTML;
    
    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
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

function showLoadingState(show) {
    const uploadArea = document.getElementById('pdfUploadArea');
    if (show) {
        uploadArea.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Analyzing PDF with AI...</p>
                <small>This may take a few moments</small>
            </div>
        `;
    } else {
        uploadArea.innerHTML = `
            <div class="upload-placeholder" onclick="document.getElementById('pdfFileInput').click()">
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
            gmailConfig: gmailConfig,
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
        gmailConfig = backupData.gmailConfig || {};
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
        // Clear localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('plaasHoenders')) {
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

        // Clear settings table
        const { error: settingsError } = await supabaseClient
            .from('settings')
            .delete()
            .neq('id', 'never_match_this_id'); // Delete all records

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
        gmailConfig = {};
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