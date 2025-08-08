// Customer Portal JavaScript
// Plaas Hoenders Customer Ordering System

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
            // Add order to email queue for confirmation
            await addOrderToEmailQueue(orderData);
            
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
 * Add order confirmation to email queue system
 * @async
 * @function addOrderToEmailQueue
 * @param {Object} orderData - Order data to add to email queue
 */
async function addOrderToEmailQueue(orderData) {
    try {
        // Skip if customer has no email
        if (!orderData.customer.email || orderData.customer.email.includes('@placeholder.com')) {
            console.log('No valid email for customer, skipping email queue');
            return;
        }
        
        // Create email queue entry compatible with admin system
        const emailQueueItem = {
            id: `email-${orderData.orderNumber}-${Date.now()}`,
            type: 'order_confirmation',
            customer_name: orderData.customer.name,
            customer_email: orderData.customer.email,
            order_number: orderData.orderNumber,
            order_total: formatCurrency ? formatCurrency(orderData.estimatedTotal) : `R${orderData.estimatedTotal.toFixed(2)}`,
            estimated_delivery: 'Saterdag oggend', // Standard delivery time
            created_at: new Date().toISOString(),
            status: 'pending',
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
        
        // Add to admin system email queue
        const existingQueue = JSON.parse(localStorage.getItem('plaasHoendersEmailQueue') || '[]');
        existingQueue.push(emailQueueItem);
        localStorage.setItem('plaasHoendersEmailQueue', JSON.stringify(existingQueue));
        
        console.log('Added order confirmation to email queue:', emailQueueItem);
        
    } catch (error) {
        console.error('Error adding order to email queue:', error);
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
    try {
        // Save to localStorage for backup
        const orders = JSON.parse(localStorage.getItem('plaasHoendersCustomerOrders') || '[]');
        orders.push(order);
        localStorage.setItem('plaasHoendersCustomerOrders', JSON.stringify(orders));
        
        // Convert to admin system format for database storage
        const adminOrder = {
            id: order.orderNumber,
            customer_name: order.customer.name,
            customer_phone: order.customer.phone,
            customer_email: order.customer.email || '',
            customer_address: order.customer.address,
            delivery_instructions: order.customer.deliveryInstructions || '',
            timestamp: order.timestamp,
            status: 'provisional',
            source: 'customer_portal',
            estimated_total: order.estimatedTotal,
            total_estimated_weight: calculateEstimatedTotal().totalWeight
        };
        
        // Create order items array
        const orderItems = Object.entries(order.items).map(([productKey, cartItem]) => ({
            order_id: order.orderNumber,
            product_name: products[productKey].name,
            quantity: cartItem.quantity,
            description: products[productKey].description,
            estimated_price_per_kg: products[productKey].price,
            estimated_weight: products[productKey].estimatedWeight * cartItem.quantity,
            line_total: calculateLineItemTotal(productKey, cartItem.quantity).lineTotal,
            status: 'pending_weights' // Waiting for plaas slaghuis weights
        }));
        
        // Save to admin orders format for dashboard compatibility
        const adminOrders = JSON.parse(localStorage.getItem('plaasHoendersOrders') || '[]');
        adminOrders.push(adminOrder);
        localStorage.setItem('plaasHoendersOrders', JSON.stringify(adminOrders));
        
        // TODO: Save to Supabase database when available
        // This would integrate with the existing database structure
        console.log('Order saved successfully:', {
            order: adminOrder,
            items: orderItems
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