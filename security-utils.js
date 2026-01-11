/**
 * Security and Input Validation Utilities
 * Provides comprehensive input sanitization and validation
 * Prevents XSS, SQL injection, and other security vulnerabilities
 */

(function() {
    'use strict';

    const SecurityUtils = {
        // Validation patterns
        PATTERNS: {
            EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            PHONE_SA: /^(\+27|0)[0-9]{9}$/,
            NAME: /^[a-zA-Z\s\-']+$/,
            ADDRESS: /^[a-zA-Z0-9\s\-',.#]+$/,
            PRODUCT_NAME: /^[a-zA-Z0-9\s\-()]+$/,
            ORDER_ID: /^ORD-[0-9]{13}-[a-zA-Z0-9]{4}$/,
            PRICE: /^\d+(\.\d{1,2})?$/,
            QUANTITY: /^\d+$/,
            EMAIL_TEMPLATE: /^[a-zA-Z0-9\s\-_{}(),.]+$/
        },

        // Maximum lengths for validation
        MAX_LENGTHS: {
            EMAIL: 254,
            NAME: 100,
            PHONE: 20,
            ADDRESS: 500,
            PRODUCT_NAME: 200,
            ORDER_ID: 50,
            EMAIL_SUBJECT: 200,
            EMAIL_BODY: 10000
        },

        /**
         * Sanitize HTML content to prevent XSS attacks
         */
        sanitizeHtml: function(input, options) {
            options = options || {};
            
            const defaultOptions = {
                allowTags: [],
                escapeQuotes: true,
                stripScripts: true,
                maxLength: 10000
            };
            
            const opts = Object.assign({}, defaultOptions, options);
            
            if (typeof input !== 'string') return String(input);
            
            // Truncate if too long
            if (input.length > opts.maxLength) {
                input = input.substring(0, opts.maxLength) + '...';
            }
            
            // Create a temporary element to safely escape HTML
            const temp = document.createElement('div');
            temp.textContent = input;
            let sanitized = temp.innerHTML;
            
            // Additional escaping for quotes if needed
            if (opts.escapeQuotes) {
                sanitized = sanitized
                    .replace(/"/g, '"')
                    .replace(/'/g, '&#x27;');
            }
            
            // Remove any remaining script tags
            if (opts.stripScripts) {
                sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            }
            
            return sanitized;
        },

        /**
         * Sanitize input for database operations (prevent SQL injection)
         */
        sanitizeForDatabase: function(input, options) {
            options = options || {};
            
            const defaultOptions = {
                maxLength: 1000,
                escapeWildcards: true,
                trimWhitespace: true
            };
            
            const opts = Object.assign({}, defaultOptions, options);
            
            if (typeof input !== 'string') return input;
            
            // Trim whitespace if requested
            if (opts.trimWhitespace) {
                input = input.trim();
            }
            
            // Truncate if too long
            if (input.length > opts.maxLength) {
                input = input.substring(0, opts.maxLength);
            }
            
            // Escape SQL special characters
            let sanitized = input
                .replace(/'/g, "''")      // Escape single quotes
                .replace(/"/g, '\\"')     // Escape double quotes
                .replace(/\\/g, '\\\\')   // Escape backslashes
                .replace(/\0/g, '\\0');   // Escape null bytes
            
            // Escape wildcards if requested
            if (opts.escapeWildcards) {
                sanitized = sanitized
                    .replace(/%/g, '\\%')
                    .replace(/_/g, '\\_');
            }
            
            return sanitized;
        },

        /**
         * Validate and sanitize email addresses
         */
        validateAndSanitizeEmail: function(email) {
            if (typeof email !== 'string') {
                return { valid: false, error: 'Email must be a string' };
            }
            
            const trimmed = email.trim().toLowerCase();
            
            if (trimmed.length > SecurityUtils.MAX_LENGTHS.EMAIL) {
                return { valid: false, error: 'Email too long' };
            }
            
            if (!SecurityUtils.PATTERNS.EMAIL.test(trimmed)) {
                return { valid: false, error: 'Invalid email format' };
            }
            
            // Additional security checks
            if (trimmed.includes('..') || trimmed.includes(' ')) {
                return { valid: false, error: 'Email contains invalid characters' };
            }
            
            return { valid: true, sanitized: trimmed };
        },

        /**
         * Validate and sanitize phone numbers (South African format)
         */
        validateAndSanitizePhone: function(phone) {
            if (!phone) return { valid: true, sanitized: null }; // Optional field
            
            if (typeof phone !== 'string') {
                return { valid: false, error: 'Phone must be a string' };
            }
            
            const cleaned = phone.replace(/\D/g, '');
            
            if (cleaned.length === 0) {
                return { valid: true, sanitized: null };
            }
            
            if (!SecurityUtils.PATTERNS.PHONE_SA.test(cleaned)) {
                return { valid: false, error: 'Invalid South African phone number format' };
            }
            
            // Format as +27 XX XXX XXXX
            const formatted = cleaned.startsWith('0') 
                ? '+27' + cleaned.substring(1)
                : cleaned;
            
            return { valid: true, sanitized: formatted };
        },

        /**
         * Validate and sanitize names
         */
        validateAndSanitizeName: function(name, options) {
            options = options || {};
            
            const defaultOptions = {
                minLength: 2,
                maxLength: SecurityUtils.MAX_LENGTHS.NAME,
                allowNumbers: false
            };
            
            const opts = Object.assign({}, defaultOptions, options);
            
            if (typeof name !== 'string') {
                return { valid: false, error: 'Name must be a string' };
            }
            
            const trimmed = name.trim();
            
            if (trimmed.length < opts.minLength) {
                return { valid: false, error: 'Name must be at least ' + opts.minLength + ' characters' };
            }
            
            if (trimmed.length > opts.maxLength) {
                return { valid: false, error: 'Name must be no more than ' + opts.maxLength + ' characters' };
            }
            
            if (!opts.allowNumbers && !SecurityUtils.PATTERNS.NAME.test(trimmed)) {
                return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
            }
            
            // Check for suspicious patterns
            if (trimmed.includes('<') || trimmed.includes('>') || trimmed.includes('&')) {
                return { valid: false, error: 'Name contains invalid characters' };
            }
            
            return { valid: true, sanitized: trimmed };
        },

        /**
         * Validate and sanitize addresses
         */
        validateAndSanitizeAddress: function(address) {
            if (!address) return { valid: true, sanitized: null }; // Optional field
            
            if (typeof address !== 'string') {
                return { valid: false, error: 'Address must be a string' };
            }
            
            const trimmed = address.trim();
            
            if (trimmed.length > SecurityUtils.MAX_LENGTHS.ADDRESS) {
                return { valid: false, error: 'Address too long' };
            }
            
            if (!SecurityUtils.PATTERNS.ADDRESS.test(trimmed)) {
                return { valid: false, error: 'Address contains invalid characters' };
            }
            
            // Additional security checks
            if (trimmed.includes('<script') || trimmed.includes('javascript:')) {
                return { valid: false, error: 'Address contains potentially dangerous content' };
            }
            
            return { valid: true, sanitized: trimmed };
        },

        /**
         * Validate and sanitize product quantities
         */
        validateAndSanitizeQuantity: function(quantity) {
            if (typeof quantity === 'string') {
                quantity = quantity.trim();
            }
            
            const num = parseInt(quantity, 10);
            
            if (isNaN(num)) {
                return { valid: false, error: 'Quantity must be a valid number' };
            }
            
            if (num < 0) {
                return { valid: false, error: 'Quantity cannot be negative' };
            }
            
            if (num > 1000) { // Reasonable maximum
                return { valid: false, error: 'Quantity too large (max 1000)' };
            }
            
            return { valid: true, sanitized: num };
        },

        /**
         * Validate and sanitize prices
         */
        validateAndSanitizePrice: function(price) {
            if (typeof price === 'string') {
                price = price.trim();
            }
            
            const num = parseFloat(price);
            
            if (isNaN(num)) {
                return { valid: false, error: 'Price must be a valid number' };
            }
            
            if (num < 0) {
                return { valid: false, error: 'Price cannot be negative' };
            }
            
            if (num > 10000) { // Reasonable maximum
                return { valid: false, error: 'Price too large (max R10,000)' };
            }
            
            // Round to 2 decimal places
            const sanitized = Math.round(num * 100) / 100;
            
            return { valid: true, sanitized: sanitized };
        },

        /**
         * Comprehensive form validation
         */
        validateForm: function(formData, validationRules) {
            const errors = {};
            const sanitized = {};
            
            for (const field in validationRules) {
                const rules = validationRules[field];
                const value = formData[field];
                const fieldErrors = [];
                let fieldSanitized = value;
                
                // Required check
                if (rules.required && (!value || value.toString().trim() === '')) {
                    fieldErrors.push(field + ' is required');
                    continue;
                }
                
                // Skip if not required and empty
                if (!rules.required && (!value || value.toString().trim() === '')) {
                    sanitized[field] = null;
                    continue;
                }
                
                // Type-specific validation
                switch (rules.type) {
                    case 'email':
                        const emailResult = SecurityUtils.validateAndSanitizeEmail(value);
                        if (!emailResult.valid) {
                            fieldErrors.push(emailResult.error);
                        } else {
                            fieldSanitized = emailResult.sanitized;
                        }
                        break;
                        
                    case 'phone':
                        const phoneResult = SecurityUtils.validateAndSanitizePhone(value);
                        if (!phoneResult.valid) {
                            fieldErrors.push(phoneResult.error);
                        } else {
                            fieldSanitized = phoneResult.sanitized;
                        }
                        break;
                        
                    case 'name':
                        const nameResult = SecurityUtils.validateAndSanitizeName(value, rules);
                        if (!nameResult.valid) {
                            fieldErrors.push(nameResult.error);
                        } else {
                            fieldSanitized = nameResult.sanitized;
                        }
                        break;
                        
                    case 'address':
                        const addressResult = SecurityUtils.validateAndSanitizeAddress(value);
                        if (!addressResult.valid) {
                            fieldErrors.push(addressResult.error);
                        } else {
                            fieldSanitized = addressResult.sanitized;
                        }
                        break;
                        
                    case 'quantity':
                        const qtyResult = SecurityUtils.validateAndSanitizeQuantity(value);
                        if (!qtyResult.valid) {
                            fieldErrors.push(qtyResult.error);
                        } else {
                            fieldSanitized = qtyResult.sanitized;
                        }
                        break;
                        
                    case 'price':
                        const priceResult = SecurityUtils.validateAndSanitizePrice(value);
                        if (!priceResult.valid) {
                            fieldErrors.push(priceResult.error);
                        } else {
                            fieldSanitized = priceResult.sanitized;
                        }
                        break;
                        
                    default:
                        // Generic string validation
                        if (rules.maxLength && value.length > rules.maxLength) {
                            fieldErrors.push(field + ' must be no more than ' + rules.maxLength + ' characters');
                        }
                        
                        if (rules.pattern && !rules.pattern.test(value)) {
                            fieldErrors.push(field + ' has invalid format');
                        }
                        
                        fieldSanitized = SecurityUtils.sanitizeForDatabase(value);
                }
                
                if (fieldErrors.length > 0) {
                    errors[field] = fieldErrors;
                } else {
                    sanitized[field] = fieldSanitized;
                }
            }
            
            return {
                valid: Object.keys(errors).length === 0,
                errors: errors,
                sanitized: sanitized
            };
        },

        /**
         * Rate limiting for form submissions
         */
        createRateLimiter: function(maxRequests, timeWindow) {
            maxRequests = maxRequests || 5;
            timeWindow = timeWindow || 60000; // 1 minute default
            
            let requests = [];
            
            return {
                check: function() {
                    const now = Date.now();
                    requests = requests.filter(function(time) {
                        return now - time < timeWindow;
                    });
                    
                    if (requests.length >= maxRequests) {
                        const oldestRequest = Math.max.apply(null, requests);
                        return {
                            allowed: false,
                            remainingTime: oldestRequest + timeWindow - now,
                            message: 'Rate limit exceeded. Please wait ' + Math.ceil((oldestRequest + timeWindow - now) / 1000) + ' seconds.'
                        };
                    }
                    
                    requests.push(now);
                    return { allowed: true };
                },
                
                reset: function() {
                    requests = [];
                }
            };
        },

        /**
         * CSRF token generation and validation
         */
        generateCSRFToken: function() {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return btoa(String.fromCharCode.apply(null, array));
        },

        /**
         * Safe JSON parsing with error handling
         */
        safeJsonParse: function(jsonString) {
            try {
                return JSON.parse(jsonString);
            } catch (error) {
                console.error('JSON parsing error:', error);
                return null;
            }
        }
    };

    // Make available globally
    window.SecurityUtils = SecurityUtils;

    // Export for Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SecurityUtils;
    }

})();