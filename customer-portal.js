// Customer Portal JavaScript
// Plaas Hoenders Customer Ordering System

// Supabase configuration for database integration
const SUPABASE_URL = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';

// Initialize Supabase client (from CDN in customer.html)
let supabaseClient;
if (typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Customer portal Supabase client initialized');
} else {
    console.error('❌ Supabase not available in customer portal - window.supabase missing');
    console.log('🔍 Available window properties:', Object.keys(window));
}

// Product catalog with pricing (based on your rate card)
const products = {
    'HEEL_HOENDER': {
        name: 'Heel Hoender',
        description: 'Hele hoender, vars van die plaas',
        price: 67.00, // R67/kg - will be calculated when weighed
        estimatedWeight: 2.5, // Average weight for estimation
        category: 'whole'
    },
    'HEEL_HALWE': {
        name: 'Hele Halwe Hoenders',
        description: 'Halwe hoenders, perfek vir kleiner gesinne',
        price: 68.00,
        estimatedWeight: 1.25,
        category: 'half'
    },
    'FILETTE': {
        name: 'Filette (sonder vel)',
        description: 'Hoender filette sonder vel',
        price: 100.00,
        estimatedWeight: 0.5,
        category: 'cuts'
    },
    'BORSSTUKKE': {
        name: 'Borsstukke met Been en Vel',
        description: 'Hoender borsstukke met been en vel',
        price: 73.00,
        estimatedWeight: 0.6,
        category: 'cuts'
    },
    'BOUDE_DYE': {
        name: 'Boude en Dye',
        description: 'Hoender boude en dye',
        price: 81.00,
        estimatedWeight: 0.8,
        category: 'cuts'
    },
    'VLERKIES': {
        name: 'Vlerkies',
        description: 'Hoender vlerkies',
        price: 90.00,
        estimatedWeight: 0.3,
        category: 'cuts'
    },
    'BRAAIPAKKE': {
        name: 'Braaipakke',
        description: 'Gemengde braai pakke',
        price: 74.00,
        estimatedWeight: 1.0,
        category: 'mixed'
    },
    'PLAT_HOENDER': {
        name: 'Plat Hoender (Flatty\'s)',
        description: 'Plat hoenders, perfek vir braai',
        price: 79.00,
        estimatedWeight: 1.8,
        category: 'whole'
    }
};

// Global state
let currentStep = 1;
let customerData = {};
let cart = {}; // Structure: { productKey: { quantity: number, addedAt: timestamp } }
let orderData = {};
let isEditMode = false;
let originalCustomerData = {};

// Cart persistence and management
const CART_STORAGE_KEY = 'plaasHoendersShoppingCart';
const CART_EXPIRY_HOURS = 24; // Cart expires after 24 hours

// DOM elements
const modal = document.getElementById('modal');
const closeBtn = document.getElementById('closeModal');

// Step navigation elements
const stepIndicators = {
    1: document.getElementById('step-indicator-1'),
    2: document.getElementById('step-indicator-2'),
    3: document.getElementById('step-indicator-3'),
    4: document.getElementById('step-indicator-4')
};

const progressBars = {
    1: document.getElementById('progress-1'),
    2: document.getElementById('progress-2'),
    3: document.getElementById('progress-3')
};

// Initialize the portal
document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
    setupEventListeners();
    populateProductGrid();
});

/**
 * Initialize the customer portal
 * @function initializePortal
 */
function initializePortal() {
    // Show step 1 by default
    showStep(1);
    updateStepIndicators();
    
    // Load any existing customer data from localStorage
    loadCustomerData();
    
    // Load existing cart from localStorage
    loadCartFromStorage();
}

function setupEventListeners() {
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.classList.add('hidden'), 300);
    });

    // Step 1: Customer details and editing
    document.getElementById('confirmDetails').addEventListener('click', handleCustomerDetails);
    document.getElementById('editDetailsBtn').addEventListener('click', enableEditMode);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEditMode);
    document.getElementById('saveChangesBtn').addEventListener('click', saveCustomerChanges);

    // Step 2: Navigation
    document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));
    document.getElementById('proceedToReview').addEventListener('click', () => goToStep(3));

    // Step 3: Navigation
    document.getElementById('backToProducts').addEventListener('click', () => goToStep(2));
    document.getElementById('placeOrder').addEventListener('click', handlePlaceOrder);

    // Step 4: Actions
    document.getElementById('newOrder').addEventListener('click', startNewOrder);
    document.getElementById('closePortal').addEventListener('click', () => closeBtn.click());
    
    // Cart toggle functionality
    document.getElementById('cartToggle').addEventListener('click', toggleCartView);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeBtn.click();
        }
    });
}

function loadCustomerData() {
    // In real app, this would come from your user authentication system
    // For demo, we'll use saved data or default logged-in user
    const saved = localStorage.getItem('plaasHoendersLoggedInUser');
    
    if (saved) {
        customerData = JSON.parse(saved);
    } else {
        // Default logged-in user data (simulate existing customer)
        customerData = {
            name: 'Jean Dreyer',
            phone: '079 616 7761', 
            address: '123 Main Street, Pretoria, 0001',
            email: 'jean.dreyer@email.com'
        };
        // Save this as the logged-in user
        localStorage.setItem('plaasHoendersLoggedInUser', JSON.stringify(customerData));
    }
    
    // Store original data for cancel functionality
    originalCustomerData = {...customerData};
    
    // Update display elements
    updateCustomerDisplay();
    
    // Load last order info if available
    loadLastOrderInfo();
}

function updateCustomerDisplay() {
    document.getElementById('displayName').textContent = customerData.name;
    document.getElementById('displayPhone').textContent = customerData.phone;
    document.getElementById('displayAddress').textContent = customerData.address;
    document.getElementById('displayEmail').textContent = customerData.email;
    
    // Also update edit form fields
    document.getElementById('customerName').value = customerData.name;
    document.getElementById('customerPhone').value = customerData.phone;
    document.getElementById('customerAddress').value = customerData.address;
    document.getElementById('customerEmail').value = customerData.email;
    document.getElementById('deliveryInstructions').value = customerData.deliveryInstructions || '';
}

function loadLastOrderInfo() {
    // Load customer's order history
    const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
    const customerOrders = orders.filter(order => order.customer.name === customerData.name);
    
    if (customerOrders.length > 0) {
        const lastOrder = customerOrders[customerOrders.length - 1];
        const orderDate = new Date(lastOrder.timestamp);
        const weeksAgo = Math.floor((Date.now() - orderDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        // Create summary of last order items
        const itemsSummary = Object.entries(lastOrder.items)
            .map(([productKey, qty]) => `${qty}x ${products[productKey]?.name || productKey}`)
            .slice(0, 2) // Show max 2 items
            .join(', ');
        
        const timeText = weeksAgo === 0 ? 'Hierdie week' : 
                        weeksAgo === 1 ? '1 week gelede' : 
                        `${weeksAgo} weke gelede`;
        
        document.getElementById('lastOrderText').textContent = `${timeText}: ${itemsSummary}`;
    } else {
        document.getElementById('lastOrderInfo').style.display = 'none';
    }
}

function enableEditMode() {
    isEditMode = true;
    document.getElementById('detailsDisplay').classList.add('hidden');
    document.getElementById('detailsEdit').classList.remove('hidden');
}

function cancelEditMode() {
    isEditMode = false;
    
    // Restore original data
    customerData = {...originalCustomerData};
    updateCustomerDisplay();
    
    // Switch back to display mode
    document.getElementById('detailsEdit').classList.add('hidden');
    document.getElementById('detailsDisplay').classList.remove('hidden');
}

function saveCustomerChanges() {
    // Get updated values (only phone, address and delivery instructions can be changed)
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const deliveryInstructions = document.getElementById('deliveryInstructions').value.trim();
    
    // Validate required fields
    if (!phone || !address) {
        showTempMessage('Telefoon nommer en adres is verplig', 'error');
        return;
    }
    
    // Validate phone number format
    if (!validatePhoneNumber(phone)) {
        showTempMessage('Ongeldige telefoon nommer formaat', 'error');
        return;
    }
    
    // Sanitize inputs to prevent XSS
    const sanitizedPhone = sanitizeHtml(phone).substring(0, 20);
    const sanitizedAddress = sanitizeHtml(address).substring(0, 500);
    const sanitizedInstructions = sanitizeHtml(deliveryInstructions).substring(0, 1000);
    
    // Update customer data with sanitized values
    customerData.phone = sanitizedPhone;
    customerData.address = sanitizedAddress;
    customerData.deliveryInstructions = sanitizedInstructions;
    
    // Save to storage
    localStorage.setItem('plaasHoendersLoggedInUser', JSON.stringify(customerData));
    
    // Update display
    updateCustomerDisplay();
    
    // Exit edit mode
    isEditMode = false;
    document.getElementById('detailsEdit').classList.add('hidden');
    document.getElementById('detailsDisplay').classList.remove('hidden');
    
    // Show success message
    showTempMessage('Besonderhede suksesvol gewysig!', 'success');
}

function showTempMessage(message, type = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 2000);
}

function saveCustomerData() {
    localStorage.setItem('plaasHoendersCustomerData', JSON.stringify(customerData));
}

/**
 * Load cart from localStorage with expiry check
 * @function loadCartFromStorage
 */
function loadCartFromStorage() {
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
            const cartData = JSON.parse(stored);
            const now = Date.now();
            
            // Check if cart has expired
            if (cartData.timestamp && (now - cartData.timestamp) > (CART_EXPIRY_HOURS * 60 * 60 * 1000)) {
                console.log('Cart expired, clearing stored cart');
                clearCart();
                return;
            }
            
            // Load valid cart data
            cart = cartData.items || {};
            console.log('Loaded cart from storage:', cart);
            
            // Update UI to reflect loaded cart
            updateAllProductQuantities();
            updateCartSummary();
        }
    } catch (error) {
        console.error('Error loading cart from storage:', error);
        clearCart();
    }
}

