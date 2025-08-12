/**
 * Shared Utility Functions
 * Common functions used by both admin and customer portals
 */

// Google Apps Script Email Configuration
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec';

/**
 * Send email via Google Apps Script service
 * @async
 * @function sendEmailViaGoogleScript
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} body - Email body content (HTML supported)
 * @param {Array} attachments - Optional email attachments (default: empty)
 * @returns {Promise<boolean>} True if email sent successfully, false otherwise
 * @throws {Error} When email service is unavailable or network error occurs
 * @since 1.5.0
 * @example
 * const success = await sendEmailViaGoogleScript('test@example.com', 'Subject', 'Body');
 * if (success) {
 *   console.log('Email sent successfully');
 * }
 */
async function sendEmailViaGoogleScript(to, subject, body, attachments = []) {
    if (!GOOGLE_SCRIPT_URL) {
        console.error('Google Apps Script URL not configured');
        return false;
    }

    try {
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
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log('Email sent successfully via Google Apps Script to:', to);
            return true;
        } else {
            console.error('Email failed:', result.message);
            return false;
        }
    } catch (error) {
        console.error('Error sending email via Google Apps Script:', error);
        return false;
    }
}

/**
 * Get customer-safe pricing data (selling prices only, no cost information)
 * @function getCustomerPricing
 * @returns {Object} Customer-safe pricing object with selling prices only
 */
function getCustomerPricing() {
    // Default pricing data (synchronized with admin system)
    const adminPricing = {
        'HEEL HOENDER': { cost: 59.00, selling: 67.00, packaging: '' },
        'PLAT HOENDER (FLATTY\'S)': { cost: 69.00, selling: 79.00, packaging: 'VACUUM VERPAK' },
        'BRAAIPAKKE': { cost: 65.00, selling: 74.00, packaging: '1 Heel hoender opgesnye VACUUM VERPAK' },
        'HEEL HALWE HOENDERS': { cost: 60.00, selling: 68.00, packaging: '1 Heel hoender deurgesny' },
        'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)': { cost: 64.00, selling: 73.00, packaging: '2 borsstukke in pak' },
        'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)': { cost: 64.00, selling: 73.00, packaging: '4 borsstukke in pak' },
        'VLERKIES': { cost: 79.00, selling: 90.00, packaging: '8 IN PAK NIE ALTYD BESKIKBAAR' },
        'BOUDE EN DYE': { cost: 71.00, selling: 81.00, packaging: '2 boude en 2 dye in pak' },
        'GUNS Boud en dy aanmekaar': { cost: 71.00, selling: 81.00, packaging: '3 IN PAK' },
        'LEWER': { cost: 27.00, selling: 31.00, packaging: 'In 500g bakkies verpak' },
        'NEKKIES': { cost: 25.00, selling: 30.00, packaging: 'In 500g sakkies verpak NIE ALTYD BESKIKBAAR' },
        'FILETTE (sonder vel)': { cost: 86.50, selling: 100.00, packaging: '4 fillets per pak' },
        'STRIPS': { cost: 86.50, selling: 100.00, packaging: '± 500g per pak' },
        'ONTBEENDE HOENDER': { cost: 110.00, selling: 125.00, packaging: 'VACUUM VERPAK' },
        'GEVULDE HOENDER ROLLE VAKUUM VERPAK': { cost: 166.00, selling: 193.00, packaging: 'Opsie 1: Vye, feta, cheddar, sweet chilly.', unit: 'per kg' },
        'GEVULDE HOENDER ROLLE OPSIE 2': { cost: 166.00, selling: 193.00, packaging: 'Opsie 2: Peppadew, mozzarella, cheddar, pynappel.', unit: 'per kg' },
        'INGELEGDE GROEN VYE': { cost: 55, selling: 75, packaging: '375ml potjie', unit: 'per potjie' },
        'HOENDER PATTIES': { cost: 105.00, selling: 120.00, packaging: '4 in pak (120-140g patty)', unit: 'per kg' },
        'HOENDER KAASWORS': { cost: 140.00, selling: 148.00, packaging: '500gr VACUUM VERPAK', unit: 'per kg' },
        'SUIWER HEUNING': { cost: 60, selling: 70, packaging: '500g potjie', unit: 'per potjie' }
    };

    // Create customer-safe version with only selling prices and packaging info
    const customerPricing = {};
    Object.keys(adminPricing).forEach(productName => {
        const product = adminPricing[productName];
        // Defensive check to prevent runtime errors if admin pricing structure changes
        if (product && typeof product.selling === 'number') {
            customerPricing[productName] = {
                selling: product.selling,
                packaging: product.packaging || '',
                unit: product.unit || 'per kg'
            };
        } else {
            console.warn(`Invalid pricing data for product: ${productName}`);
        }
    });

    return customerPricing;
}

