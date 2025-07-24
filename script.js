// Global variables
let orders = [];
let invoices = [];
let emailQueue = [];
let gmailConfig = {};
let csvData = null;
let csvHeaders = [];

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

// Updated pricing based on March 2025 Braaikuikens rate card
let pricing = {
    'HEEL HOENDER': { cost: 67, selling: 95, margin: 42, packaging: 'VAKUUM VERPAK' },
    'PLAT HOENDER (FLATTY\'S)': { cost: 79, selling: 115, margin: 46, packaging: 'VAKUUM VERPAK' },
    'BRAAIPAKKE': { cost: 74, selling: 105, margin: 42, packaging: '1 heel hoender opgesnye VAKUUM VERPAK' },
    'HEEL HALWE HOENDERS': { cost: 68, selling: 95, margin: 40, packaging: '1 heel hoender deurgesny' },
    'BORSSTUKKE MET BEEN EN VEL': { cost: 73, selling: 110, margin: 51, packaging: '4 IN PAK OF 2 IN PAK MELD KEUSE IN BESTELLING' },
    'VLERKIES': { cost: 90, selling: 125, margin: 39, packaging: '8 IN PAK NIE ALTYD BESKIKBAAR' },
    'BOUDE EN DYE': { cost: 81, selling: 115, margin: 42, packaging: '2 boude en 2 dye in pak' },
    'GUNS Boud en dy aanmekaar': { cost: 81, selling: 115, margin: 42, packaging: '3 IN PAK' },
    'LEWER': { cost: 31, selling: 50, margin: 61, packaging: 'In 500g bakkies verpak' },
    'NEKKIES': { cost: 30, selling: 45, margin: 50, packaging: 'In 1 kg sakkies verpak NIE ALTYD BESKIKBAAR' },
    'FILETTE (sonder vel)': { cost: 100, selling: 140, margin: 40, packaging: '4 fillets per pak' },
    'STRIPS': { cost: 100, selling: 140, margin: 40, packaging: '±500g per pak' },
    'ONTBEENDE HOENDER': { cost: 125, selling: 170, margin: 36, packaging: 'Vacuum verpak' },
    'GEVULDE HOENDER ROLLE VAKUUM VERPAK': { cost: 193, selling: 260, margin: 35, packaging: 'Opsie 1: Vye, feta, cheddar sweet chilly; Opsie 2: Peppadew, mozzarella, cheddar, pynappel' },
    'INGELEGDE GROEN VYE': { cost: 75, selling: 95, margin: 27, packaging: '375ml potjie', unit: 'per potjie' },
    'HOENDER PATTIES': { cost: 120, selling: 160, margin: 33, packaging: '4 IN PAK(120-140GR)' },
    'HOENDER KAASWORS': { cost: 148, selling: 190, margin: 28, packaging: '500gr VACUUM VERPAK' },
    'SUIWER HEUNING': { cost: 70, selling: 90, margin: 29, packaging: '500gr POTJIE', unit: 'per potjie' }
};

// Analysis history
let analysisHistory = [];

// Gmail API Configuration
const GMAIL_API_KEY = 'YOUR_GMAIL_API_KEY'; // You'll need to get this from Google Cloud Console
const GMAIL_CLIENT_ID = 'YOUR_GMAIL_CLIENT_ID';
const GMAIL_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.send';

let gapi;
let tokenClient;
let isGmailInitialized = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadStoredData();
    updateDashboard();
    loadPricingTable();
    loadCurrentRatesTable();
    setupPDFDragDrop();
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