/**
 * Save cart to localStorage with timestamp and validation
 * @function saveCartToStorage
 */
function saveCartToStorage() {
    try {
        // Skip save if cart is empty (reduces localStorage usage)
        if (Object.keys(cart).length === 0) {
            localStorage.removeItem(CART_STORAGE_KEY);
            return;
        }
        
        // Validate cart data integrity before saving
        const validatedCart = {};
        for (const [productKey, cartItem] of Object.entries(cart)) {
            if (products[productKey] && cartItem.quantity > 0) {
                validatedCart[productKey] = {
                    quantity: Math.max(0, Math.min(999, parseInt(cartItem.quantity))),
                    addedAt: cartItem.addedAt || Date.now()
                };
            }
        }
        
        const cartData = {
            items: validatedCart,
            timestamp: Date.now(),
            customerId: sanitizeHtml(customerData.email || customerData.name).substring(0, 100),
            version: '1.0' // For future cart structure migrations
        };
        
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
        console.log('Cart saved to storage (items:', Object.keys(validatedCart).length, ')');
        
    } catch (error) {
        console.error('Error saving cart to storage:', error);
        // Fallback: Clear corrupted cart if localStorage quota exceeded
        if (error.name === 'QuotaExceededError') {
            localStorage.removeItem(CART_STORAGE_KEY);
            showTempMessage('Mandjie kon nie gestoor word nie - vol berging', 'warning');
        }
    }
}

/**
 * Clear cart and remove from storage
 * @function clearCart
 */
function clearCart() {
    cart = {};
    localStorage.removeItem(CART_STORAGE_KEY);
    updateAllProductQuantities();
    updateCartSummary();
    console.log('Cart cleared');
}

/**
 * Add item to cart with validation
 * @function addToCart
 * @param {string} productKey - Product key
 * @param {number} quantity - Quantity to add
 */
function addToCart(productKey, quantity) {
    if (!products[productKey]) {
        console.error('Invalid product key:', productKey);
        return false;
    }
    
    quantity = Math.max(0, parseInt(quantity) || 0);
    
    if (quantity === 0) {
        removeFromCart(productKey);
    } else {
        cart[productKey] = {
            quantity: quantity,
            addedAt: Date.now()
        };
        console.log(`Added to cart: ${productKey} x${quantity}`);
    }
    
    saveCartToStorage();
    updateCartSummary();
    return true;
}

/**
 * Remove item from cart
 * @function removeFromCart  
 * @param {string} productKey - Product key to remove
 */
function removeFromCart(productKey) {
    if (cart[productKey]) {
        delete cart[productKey];
        console.log(`Removed from cart: ${productKey}`);
        saveCartToStorage();
        updateCartSummary();
    }
}

/**
 * Get cart item count
 * @function getCartItemCount
 * @returns {number} Total number of different products in cart
 */
function getCartItemCount() {
    return Object.keys(cart).length;
}

/**
 * Get cart total quantity
 * @function getCartTotalQuantity
 * @returns {number} Total quantity of all items in cart
 */
function getCartTotalQuantity() {
    return Object.values(cart).reduce((total, item) => total + item.quantity, 0);
}

/**
 * Update all product quantity inputs to reflect current cart
 * @function updateAllProductQuantities
 */
function updateAllProductQuantities() {
    Object.keys(products).forEach(productKey => {
        const qtyInput = document.getElementById(`qty-${productKey}`);
        if (qtyInput) {
            const cartItem = cart[productKey];
            const quantity = cartItem ? cartItem.quantity : 0;
            qtyInput.value = quantity;
            updateProductTotal(productKey, quantity);
        }
    });
}

function showStep(stepNumber) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.remove('active');
    }
    
    // Show current step
    const currentStepEl = document.getElementById(`step-${stepNumber}`);
    currentStepEl.classList.add('active');
    
    // Trigger animations
    const animatedElements = currentStepEl.querySelectorAll('.opacity-0');
    animatedElements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.remove('opacity-0');
        }, index * 100);
    });
    
    currentStep = stepNumber;
}

function goToStep(stepNumber) {
    updateStepIndicators();
    showStep(stepNumber);
}

function updateStepIndicators() {
    // Update step indicators based on current step
    for (let i = 1; i <= 4; i++) {
        const indicator = stepIndicators[i];
        const span = indicator.querySelector('span');
        
        if (i < currentStep) {
            // Completed step
            indicator.className = 'flex items-center justify-center w-8 h-8 bg-green-500 rounded-full border border-green-400';
            span.className = 'text-sm font-medium text-white';
            span.innerHTML = '✓';
        } else if (i === currentStep) {
            // Current step
            indicator.className = 'flex items-center justify-center w-8 h-8 bg-orange-500 rounded-full border border-orange-400';
            span.className = 'text-sm font-medium text-white';
            span.textContent = i;
        } else {
            // Future step
            indicator.className = 'flex items-center justify-center w-8 h-8 bg-zinc-800/50 rounded-full border border-zinc-800/30';
            span.className = 'text-sm font-medium text-zinc-500';
            span.textContent = i;
        }
    }
    
    // Update progress bars
    for (let i = 1; i <= 3; i++) {
        const progressBar = progressBars[i];
        if (i < currentStep) {
            progressBar.className = 'w-8 h-0.5 bg-green-500';
        } else {
            progressBar.className = 'w-8 h-0.5 bg-zinc-800/50';
        }
    }
}

function handleCustomerDetails() {
    // If in edit mode, save changes first
    if (isEditMode) {
        saveCustomerChanges();
        return;
    }
    
    // Proceed to next step with confirmed details
    goToStep(2);
}

function populateProductGrid() {
    const productGrid = document.getElementById('productGrid');
    
    Object.entries(products).forEach(([key, product]) => {
        const productCard = createProductCard(key, product);
        productGrid.appendChild(productCard);
    });
}