/**
 * Get product display information for customer interface
 * @function getProductDisplayInfo
 * @param {string} productName - Product name from pricing system
 * @returns {Object} Display information with displayName and description
 */
function getProductDisplayInfo(productName) {
    const displayMap = {
        'HEEL HOENDER': {
            displayName: 'Heel Hoender',
            description: 'Heel vars hoender, perfek vir gesinne'
        },
        'PLAT HOENDER (FLATTY\'S)': {
            displayName: 'Plat Hoender (Flatty\'s)',
            description: 'Plat hoenders, perfek vir braai'
        },
        'BRAAIPAKKE': {
            displayName: 'Braaipakke',
            description: 'Heel hoender opgesnye in braai stukke'
        },
        'HEEL HALWE HOENDERS': {
            displayName: 'Heel Halwe Hoenders', 
            description: 'Heel hoender deurgesny in helftes'
        },
        'BORSSTUKKE MET BEEN EN VEL': {
            displayName: 'Borsstukke met Been en Vel',
            description: 'Sappige borsstukke met been en vel'
        },
        'VLERKIES': {
            displayName: 'Vlerkies',
            description: 'Hoender vlerkies, perfek vir braai'
        },
        'BOUDE EN DYE': {
            displayName: 'Boude en Dye',
            description: 'Boude en dye porties'
        },
        'GUNS Boud en dy aanmekaar': {
            displayName: 'Boude en Dye Aanmekaar (Guns)',
            description: 'Boude en dye nog aanmekaar, maklik om te braai'
        },
        'FILETTE (sonder vel)': {
            displayName: 'Filette (sonder vel)',
            description: 'Premium filette sonder vel'
        },
        'ONTBEENDE HOENDER': {
            displayName: 'Ontbeende Hoender',
            description: 'Heel hoender sonder bene, maklik om te sny'
        },
        'SOSATIE': {
            displayName: 'Sosatie',
            description: 'Gemarineerde hoender sosaties'
        },
        'CRUMBED STRIPS': {
            displayName: 'Crumbed Hoender Strips',
            description: 'Gemarineerde en gebreide strips'
        },
        'DRUMSTICKSSS': {
            displayName: 'Drumsticks',
            description: 'Hoender drumsticks'
        },
        'DIE BOUDE ALLEEN': {
            displayName: 'Die Boude Alleen',
            description: 'Hoender boude porties'
        },
        'DIE DYE ALLEEN': {
            displayName: 'Die Dye Alleen', 
            description: 'Hoender dye porties'
        },
        'TITTES (borsstukke sonder been en vel)': {
            displayName: 'Tittes (borsstukke sonder been en vel)',
            description: 'Borsstukke sonder been en vel'
        },
        'GEVULDE HOENDER ROLLE OPSIE 2': {
            displayName: 'Gevulde Hoender Rolle Opsie 2',
            description: 'Spesiaal gevulde hoender rolle'
        },
        'SUIWER HEUNING': {
            displayName: 'Suiwer Heuning',
            description: 'Vars plaas heuning'
        },
        'EIERS': {
            displayName: 'Eiers',
            description: 'Vars plaas eiers'
        }
    };
    
    return displayMap[productName] || {
        displayName: productName,
        description: 'Vars hoender produk van die plaas'
    };
}

/**
 * Get estimated weight for product portions
 * @function getEstimatedWeight
 * @param {string} productName - Product name
 * @returns {string} Estimated weight with unit
 */
function getEstimatedWeight(productName) {
    const weightMap = {
        'HEEL HOENDER': '2.5kg',
        'PLAT HOENDER (FLATTY\'S)': '1.8kg', 
        'BRAAIPAKKE': '2.2kg',
        'HEEL HALWE HOENDERS': '1.2kg',
        'BORSSTUKKE MET BEEN EN VEL': '0.8kg',
        'VLERKIES': '0.4kg',
        'BOUDE EN DYE': '0.6kg',
        'GUNS Boud en dy aanmekaar': '0.7kg',
        'FILETTE (sonder vel)': '0.5kg',
        'ONTBEENDE HOENDER': '1.8kg',
        'SOSATIE': '0.6kg',
        'CRUMBED STRIPS': '0.3kg',
        'DRUMSTICKSSS': '0.5kg',
        'DIE BOUDE ALLEEN': '0.4kg',
        'DIE DYE ALLEEN': '0.3kg',
        'TITTES (borsstukke sonder been en vel)': '0.6kg',
        'GEVULDE HOENDER ROLLE OPSIE 2': '0.5kg',
        'SUIWER HEUNING': '1.0kg',
        'EIERS': '0.6kg'
    };
    
    return weightMap[productName] || '1.0kg';
}

