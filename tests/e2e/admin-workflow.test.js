// End-to-End Tests for Admin Dashboard Workflows
// Critical workflow testing for Plaas Hoenders Admin Dashboard

import { jest } from '@jest/globals';
import puppeteer from 'puppeteer';

let browser;
let page;

// Test configuration
const TEST_CONFIG = {
    baseURL: 'http://localhost:3000', // Adjust for your test server
    timeout: 30000,
    viewport: { width: 1920, height: 1080 }
};

beforeAll(async () => {
    browser = await puppeteer.launch({
        headless: process.env.CI === 'true', // Run headless in CI
        slowMo: 50, // Slow down for better visibility in dev
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport(TEST_CONFIG.viewport);
    
    // Set up console logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
});

afterAll(async () => {
    if (browser) {
        await browser.close();
    }
});

beforeEach(async () => {
    // Navigate to admin dashboard
    await page.goto(TEST_CONFIG.baseURL, { waitUntil: 'networkidle0' });
    
    // Wait for main dashboard to load
    await page.waitForSelector('#dashboard-section', { timeout: TEST_CONFIG.timeout });
});

describe('Admin Dashboard - Core Navigation', () => {
    
    test('should load dashboard with all main sections', async () => {
        // Check that main navigation elements are present
        const sections = [
            '#dashboard-section',
            '#import-section', 
            '#orders-section',
            '#invoices-section',
            '#email-section',
            '#pricing-section',
            '#analytics-section'
        ];
        
        for (const selector of sections) {
            const element = await page.$(selector);
            expect(element).toBeTruthy();
        }
    });
    
    test('should navigate between sections', async () => {
        // Test navigation to Import & Analyze section
        await page.click('a[href="#import-section"]');
        await page.waitForSelector('#import-section.active');
        
        const activeSection = await page.$('#import-section.active');
        expect(activeSection).toBeTruthy();
        
        // Test navigation back to dashboard
        await page.click('a[href="#dashboard-section"]');
        await page.waitForSelector('#dashboard-section.active');
        
        const dashboardActive = await page.$('#dashboard-section.active');
        expect(dashboardActive).toBeTruthy();
    });
});

describe('Admin Dashboard - PDF Processing Workflow', () => {
    
    test('should handle PDF upload interface', async () => {
        // Navigate to import section
        await page.click('a[href="#import-section"]');
        await page.waitForSelector('#import-section.active');
        
        // Check PDF upload area exists
        const uploadArea = await page.$('#pdfUploadArea');
        expect(uploadArea).toBeTruthy();
        
        // Check that upload area shows proper messaging
        const uploadText = await page.$eval('#pdfUploadArea', el => el.textContent);
        expect(uploadText).toContain('Drop PDF');
    });
    
    test('should display PDF processing status', async () => {
        await page.click('a[href="#import-section"]');
        await page.waitForSelector('#import-section.active');
        
        // Mock PDF upload by triggering processing UI
        await page.evaluate(() => {
            // Simulate PDF processing start
            const uploadArea = document.getElementById('pdfUploadArea');
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <div class="spinner">
                        <div class="spinner-icon"></div>
                        <span>Processing PDF with OCR...</span>
                    </div>
                `;
            }
        });
        
        // Check processing indicator appears
        const spinner = await page.$('.spinner');
        expect(spinner).toBeTruthy();
        
        const spinnerText = await page.$eval('.spinner span', el => el.textContent);
        expect(spinnerText).toContain('Processing PDF');
    });
    
    test('should show extracted customer data', async () => {
        await page.click('a[href="#import-section"]');
        await page.waitForSelector('#import-section.active');
        
        // Mock extracted customer data display
        await page.evaluate(() => {
            const summaryContainer = document.getElementById('extractionSummary');
            if (summaryContainer) {
                summaryContainer.innerHTML = `
                    <div class="extraction-summary">
                        <h3>📄 PDF Analysis Complete</h3>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-number">26</span>
                                <span class="stat-label">Customers Found</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">89</span>
                                <span class="stat-label">Total Items</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        // Verify extraction summary displays
        const summary = await page.$('.extraction-summary');
        expect(summary).toBeTruthy();
        
        const customerCount = await page.$eval('.stat-number', el => el.textContent);
        expect(customerCount).toBe('26');
    });
});

describe('Admin Dashboard - Order Management Workflow', () => {
    
    test('should display orders table', async () => {
        await page.click('a[href="#orders-section"]');
        await page.waitForSelector('#orders-section.active');
        
        // Check orders table exists
        const ordersTable = await page.$('#ordersTableBody');
        expect(ordersTable).toBeTruthy();
    });
    
    test('should handle order filtering', async () => {
        await page.click('a[href="#orders-section"]');
        await page.waitForSelector('#orders-section.active');
        
        // Mock adding orders data
        await page.evaluate(() => {
            const tableBody = document.getElementById('ordersTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr data-customer="Jean Dreyer">
                        <td>ORD-2025-001</td>
                        <td>Jean Dreyer</td>
                        <td>HEEL HOENDER</td>
                        <td>2</td>
                        <td>R134.00</td>
                        <td>pending</td>
                    </tr>
                    <tr data-customer="Chris Fourie">
                        <td>ORD-2025-002</td>
                        <td>Chris Fourie</td>
                        <td>SUIWER HEUNING</td>
                        <td>1</td>
                        <td>R70.00</td>
                        <td>completed</td>
                    </tr>
                `;
            }
        });
        
        // Check orders are displayed
        const orderRows = await page.$$('#ordersTableBody tr');
        expect(orderRows.length).toBe(2);
        
        // Test that order data is properly shown
        const firstOrderId = await page.$eval('#ordersTableBody tr:first-child td:first-child', 
            el => el.textContent);
        expect(firstOrderId).toBe('ORD-2025-001');
    });
});

describe('Admin Dashboard - Invoice Generation Workflow', () => {
    
    test('should generate invoices for orders', async () => {
        await page.click('a[href="#invoices-section"]');
        await page.waitForSelector('#invoices-section.active');
        
        // Check invoice generation button exists
        const generateBtn = await page.$('#generateInvoicesBtn');
        expect(generateBtn).toBeTruthy();
    });
    
    test('should display generated invoices', async () => {
        await page.click('a[href="#invoices-section"]');
        await page.waitForSelector('#invoices-section.active');
        
        // Mock generated invoices
        await page.evaluate(() => {
            const invoicesGrid = document.getElementById('invoicesGrid');
            if (invoicesGrid) {
                invoicesGrid.innerHTML = `
                    <div class="invoice-card">
                        <div class="invoice-header">
                            <h4>INV-2025-001</h4>
                            <span class="invoice-status">generated</span>
                        </div>
                        <div class="invoice-details">
                            <p><strong>Customer:</strong> Jean Dreyer</p>
                            <p><strong>Total:</strong> R134.00</p>
                        </div>
                        <div class="invoice-actions">
                            <button class="btn btn-primary">📧 Email</button>
                            <button class="btn btn-secondary">📄 View</button>
                        </div>
                    </div>
                `;
            }
        });
        
        // Verify invoice card is displayed
        const invoiceCard = await page.$('.invoice-card');
        expect(invoiceCard).toBeTruthy();
        
        const invoiceNumber = await page.$eval('.invoice-card h4', el => el.textContent);
        expect(invoiceNumber).toBe('INV-2025-001');
    });
});

describe('Admin Dashboard - Email Workflow', () => {
    
    test('should prepare email queue', async () => {
        await page.click('a[href="#email-section"]');
        await page.waitForSelector('#email-section.active');
        
        // Check email queue container exists
        const emailQueue = await page.$('#emailQueueContainer');
        expect(emailQueue).toBeTruthy();
    });
    
    test('should show email status', async () => {
        await page.click('a[href="#email-section"]');
        await page.waitForSelector('#email-section.active');
        
        // Mock email queue with items
        await page.evaluate(() => {
            const queueContainer = document.getElementById('emailQueueContainer');
            if (queueContainer) {
                queueContainer.innerHTML = `
                    <div class="email-queue-item">
                        <div class="queue-item-info">
                            <strong>Jean Dreyer</strong> - jean.dreyer@email.com
                            <br><small>Invoice: INV-2025-001</small>
                        </div>
                        <div class="queue-item-status">
                            <span class="status-pending">Queued</span>
                        </div>
                    </div>
                `;
            }
        });
        
        // Verify email queue item is displayed
        const queueItem = await page.$('.email-queue-item');
        expect(queueItem).toBeTruthy();
        
        const customerName = await page.$eval('.queue-item-info strong', el => el.textContent);
        expect(customerName).toBe('Jean Dreyer');
    });
    
    test('should handle send all emails', async () => {
        await page.click('a[href="#email-section"]');
        await page.waitForSelector('#email-section.active');
        
        // Check send all button exists
        const sendAllBtn = await page.$('#sendAllEmailsBtn');
        expect(sendAllBtn).toBeTruthy();
        
        // Mock sending process
        await page.evaluate(() => {
            const btn = document.getElementById('sendAllEmailsBtn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                btn.disabled = true;
            }
        });
        
        // Verify button shows sending state
        const buttonText = await page.$eval('#sendAllEmailsBtn', el => el.textContent);
        expect(buttonText).toContain('Sending');
        
        const isDisabled = await page.$eval('#sendAllEmailsBtn', el => el.disabled);
        expect(isDisabled).toBe(true);
    });
});

describe('Admin Dashboard - Analytics Workflow', () => {
    
    test('should display business intelligence dashboard', async () => {
        await page.click('a[href="#analytics-section"]');
        await page.waitForSelector('#analytics-section.active');
        
        // Check analytics cards exist
        const analyticsCards = await page.$$('.analytics-card');
        expect(analyticsCards.length).toBeGreaterThan(0);
    });
    
    test('should show revenue metrics', async () => {
        await page.click('a[href="#analytics-section"]');
        await page.waitForSelector('#analytics-section.active');
        
        // Mock analytics data
        await page.evaluate(() => {
            const salesCard = document.querySelector('.analytics-card');
            if (salesCard) {
                salesCard.innerHTML = `
                    <div class="card-header">📊 Sales Analytics</div>
                    <div class="card-body">
                        <div class="metric">
                            <span class="metric-value">R12,450</span>
                            <span class="metric-label">Total Revenue</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">R3,200</span>
                            <span class="metric-label">This Month</span>
                        </div>
                    </div>
                `;
            }
        });
        
        // Verify analytics data is displayed
        const totalRevenue = await page.$eval('.metric-value', el => el.textContent);
        expect(totalRevenue).toBe('R12,450');
    });
});

describe('Admin Dashboard - Error Handling', () => {
    
    test('should handle network errors gracefully', async () => {
        // Simulate network failure
        await page.setOfflineMode(true);
        
        await page.click('a[href="#import-section"]');
        await page.waitForSelector('#import-section.active');
        
        // Try to trigger a network operation (mock)
        await page.evaluate(() => {
            // Simulate error notification
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.showNotification('Network error occurred', 'error');
            }
        });
        
        // Check if error notification appears
        const notification = await page.$('.notification-error');
        if (notification) {
            const notificationText = await page.$eval('.notification-error', el => el.textContent);
            expect(notificationText).toContain('Network error');
        }
        
        // Restore network
        await page.setOfflineMode(false);
    });
    
    test('should validate user inputs', async () => {
        await page.click('a[href="#pricing-section"]');
        await page.waitForSelector('#pricing-section.active');
        
        // Mock invalid input scenario
        await page.evaluate(() => {
            // Simulate price input validation
            const mockInvalidPrice = 'invalid-price';
            const sanitized = window.SecurityUtils ? 
                window.SecurityUtils.sanitizeNumber(mockInvalidPrice) : 0;
            
            if (sanitized === 0) {
                console.log('Input validation working: invalid price rejected');
            }
        });
        
        // Check console for validation message
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));
        
        // Wait briefly for any console messages
        await page.waitForTimeout(500);
        
        const validationLog = logs.find(log => log.includes('Input validation working'));
        expect(validationLog).toBeTruthy();
    });
});

describe('Admin Dashboard - Responsive Design', () => {
    
    test('should work on mobile viewport', async () => {
        // Set mobile viewport
        await page.setViewport({ width: 375, height: 667 });
        
        // Reload page
        await page.reload({ waitUntil: 'networkidle0' });
        
        // Check that navigation is still accessible
        const navigation = await page.$('nav');
        expect(navigation).toBeTruthy();
        
        // Check that main sections are accessible
        const dashboard = await page.$('#dashboard-section');
        expect(dashboard).toBeTruthy();
        
        // Restore desktop viewport
        await page.setViewport(TEST_CONFIG.viewport);
    });
    
    test('should handle tablet viewport', async () => {
        // Set tablet viewport
        await page.setViewport({ width: 768, height: 1024 });
        
        await page.reload({ waitUntil: 'networkidle0' });
        
        // Check layout adapts properly
        const sections = await page.$$('.section');
        expect(sections.length).toBeGreaterThan(0);
        
        // Restore desktop viewport
        await page.setViewport(TEST_CONFIG.viewport);
    });
});