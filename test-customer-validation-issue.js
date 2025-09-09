import { chromium } from 'playwright';

async function testCustomerValidationIssue() {
    console.log('🧪 Starting Customer Validation Issue Test...');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000, // Slow down for better observation
        channel: 'chrome' // Use Chrome instead of Chromium
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
        console.log(`[Browser Console] ${msg.text()}`);
    });
    
    // Navigate to customer portal
    console.log('📱 Navigating to customer portal...');
    await page.goto('https://bester1.github.io/hoenders/customer-portal.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    console.log('🔍 Analyzing page structure and validation system...');
    
    // Check if CustomerValidator is available
    const validatorAvailable = await page.evaluate(() => {
        return typeof window.customerValidator !== 'undefined';
    });
    console.log(`🧪 CustomerValidator available: ${validatorAvailable}`);
    
    // Check if validation functions are available
    const validationFunctions = await page.evaluate(() => {
        return {
            canProceed: typeof window.validateCustomerFields === 'function',
            getErrors: typeof window.getCustomerValidationErrors === 'function',
            clearErrors: typeof window.clearCustomerValidationErrors === 'function'
        };
    });
    console.log(`🧪 Validation functions:`, validationFunctions);
    
    // Test current customer validation state
    const validationState = await page.evaluate(() => {
        if (window.customerValidator) {
            const result = window.customerValidator.validateCurrentCustomer();
            return {
                isValid: result.isValid,
                errors: result.errors,
                message: result.message
            };
        }
        return null;
    });
    console.log(`🧪 Current validation state:`, validationState);
    
    // Check DOM elements that validation expects
    const expectedElements = await page.evaluate(() => {
        const elements = {
            displayPhone: document.getElementById('displayPhone'),
            displayAddress: document.getElementById('displayAddress'),
            phoneError: document.getElementById('phoneError'),
            addressError: document.getElementById('addressError'),
            validationMessage: document.getElementById('validationMessage')
        };
        
        const results = {};
        for (const [key, element] of Object.entries(elements)) {
            results[key] = {
                exists: !!element,
                text: element ? element.textContent.trim() : null,
                display: element ? getComputedStyle(element).display : 'not found'
            };
        }
        
        return results;
    });
    console.log(`🧪 Expected validation elements:`, expectedElements);
    
    // Check if customer data is available in storage or global variables
    const customerDataSources = await page.evaluate(() => {
        const sources = {
            localStorage: null,
            sessionStorage: null,
            window: null,
            currentCustomer: null
        };
        
        try {
            sources.localStorage = localStorage.getItem('customerData');
            sources.sessionStorage = sessionStorage.getItem('customerData');
        } catch (e) {
            console.log('Storage access blocked');
        }
        
        sources.window = window.customerData;
        sources.currentCustomer = window.currentCustomer;
        
        return {
            localStorage: sources.localStorage ? JSON.parse(sources.localStorage) : null,
            sessionStorage: sources.sessionStorage ? JSON.parse(sources.sessionStorage) : null,
            window: sources.window,
            currentCustomer: sources.currentCustomer
        };
    });
    console.log(`📊 Customer data sources:`, customerDataSources);
    
    // Navigate to Step 3 specifically
    console.log('📋 Navigating to Step 3 to check customer details...');
    
    // Try to find and click Step 3 navigation
    const step3Button = await page.$('button[data-step="3"], .step[data-step="3"], #step3, .step3');
    if (step3Button) {
        await step3Button.click();
        await page.waitForTimeout(2000);
    } else {
        // Look for any step navigation
        const stepButtons = await page.$$('button[data-step], .step[data-step]');
        for (const button of stepButtons) {
            const step = await button.getAttribute('data-step');
            if (step === '3') {
                await button.click();
                await page.waitForTimeout(2000);
                break;
            }
        }
    }
    
    // Check Step 3 customer details specifically
    const step3Details = await page.evaluate(() => {
        const details = {};
        
        // Look for customer detail elements in Step 3
        const selectors = [
            '#step3 .customer-name',
            '#step3 .customer-phone', 
            '#step3 .customer-email',
            '#step3 .customer-address',
            '.step3 .customer-name',
            '.step3 .customer-phone',
            '.step3 .customer-email', 
            '.step3 .customer-address',
            '[data-customer-field="name"]',
            '[data-customer-field="phone"]',
            '[data-customer-field="email"]',
            '[data-customer-field="address"]'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                details[selector] = Array.from(elements).map(el => ({
                    text: el.textContent.trim(),
                    display: getComputedStyle(el).display,
                    visibility: getComputedStyle(el).visibility
                }));
            }
        }
        
        // Also check for any elements containing "-"
        const allElements = document.querySelectorAll('*');
        const dashElements = Array.from(allElements).filter(el =>
            el.textContent.includes('-') &&
            (el.textContent.includes('Naam') ||
             el.textContent.includes('Telefoon') ||
             el.textContent.includes('Email') ||
             el.textContent.includes('Adres'))
        );
        
        details.dashElements = dashElements.map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            text: el.textContent.trim(),
            display: getComputedStyle(el).display
        }));
        
        return details;
    });
    console.log(`📋 Step 3 customer details structure:`, step3Details);
    
    // Test validation with mock customer data
    console.log('🧪 Testing validation with mock customer data...');
    
    const mockValidation = await page.evaluate(() => {
        if (window.customerValidator) {
            // Test with valid data
            const validResult = window.customerValidator.validate({
                phone: '0796167761',
                address: '123 Test Street, Test Town, 1234'
            });
            
            // Test with invalid data
            const invalidResult = window.customerValidator.validate({
                phone: '',
                address: 'short'
            });
            
            return {
                valid: validResult,
                invalid: invalidResult
            };
        }
        return null;
    });
    console.log(`🧪 Mock validation results:`, mockValidation);
    
    // Check if there are any JavaScript errors related to validation
    const jsErrors = await page.evaluate(() => {
        const errors = [];
        
        // Check for validation-related errors in console
        if (window.validationErrors) {
            errors.push(...window.validationErrors);
        }
        
        // Check for any validation-related issues
        try {
            const result = window.customerValidator ? window.customerValidator.validateCurrentCustomer() : null;
            if (result && !result.isValid) {
                errors.push(`Validation failed: ${JSON.stringify(result.errors)}`);
            }
        } catch (e) {
            errors.push(`Validation error: ${e.message}`);
        }
        
        return errors;
    });
    console.log(`⚠️ JavaScript validation errors:`, jsErrors);
    
    // Take a screenshot of Step 3
    await page.screenshot({ path: 'customer-portal-step3-validation.png', fullPage: true });
    console.log('📸 Screenshot saved as customer-portal-step3-validation.png');
    
    // Check if we can manually populate customer data
    console.log('🔧 Attempting to manually populate customer data...');
    
    const manualPopulation = await page.evaluate(() => {
        const results = {
            before: {},
            after: {},
            success: false
        };
        
        // Get current state before
        const phoneEl = document.getElementById('displayPhone');
        const addressEl = document.getElementById('displayAddress');
        
        if (phoneEl) results.before.phone = phoneEl.textContent.trim();
        if (addressEl) results.before.address = addressEl.textContent.trim();
        
        // Try to set mock customer data
        if (window.currentCustomer) {
            window.currentCustomer.phone = '0796167761';
            window.currentCustomer.address = '123 Test Street, Test Town, 1234';
            window.currentCustomer.name = 'Jean Dreyer';
            window.currentCustomer.email = 'jean@example.com';
            
            // Try to trigger display update
            if (window.updateCustomerDisplayElements) {
                window.updateCustomerDisplayElements();
            }
            
            if (window.populateReviewCustomerInfo) {
                window.populateReviewCustomerInfo();
            }
            
            // Wait a bit and check again
            setTimeout(() => {
                if (phoneEl) results.after.phone = phoneEl.textContent.trim();
                if (addressEl) results.after.address = addressEl.textContent.trim();
                
                results.success = results.after.phone !== results.before.phone || 
                                 results.after.address !== results.before.address;
            }, 1000);
        }
        
        return results;
    });
    
    await page.waitForTimeout(2000); // Wait for the timeout in the evaluate
    
    const finalResults = await page.evaluate(() => {
        return window.manualPopulationResults || {};
    });
    
    console.log(`🔧 Manual population results:`, finalResults);
    
    // Final validation check
    const finalValidation = await page.evaluate(() => {
        if (window.customerValidator) {
            return window.customerValidator.validateCurrentCustomer();
        }
        return null;
    });
    console.log(`🧪 Final validation state:`, finalValidation);
    
    console.log('✅ Test completed. Check the results above for validation issues.');
    
    await browser.close();
}

// Run the test
testCustomerValidationIssue().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});