/**
 * Get product categories mapping for customer display
 * @function getProductCategories
 * @returns {Object} Product categories with associated products
 */
function getProductCategories() {
    return {
        'whole': {
            name: 'Heel Hoenders',
            description: 'Heel hoenders perfek vir gesinne',
            icon: 'fas fa-drumstick-bite',
            products: [
                'HEEL HOENDER',
                'PLAT HOENDER (FLATTY\'S)',
                'ONTBEENDE HOENDER'
            ]
        },
        'cuts': {
            name: 'Hoender Snitte',
            description: 'Hoender dele en spesialiteit snitte',
            icon: 'fas fa-cut',
            products: [
                'HEEL HALWE HOENDERS', 
                'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)',
                'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)',
                'BOUDE EN DYE',
                'GUNS Boud en dy aanmekaar',
                'VLERKIES',
                'FILETTE (sonder vel)',
                'STRIPS'
            ]
        },
        'specialty': {
            name: 'Spesialiteit Items',
            description: 'Braai pakkette en voorbereide items',
            icon: 'fas fa-star',
            products: [
                'BRAAIPAKKE',
                'GEVULDE HOENDER ROLLE VAKUUM VERPAK',
                'GEVULDE HOENDER ROLLE OPSIE 2',
                'HOENDER PATTIES',
                'HOENDER KAASWORS'
            ]
        },
        'other': {
            name: 'Ander Produkte', 
            description: 'Newe produkte en byvoegings',
            icon: 'fas fa-plus-circle',
            products: [
                'LEWER',
                'NEKKIES', 
                'INGELEGDE GROEN VYE',
                'SUIWER HEUNING'
            ]
        }
    };
}

/**
 * Map product names to customer-friendly display names and descriptions
 * @function getProductDisplayInfo
 * @param {string} productName - Internal product name
 * @returns {Object} Display information for product
 */
function getProductDisplayInfo(productName) {
    const displayMap = {
        'HEEL HOENDER': {
            displayName: 'Heel Hoender',
            description: 'Hele vars hoender, perfek vir gesinne'
        },
        'PLAT HOENDER (FLATTY\'S)': {
            displayName: 'Plat Hoender (Flatty\'s)',
            description: 'Plat hoenders, ideaal vir die braai'
        },
        'BRAAIPAKKE': {
            displayName: 'Braai Pakke',
            description: 'Hele hoender opgesnye, gereed vir die braai'
        },
        'HEEL HALWE HOENDERS': {
            displayName: 'Hele Halwe Hoenders',
            description: 'Hele hoender deurgesny, perfek vir kleiner gesinne'
        },
        'BORSSTUKKE MET BEEN EN VEL': {
            displayName: 'Borsstukke met Been en Vel',
            description: 'Sappige borsstukke, perfek vir braai of bak'
        },
        'VLERKIES': {
            displayName: 'Vlerkies',
            description: 'Hoender vlerkies, gewild by kinders'
        },
        'BOUDE EN DYE': {
            displayName: 'Boude en Dye',
            description: 'Dons en sappige hoender boude en dye'
        },
        'GUNS Boud en dy aanmekaar': {
            displayName: 'Boude en Dye Aanmekaar',
            description: 'Boude en dye nog aanmekaar, maklik om te braai'
        },
        'LEWER': {
            displayName: 'Hoender Lewer',
            description: 'Vars hoender lewer, ryk aan yster'
        },
        'NEKKIES': {
            displayName: 'Hoender Nekkies',
            description: 'Hoender nekkies, perfek vir sop of honde kos'
        },
        'FILETTE (sonder vel)': {
            displayName: 'Filette (sonder vel)',
            description: 'Skoon hoender filette, sonder vel'
        },
        'STRIPS': {
            displayName: 'Hoender Strips',
            description: 'Hoender strips, perfek vir roerbraai'
        },
        'ONTBEENDE HOENDER': {
            displayName: 'Ontbeende Hoender',
            description: 'Hele hoender sonder bene, maklik om te snye'
        },
        'GEVULDE HOENDER ROLLE VAKUUM VERPAK': {
            displayName: 'Gevulde Hoender Rolle Opsie 1',
            description: 'Vye, feta, cheddar, sweet chilly'
        },
        'INGELEGDE GROEN VYE': {
            displayName: 'Ingelegde Groen Vye',
            description: 'Huis-ingelegde groen vye, perfekte bysmaak'
        },
        'HOENDER PATTIES': {
            displayName: 'Hoender Patties',
            description: 'Vars hoender patties, maklik om te braai'
        },
        'HOENDER KAASWORS': {
            displayName: 'Hoender Kaaswors',
            description: 'Hoender wors met kaas, 500g verpak'
        },
        'SUIWER HEUNING': {
            displayName: 'Suiwer Heuning',
            description: 'Plaas vars heuning, 500g potjie'
        }
    };

    return displayMap[productName] || {
        displayName: productName,
        description: 'Vars plaas produk'
    };
}

