/**
 * Centralized Error Handling and Logging System
 * Provides comprehensive error management with user-friendly messages
 * Includes logging, monitoring, and graceful error recovery
 */

(function() {
    'use strict';

    const ErrorHandler = {
        // Error severity levels
        LEVELS: {
            FATAL: 'fatal',
            ERROR: 'error', 
            WARNING: 'warning',
            INFO: 'info',
            DEBUG: 'debug'
        },

        // Error categories for better organization
        CATEGORIES: {
            AUTHENTICATION: 'authentication',
            DATABASE: 'database',
            NETWORK: 'network',
            VALIDATION: 'validation',
            SECURITY: 'security',
            BUSINESS_LOGIC: 'business_logic',
            SYSTEM: 'system',
            USER_INPUT: 'user_input'
        },

        // User-friendly error messages
        USER_MESSAGES: {
            'authentication_failed': 'Unable to authenticate. Please check your credentials and try again.',
            'session_expired': 'Your session has expired. Please log in again.',
            'database_error': 'Unable to save your data. Please try again later.',
            'network_error': 'Connection failed. Please check your internet connection.',
            'validation_error': 'Please check your input and try again.',
            'security_error': 'Security check failed. Please try again.',
            'rate_limit_exceeded': 'Too many requests. Please wait a moment and try again.',
            'server_error': 'Server error. Please contact support if the problem persists.',
            'not_found': 'The requested item was not found.',
            'permission_denied': 'You do not have permission to perform this action.',
            'default': 'An unexpected error occurred. Please try again later.'
        },

        // Configuration
        config: {
            maxLogEntries: 100,
            enableConsoleLogging: true,
            enableLocalStorage: true,
            enableExternalLogging: false,
            externalLogEndpoint: null,
            showUserNotifications: true,
            debugMode: false
        },

        /**
         * Initialize error handler with configuration
         */
        init: function(userConfig) {
            if (userConfig) {
                Object.assign(ErrorHandler.config, userConfig);
            }

            // Set up global error handlers
            ErrorHandler.setupGlobalHandlers();

            // Load any existing error logs
            if (ErrorHandler.config.enableLocalStorage) {
                ErrorHandler.loadStoredErrors();
            }

            console.info('ErrorHandler initialized with config:', ErrorHandler.config);
        },

        /**
         * Set up global error event handlers
         */
        setupGlobalHandlers: function() {
            // Handle uncaught JavaScript errors
            window.addEventListener('error', function(event) {
                ErrorHandler.handleGlobalError(event);
            });

            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', function(event) {
                ErrorHandler.handleUnhandledRejection(event);
            });

            // Handle network errors
            window.addEventListener('offline', function() {
                ErrorHandler.log('Network connection lost', 'warning', 'network', { type: 'connection_lost' });
            });
        },

        /**
         * Handle global JavaScript errors
         */
        handleGlobalError: function(event) {
            const errorData = {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                type: 'javascript_error',
                timestamp: new Date().toISOString()
            };

            ErrorHandler.log(errorData, 'error', 'system');
            
            // Show user notification if enabled
            if (ErrorHandler.config.showUserNotifications) {
                ErrorHandler.showUserNotification('An unexpected error occurred. Please refresh the page and try again.', 'error');
            }
        },

        /**
         * Handle unhandled promise rejections
         */
        handleUnhandledRejection: function(event) {
            const errorData = {
                reason: event.reason,
                type: 'promise_rejection',
                timestamp: new Date().toISOString()
            };

            ErrorHandler.log(errorData, 'error', 'system');
        },

        /**
         * Centralized error logging
         */
        log: function(error, level, category, context) {
            level = level || 'error';
            category = category || 'system';
            context = context || {};

            const errorData = {
                id: ErrorHandler.generateErrorId(),
                timestamp: new Date().toISOString(),
                level: level,
                category: category,
                message: ErrorHandler.extractErrorMessage(error),
                stack: ErrorHandler.extractStackTrace(error),
                context: Object.assign({}, context, {
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: Date.now()
                })
            };

            // Console logging
            if (ErrorHandler.config.enableConsoleLogging) {
                console[level]('Application Error:', errorData);
            }

            // Local storage logging
            if (ErrorHandler.config.enableLocalStorage) {
                ErrorHandler.storeError(errorData);
            }

            // External logging service
            if (ErrorHandler.config.enableExternalLogging && ErrorHandler.config.externalLogEndpoint) {
                ErrorHandler.sendToExternalService(errorData);
            }

            // Debug mode additional logging
            if (ErrorHandler.config.debugMode) {
                console.debug('Error Context:', context);
                console.debug('Original Error:', error);
            }

            return errorData;
        },

        /**
         * Extract meaningful error message from various error types
         */
        extractErrorMessage: function(error) {
            if (!error) return 'Unknown error';

            if (typeof error === 'string') {
                return error;
            }

            if (error instanceof Error) {
                return error.message || 'Unknown error';
            }

            if (error.message) {
                return error.message;
            }

            if (error.error && error.error.message) {
                return error.error.message;
            }

            return JSON.stringify(error);
        },

        /**
         * Extract stack trace from error
         */
        extractStackTrace: function(error) {
            if (error instanceof Error && error.stack) {
                return error.stack;
            }

            if (error && error.stack) {
                return error.stack;
            }

            return null;
        },

        /**
         * Generate unique error ID
         */
        generateErrorId: function() {
            return 'ERR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Store error in localStorage
         */
        storeError: function(errorData) {
            try {
                let errors = JSON.parse(localStorage.getItem('plaasHoendersErrors') || '[]');
                errors.push(errorData);
                
                // Keep only recent errors
                if (errors.length > ErrorHandler.config.maxLogEntries) {
                    errors = errors.slice(-ErrorHandler.config.maxLogEntries);
                }
                
                localStorage.setItem('plaasHoendersErrors', JSON.stringify(errors));
            } catch (e) {
                console.error('Failed to store error in localStorage:', e);
            }
        },

        /**
         * Load stored errors from localStorage
         */
        loadStoredErrors: function() {
            try {
                const errors = JSON.parse(localStorage.getItem('plaasHoendersErrors') || '[]');
                return errors;
            } catch (e) {
                console.error('Failed to load stored errors:', e);
                return [];
            }
        },

        /**
         * Send error to external logging service
         */
        sendToExternalService: function(errorData) {
            if (!ErrorHandler.config.externalLogEndpoint) return;

            // Use sendBeacon for reliability
            if (navigator.sendBeacon) {
                const data = new Blob([JSON.stringify(errorData)], { type: 'application/json' });
                navigator.sendBeacon(ErrorHandler.config.externalLogEndpoint, data);
            } else {
                // Fallback to fetch
                fetch(ErrorHandler.config.externalLogEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorData),
                    keepalive: true
                }).catch(function(error) {
                    console.error('Failed to send error to external service:', error);
                });
            }
        },

        /**
         * Show user-friendly error notification
         */
        showUserNotification: function(message, type, duration) {
            type = type || 'error';
            duration = duration || 5000;

            // Use toast notification if available
            if (window.showToast) {
                window.showToast(message, type, duration);
                return;
            }

            // Fallback to custom notification
            ErrorHandler.createNotification(message, type, duration);
        },

        /**
         * Create custom error notification
         */
        createNotification: function(message, type, duration) {
            // Remove existing notifications
            const existing = document.querySelector('.error-handler-notification');
            if (existing) {
                existing.remove();
            }

            const notification = document.createElement('div');
            notification.className = 'error-handler-notification error-handler-' + type;
            notification.innerHTML = `
                <div class="error-handler-content">
                    <span class="error-handler-icon">${ErrorHandler.getIcon(type)}</span>
                    <span class="error-handler-message">${SecurityUtils.sanitizeHtml(message)}</span>
                    <button class="error-handler-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .error-handler-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-left: 4px solid;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    padding: 16px;
                    max-width: 400px;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease-out;
                }
                .error-handler-error { border-left-color: #dc3545; }
                .error-handler-warning { border-left-color: #ffc107; }
                .error-handler-info { border-left-color: #17a2b8; }
                .error-handler-success { border-left-color: #28a745; }
                .error-handler-content { display: flex; align-items: center; gap: 12px; }
                .error-handler-icon { font-size: 20px; }
                .error-handler-close { background: none; border: none; font-size: 20px; cursor: pointer; margin-left: auto; }
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `;

            document.head.appendChild(style);
            document.body.appendChild(notification);

            // Auto-remove after duration
            setTimeout(function() {
                if (notification.parentElement) {
                    notification.remove();
                    style.remove();
                }
            }, duration);
        },

        /**
         * Get icon for notification type
         */
        getIcon: function(type) {
            const icons = {
                error: '⚠️',
                warning: '⚠️',
                info: 'ℹ️',
                success: '✅'
            };
            return icons[type] || 'ℹ️';
        },

        /**
         * Handle specific error categories with appropriate user messages
         */
        handleError: function(error, category, context) {
            const errorData = ErrorHandler.log(error, 'error', category, context);
            
            // Get user-friendly message
            const userMessage = ErrorHandler.getUserMessage(category, error);
            
            // Show user notification
            if (ErrorHandler.config.showUserNotifications) {
                ErrorHandler.showUserNotification(userMessage, 'error');
            }
            
            return errorData;
        },

        /**
         * Get user-friendly error message based on category and error
         */
        getUserMessage: function(category, error) {
            // Check for specific error patterns
            if (error && error.message) {
                const message = error.message.toLowerCase();
                
                if (message.includes('network') || message.includes('fetch')) {
                    return ErrorHandler.USER_MESSAGES.network_error;
                }
                if (message.includes('auth') || message.includes('token') || message.includes('session')) {
                    return ErrorHandler.USER_MESSAGES.authentication_failed;
                }
                if (message.includes('rate limit')) {
                    return ErrorHandler.USER_MESSAGES.rate_limit_exceeded;
                }
                if (message.includes('validation')) {
                    return ErrorHandler.USER_MESSAGES.validation_error;
                }
                if (message.includes('permission') || message.includes('access')) {
                    return ErrorHandler.USER_MESSAGES.permission_denied;
                }
                if (message.includes('not found')) {
                    return ErrorHandler.USER_MESSAGES.not_found;
                }
            }
            
            // Return category-specific message or default
            const categoryMessage = ErrorHandler.USER_MESSAGES[category + '_error'];
            return categoryMessage || ErrorHandler.USER_MESSAGES.default;
        },

        /**
         * Handle async operations with automatic error handling
         */
        asyncOperation: async function(operation, context) {
            try {
                return await operation();
            } catch (error) {
                ErrorHandler.handleError(error, context.category || 'system', context);
                throw error; // Re-throw for caller to handle
            }
        },

        /**
         * Validation error handler
         */
        validationError: function(field, message) {
            const error = new Error('Validation failed for ' + field + ': ' + message);
            error.field = field;
            error.type = 'validation_error';
            
            ErrorHandler.log(error, 'warning', 'validation');
            
            // Show field-specific error
            const fieldElement = document.querySelector('[name="' + field + '"]');
            if (fieldElement) {
                fieldElement.classList.add('error');
                const errorElement = document.getElementById(field + 'Error');
                if (errorElement) {
                    errorElement.textContent = message;
                    errorElement.style.display = 'block';
                }
            }
            
            return error;
        },

        /**
         * Clear all stored errors
         */
        clearStoredErrors: function() {
            try {
                localStorage.removeItem('plaasHoendersErrors');
            } catch (e) {
                console.error('Failed to clear stored errors:', e);
            }
        },

        /**
         * Get error statistics
         */
        getErrorStats: function() {
            const errors = ErrorHandler.loadStoredErrors();
            const stats = {
                total: errors.length,
                byLevel: {},
                byCategory: {},
                recent: errors.slice(-10)
            };
            
            errors.forEach(function(error) {
                stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
                stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            });
            
            return stats;
        }
    };

    // Make available globally
    window.ErrorHandler = ErrorHandler;

    // Export for Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ErrorHandler;
    }
})();