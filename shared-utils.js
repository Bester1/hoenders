/**
 * Shared Utility Functions
 * Common functions used by both admin and customer portals
 */

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