/**
 * Format currency value to South African Rand
 * @function formatCurrency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 * @example formatCurrency(123.45) // "R123.45"
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return 'R0.00';
    }
    return `R${amount.toFixed(2)}`;
}

/**
 * Format South African phone number
 * @function formatPhoneNumber
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 * @example formatPhoneNumber('0791234567') // "079 123 4567"
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format as South African number
    if (digits.length === 10 && digits.startsWith('0')) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('27')) {
        return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    
    return phone; // Return original if can't format
}

/**
 * Validate South African phone number
 * @function validatePhoneNumber
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid South African phone number
 */
function validatePhoneNumber(phone) {
    if (!phone) return true; // Optional field
    
    const phoneRegex = /^(\+27|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validate email address format
 * @function validateEmail
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
    if (!email) return false;
    
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    return emailRegex.test(email);
}

/**
 * Generate unique order ID
 * @function generateOrderId
 * @param {string} prefix - Prefix for order ID (default: 'ORD')
 * @returns {string} Unique order ID
 * @example generateOrderId('CUST') // "CUST-2025-01-08-1641234567890"
 */
function generateOrderId(prefix = 'ORD') {
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0];
    return `${prefix}-${date}-${timestamp}`;
}

/**
 * Format date for display
 * @function formatDate
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
function formatDate(date, options = {}) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Africa/Johannesburg'
    };
    
    return dateObj.toLocaleDateString('en-ZA', { ...defaultOptions, ...options });
}

/**
 * Format date and time for display
 * @function formatDateTime
 * @param {string|Date} datetime - DateTime to format
 * @returns {string} Formatted datetime string
 */
function formatDateTime(datetime) {
    return formatDate(datetime, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Debounce function to limit function calls
 * @function debounce
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Show toast notification
 * @function showToast
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add toast styles if not already present
    if (!document.getElementById('toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                min-width: 300px;
                animation: slideIn 0.3s ease-out;
            }
            .toast-success { border-left: 4px solid #28a745; }
            .toast-error { border-left: 4px solid #dc3545; }
            .toast-warning { border-left: 4px solid #ffc107; }
            .toast-info { border-left: 4px solid #17a2b8; }
            .toast-content { display: flex; align-items: center; gap: 8px; flex: 1; }
            .toast-close { background: none; border: none; cursor: pointer; color: #6c757d; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    // Add toast to page
    document.body.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

/**
 * Get appropriate icon for toast type
 * @function getToastIcon
 * @param {string} type - Toast type
 * @returns {string} FontAwesome icon class
 */
function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

/**
 * Sanitize string for HTML output (basic XSS prevention)
 * @function sanitizeHtml
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Calculate order total from line items
 * @function calculateOrderTotal
 * @param {Array} items - Array of order items
 * @returns {number} Total amount
 */
function calculateOrderTotal(items) {
    if (!Array.isArray(items)) return 0;
    
    return items.reduce((total, item) => {
        const lineTotal = parseFloat(item.line_total) || 0;
        return total + lineTotal;
    }, 0);
}

/**
 * Group array of objects by a key
 * @function groupBy
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(item);
        return groups;
    }, {});
}

/**
 * Check if user agent is mobile device
 * @function isMobileDevice
 * @returns {boolean} True if mobile device
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Export functions for Node.js environments (if applicable)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatCurrency,
        formatPhoneNumber,
        validatePhoneNumber,
        validateEmail,
        generateOrderId,
        formatDate,
        formatDateTime,
        debounce,
        showToast,
        sanitizeHtml,
        calculateOrderTotal,
        groupBy,
        isMobileDevice
    };
}