// Gmail API Functions
async function initializeGmailAPI() {
    try {
        await new Promise((resolve) => {
            gapi.load('client', resolve);
        });
        
        await gapi.client.init({
            apiKey: GMAIL_API_KEY,
            discoveryDocs: [GMAIL_DISCOVERY_DOC],
        });

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

async function sendEmailViaGmail(to, subject, body, attachments = []) {
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
        const encodedEmail = btoa(unescape(encodeURIComponent(email)))
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

    if (!gapi.client.getToken()) {
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
                await sendEmailViaGmail(email.to, email.subject, email.body);
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
    if (!gapi.client.getToken()) {
        alert('Please connect Gmail first.');
        return;
    }

    const testEmail = prompt('Enter email address for test:');
    if (!testEmail) return;

    try {
        await sendEmailViaGmail(
            testEmail,
            'Test Email from Gro Chicken Admin',
            '<h2>Test Email</h2><p>This is a test email from your Gro Chicken admin panel. Gmail integration is working correctly!</p>'
        );
        alert('Test email sent successfully!');
        addActivity(`Test email sent to ${testEmail}`);
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
    
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="no-data">No orders loaded</td></tr>';
        return;
    }
    
    const tableHTML = orders.map(order => `
        <tr class="order-row">
            <td>${order.orderId}</td>
            <td>${order.date}</td>
            <td>${order.name}</td>
            <td>${order.email}</td>
            <td>${order.phone}</td>
            <td>${order.address || 'N/A'}</td>
            <td>${order.product}</td>
            <td>${order.quantity}</td>
            <td>R${order.total}</td>
            <td><span class="status status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>
                <button onclick="generateInvoice('${order.orderId}')" class="btn-small btn-primary">Invoice</button>
                <button onclick="addToEmailQueue(${JSON.stringify(order).replace(/"/g, '&quot;')})" class="btn-small btn-secondary">Queue Email</button>
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = tableHTML;
}

// Invoice generation
function generateInvoice(orderId) {
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;
    
    const invoice = {
        invoiceId: 'INV-' + Date.now(),
        orderId: order.orderId,
        date: new Date().toISOString().split('T')[0],
        customerName: order.name,
        customerEmail: order.email,
        items: [{
            product: order.product,
            quantity: order.quantity,
            unitPrice: order.unitPrice,
            total: order.total
        }],
        subtotal: order.total,
        tax: order.total * 0.15, // 15% VAT
        total: order.total * 1.15,
        status: 'generated'
    };
    
    invoices.push(invoice);
    order.status = 'invoiced';
    
    updateOrdersTable();
    updateInvoicesDisplay();
    updateDashboard();
    saveToStorage();
    
    addActivity(`Invoice ${invoice.invoiceId} generated for ${order.name}`);
    
    // Add to email queue
    addToEmailQueue(order);
}

function generateAllInvoices() {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) {
        alert('No pending orders to invoice.');
        return;
    }
    
    pendingOrders.forEach(order => generateInvoice(order.orderId));
    alert(`Generated ${pendingOrders.length} invoices and added to email queue.`);
}

function updateInvoicesDisplay() {
    const container = document.getElementById('invoicesGrid');
    
    if (invoices.length === 0) {
        container.innerHTML = '<p class="no-data">No invoices generated yet</p>';
        return;
    }
    
    const invoicesHTML = invoices.map(invoice => `
        <div class="invoice-card">
            <div class="invoice-header">
                <h4>${invoice.invoiceId}</h4>
                <span class="status status-${invoice.status}">${invoice.status.toUpperCase()}</span>
            </div>
            <div class="invoice-details">
                <p><strong>Customer:</strong> ${invoice.customerName}</p>
                <p><strong>Date:</strong> ${invoice.date}</p>
                <p><strong>Total:</strong> R${invoice.total.toFixed(2)}</p>
            </div>
            <div class="invoice-actions">
                <button onclick="downloadInvoice('${invoice.invoiceId}')" class="btn-small btn-primary">Download PDF</button>
                <button onclick="previewInvoice('${invoice.invoiceId}')" class="btn-small btn-secondary">Preview</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = invoicesHTML;
}

// Pricing management
function loadPricingTable() {
    const tableBody = document.getElementById('pricingTableBody');
    
    const pricingHTML = Object.entries(pricing).map(([product, prices]) => `
        <tr>
            <td>${product}</td>
            <td>R${prices.cost}</td>
            <td>R${prices.selling}</td>
            <td>${prices.margin}%</td>
            <td>
                <button onclick="editProduct('${product}')" class="btn-small btn-secondary">Edit</button>
                <button onclick="deleteProduct('${product}')" class="btn-small btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = pricingHTML;
}

function addNewProduct() {
    const product = prompt('Enter product name:');
    if (!product) return;
    
    const cost = parseFloat(prompt('Enter cost price:'));
    const selling = parseFloat(prompt('Enter selling price:'));
    
    if (isNaN(cost) || isNaN(selling)) {
        alert('Please enter valid prices.');
        return;
    }
    
    pricing[product] = {
        cost: cost,
        selling: selling,
        margin: ((selling - cost) / cost * 100).toFixed(0)
    };
    
    loadPricingTable();
    saveToStorage();
    addActivity(`Added new product: ${product}`);
}

// Dashboard functions
function updateDashboard() {
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalRevenue').textContent = 'R' + orders.reduce((sum, order) => sum + (order.total || 0), 0).toFixed(2);
    document.getElementById('emailsSent').textContent = emailQueue.filter(e => e.status === 'sent').length;
    document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'pending').length;
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

// Storage functions
function saveToStorage() {
    localStorage.setItem('groChickenOrders', JSON.stringify(orders));
    localStorage.setItem('groChickenInvoices', JSON.stringify(invoices));
    localStorage.setItem('groChickenEmailQueue', JSON.stringify(emailQueue));
    localStorage.setItem('groChickenPricing', JSON.stringify(pricing));
    localStorage.setItem('groChickenGmailConfig', JSON.stringify(gmailConfig));
    localStorage.setItem('groChickenAnalysisHistory', JSON.stringify(analysisHistory));
}

function loadStoredData() {
    const storedOrders = localStorage.getItem('groChickenOrders');
    const storedInvoices = localStorage.getItem('groChickenInvoices');
    const storedEmailQueue = localStorage.getItem('groChickenEmailQueue');
    const storedPricing = localStorage.getItem('groChickenPricing');
    const storedGmailConfig = localStorage.getItem('groChickenGmailConfig');
    const storedAnalysisHistory = localStorage.getItem('groChickenAnalysisHistory');
    
    if (storedOrders) orders = JSON.parse(storedOrders);
    if (storedInvoices) invoices = JSON.parse(storedInvoices);
    if (storedEmailQueue) emailQueue = JSON.parse(storedEmailQueue);
    if (storedPricing) pricing = JSON.parse(storedPricing);
    if (storedGmailConfig) gmailConfig = JSON.parse(storedGmailConfig);
    if (storedAnalysisHistory) analysisHistory = JSON.parse(storedAnalysisHistory);
    
    updateOrdersTable();
    updateInvoicesDisplay();
    updateEmailQueueDisplay();
    updateAnalysisHistoryDisplay();
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
    
    localStorage.setItem('groChickenSettings', JSON.stringify(settings));
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
    
    localStorage.setItem('groChickenEmailTemplate', JSON.stringify(template));
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
            
            // Process each product column
            let orderCount = 0;
            csvHeaders.forEach((header, colIndex) => {
                // Skip non-product columns
                if (colIndex <= addressIndex) return;
                
                const quantity = row[colIndex];
                if (quantity && !isNaN(parseInt(quantity))) {
                    const mappedProduct = productMapping[header];
                    if (mappedProduct && pricing[mappedProduct]) {
                        const order = {
                            orderId: 'ORD-' + Date.now() + '-' + rowIndex + '-' + orderCount++,
                            date: new Date().toISOString().split('T')[0],
                            name: name,
                            email: email,
                            phone: phone,
                            address: address,
                            product: mappedProduct,
                            quantity: parseInt(quantity),
                            specialInstructions: extractSpecialInstructions(row[colIndex]),
                            status: 'pending'
                        };
                        
                        // Calculate pricing
                        const productPricing = pricing[order.product];
                        order.unitPrice = productPricing.selling;
                        order.total = order.unitPrice * order.quantity;
                        
                        newOrders.push(order);
                    }
                }
            });
        });
        
        if (newOrders.length === 0) {
            alert('No valid orders found in the CSV file.');
            return;
        }
        
        // Add orders to system
        orders.push(...newOrders);
        updateOrdersTable();
        updateDashboard();
        saveToStorage();
        
        // Clear upload state
        clearCSVUpload();
        
        let message = `Successfully processed ${newOrders.length} orders from CSV!`;
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

// Placeholder functions for additional features
function downloadInvoice(invoiceId) {
    alert('PDF generation feature will be implemented. Invoice ID: ' + invoiceId);
}

function previewInvoice(invoiceId) {
    alert('Invoice preview feature will be implemented. Invoice ID: ' + invoiceId);
}

function editProduct(product) {
    const newCost = parseFloat(prompt(`Enter new cost price for ${product}:`, pricing[product].cost));
    const newSelling = parseFloat(prompt(`Enter new selling price for ${product}:`, pricing[product].selling));
    
    if (!isNaN(newCost) && !isNaN(newSelling)) {
        pricing[product] = {
            cost: newCost,
            selling: newSelling,
            margin: ((newSelling - newCost) / newCost * 100).toFixed(0)
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

async function analyzePDFContent(arrayBuffer, filename) {
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
    
    const ratesHTML = Object.entries(pricing).map(([product, rates]) => `
        <tr>
            <td>${product}</td>
            <td>R${rates.cost}</td>
            <td>R${rates.selling}</td>
            <td>${rates.margin}%</td>
        </tr>
    `).join('');
    
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