function createProductCard(productKey, product) {
    const card = document.createElement('div');
    card.className = 'bg-zinc-800/30 rounded-xl border border-zinc-700/30 p-6 hover:border-orange-500/30 transition-all duration-200';
    
    card.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-white mb-2">${product.name}</h3>
            <p class="text-zinc-400 text-sm mb-3">${product.description}</p>
            <div class="flex justify-between items-center mb-4">
                <span class="text-orange-400 font-semibold">~R${product.price}/kg</span>
                <span class="text-xs text-zinc-500">Est. ~${product.estimatedWeight}kg each</span>
            </div>
        </div>
        
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button onclick="updateQuantity('${productKey}', -1)" class="w-10 h-10 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50 text-white flex items-center justify-center transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"></path>
                    </svg>
                </button>
                <input type="number" id="qty-${productKey}" value="0" min="0" class="quantity-input w-16 h-10 bg-zinc-700/50 border border-zinc-600/50 rounded-lg text-white text-center focus:outline-none focus:border-orange-500/50" onchange="setQuantity('${productKey}', this.value)">
                <button onclick="updateQuantity('${productKey}', 1)" class="w-10 h-10 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50 text-white flex items-center justify-center transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14"></path><path d="M5 12h14"></path>
                    </svg>
                </button>
            </div>
            <div class="text-right">
                <p class="text-sm text-zinc-400">Est. totaal</p>
                <p class="text-orange-400 font-semibold" id="total-${productKey}">R0.00</p>
            </div>
        </div>
    `;
    
    return card;
}

function updateQuantity(productKey, change) {
    const qtyInput = document.getElementById(`qty-${productKey}`);
    let currentQty = parseInt(qtyInput.value) || 0;
    let newQty = Math.max(0, currentQty + change);
    
    qtyInput.value = newQty;
    setQuantity(productKey, newQty);
}

function setQuantity(productKey, quantity) {
    // Input validation and sanitization
    if (!productKey || typeof productKey !== 'string') {
        console.error('Invalid productKey provided to setQuantity');
        return;
    }
    
    // Sanitize productKey to prevent XSS attacks
    const sanitizedProductKey = productKey.replace(/[<>'"&]/g, '');
    if (!products[sanitizedProductKey]) {
        console.error('Product not found:', sanitizedProductKey);
        return;
    }
    
    // Validate quantity with stricter bounds
    const parsedQty = parseInt(quantity);
    if (isNaN(parsedQty) || parsedQty < 0 || parsedQty > 999) {
        console.warn('Invalid quantity provided:', quantity, 'defaulting to 0');
        quantity = 0;
    } else {
        quantity = parsedQty;
    }
    
    addToCart(sanitizedProductKey, quantity);
    updateProductTotal(sanitizedProductKey, quantity);
}

/**
 * Update product total display on product card
 * @function updateProductTotal
 * @param {string} productKey - Product key
 * @param {number} quantity - Quantity
 */
function updateProductTotal(productKey, quantity) {
    const lineCalc = calculateLineItemTotal(productKey, quantity);
    const totalElement = document.getElementById(`total-${productKey}`);
    if (totalElement) {
        totalElement.textContent = `R${lineCalc.lineTotal.toFixed(2)}`;
    }
    
    // Also update weight display if it exists
    const weightElement = document.getElementById(`weight-${productKey}`);
    if (weightElement) {
        weightElement.textContent = `~${lineCalc.estimatedWeight}kg`;
    }
}

/**
 * Update cart summary display with current cart contents (optimized for performance)
 * @function updateCartSummary
 */
function updateCartSummary() {
    // Cache DOM elements to avoid repeated queries
    const cartItemsEl = document.getElementById('cartItems');
    const cartItemCountEl = document.getElementById('cartItemCount');
    const cartTotalEl = document.getElementById('cartTotal');
    const proceedBtn = document.getElementById('proceedToReview');
    
    if (!cartItemsEl || !cartItemCountEl || !cartTotalEl) {
        console.warn('Cart summary elements not found');
        return;
    }
    
    const cartKeys = Object.keys(cart);
    const totalItems = cartKeys.length;
    
    // Early return for empty cart
    if (totalItems === 0) {
        // Use documentFragment for better performance
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-zinc-400 text-center py-4';
        emptyMsg.textContent = 'Geen items in mandjie nie';
        
        cartItemsEl.innerHTML = '';
        cartItemsEl.appendChild(emptyMsg);
        cartItemCountEl.textContent = '0 items';
        cartTotalEl.textContent = 'R0.00';
        
        if (proceedBtn) proceedBtn.disabled = true;
        updateCartBadge();
        return;
    }
    
    let cartTotal = 0;
    let cartHTML = '';
    
    cartKeys.forEach(productKey => {
        const product = products[productKey];
        const cartItem = cart[productKey];
        const quantity = cartItem.quantity;
        const lineCalc = calculateLineItemTotal(productKey, quantity);
        cartTotal += lineCalc.lineTotal;
        
        cartHTML += `
            <div class="flex justify-between items-start text-sm group">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-zinc-300 font-medium">${quantity}x ${product.name}</span>
                        <button 
                            onclick="removeFromCart('${productKey}'); updateAllProductQuantities();" 
                            class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            title="Verwyder item">
                            ✕
                        </button>
                    </div>
                    <div class="text-xs text-zinc-500 mt-1">
                        ~${lineCalc.estimatedWeight}kg × R${lineCalc.pricePerKg}/kg
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-orange-400 font-medium">R${lineCalc.lineTotal.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    
    cartItemsEl.innerHTML = cartHTML;
    cartItemCountEl.textContent = `${totalItems} items`;
    cartTotalEl.textContent = `R${cartTotal.toFixed(2)}`;
    
    // Update estimated weight display
    const cartWeightEl = document.getElementById('cartWeight');
    if (cartWeightEl) {
        const totalCalc = calculateEstimatedTotal();
        cartWeightEl.textContent = `${totalCalc.totalWeight}kg`;
    }
    
    if (proceedBtn) proceedBtn.disabled = false;
    
    // Update cart badge in header
    updateCartBadge();
}

/**
 * Update cart badge in header navigation
 * @function updateCartBadge
 */
function updateCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    const itemCount = getCartItemCount();
    
    if (cartBadge) {
        cartBadge.textContent = itemCount;
        
        // Show/hide badge based on cart contents
        if (itemCount === 0) {
            cartBadge.classList.add('opacity-0', 'scale-0');
        } else {
            cartBadge.classList.remove('opacity-0', 'scale-0');
        }
    }
}

/**
 * Toggle cart view (show step 2 with products and cart)
 * @function toggleCartView
 */
