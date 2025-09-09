/**
 * Customer Validation Module
 * Ensures all required customer fields are filled before proceeding with orders
 */

class CustomerValidator {
    constructor() {
        this.requiredFields = ['phone', 'address'];
        this.validationRules = {
            phone: {
                required: true,
                pattern: /^[\d\s\-\+\(\)]+$/,
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

    /**
     * Validate customer data against required fields
     * @param {Object} customerData - Customer data object
     * @returns {Object} Validation result with status and errors
     */
    validateCustomerData(customerData) {
        const errors = {};
        let isValid = true;

        // Check required fields
        this.requiredFields.forEach(field => {
            const value = customerData[field];
            const rules = this.validationRules[field];

            if (!value || value.trim() === '') {
                errors[field] = rules.message;
                isValid = false;
            } else if (rules.minLength && value.trim().length < rules.minLength) {
                errors[field] = `${rules.message} (minimum ${rules.minLength} characters)`;
                isValid = false;
            } else if (rules.pattern && !rules.pattern.test(value.trim())) {
                errors[field] = rules.message;
                isValid = false;
            }
        });

        return {
            isValid,
            errors,
            message: isValid ? 'All required fields are filled' : 'Please fill in all required fields'
        };
    }

    /**
     * Main validation method for test framework compatibility
     * @param {Object} customerData - Customer data object with phone and address
     * @returns {Object} Validation result with isValid, errors array, and message
     */
    validate(customerData) {
        // Convert to format expected by validateCustomerData
        const validation = this.validateCustomerData(customerData);
        
        // Convert errors object to array format for test compatibility
        const errorsArray = [];
        Object.keys(validation.errors).forEach(field => {
            errorsArray.push({
                field: field,
                message: validation.errors[field],
                type: 'error'
            });
        });
        
        return {
            isValid: validation.isValid,
            errors: errorsArray,
            warnings: [],
            message: validation.message
        };
    }

    /**
     * Validate current customer data from the DOM
     * @returns {Object} Validation result
     */
    validateCurrentCustomer() {
        // Get current customer data from DOM elements
        const phoneElement = document.getElementById('displayPhone');
        const addressElement = document.getElementById('displayAddress');
        
        const customerData = {
            phone: phoneElement ? phoneElement.textContent.trim() : '',
            address: addressElement ? addressElement.textContent.trim() : ''
        };

        return this.validateCustomerData(customerData);
    }

    /**
     * Display validation errors in the UI
     * @param {Object} errors - Validation errors object
     */
    displayValidationErrors(errors) {
        // Clear previous errors
        this.clearValidationErrors();

        // Display new errors
        Object.keys(errors).forEach(field => {
            const errorElement = document.getElementById(`${field}Error`);
            const fieldElement = document.getElementById(`display${field.charAt(0).toUpperCase() + field.slice(1)}`);
            
            if (errorElement) {
                errorElement.textContent = errors[field];
                errorElement.style.display = 'block';
            }

            if (fieldElement) {
                fieldElement.classList.add('validation-error');
            }
        });

        // Show general validation message
        const generalError = document.getElementById('validationMessage');
        if (generalError) {
            generalError.textContent = 'Please fill in all required fields before proceeding.';
            generalError.style.display = 'block';
            generalError.className = 'alert alert-danger';
        }
    }

    /**
     * Clear validation errors from the UI
     */
    clearValidationErrors() {
        // Clear field-specific errors
        this.requiredFields.forEach(field => {
            const errorElement = document.getElementById(`${field}Error`);
            const fieldElement = document.getElementById(`display${field.charAt(0).toUpperCase() + field.slice(1)}`);
            
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }

            if (fieldElement) {
                fieldElement.classList.remove('validation-error');
            }
        });

        // Clear general validation message
        const generalError = document.getElementById('validationMessage');
        if (generalError) {
            generalError.textContent = '';
            generalError.style.display = 'none';
            generalError.className = '';
        }
    }

    /**
     * Check if customer can proceed to next step
     * @returns {boolean} True if customer can proceed
     */
    canProceed() {
        const validation = this.validateCurrentCustomer();
        
        if (!validation.isValid) {
            this.displayValidationErrors(validation.errors);
            return false;
        }

        this.clearValidationErrors();
        return true;
    }

    /**
     * Get validation status message
     * @returns {string} Status message
     */
    getValidationStatus() {
        const validation = this.validateCurrentCustomer();
        return validation.message;
    }
}

// Create global validator instance
window.customerValidator = new CustomerValidator();

// Also create CustomerValidator constructor globally for test compatibility
window.CustomerValidator = CustomerValidator;

// Validation helper functions
window.validateCustomerFields = function() {
    return customerValidator.canProceed();
};

window.getCustomerValidationErrors = function() {
    return customerValidator.validateCurrentCustomer().errors;
};

window.clearCustomerValidationErrors = function() {
    customerValidator.clearValidationErrors();
};