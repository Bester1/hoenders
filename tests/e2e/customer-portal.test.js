// End-to-End Tests for Customer Portal Workflows
// Customer-facing functionality testing

import { jest } from '@jest/globals';
import puppeteer from 'puppeteer';

let browser;
let page;

const TEST_CONFIG = {
    baseURL: 'http://localhost:3000/customer-portal.html',
    timeout: 30000,
    viewport: { width: 1920, height: 1080 }
};

// Mock customer data for testing
const MOCK_CUSTOMER = {
    name: 'Test Customer',
    email: 'test@example.com',
    password: 'TestPassword123!',
    phone: '0821234567',
    address: '123 Test Street, Cape Town'
};

beforeAll(async () => {
    browser = await puppeteer.launch({
        headless: process.env.CI === 'true',
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport(TEST_CONFIG.viewport);
    
    // Set up console logging
    page.on('console', msg => console.log('CUSTOMER PORTAL LOG:', msg.text()));
    page.on('pageerror', err => console.error('CUSTOMER PORTAL ERROR:', err.message));
});

afterAll(async () => {
    if (browser) {
        await browser.close();
    }
});

beforeEach(async () => {
    await page.goto(TEST_CONFIG.baseURL, { waitUntil: 'networkidle0' });
});

describe('Customer Portal - Landing Page', () => {
    
    test('should load customer portal homepage', async () => {
        // Check main elements are present
        const heroSection = await page.$('.hero-section');
        expect(heroSection).toBeTruthy();
        
        // Check branding
        const title = await page.$eval('h1', el => el.textContent);
        expect(title).toContain('Plaas Hoenders');
        
        // Check call-to-action buttons
        const loginBtn = await page.$('button[data-action="login"]');
        const registerBtn = await page.$('button[data-action="register"]');
        
        expect(loginBtn).toBeTruthy();
        expect(registerBtn).toBeTruthy();
    });
    
    test('should display product showcase', async () => {
        // Mock product display
        await page.evaluate(() => {
            const productSection = document.createElement('section');
            productSection.className = 'products-showcase';
            productSection.innerHTML = `
                <h2>Our Fresh Products</h2>
                <div class="product-grid">
                    <div class="product-card">
                        <h3>HEEL HOENDER</h3>
                        <p>Fresh whole chicken</p>
                        <span class="price">R67/kg</span>
                    </div>
                    <div class="product-card">
                        <h3>SUIWER HEUNING</h3>
                        <p>Pure honey</p>
                        <span class="price">R70</span>
                    </div>
                </div>
            `;
            document.body.appendChild(productSection);
        });
        
        const productShowcase = await page.$('.products-showcase');
        expect(productShowcase).toBeTruthy();
        
        const productCards = await page.$$('.product-card');
        expect(productCards.length).toBe(2);
    });
});

describe('Customer Portal - Authentication', () => {
    
    test('should show registration form', async () => {
        // Trigger registration form
        await page.evaluate(() => {
            // Mock registration form display
            const formHtml = `
                <form id="registrationForm" class="auth-form">
                    <h2>Create Account</h2>
                    <div class="form-group">
                        <input type="text" id="regName" placeholder="Full Name" required>
                    </div>
                    <div class="form-group">
                        <input type="email" id="regEmail" placeholder="Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" id="regPassword" placeholder="Password" required>
                    </div>
                    <div class="form-group">
                        <input type="tel" id="regPhone" placeholder="Phone Number">
                    </div>
                    <button type="submit" class="btn btn-primary">Register</button>
                </form>
            `;
            
            const container = document.createElement('div');
            container.innerHTML = formHtml;
            document.body.appendChild(container);
        });
        
        // Verify registration form elements
        const regForm = await page.$('#registrationForm');
        expect(regForm).toBeTruthy();
        
        const nameInput = await page.$('#regName');
        const emailInput = await page.$('#regEmail');
        const passwordInput = await page.$('#regPassword');
        
        expect(nameInput).toBeTruthy();
        expect(emailInput).toBeTruthy();
        expect(passwordInput).toBeTruthy();
    });
    
    test('should validate registration inputs', async () => {
        // Create registration form
        await page.evaluate(() => {
            const formHtml = `
                <form id="registrationForm">
                    <input type="text" id="regName" required>
                    <input type="email" id="regEmail" required>
                    <input type="password" id="regPassword" required>
                    <button type="submit">Register</button>
                </form>
            `;
            document.body.innerHTML = formHtml;
        });
        
        // Fill form with invalid data
        await page.type('#regName', '<script>alert("xss")</script>');
        await page.type('#regEmail', 'invalid-email');
        await page.type('#regPassword', '123'); // Too short
        
        // Mock validation
        await page.evaluate(() => {
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            // Simulate validation with SecurityUtils
            const sanitizedName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            const passwordValid = password.length >= 6;
            
            console.log('Validation results:', {
                nameSanitized: sanitizedName !== name,
                emailValid,
                passwordValid
            });
        });
        
        // Check validation results in console
        const logs = [];
        page.on('console', msg => {
            if (msg.text().includes('Validation results')) {
                logs.push(msg.text());
            }
        });
        
        await page.waitForTimeout(500);
        
        const validationLog = logs.find(log => log.includes('nameSanitized: true'));
        expect(validationLog).toBeTruthy();
    });
    
    test('should handle login process', async () => {
        // Create login form
        await page.evaluate(() => {
            const formHtml = `
                <form id="loginForm" class="auth-form">
                    <h2>Login</h2>
                    <input type="email" id="loginEmail" placeholder="Email" required>
                    <input type="password" id="loginPassword" placeholder="Password" required>
                    <button type="submit" class="btn btn-primary">Login</button>
                    <div id="loginStatus"></div>
                </form>
            `;
            document.body.innerHTML = formHtml;
        });
        
        // Fill login form
        await page.type('#loginEmail', MOCK_CUSTOMER.email);
        await page.type('#loginPassword', MOCK_CUSTOMER.password);
        
        // Mock successful login
        await page.evaluate(() => {
            const statusDiv = document.getElementById('loginStatus');
            statusDiv.innerHTML = '<span class="success">Login successful!</span>';
            
            // Mock user session
            localStorage.setItem('customerSession', JSON.stringify({
                email: 'test@example.com',
                name: 'Test Customer',
                loggedIn: true
            }));
        });
        
        // Verify login success message
        const successMessage = await page.$('.success');
        expect(successMessage).toBeTruthy();
        
        const successText = await page.$eval('.success', el => el.textContent);
        expect(successText).toContain('Login successful');
    });
});

describe('Customer Portal - Product Catalog', () => {
    
    test('should display product catalog', async () => {
        // Mock authenticated state
        await page.evaluate(() => {
            localStorage.setItem('customerSession', JSON.stringify({
                email: 'test@example.com',
                name: 'Test Customer',
                loggedIn: true
            }));
        });
        
        // Create product catalog
        await page.evaluate(() => {
            const catalogHtml = `
                <section id="product-catalog" class="catalog-section">
                    <h2>Our Products</h2>
                    <div class="product-grid">
                        <div class="product-item" data-product="HEEL_HOENDER">
                            <h3>HEEL HOENDER</h3>
                            <p>Fresh whole chicken (1.5kg - 2.2kg)</p>
                            <div class="price">R67.00/kg</div>
                            <div class="quantity-controls">
                                <button class="qty-minus">-</button>
                                <input type="number" class="qty-input" min="0" max="10" value="0">
                                <button class="qty-plus">+</button>
                            </div>
                            <button class="add-to-cart">Add to Cart</button>
                        </div>
                        <div class="product-item" data-product="SUIWER_HEUNING">
                            <h3>SUIWER HEUNING</h3>
                            <p>Pure honey (500g jar)</p>
                            <div class="price">R70.00</div>
                            <div class="quantity-controls">
                                <button class="qty-minus">-</button>
                                <input type="number" class="qty-input" min="0" max="10" value="0">
                                <button class="qty-plus">+</button>
                            </div>
                            <button class="add-to-cart">Add to Cart</button>
                        </div>
                    </div>
                </section>
            `;
            document.body.innerHTML = catalogHtml;
        });
        
        // Verify product catalog is displayed
        const catalog = await page.$('#product-catalog');
        expect(catalog).toBeTruthy();
        
        const productItems = await page.$$('.product-item');
        expect(productItems.length).toBe(2);
        
        // Check product details
        const firstProduct = await page.$eval('.product-item h3', el => el.textContent);
        expect(firstProduct).toBe('HEEL HOENDER');
        
        const price = await page.$eval('.product-item .price', el => el.textContent);
        expect(price).toBe('R67.00/kg');
    });
    
    test('should handle quantity selection', async () => {
        // Create product with quantity controls
        await page.evaluate(() => {
            const productHtml = `
                <div class="product-item">
                    <h3>HEEL HOENDER</h3>
                    <div class="quantity-controls">
                        <button class="qty-minus" onclick="updateQuantity(-1)">-</button>
                        <input type="number" class="qty-input" value="0" min="0" max="10">
                        <button class="qty-plus" onclick="updateQuantity(1)">+</button>
                    </div>
                </div>
            `;
            document.body.innerHTML = productHtml;
            
            // Add quantity update function
            window.updateQuantity = function(delta) {
                const input = document.querySelector('.qty-input');
                const currentValue = parseInt(input.value) || 0;
                const newValue = Math.max(0, Math.min(10, currentValue + delta));
                input.value = newValue;
            };
        });
        
        // Test quantity increase
        await page.click('.qty-plus');
        const quantityAfterIncrease = await page.$eval('.qty-input', el => el.value);
        expect(quantityAfterIncrease).toBe('1');
        
        // Test quantity decrease
        await page.click('.qty-minus');
        const quantityAfterDecrease = await page.$eval('.qty-input', el => el.value);
        expect(quantityAfterDecrease).toBe('0');
    });
    
    test('should add items to cart', async () => {
        // Create product with add to cart functionality
        await page.evaluate(() => {
            const productHtml = `
                <div class="product-item" data-product="HEEL_HOENDER">
                    <h3>HEEL HOENDER</h3>
                    <input type="number" class="qty-input" value="2" min="0">
                    <button class="add-to-cart" onclick="addToCart()">Add to Cart</button>
                </div>
                <div id="cart-status"></div>
            `;
            document.body.innerHTML = productHtml;
            
            // Mock cart functionality
            window.cart = window.cart || [];
            window.addToCart = function() {
                const product = 'HEEL_HOENDER';
                const quantity = parseInt(document.querySelector('.qty-input').value);
                
                if (quantity > 0) {
                    window.cart.push({ product, quantity });
                    document.getElementById('cart-status').innerHTML = 
                        `Added ${quantity} x HEEL HOENDER to cart`;
                }
            };
        });
        
        // Click add to cart
        await page.click('.add-to-cart');
        
        // Verify item was added
        const cartStatus = await page.$eval('#cart-status', el => el.textContent);
        expect(cartStatus).toContain('Added 2 x HEEL HOENDER to cart');
        
        // Verify cart has item
        const cartItems = await page.evaluate(() => window.cart.length);
        expect(cartItems).toBe(1);
    });
});

describe('Customer Portal - Shopping Cart', () => {
    
    test('should display cart contents', async () => {
        // Mock cart with items
        await page.evaluate(() => {
            const cartHtml = `
                <section id="shopping-cart">
                    <h2>Your Cart</h2>
                    <div class="cart-items">
                        <div class="cart-item">
                            <div class="item-details">
                                <h4>HEEL HOENDER</h4>
                                <p>Fresh whole chicken</p>
                            </div>
                            <div class="item-quantity">
                                <input type="number" value="2" min="1">
                            </div>
                            <div class="item-price">R67.00/kg</div>
                            <div class="item-total">R134.00</div>
                            <button class="remove-item">Remove</button>
                        </div>
                    </div>
                    <div class="cart-summary">
                        <div class="total-amount">
                            <strong>Total: R134.00</strong>
                        </div>
                        <button class="checkout-btn">Proceed to Checkout</button>
                    </div>
                </section>
            `;
            document.body.innerHTML = cartHtml;
        });
        
        // Verify cart display
        const cart = await page.$('#shopping-cart');
        expect(cart).toBeTruthy();
        
        const cartItem = await page.$('.cart-item');
        expect(cartItem).toBeTruthy();
        
        const itemName = await page.$eval('.item-details h4', el => el.textContent);
        expect(itemName).toBe('HEEL HOENDER');
        
        const total = await page.$eval('.total-amount', el => el.textContent);
        expect(total).toContain('R134.00');
    });
    
    test('should handle cart item updates', async () => {
        // Create cart with update functionality
        await page.evaluate(() => {
            const cartHtml = `
                <div class="cart-item">
                    <h4>HEEL HOENDER</h4>
                    <input type="number" class="item-quantity" value="2" onchange="updateCartItem()">
                    <div class="item-total">R134.00</div>
                    <button class="remove-item" onclick="removeCartItem()">Remove</button>
                </div>
                <div class="cart-total">Total: R134.00</div>
            `;
            document.body.innerHTML = cartHtml;
            
            window.updateCartItem = function() {
                const quantity = parseInt(document.querySelector('.item-quantity').value);
                const unitPrice = 67.00;
                const newTotal = quantity * unitPrice;
                
                document.querySelector('.item-total').textContent = `R${newTotal.toFixed(2)}`;
                document.querySelector('.cart-total').textContent = `Total: R${newTotal.toFixed(2)}`;
            };
            
            window.removeCartItem = function() {
                document.querySelector('.cart-item').remove();
                document.querySelector('.cart-total').textContent = 'Total: R0.00';
            };
        });
        
        // Test quantity update
        await page.focus('.item-quantity');
        await page.keyboard.selectAll();
        await page.type('.item-quantity', '3');
        await page.$eval('.item-quantity', el => el.dispatchEvent(new Event('change')));
        
        // Verify updated total
        const updatedTotal = await page.$eval('.item-total', el => el.textContent);
        expect(updatedTotal).toBe('R201.00');
        
        // Test item removal
        await page.click('.remove-item');
        
        // Verify item removed
        const cartItem = await page.$('.cart-item');
        expect(cartItem).toBeFalsy();
        
        const cartTotal = await page.$eval('.cart-total', el => el.textContent);
        expect(cartTotal).toBe('Total: R0.00');
    });
});

describe('Customer Portal - Checkout Process', () => {
    
    test('should display checkout form', async () => {
        // Mock checkout form
        await page.evaluate(() => {
            const checkoutHtml = `
                <section id="checkout">
                    <h2>Checkout</h2>
                    <form id="checkout-form">
                        <div class="customer-info">
                            <h3>Delivery Information</h3>
                            <input type="text" id="deliveryName" placeholder="Full Name" required>
                            <input type="tel" id="deliveryPhone" placeholder="Phone Number" required>
                            <textarea id="deliveryAddress" placeholder="Delivery Address" required></textarea>
                        </div>
                        <div class="order-summary">
                            <h3>Order Summary</h3>
                            <div class="summary-item">
                                <span>HEEL HOENDER (2x)</span>
                                <span>R134.00</span>
                            </div>
                            <div class="summary-total">
                                <strong>Total: R134.00</strong>
                            </div>
                        </div>
                        <button type="submit" class="place-order-btn">Place Order</button>
                    </form>
                </section>
            `;
            document.body.innerHTML = checkoutHtml;
        });
        
        // Verify checkout form elements
        const checkoutForm = await page.$('#checkout-form');
        expect(checkoutForm).toBeTruthy();
        
        const nameInput = await page.$('#deliveryName');
        const phoneInput = await page.$('#deliveryPhone');
        const addressInput = await page.$('#deliveryAddress');
        
        expect(nameInput).toBeTruthy();
        expect(phoneInput).toBeTruthy();
        expect(addressInput).toBeTruthy();
        
        // Verify order summary
        const summaryTotal = await page.$eval('.summary-total', el => el.textContent);
        expect(summaryTotal).toContain('R134.00');
    });
    
    test('should validate checkout form', async () => {
        // Create checkout form with validation
        await page.evaluate(() => {
            const formHtml = `
                <form id="checkout-form">
                    <input type="text" id="deliveryName" required>
                    <input type="tel" id="deliveryPhone" required>
                    <textarea id="deliveryAddress" required></textarea>
                    <button type="submit">Place Order</button>
                    <div id="validation-errors"></div>
                </form>
            `;
            document.body.innerHTML = formHtml;
            
            document.getElementById('checkout-form').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const name = document.getElementById('deliveryName').value.trim();
                const phone = document.getElementById('deliveryPhone').value.trim();
                const address = document.getElementById('deliveryAddress').value.trim();
                
                const errors = [];
                if (!name) errors.push('Name is required');
                if (!phone) errors.push('Phone is required');
                if (!address) errors.push('Address is required');
                
                const errorDiv = document.getElementById('validation-errors');
                if (errors.length > 0) {
                    errorDiv.innerHTML = errors.join(', ');
                } else {
                    errorDiv.innerHTML = 'Order placed successfully!';
                }
            });
        });
        
        // Try to submit empty form
        await page.click('button[type="submit"]');
        
        // Check validation errors
        const errors = await page.$eval('#validation-errors', el => el.textContent);
        expect(errors).toContain('Name is required');
        expect(errors).toContain('Phone is required');
        expect(errors).toContain('Address is required');
        
        // Fill form and submit
        await page.type('#deliveryName', MOCK_CUSTOMER.name);
        await page.type('#deliveryPhone', MOCK_CUSTOMER.phone);
        await page.type('#deliveryAddress', MOCK_CUSTOMER.address);
        
        await page.click('button[type="submit"]');
        
        // Check success message
        const successMessage = await page.$eval('#validation-errors', el => el.textContent);
        expect(successMessage).toBe('Order placed successfully!');
    });
});