function toggleCartView() {
    if (currentStep !== 2) {
        goToStep(2);
    } else {
        // If already on step 2, scroll to cart summary
        const cartSummary = document.getElementById('cartSummary');
        if (cartSummary) {
            cartSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/**
 * Handle order placement with validation and database integration
 * @async
 * @function handlePlaceOrder
 */
async function handlePlaceOrder() {
    try {
        const orderNumber = generateOrderNumber();
        const totalCalc = calculateEstimatedTotal();
        
        // Create comprehensive order data
        orderData = {
            orderNumber: orderNumber,
            customer: { 
                ...customerData,
                deliveryInstructions: document.getElementById('deliveryInstructions')?.value || ''
            },
            items: cart,
            products: products,
            timestamp: new Date().toISOString(),
            status: 'provisional', // Will be finalized when plaas slaghuis PDF is processed
            estimatedTotal: totalCalc.subtotal,
            totalWeight: totalCalc.totalWeight,
            itemCount: totalCalc.itemCount
        };
        
        // Validate order before saving
        const validation = validateOrderData(orderData);
        if (!validation.isValid) {
            const errorMsg = validation.errors.join(', ');
            console.error('Order validation failed:', validation.errors);
            showTempMessage(`Bestelling ongeldige: ${errorMsg}`, 'error');
            return;
        }
        
        // Save order to database and localStorage
        const saved = await saveOrder(orderData);
        
        if (saved) {
            // Send immediate order confirmation email to customer
            const emailResult = await sendCustomerOrderConfirmation(orderData);
            
            if (!emailResult.success) {
                console.warn('Order confirmation email failed:', emailResult.error);
                // Order still succeeds even if email fails
            }
            
            // Show order number
            document.getElementById('orderNumber').textContent = orderNumber;
            
            // Clear cart after successful order
            clearCart();
            
            // Go to confirmation step
            goToStep(4);
            
            // Show success message
            showTempMessage('Bestelling suksesvol geplaas!', 'success');
            
            // Log for admin system integration
            console.log('New customer order placed:', orderData);
        } else {
            showTempMessage('Fout met bestelling - probeer weer', 'error');
        }
        
    } catch (error) {
        console.error('Error placing order:', error);
        showTempMessage('Fout met bestelling - probeer weer', 'error');
    }
}

/**
 * Validate order data before submission with comprehensive security checks
 * @function validateOrderData
 * @param {Object} orderData - Order data to validate
 * @returns {Object} Validation result with success flag and errors
 */
function validateOrderData(orderData) {
    const errors = [];
    
    try {
        // Validate order structure
        if (!orderData || typeof orderData !== 'object') {
            errors.push('Ongeldige bestelling data');
            return { isValid: false, errors };
        }
        
        // Validate customer data
        const customer = orderData.customer;
        if (!customer || typeof customer !== 'object') {
            errors.push('Kliënt data ontbreek');
        } else {
            if (!customer.name || customer.name.length < 2 || customer.name.length > 100) {
                errors.push('Ongeldige kliënt naam');
            }
            if (!customer.phone || !validatePhoneNumber(customer.phone)) {
                errors.push('Ongeldige telefoon nommer');
            }
            if (!customer.address || customer.address.length < 10 || customer.address.length > 500) {
                errors.push('Ongeldige adres (te kort of te lank)');
            }
            if (customer.email && !validateEmail(customer.email)) {
                errors.push('Ongeldige email formaat');
            }
        }
        
        // Validate cart items
        if (!orderData.items || typeof orderData.items !== 'object') {
            errors.push('Geen items in bestelling');
        } else {
            const itemKeys = Object.keys(orderData.items);
            if (itemKeys.length === 0) {
                errors.push('Bestelling is leeg');
            } else if (itemKeys.length > 50) {
                errors.push('Te veel items in bestelling (maksimum 50)');
            }
            
            // Validate each item
            for (const [productKey, cartItem] of Object.entries(orderData.items)) {
                if (!products[productKey]) {
                    errors.push(`Ongeldige produk: ${productKey}`);
                } else if (!cartItem.quantity || cartItem.quantity <= 0 || cartItem.quantity > 999) {
                    errors.push(`Ongeldige hoeveelheid vir ${products[productKey].name}: ${cartItem.quantity}`);
                }
            }
        }
        
        // Validate financial data
        if (!orderData.estimatedTotal || isNaN(orderData.estimatedTotal) || orderData.estimatedTotal <= 0) {
            errors.push('Ongeldige bestelling totaal');
        } else if (orderData.estimatedTotal > 50000) {
            errors.push('Bestelling te groot (maksimum R50,000)');
        }
        
        // Validate order metadata
        if (!orderData.orderNumber || typeof orderData.orderNumber !== 'string') {
            errors.push('Bestelling nommer ontbreek');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
        
    } catch (error) {
        console.error('Order validation error:', error);
        return {
            isValid: false,
            errors: ['Validasie fout: ' + error.message]
        };
    }
}

/**
 * Send immediate customer order confirmation email
 * @async
 * @function sendCustomerOrderConfirmation
 * @param {Object} orderData - Complete order data including customer and items
 * @param {Object} orderData.customer - Customer information
 * @param {string} orderData.customer.name - Customer full name
 * @param {string} orderData.customer.email - Customer email address
 * @param {string} orderData.customer.address - Delivery address
 * @param {string} orderData.orderNumber - Unique order identifier
 * @param {Object} orderData.items - Order items by product key
 * @param {number} orderData.estimatedTotal - Total order value
 * @param {number} orderData.totalWeight - Total estimated weight
 * @returns {Promise<{success: boolean, error?: string}>} Email delivery result
 * @throws {Error} When email service is unavailable
 * @since 1.5.0
 * @example
 * const result = await sendCustomerOrderConfirmation(orderData);
 * if (result.success) {
 *   console.log('Confirmation email sent successfully');
 * }
 */
async function sendCustomerOrderConfirmation(orderData) {
    try {
        // Validate email address
        if (!orderData.customer.email || orderData.customer.email.includes('@placeholder.com')) {
            console.log('No valid email for customer, skipping confirmation email');
            return { success: false, error: 'Invalid email address' };
        }
        
        // Generate customer-specific email content
        const subject = generateCustomerEmailSubject(orderData);
        const body = generateCustomerEmailBody(orderData);
        
        // Send email immediately via Google Apps Script
        const emailSent = await sendEmailViaGoogleScript(
            orderData.customer.email,
            subject,
            body
        );
        
        if (emailSent) {
            // Add to email queue for tracking/resend capability
            await addToCustomerEmailQueue(orderData, 'sent');
            console.log('✅ Order confirmation email sent successfully to:', orderData.customer.email);
            return { success: true };
        } else {
            // Add to email queue with failed status for retry
            await addToCustomerEmailQueue(orderData, 'failed');
            console.error('❌ Failed to send order confirmation email');
            return { success: false, error: 'Email delivery failed' };
        }
        
    } catch (error) {
        console.error('Error sending customer order confirmation:', error);
        // Add to email queue with error status
        await addToCustomerEmailQueue(orderData, 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Generate customer order confirmation email subject
 * @function generateCustomerEmailSubject
 * @param {Object} orderData - Order data for subject generation
 * @returns {string} Formatted email subject in Afrikaans
 * @since 1.5.0
 */
function generateCustomerEmailSubject(orderData) {
    return `Bestelling Bevestiging - Plaas Hoenders Order #${orderData.orderNumber}`;
}

/**
 * Generate customer order confirmation email body with Afrikaans template
 * @function generateCustomerEmailBody  
 * @param {Object} orderData - Complete order data for email body
 * @returns {string} Formatted email body with HTML line breaks
 * @since 1.5.0
 */
function generateCustomerEmailBody(orderData) {
    // Generate itemized product list with weights and totals
    let itemList = '';
    Object.entries(orderData.items).forEach(([productKey, cartItem]) => {
        const product = products[productKey];
        const lineTotal = calculateLineItemTotal(productKey, cartItem.quantity).lineTotal;
        const estimatedWeight = (product.estimatedWeight * cartItem.quantity).toFixed(1);
        
        itemList += `- ${product.name}: ${cartItem.quantity} stuks (±${estimatedWeight}kg) - R${lineTotal.toFixed(2)}<br>`;
    });
    
    // Customer confirmation template in Afrikaans
    const template = `Goeie naand {customerName},

Baie dankie vir die bestelling, ek waardeer dit. Neem asb kenis van nuwe bank besonderhede. Ek sien jul Saterdag oggend, vind asb staat aangeheg vir bestelling #{orderNumber}.

Bestelling besonderhede:
{orderItems}

Totaal: R{totalAmount}
Geskatte gewig: {totalWeight}kg
Aflewering: {deliveryAddress}

Hierdie is met n nuwe stelsel geproduseer en fe email, as daar foute is laat my asb weet, daar was n te min aan lewer.

Groete
Adriaan Bester
079 616 7761

My bank details:
CAPITEC - Adriaan Bester
Rek no:2258491149
Savings/Spaar rek`;

    return template
        .replace('{customerName}', orderData.customer.name)
        .replace('{orderNumber}', orderData.orderNumber)
        .replace('{orderItems}', itemList)
        .replace('{totalAmount}', orderData.estimatedTotal.toFixed(2))
        .replace('{totalWeight}', orderData.totalWeight.toFixed(1))
        .replace('{deliveryAddress}', orderData.customer.address)
        .replace(/\n/g, '<br>'); // Convert line breaks to HTML for proper email display
}

/**
 * Add order confirmation to customer email queue for tracking and resend capability
 * @async
 * @function addToCustomerEmailQueue
 * @param {Object} orderData - Order data to add to email queue
 * @param {string} status - Email status: 'sent', 'failed', 'error', 'pending'
 * @returns {Promise<void>}
 * @since 1.5.0
 */
async function addToCustomerEmailQueue(orderData, status = 'pending') {
    try {
        // Create customer email queue entry
        const emailQueueItem = {
            id: `customer-email-${orderData.orderNumber}-${Date.now()}`,
            type: 'customer_confirmation',
            customer_name: orderData.customer.name,
            customer_email: orderData.customer.email,
            order_number: orderData.orderNumber,
            order_total: `R${orderData.estimatedTotal.toFixed(2)}`,
            estimated_delivery: 'Saterdag oggend',
            created_at: new Date().toISOString(),
            status: status,
            source: 'customer_portal',
            template_data: {
                customerName: orderData.customer.name,
                orderNumber: orderData.orderNumber,
                orderItems: Object.entries(orderData.items).map(([productKey, cartItem]) => ({
                    product: products[productKey].name,
                    quantity: cartItem.quantity,
                    estimatedWeight: (products[productKey].estimatedWeight * cartItem.quantity).toFixed(1),
                    lineTotal: calculateLineItemTotal(productKey, cartItem.quantity).lineTotal
                })),
                totalAmount: orderData.estimatedTotal,
                totalWeight: orderData.totalWeight,
                deliveryAddress: orderData.customer.address,
                deliveryInstructions: orderData.customer.deliveryInstructions || ''
            }
        };
        
        // Add to both local storage and try to sync with admin system
        const existingQueue = JSON.parse(localStorage.getItem('plaasHoendersEmailQueue') || '[]');
        existingQueue.push(emailQueueItem);
        localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(existingQueue));
        
        // Try to sync with Supabase database if available
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const settings = await supabaseClient.from('settings').select('email_queue').eq('id', 'main').single();
                const databaseQueue = settings.data?.email_queue || [];
                databaseQueue.push(emailQueueItem);
                
                await supabaseClient.from('settings').upsert({
                    id: 'main',
                    email_queue: databaseQueue
                });
            } catch (dbError) {
                console.warn('Could not sync customer email to database, using localStorage only:', dbError);
            }
        }
        
        console.log(`Customer email queue updated - Status: ${status}:`, emailQueueItem);
        
    } catch (error) {
        console.error('Error adding customer email to queue:', error);
    }
}

/**
 * Retry failed customer email delivery with exponential backoff
 * @async
 * @function retryFailedCustomerEmail
 * @param {string} orderNumber - Order number to retry email for
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise<{success: boolean, error?: string}>} Retry result
 * @since 1.5.0
 */
async function retryFailedCustomerEmail(orderNumber, maxRetries = 3, baseDelay = 1000) {
    try {
        // Find the failed email in queue
        const emailQueue = JSON.parse(localStorage.getItem('plaasHoendersEmailQueue') || '[]');
        const failedEmail = emailQueue.find(email => 
            email.order_number === orderNumber && 
            email.type === 'customer_confirmation' && 
            (email.status === 'failed' || email.status === 'error')
        );
        
        if (!failedEmail) {
            return { success: false, error: 'No failed email found for this order' };
        }
        
        // Reconstruct order data from template data
        const orderData = {
            customer: {
                name: failedEmail.customer_name,
                email: failedEmail.customer_email,
                address: failedEmail.template_data.deliveryAddress
            },
            orderNumber: failedEmail.order_number,
            items: {},
            estimatedTotal: failedEmail.template_data.totalAmount,
            totalWeight: failedEmail.template_data.totalWeight
        };
        
        // Convert order items back to required format
        failedEmail.template_data.orderItems.forEach(item => {
            // Find matching product key for this item
            const productKey = Object.keys(products).find(key => 
                products[key].name === item.product
            );
            if (productKey) {
                orderData.items[productKey] = {
                    quantity: item.quantity
                };
            }
        });
        
        // Retry with exponential backoff
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Retry attempt ${attempt}/${maxRetries} for order ${orderNumber}`);
            
            const result = await sendCustomerOrderConfirmation(orderData);
            
            if (result.success) {
                // Update original email status to sent
                failedEmail.status = 'sent';
                failedEmail.retry_count = attempt;
                failedEmail.last_retry_at = new Date().toISOString();
                localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(emailQueue));
                
                console.log(`✅ Email retry successful after ${attempt} attempts for order ${orderNumber}`);
                return { success: true };
            }
            
            // Wait before next retry with exponential backoff
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`Waiting ${delay}ms before next retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // All retries failed
        failedEmail.status = 'retry_failed';
        failedEmail.retry_count = maxRetries;
        failedEmail.last_retry_at = new Date().toISOString();
        localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(emailQueue));
        
        console.error(`❌ All ${maxRetries} retry attempts failed for order ${orderNumber}`);
        return { success: false, error: `All ${maxRetries} retry attempts failed` };
        
    } catch (error) {
        console.error('Error retrying customer email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate order number using existing sequence format
 * @function generateOrderNumber
 * @returns {string} Order number in format ORD-CUSTOMER-timestamp
 */
function generateOrderNumber() {
    // Use shared utility function if available
    if (typeof generateOrderId === 'function') {
        return generateOrderId('ORD-CUSTOMER');
    }
    
    // Fallback to timestamp-based generation
    const timestamp = Date.now();
    return `ORD-CUSTOMER-${timestamp}`;
}

/**
 * Calculate estimated total with detailed breakdown
 * @function calculateEstimatedTotal
 * @returns {Object} Detailed calculation results
 */
function calculateEstimatedTotal() {
    let subtotal = 0;
    let totalWeight = 0;
    const itemBreakdown = [];
    
    Object.entries(cart).forEach(([productKey, cartItem]) => {
        const product = products[productKey];
        const quantity = cartItem.quantity;
        const itemWeight = quantity * product.estimatedWeight;
        const itemTotal = itemWeight * product.price; // price per kg × weight
        
        subtotal += itemTotal;
        totalWeight += itemWeight;
        
        itemBreakdown.push({
            productKey,
            productName: product.name,
            quantity,
            estimatedWeight: itemWeight,
            pricePerKg: product.price,
            lineTotal: itemTotal
        });
    });
    
    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalWeight: parseFloat(totalWeight.toFixed(2)),
        itemCount: Object.keys(cart).length,
        totalQuantity: getCartTotalQuantity(),
        itemBreakdown
    };
}

/**
 * Calculate line item total for a specific product
 * @function calculateLineItemTotal
 * @param {string} productKey - Product key
 * @param {number} quantity - Quantity
 * @returns {Object} Line calculation details
 */
function calculateLineItemTotal(productKey, quantity) {
    if (!products[productKey]) {
        return { lineTotal: 0, estimatedWeight: 0, pricePerKg: 0 };
    }
    
    const product = products[productKey];
    const estimatedWeight = quantity * product.estimatedWeight;
    const lineTotal = estimatedWeight * product.price;
    
    return {
        lineTotal: parseFloat(lineTotal.toFixed(2)),
        estimatedWeight: parseFloat(estimatedWeight.toFixed(2)),
        pricePerKg: product.price,
        productName: product.name
    };
}

/**
 * Save customer order to both localStorage and database
 * @async
 * @function saveOrder
 * @param {Object} order - Order data to save
 * @returns {Promise<boolean>} Success status
 */
async function saveOrder(order) {
    console.log('🚀 saveOrder function called with:', {
        orderNumber: order.orderNumber,
        itemCount: Object.keys(order.items).length,
        customerName: order.customer.name,
        supabaseClientExists: !!supabaseClient
    });
    
    try {
        // Save to localStorage for backup
        const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
        orders.push(order);
        localStorage.setItem('plaasHoendersCustomerOrders', JSON.stringify(orders));
        
        // Convert to admin system format - create individual order rows for each product
        const adminOrders = JSON.parse(localStorage.getItem('plaasHoendersOrders') || '[]');
        
        // Create separate order rows for each product (matches admin system format)
        const individualOrderRows = Object.entries(order.items).map(([productKey, cartItem], index) => {
            const lineTotal = calculateLineItemTotal(productKey, cartItem.quantity);
            return {
                id: `${order.orderNumber}-${index + 1}`, // Unique ID for each product line
                orderId: order.orderNumber, // Group by order number
                name: order.customer.name,
                email: order.customer.email || '',
                phone: order.customer.phone,
                address: order.customer.address,
                product: products[productKey].name,
                quantity: cartItem.quantity,
                weight: lineTotal.estimatedWeight,
                total: lineTotal.lineTotal,
                status: 'provisional',
                timestamp: order.timestamp,
                source: 'Customer Portal',
                deliveryInstructions: order.customer.deliveryInstructions || '',
                pricePerKg: products[productKey].price
            };
        });
        
        // Add individual orders to localStorage for admin dashboard compatibility
        adminOrders.push(...individualOrderRows);
        localStorage.setItem('plaasHoendersOrders', JSON.stringify(adminOrders));
        
        // Save to Supabase database in the format admin dashboard expects
        try {
            const supabaseOrderRows = Object.entries(order.items).map(([productKey, cartItem], index) => {
                const lineTotal = calculateLineItemTotal(productKey, cartItem.quantity);
                return {
                    id: `${order.orderNumber}-${index + 1}`,
                    order_id: order.orderNumber,
                    customer_name: order.customer.name,
                    customer_phone: order.customer.phone,
                    customer_email: order.customer.email || '',
                    customer_address: order.customer.address,
                    delivery_instructions: order.customer.deliveryInstructions || '',
                    timestamp: order.timestamp,
                    status: 'provisional',
                    source: 'customer_portal',
                    product_name: products[productKey].name,
                    quantity: cartItem.quantity,
                    weight_kg: lineTotal.estimatedWeight,
                    total_amount: lineTotal.lineTotal,
                    order_date: new Date(order.timestamp).toISOString().split('T')[0],
                    estimated_total: lineTotal.lineTotal,
                    total_estimated_weight: lineTotal.estimatedWeight
                };
            });

            // Insert individual product rows into orders table
            console.log('📝 Attempting to save', supabaseOrderRows.length, 'individual product rows to Supabase');
            console.log('📋 Sample row data:', supabaseOrderRows[0]);
            
            const { data: orderData, error: orderError } = await supabaseClient
                .from('orders')
                .insert(supabaseOrderRows)
                .select();

            if (orderError) {
                console.error('❌ Supabase order insert failed:', orderError);
                console.error('📄 Failed data structure:', supabaseOrderRows);
                console.warn('🔄 Using localStorage fallback only');
            } else {
                console.log('✅ Individual product orders saved to Supabase database:', orderData?.length || 'unknown', 'rows');
                console.log('📊 Saved data sample:', orderData?.[0]);
            }

            // Also save detailed order items for future reference
            const orderItems = Object.entries(order.items).map(([productKey, cartItem], index) => ({
                id: `${order.orderNumber}-item-${index + 1}`,
                order_id: order.orderNumber,
                product_name: products[productKey].name,
                quantity: cartItem.quantity,
                description: products[productKey].description,
                estimated_price_per_kg: products[productKey].price,
                estimated_weight: products[productKey].estimatedWeight * cartItem.quantity,
                line_total: calculateLineItemTotal(productKey, cartItem.quantity).lineTotal,
                status: 'pending_weights'
            }));

            const { data: itemsData, error: itemsError } = await supabaseClient
                .from('order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                console.warn('Supabase order items insert failed:', itemsError);
            } else {
                console.log('✅ Detailed order items saved for reference:', itemsData.length, 'items');
            }
        } catch (supabaseError) {
            console.warn('Supabase integration error, using localStorage fallback:', supabaseError);
        }
        
        console.log('Order saved successfully:', {
            orderNumber: order.orderNumber,
            individualRows: individualOrderRows.length,
            totalAmount: individualOrderRows.reduce((sum, row) => sum + row.total, 0)
        });
        
        return true;
    } catch (error) {
        console.error('Error saving order:', error);
        return false;
    }
}

function populateOrderReview() {
    // Customer summary
    const customerSummaryEl = document.getElementById('customerSummary');
    customerSummaryEl.innerHTML = `
        <div class="text-zinc-300"><strong>Naam:</strong> ${customerData.name}</div>
        <div class="text-zinc-300"><strong>Telefoon:</strong> ${customerData.phone}</div>
        <div class="text-zinc-300"><strong>Adres:</strong> ${customerData.address}</div>
        ${customerData.email ? `<div class="text-zinc-300"><strong>Email:</strong> ${customerData.email}</div>` : ''}
    `;
    
    // Order items summary
    const orderItemsSummaryEl = document.getElementById('orderItemsSummary');
    const finalTotalEl = document.getElementById('finalTotal');
    
    let orderHTML = '';
    let orderTotal = 0;
    
    Object.entries(cart).forEach(([productKey, cartItem]) => {
        const product = products[productKey];
        const quantity = cartItem.quantity;
        const itemTotal = quantity * (product.price * product.estimatedWeight);
        orderTotal += itemTotal;
        
        orderHTML += `
            <div class="flex justify-between items-start p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
                <div class="flex-1">
                    <h4 class="font-medium text-white">${product.name}</h4>
                    <p class="text-sm text-zinc-400 mt-1">${product.description}</p>
                    <div class="flex gap-4 mt-2 text-xs text-zinc-500">
                        <span>Hoeveelheid: ${quantity}</span>
                        <span>Est. gewig: ~${(product.estimatedWeight * quantity).toFixed(1)}kg</span>
                        <span>~R${product.price}/kg</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-orange-400 font-semibold">R${itemTotal.toFixed(2)}</div>
                    <div class="text-xs text-zinc-500">provisional</div>
                </div>
            </div>
        `;
    });
    
    orderItemsSummaryEl.innerHTML = orderHTML;
    finalTotalEl.textContent = `R${orderTotal.toFixed(2)}`;
}

function startNewOrder() {
    // Clear cart and reset to step 1
    clearCart();
    orderData = {};
    
    // Go back to step 1
    goToStep(1);
}

/**
 * Navigate to a specific section of the customer portal
 * @function navigateToSection
 * @param {string} sectionName - Name of section to navigate to ('products', 'orders', 'account')
 * @since 1.5.0
 */
function navigateToSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.customer-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load data for specific sections
        if (sectionName === 'orders') {
            loadOrderHistory();
        }
    }
}

/**
 * Load and display customer order history with enhanced filtering and database integration
 * @async
 * @function loadOrderHistory
 * @param {string} [statusFilter='all'] - Filter orders by status
 * @returns {Promise<void>}
 * @since 1.6.0 - Enhanced with database integration and filtering
 */
async function loadOrderHistory(statusFilter = 'all') {
    const ordersList = document.getElementById('ordersList');
    const ordersLoading = document.getElementById('ordersLoading');
    const ordersEmpty = document.getElementById('ordersEmpty');
    const ordersError = document.getElementById('ordersError');
    
    try {
        // Show loading state
        ordersLoading.style.display = 'block';
        ordersList.style.display = 'none';
        ordersEmpty.style.display = 'none';
        ordersError.style.display = 'none';
        
        let customerOrders = [];
        
        // Try to load from database first if available
        if (typeof supabaseClient !== 'undefined' && supabaseClient && currentCustomer) {
            try {
                // Match historical orders by name/email if not already linked
                await supabaseClient.rpc('match_customer_orders', {
                    p_customer_id: currentCustomer.id,
                    p_customer_name: currentCustomer.name,
                    p_customer_email: currentCustomer.email
                });
                
                // Load orders from database
                let query = supabaseClient
                    .from('orders')
                    .select(`
                        *,
                        order_items (*)
                    `)
                    .eq('customer_id', currentCustomer.id)
                    .order('order_date', { ascending: false });
                
                // Apply status filter if not 'all'
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }
                
                const { data: dbOrders, error: dbError } = await query;
                
                if (dbError) throw dbError;
                
                // Convert database format to display format
                customerOrders = dbOrders.map(order => ({
                    orderNumber: order.order_id,
                    timestamp: order.order_date,
                    estimatedTotal: parseFloat(order.total_amount || 0),
                    status: order.status || 'pending',
                    source: order.source || 'imported',
                    customer: {
                        name: order.customer_name || currentCustomer.name,
                        email: order.customer_email || currentCustomer.email,
                        phone: order.customer_phone || currentCustomer.phone,
                        address: order.customer_address || currentCustomer.address
                    },
                    items: order.order_items || []
                }));
                
            } catch (dbError) {
                console.warn('Database order loading failed, falling back to localStorage:', dbError);
                // Fall back to localStorage
                const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
                customerOrders = orders.filter(order => 
                    order.customer.name === customerData.name || 
                    order.customer.email === customerData.email
                );
            }
        } else {
            // Load from localStorage
            const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
            customerOrders = orders.filter(order => 
                order.customer.name === customerData.name || 
                order.customer.email === customerData.email
            );
        }
        
        // Apply status filter to localStorage data if needed
        if (statusFilter !== 'all' && customerOrders.length > 0 && !customerOrders[0].source) {
            // This is localStorage data, apply client-side filtering
            customerOrders = customerOrders.filter(order => {
                const orderStatus = order.status || 'pending';
                return orderStatus === statusFilter;
            });
        }
        
        // Hide loading state
        ordersLoading.style.display = 'none';
        
        if (customerOrders.length === 0) {
            ordersEmpty.style.display = 'block';
            hideOrderFilters();
            return;
        }
        
        // Show filters when orders are available
        showOrderFilters();
        
        // Sort orders by date (newest first) - already sorted from DB query
        if (!customerOrders[0].source) {
            customerOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        // Generate order history HTML with enhanced status display
        let ordersHTML = '<div class="orders-grid">';
        
        customerOrders.forEach(order => {
            const orderDate = formatDate(order.timestamp);
            const orderTotal = parseFloat(order.estimatedTotal || 0).toFixed(2);
            const orderStatus = order.status || 'pending';
            const isGroupOrder = order.order_type === 'group';
            
            // Calculate item information
            let itemCount = 0;
            let productList = '';
            
            if (order.items && typeof order.items === 'object' && !Array.isArray(order.items)) {
                // localStorage format
                itemCount = Object.values(order.items).reduce((total, item) => total + item.quantity, 0);
                productList = Object.entries(order.items).map(([key, item]) => 
                    `${products[key]?.name || key} (${item.quantity})`
                ).join(', ');
            } else if (Array.isArray(order.items)) {
                // Database format
                itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
                productList = order.items.map(item => 
                    `${item.product_name} (${item.quantity})`
                ).join(', ');
            }
            
            // Status badge with color
            const statusClass = getStatusClass(orderStatus);
            const statusText = getStatusText(orderStatus);
            const groupIndicator = isGroupOrder ? '<span class="group-indicator">👥 Group Order</span>' : '';
            
            ordersHTML += `
                <div class="order-card ${isGroupOrder ? 'group-order' : ''}">
                    <div class="order-header">
                        <div class="order-info">
                            <h3>Order #${order.orderNumber} ${groupIndicator}</h3>
                            <p class="order-date">
                                <i class="fas fa-calendar"></i> ${orderDate}
                            </p>
                        </div>
                        <div class="order-total">
                            <strong>R${orderTotal}</strong>
                        </div>
                    </div>
                    
                    <div class="order-body">
                        <div class="order-items">
                            <p><strong>Items (${itemCount}):</strong></p>
                            <p class="items-list">${productList}</p>
                        </div>
                        
                        <div class="order-delivery">
                            <p><strong>Delivery:</strong> ${order.customer.address}</p>
                            <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
                        </div>
                    </div>
                    
                    <div class="order-actions">
                        <button class="btn btn-secondary btn-sm" onclick="resendOrderConfirmation('${order.orderNumber}')">
                            <i class="fas fa-envelope"></i> Resend Email
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="viewOrderDetails('${order.orderNumber}')">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        <button class="btn btn-success btn-sm" onclick="reorderFromHistory('${order.orderNumber}')">
                            <i class="fas fa-redo"></i> Reorder
                        </button>
                    </div>
                </div>
            `;
        });
        
        ordersHTML += '</div>';
        ordersList.innerHTML = ordersHTML;
        ordersList.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading order history:', error);
        ordersLoading.style.display = 'none';
        ordersError.style.display = 'block';
    }
}

/**
 * Get CSS class for order status badge
 * @function getStatusClass
 * @param {string} status - Order status
 * @returns {string} CSS class name
 * @since 1.6.0
 */
function getStatusClass(status) {
    const statusClasses = {
        'pending': 'status-pending',
        'confirmed': 'status-confirmed',
        'processing': 'status-processing',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-pending';
}

/**
 * Get display text for order status
 * @function getStatusText
 * @param {string} status - Order status
 * @returns {string} Display text
 * @since 1.6.0
 */
function getStatusText(status) {
    const statusTexts = {
        'pending': 'Pending Weights',
        'confirmed': 'Confirmed',
        'processing': 'In Process',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };
    return statusTexts[status] || 'Pending Weights';
}

/**
 * Reorder items from historical order
 * @async
 * @function reorderFromHistory
 * @param {string} orderNumber - Order number to reorder from
 * @returns {Promise<void>}
 * @since 1.6.0
 */
async function reorderFromHistory(orderNumber) {
    try {
        // Validate customer session
        if (!customerData || !customerData.name) {
            showToast('Please log in to reorder', 'error');
            return;
        }
        
        // Find the order (check both localStorage and database data)
        let targetOrder = null;
        
        if (typeof supabaseClient !== 'undefined' && supabaseClient && currentCustomer) {
            try {
                // Try to find in database first
                const { data: dbOrder, error } = await supabaseClient
                    .from('orders')
                    .select(`
                        *,
                        order_items (*)
                    `)
                    .eq('order_id', orderNumber)
                    .eq('customer_id', currentCustomer.id)
                    .single();
                    
                if (!error && dbOrder) {
                    targetOrder = {
                        orderNumber: dbOrder.order_id,
                        items: dbOrder.order_items || []
                    };
                }
            } catch (dbError) {
                console.warn('Database reorder lookup failed:', dbError);
            }
        }
        
        // Fall back to localStorage if not found in database
        if (!targetOrder) {
            const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
            const order = orders.find(o => 
                o.orderNumber === orderNumber && 
                (o.customer.name === customerData.name || o.customer.email === customerData.email)
            );
            
            if (order) {
                targetOrder = order;
            }
        }
        
        if (!targetOrder) {
            showToast('Order not found or you do not have permission to reorder it', 'error');
            return;
        }
        
        // Clear current cart
        currentCart = {};
        
        // Add items from historical order to cart
        if (Array.isArray(targetOrder.items)) {
            // Database format
            targetOrder.items.forEach(item => {
                // Find matching product by name
                const productKey = Object.keys(products).find(key => 
                    products[key].name === item.product_name
                );
                
                if (productKey) {
                    currentCart[productKey] = {
                        quantity: item.quantity,
                        customWeight: item.weight_kg || null
                    };
                }
            });
        } else if (targetOrder.items && typeof targetOrder.items === 'object') {
            // localStorage format
            Object.entries(targetOrder.items).forEach(([key, item]) => {
                if (products[key]) {
                    currentCart[key] = {
                        quantity: item.quantity,
                        customWeight: item.customWeight || null
                    };
                }
            });
        }
        
        // Update cart display
        updateCartDisplay();
        updateCartSummary();
        
        // Navigate to cart section
        navigateToSection('cart');
        
        showToast(`Items from Order #${orderNumber} added to cart. You can adjust quantities before checkout.`, 'success');
        
    } catch (error) {
        console.error('Error reordering from history:', error);
        showToast('Error reordering. Please try again.', 'error');
    }
}

/**
 * Set up real-time subscriptions for order status updates
 * @async
 * @function setupOrderStatusSubscription
 * @returns {Promise<void>}
 * @since 1.6.0
 */
async function setupOrderStatusSubscription() {
    if (!supabaseClient || !currentCustomer) {
        console.warn('Cannot set up real-time subscriptions - missing Supabase client or customer data');
        return;
    }
    
    try {
        // Subscribe to order changes for this customer
        const subscription = supabaseClient
            .channel('customer-orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `customer_id=eq.${currentCustomer.id}`
                },
                (payload) => {
                    console.info('Order status update received:', payload);
                    // Refresh order history to show updated status
                    const currentFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-status') || 'all';
                    loadOrderHistory(currentFilter);
                }
            )
            .subscribe();
            
        // Store subscription for cleanup
        window.orderStatusSubscription = subscription;
        
        console.info('Real-time order status subscription established');
        
    } catch (error) {
        console.error('Error setting up order status subscription:', error);
    }
}

/**
 * Clean up real-time subscriptions
 * @function cleanupOrderStatusSubscription
 * @since 1.6.0
 */
function cleanupOrderStatusSubscription() {
    if (window.orderStatusSubscription) {
        supabaseClient.removeChannel(window.orderStatusSubscription);
        window.orderStatusSubscription = null;
        console.info('Order status subscription cleaned up');
    }
}

/**
 * Enhanced view order details with modal display
 * @async
 * @function viewOrderDetails
 * @param {string} orderNumber - Order number to view details for
 * @returns {Promise<void>}
 * @since 1.6.0 - Enhanced with modal and database integration
 */
async function viewOrderDetails(orderNumber) {
    try {
        // Validate customer session
        if (!customerData || !customerData.name) {
            showToast('Please log in to view order details', 'error');
            return;
        }
        
        // Find the order (check both localStorage and database data)
        let targetOrder = null;
        
        if (typeof supabaseClient !== 'undefined' && supabaseClient && currentCustomer) {
            try {
                // Try to find in database first
                const { data: dbOrder, error } = await supabaseClient
                    .from('orders')
                    .select(`
                        *,
                        order_items (*)
                    `)
                    .eq('order_id', orderNumber)
                    .eq('customer_id', currentCustomer.id)
                    .single();
                    
                if (!error && dbOrder) {
                    targetOrder = {
                        orderNumber: dbOrder.order_id,
                        timestamp: dbOrder.order_date,
                        estimatedTotal: parseFloat(dbOrder.total_amount || 0),
                        status: dbOrder.status || 'pending',
                        source: dbOrder.source || 'imported',
                        customer: {
                            name: dbOrder.customer_name || currentCustomer.name,
                            email: dbOrder.customer_email || currentCustomer.email,
                            phone: dbOrder.customer_phone || currentCustomer.phone,
                            address: dbOrder.customer_address || currentCustomer.address
                        },
                        items: dbOrder.order_items || []
                    };
                }
            } catch (dbError) {
                console.warn('Database order detail lookup failed:', dbError);
            }
        }
        
        // Fall back to localStorage if not found in database
        if (!targetOrder) {
            const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
            const order = orders.find(o => 
                o.orderNumber === orderNumber && 
                (o.customer.name === customerData.name || o.customer.email === customerData.email)
            );
            
            if (order) {
                targetOrder = order;
            }
        }
        
        if (!targetOrder) {
            showToast('Order not found', 'error');
            return;
        }
        
        // Create and show order details modal
        showOrderDetailsModal(targetOrder);
        
    } catch (error) {
        console.error('Error viewing order details:', error);
        showToast('Error loading order details. Please try again.', 'error');
    }
}

/**
 * Show order details in a modal dialog
 * @function showOrderDetailsModal
 * @param {Object} order - Order data to display
 * @since 1.6.0
 */
function showOrderDetailsModal(order) {
    const orderDate = formatDate(order.timestamp);
    const orderTotal = parseFloat(order.estimatedTotal || 0).toFixed(2);
    const orderStatus = order.status || 'pending';
    const statusClass = getStatusClass(orderStatus);
    const statusText = getStatusText(orderStatus);
    const isGroupOrder = order.order_type === 'group';
    
    // Generate items list
    let itemsHTML = '';
    if (Array.isArray(order.items)) {
        // Database format
        itemsHTML = order.items.map(item => `
            <div class="order-detail-item">
                <div class="item-info">
                    <span class="item-name">${item.product_name}</span>
                    <span class="item-details">Qty: ${item.quantity} | Weight: ${item.weight_kg}kg</span>
                </div>
                <div class="item-price">R${item.line_total.toFixed(2)}</div>
            </div>
        `).join('');
    } else if (order.items && typeof order.items === 'object') {
        // localStorage format
        itemsHTML = Object.entries(order.items).map(([key, item]) => {
            const product = products[key];
            const estimatedWeight = (product.estimatedWeight * item.quantity).toFixed(1);
            const lineTotal = calculateLineItemTotal(key, item.quantity).lineTotal;
            return `
                <div class="order-detail-item">
                    <div class="item-info">
                        <span class="item-name">${product.name}</span>
                        <span class="item-details">Qty: ${item.quantity} | Est. Weight: ${estimatedWeight}kg</span>
                    </div>
                    <div class="item-price">R${lineTotal.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    }
    
    const modalHTML = `
        <div class="modal-overlay" onclick="closeOrderDetailsModal()">
            <div class="modal-content order-details-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>
                        <i class="fas fa-receipt"></i> Order #${order.orderNumber}
                        ${isGroupOrder ? '<span class="group-indicator">👥 Group Order</span>' : ''}
                    </h2>
                    <button class="modal-close" onclick="closeOrderDetailsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="order-detail-section">
                        <h3><i class="fas fa-info-circle"></i> Order Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Order Date:</label>
                                <span>${orderDate}</span>
                            </div>
                            <div class="detail-item">
                                <label>Status:</label>
                                <span class="status-badge ${statusClass}">${statusText}</span>
                            </div>
                            <div class="detail-item">
                                <label>Total Amount:</label>
                                <span class="order-total-amount">R${orderTotal}</span>
                            </div>
                            <div class="detail-item">
                                <label>Source:</label>
                                <span>${order.source || 'Customer Portal'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-box"></i> Items Ordered</h3>
                        <div class="order-items-list">
                            ${itemsHTML}
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-truck"></i> Delivery Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Delivery Address:</label>
                                <span>${order.customer.address}</span>
                            </div>
                            <div class="detail-item">
                                <label>Contact Phone:</label>
                                <span>${order.customer.phone || 'Not provided'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeOrderDetailsModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button class="btn btn-primary" onclick="resendOrderConfirmation('${order.orderNumber}')">
                        <i class="fas fa-envelope"></i> Resend Email
                    </button>
                    <button class="btn btn-success" onclick="reorderFromHistory('${order.orderNumber}'); closeOrderDetailsModal();">
                        <i class="fas fa-redo"></i> Reorder
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.classList.add('modal-open');
}

/**
 * Close order details modal
 * @function closeOrderDetailsModal
 * @since 1.6.0
 */
function closeOrderDetailsModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    document.body.classList.remove('modal-open');
}

/**
 * Filter orders by status and update display
 * @function filterOrders
 * @param {string} status - Status to filter by ('all', 'pending', 'confirmed', 'processing', 'delivered', 'cancelled')
 * @since 1.6.0
 */
function filterOrders(status) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-status') === status) {
            btn.classList.add('active');
        }
    });
    
    // Reload orders with the new filter
    loadOrderHistory(status);
}

/**
 * Show order filters when orders are available
 * @function showOrderFilters
 * @since 1.6.0
 */
function showOrderFilters() {
    const orderFilters = document.getElementById('orderFilters');
    if (orderFilters) {
        orderFilters.style.display = 'block';
    }
}

/**
 * Hide order filters when no orders available
 * @function hideOrderFilters
 * @since 1.6.0
 */
function hideOrderFilters() {
    const orderFilters = document.getElementById('orderFilters');
    if (orderFilters) {
        orderFilters.style.display = 'none';
    }
}

/**
 * Resend order confirmation email with validation
 * @async
 * @function resendOrderConfirmation
 * @param {string} orderNumber - Order number to resend email for
 * @returns {Promise<void>}
 * @since 1.5.0
 */
async function resendOrderConfirmation(orderNumber) {
    try {
        // Validate customer session first
        if (!customerData || !customerData.name) {
            showToast('Please log in to resend emails', 'error');
            return;
        }
        
        // Find the order
        const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
        const order = orders.find(o => 
            o.orderNumber === orderNumber && 
            o.customer.name === customerData.name
        );
        
        if (!order) {
            showToast('Order not found or you do not have permission to access it', 'error');
            return;
        }
        
        // Show loading state
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        button.disabled = true;
        
        // Send confirmation email
        const result = await sendCustomerOrderConfirmation(order);
        
        if (result.success) {
            showToast('Order confirmation email resent successfully!', 'success');
        } else {
            showToast(`Failed to resend email: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error resending order confirmation:', error);
        showToast('Error resending email. Please try again.', 'error');
    } finally {
        // Restore button state
        const button = event.target.closest('button');
        if (button) {
            button.innerHTML = '<i class="fas fa-envelope"></i> Resend Email';
            button.disabled = false;
        }
    }
}

/**
 * View detailed order information
 * @function viewOrderDetails
 * @param {string} orderNumber - Order number to view details for
 * @since 1.5.0
 */
function viewOrderDetails(orderNumber) {
    // Find the order
    const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
    const order = orders.find(o => 
        o.orderNumber === orderNumber && 
        o.customer.name === customerData.name
    );
    
    if (!order) {
        showToast('Order not found', 'error');
        return;
    }
    
    // Create detailed view modal or expand order card
    // For now, just log the order details and show a simple alert
    console.log('Order details:', order);
    
    const itemsList = Object.entries(order.items).map(([key, item]) => {
        const product = products[key];
        const estimatedWeight = (product.estimatedWeight * item.quantity).toFixed(1);
        const lineTotal = calculateLineItemTotal(key, item.quantity).lineTotal;
        return `• ${product.name}: ${item.quantity} stuks (±${estimatedWeight}kg) - R${lineTotal.toFixed(2)}`;
    }).join('\n');
    
    alert(`Order #${orderNumber}\n\nItems:\n${itemsList}\n\nTotal: R${order.estimatedTotal.toFixed(2)}\nDelivery: ${order.customer.address}\nDate: ${formatDate(order.timestamp)}`);
}

/* =====================================
 * GROUP ORDER EMAIL INFRASTRUCTURE
 * Placeholder functions for future implementation
 * ===================================== */

/**
 * PLACEHOLDER: Generate group order confirmation email template
 * Future functionality for handling multi-person group orders
 * @function generateGroupOrderEmailTemplate
 * @param {Object} groupOrderData - Group order information
 * @param {string} groupOrderData.coordinatorName - Person who placed group order
 * @param {string} groupOrderData.coordinatorEmail - Coordinator email address
 * @param {Array} groupOrderData.individualOrders - Array of individual orders within group
 * @param {string} groupOrderData.groupOrderNumber - Unique group order identifier
 * @param {number} groupOrderData.totalParticipants - Number of people in group order
 * @param {number} groupOrderData.totalAmount - Total value of entire group order
 * @returns {Object} Email template with subject and body
 * @since 1.5.0 (placeholder)
 * @example
 * const template = generateGroupOrderEmailTemplate({
 *   coordinatorName: 'Jean Dreyer',
 *   coordinatorEmail: 'jean@example.com',
 *   individualOrders: [...],
 *   groupOrderNumber: 'GROUP-2025-001',
 *   totalParticipants: 5,
 *   totalAmount: 1250.00
 * });
 */
function generateGroupOrderEmailTemplate(groupOrderData) {
    // TODO: Implement group order email template generation
    console.warn('Group order email functionality not yet implemented');
    
    // Planned template structure:
    const template = {
        subject: `Group Order Confirmation - ${groupOrderData.totalParticipants} People - Order #${groupOrderData.groupOrderNumber}`,
        body: `
            <h2>Group Order Confirmation</h2>
            <p>Goeie naand ${groupOrderData.coordinatorName},</p>
            
            <p>Baie dankie vir die groep bestelling vir ${groupOrderData.totalParticipants} mense. 
            Hier is die volledige besonderhede:</p>
            
            <h3>Group Order Summary:</h3>
            <!-- Individual order breakdown will be inserted here -->
            
            <h3>Total Group Order: R${groupOrderData.totalAmount.toFixed(2)}</h3>
            
            <!-- Individual invoice attachments will be mentioned here -->
            
            <p>Banking details and delivery information...</p>
        `
    };
    
    return template;
}

/**
 * PLACEHOLDER: Generate individual PDF invoices for group order participants
 * Future functionality to create separate PDF invoices for each person in group order
 * @async
 * @function generateGroupOrderPDFInvoices
 * @param {Array} individualOrders - Array of individual orders within group
 * @param {string} coordinatorName - Name of group order coordinator
 * @returns {Promise<Array>} Array of PDF attachment objects
 * @throws {Error} When PDF generation fails
 * @since 1.5.0 (placeholder)
 * @example
 * const pdfs = await generateGroupOrderPDFInvoices(individualOrders, 'Jean Dreyer');
 * // Returns: [{ filename: 'Invoice_John_Smith_GROUP-001.pdf', data: '...' }]
 */
async function generateGroupOrderPDFInvoices(individualOrders, coordinatorName) {
    // TODO: Implement PDF generation for group order individual invoices
    console.warn('Group order PDF generation not yet implemented');
    
    // Planned implementation:
    // 1. Loop through each individual order
    // 2. Generate PDF using existing admin invoice format
    // 3. Include "Ordered by: [Coordinator Name]" on each invoice
    // 4. Name files: "Invoice_[PersonName]_[GroupOrderNumber].pdf"
    // 5. Return array of PDF attachment objects
    
    // Placeholder return for future implementation
    return individualOrders.map(order => ({
        filename: `Invoice_${order.customer.name.replace(/\s+/g, '_')}_${order.groupOrderNumber}.pdf`,
        contentType: 'application/pdf',
        data: null, // PDF data will be generated here
        size: 0 // Actual size will be calculated
    }));
}

/**
 * PLACEHOLDER: Validate email attachment size limits for Google Apps Script
 * Future functionality to check if group order PDF attachments exceed email limits
 * @function validateEmailAttachmentSize
 * @param {Array} attachments - Array of PDF attachment objects
 * @param {number} maxSizeMB - Maximum total attachment size in MB (default: 25MB)
 * @returns {Object} Validation result with size information
 * @since 1.5.0 (placeholder)
 * @example
 * const validation = validateEmailAttachmentSize(pdfAttachments, 25);
 * if (validation.valid) {
 *   console.log('Attachments within size limit');
 * }
 */
function validateEmailAttachmentSize(attachments, maxSizeMB = 25) {
    // TODO: Implement attachment size validation
    console.warn('Email attachment size validation not yet implemented');
    
    // Planned implementation:
    // 1. Calculate total size of all PDF attachments
    // 2. Check against Google Apps Script/Gmail limits (25MB typical)
    // 3. Return validation result with recommendations
    
    const totalSizeBytes = attachments.reduce((total, attachment) => total + (attachment.size || 0), 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    return {
        valid: totalSizeBytes <= maxSizeBytes,
        totalSizeMB: totalSizeMB.toFixed(2),
        maxSizeMB: maxSizeMB,
        attachmentCount: attachments.length,
        recommendations: totalSizeBytes > maxSizeBytes ? 
            ['Consider reducing PDF quality', 'Split into multiple emails', 'Use cloud storage links'] : []
    };
}

/**
 * PLACEHOLDER: Send group order confirmation email with individual PDF attachments
 * Future functionality for comprehensive group order email processing
 * @async
 * @function sendGroupOrderConfirmation
 * @param {Object} groupOrderData - Complete group order data
 * @returns {Promise<Object>} Email delivery result
 * @since 1.5.0 (placeholder)
 */
async function sendGroupOrderConfirmation(groupOrderData) {
    // TODO: Implement complete group order email workflow
    console.warn('Group order confirmation email not yet implemented');
    
    try {
        // Planned workflow:
        // 1. Generate group order email template
        // 2. Create individual PDF invoices for each participant
        // 3. Validate total attachment size
        // 4. Send email with all attachments to coordinator
        // 5. Log delivery status and handle failures
        
        const template = generateGroupOrderEmailTemplate(groupOrderData);
        const pdfAttachments = await generateGroupOrderPDFInvoices(
            groupOrderData.individualOrders, 
            groupOrderData.coordinatorName
        );
        const sizeValidation = validateEmailAttachmentSize(pdfAttachments);
        
        if (!sizeValidation.valid) {
            throw new Error(`Email attachments too large: ${sizeValidation.totalSizeMB}MB (max: ${sizeValidation.maxSizeMB}MB)`);
        }
        
        // const emailSent = await sendEmailViaGoogleScript(
        //     groupOrderData.coordinatorEmail,
        //     template.subject,
        //     template.body,
        //     pdfAttachments
        // );
        
        return { 
            success: false, 
            error: 'Group order functionality not yet implemented',
            plannedFeatures: {
                groupOrderEmail: 'Ready for implementation',
                pdfGeneration: 'Requires PDF library integration',
                attachmentHandling: 'Size validation implemented'
            }
        };
        
    } catch (error) {
        console.error('Group order confirmation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * GROUP ORDER EMAIL WORKFLOW DOCUMENTATION
 * ========================================
 * 
 * WORKFLOW OVERVIEW:
 * 1. Customer places group order for multiple people
 * 2. System creates individual orders for each participant
 * 3. Coordinator receives single confirmation email with:
 *    - Group order summary breakdown
 *    - Individual PDF invoice attachments for each person
 *    - Total group order value
 *    - Standard banking and delivery information
 * 
 * EMAIL STRUCTURE:
 * - Subject: "Group Order Confirmation - X People - Order #GROUP-XXX"
 * - Body: Afrikaans template with group order breakdown by person
 * - Attachments: Individual PDF invoices named "Invoice_[PersonName]_[OrderNumber].pdf"
 * 
 * TECHNICAL REQUIREMENTS:
 * - PDF generation using existing admin invoice format
 * - Email attachment size validation (max 25MB total)
 * - Individual invoice format with "Ordered by: [Coordinator]" notation
 * - Integration with existing Google Apps Script email service
 * - Error handling for attachment size limits
 * - Fallback strategies for oversized attachments
 * 
 * INTEGRATION POINTS:
 * - Existing order placement workflow
 * - Admin dashboard invoice generation system  
 * - Google Apps Script email service
 * - Customer portal order history display
 * - Email queue management and retry systems
 */

// Update review when going to step 3
document.addEventListener('DOMContentLoaded', function() {
    // Override the goToStep function to populate review
    const originalGoToStep = goToStep;
    goToStep = function(stepNumber) {
        if (stepNumber === 3) {
            populateOrderReview();
        }
        originalGoToStep(stepNumber);
    };
});