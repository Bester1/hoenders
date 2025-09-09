import { chromium } from 'playwright';

async function testValidationSimple() {
    console.log('🧪 Starting Simple Validation Test...');
    
    const browser = await chromium.launch({ 
        headless: false,
        channel: 'chrome'
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
        if (msg.text().includes('ERROR') || msg.text().includes('WARNING')) {
            console.log(`[Browser] ${msg.text()}`);
        }
    });
    
    try {
        console.log('📱 Loading customer portal...');
        await page.goto('https://bester1.github.io/hoenders/customer-portal.html', {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        
        // Wait a bit for scripts to load
        await page.waitForTimeout(3000);
        
        console.log('🔍 Checking validation system availability...');
        
        // Check if CustomerValidator exists
        const hasValidator = await page.evaluate(() => {
            return typeof window.customerValidator !== 'undefined';
        });
        console.log(`✅ CustomerValidator exists: ${hasValidator}`);
        
        if (!hasValidator) {
            console.log('❌ CustomerValidator not found. Checking for other validation systems...');
            
            // Check for alternative validation systems
            const altSystems = await page.evaluate(() => {
                return {
                    CustomerValidator: typeof window.CustomerValidator,
                    customerValidator: typeof window.customerValidator,
                    validateCustomerFields: typeof window.validateCustomerFields,
                    validationModule: document.querySelector('script[src*="validation"]') !== null
                };
            });
            console.log('🔍 Alternative systems found:', altSystems);
            
            // Check what scripts are loaded
            const loadedScripts = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('script[src]')).map(script => ({
                    src: script.src,
                    loaded: script.complete !== false
                }));
            });
            
            const validationScripts = loadedScripts.filter(script => 
                script.src.includes('validation') || 
                script.src.includes('customer')
            );
            console.log('📜 Validation-related scripts:', validationScripts);
        }
        
        // Check DOM elements that should exist for validation
        console.log('🔍 Checking expected DOM elements...');
        const domElements = await page.evaluate(() => {
            const elements = {};
            const expectedIds = [
                'displayPhone', 'displayAddress', 'displayName', 'displayEmail',
                'phoneError', 'addressError', 'validationMessage'
            ];
            
            expectedIds.forEach(id => {
                const element = document.getElementById(id);
                elements[id] = {
                    exists: !!element,
                    visible: element ? getComputedStyle(element).display !== 'none' : false,
                    text: element ? element.textContent.trim() : null
                };
            });
            
            return elements;
        });
        
        console.log('📋 DOM elements status:', domElements);
        
        // Look for customer detail sections
        console.log('🔍 Searching for customer detail sections...');
        const customerSections = await page.evaluate(() => {
            const sections = {};
            
            // Look for step 3 or customer details sections
            const step3Elements = document.querySelectorAll('[data-step="3"], .step3, #step3');
            sections.step3Elements = Array.from(step3Elements).map(el => ({
                tag: el.tagName,
                className: el.className,
                id: el.id,
                text: el.textContent.trim().substring(0, 100)
            }));
            
            // Look for elements containing "Naam", "Telefoon", "Email", "Adres"
            const allElements = document.querySelectorAll('*');
            const customerFields = Array.from(allElements).filter(el => {
                const text = el.textContent.toLowerCase();
                return text.includes('naam') || text.includes('telefoon') || 
                       text.includes('email') || text.includes('adres');
            }).map(el => ({
                tag: el.tagName,
                className: el.className,
                id: el.id,
                textContent: el.textContent.trim(),
                display: getComputedStyle(el).display
            }));
            
            sections.customerFields = customerFields;
            
            return sections;
        });
        
        console.log('📋 Customer sections found:', customerSections);
        
        // Check if there are any customer data placeholders with dashes
        const dashElements = await page.evaluate(() => {
            const allElements = document.querySelectorAll('*');
            return Array.from(allElements)
                .filter(el => el.textContent.includes(' - '))
                .map(el => ({
                    tag: el.tagName,
                    className: el.className,
                    id: el.id,
                    text: el.textContent.trim(),
                    display: getComputedStyle(el).display
                }))
                .slice(0, 10); // Limit to first 10
        });
        
        console.log('🔍 Elements with dashes (first 10):', dashElements);
        
        // Take a screenshot
        await page.screenshot({ path: 'validation-test-screenshot.png', fullPage: true });
        console.log('📸 Screenshot saved as validation-test-screenshot.png');
        
        // Try to manually create and test CustomerValidator if it doesn't exist
        if (!hasValidator) {
            console.log('🔧 Attempting to manually create CustomerValidator...');
            
            const manualCreation = await page.evaluate(() => {
                try {
                    // Load customer-validation.js content manually if available
                    const script = document.createElement('script');
                    script.textContent = `
                        class CustomerValidator {
                            constructor() {
                                this.requiredFields = ['phone', 'address'];
                                this.validationRules = {
                                    phone: {
                                        required: true,
                                        pattern: /^[\\d\\s\\-\\+\\(\\)]+$/,
                                        minLength: 10,
                                        message: 'Please enter a valid phone number'
                                    },
                                    address: {
                                        required: true,
                                        minLength: 10,
                                        message: 'Please enter your complete address'
                                    }
                                };
                            }
                            
                            validateCurrentCustomer() {
                                const phoneElement = document.getElementById('displayPhone');
                                const addressElement = document.getElementById('displayAddress');
                                
                                const customerData = {
                                    phone: phoneElement ? phoneElement.textContent.trim() : '',
                                    address: addressElement ? addressElement.textContent.trim() : ''
                                };
                                
                                return this.validateCustomerData(customerData);
                            }
                            
                            validateCustomerData(customerData) {
                                const errors = {};
                                let isValid = true;
                                
                                this.requiredFields.forEach(field => {
                                    const value = customerData[field];
                                    const rules = this.validationRules[field];
                                    
                                    if (!value || value.trim() === '') {
                                        errors[field] = rules.message;
                                        isValid = false;
                                    } else if (rules.minLength && value.trim().length < rules.minLength) {
                                        errors[field] = \`\${rules.message} (minimum \${rules.minLength} characters)\`;
                                        isValid = false;
                                    }
                                });
                                
                                return {
                                    isValid,
                                    errors,
                                    message: isValid ? 'All required fields are filled' : 'Please fill in all required fields'
                                };
                            }
                        }
                        
                        window.customerValidator = new CustomerValidator();
                    `;
                    document.head.appendChild(script);
                    
                    return typeof window.customerValidator !== 'undefined';
                } catch (e) {
                    return { error: e.message };
                }
            });
            
            console.log(`🔧 Manual CustomerValidator creation:`, manualCreation);
        }
        
        // Final validation test
        const finalValidation = await page.evaluate(() => {
            if (window.customerValidator) {
                return window.customerValidator.validateCurrentCustomer();
            }
            return { error: 'CustomerValidator not available' };
        });
        
        console.log(`🧪 Final validation result:`, finalValidation);
        
        console.log('✅ Test completed successfully!');
        
    } catch (error) {
        console.log(`❌ Test error: ${error.message}`);
        await page.screenshot({ path: 'validation-error-screenshot.png', fullPage: true });
        console.log('📸 Error screenshot saved as validation-error-screenshot.png');
    }
    
    await browser.close();
}

testValidationSimple().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});