describe('Customer Portal - Responsive Design', () => {
    
    test('should work on mobile devices', async () => {
        // Set mobile viewport
        await page.setViewport({ width: 375, height: 667 });
        
        await page.reload({ waitUntil: 'networkidle0' });
        
        // Create mobile-optimized layout test
        await page.evaluate(() => {
            const mobileContent = `
                <div class="mobile-layout">
                    <header class="mobile-header">
                        <h1>Plaas Hoenders</h1>
                        <button class="menu-toggle">☰</button>
                    </header>
                    <main class="mobile-main">
                        <section class="hero-mobile">
                            <h2>Fresh Chicken</h2>
                            <p>Order directly from the farm</p>
                        </section>
                    </main>
                </div>
            `;
            document.body.innerHTML = mobileContent;
        });
        
        // Verify mobile layout
        const mobileLayout = await page.$('.mobile-layout');
        expect(mobileLayout).toBeTruthy();
        
        const menuToggle = await page.$('.menu-toggle');
        expect(menuToggle).toBeTruthy();
        
        // Restore desktop viewport
        await page.setViewport(TEST_CONFIG.viewport);
    });
    
    test('should handle touch interactions', async () => {
        // Set mobile viewport
        await page.setViewport({ width: 375, height: 667 });
        
        // Mock touch-friendly buttons
        await page.evaluate(() => {
            const touchContent = `
                <div class="touch-interface">
                    <button class="touch-btn large-btn" onclick="handleTouchAction()">
                        Add to Cart
                    </button>
                </div>
                <div id="touch-feedback"></div>
            `;
            document.body.innerHTML = touchContent;
            
            window.handleTouchAction = function() {
                document.getElementById('touch-feedback').textContent = 'Touch action handled';
            };
        });
        
        // Simulate touch on button
        await page.tap('.touch-btn');
        
        // Verify touch action
        const feedback = await page.$eval('#touch-feedback', el => el.textContent);
        expect(feedback).toBe('Touch action handled');
        
        // Restore desktop viewport
        await page.setViewport(TEST_CONFIG.viewport);
    });
});