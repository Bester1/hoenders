/**
 * Secure localStorage Encryption Utilities
 * Encrypts sensitive data before storing in localStorage
 * Provides secure session management and data protection
 */

(function() {
    'use strict';

    /**
     * Secure storage utilities with encryption
     */
    const SecureStorage = {
        // Encryption key cache
        _masterKey: null,

        // Session management
        _sessionTimeout: 120 * 60 * 1000, // 2 hours default
        _sessionKey: 'plaasHoendersSecureSession',

        /**
         * Initialize secure storage with master key
         */
        async init(passphrase = null) {
            try {
                // Generate or derive master key
                this._masterKey = await this._generateMasterKey(passphrase);

                // Check for expired sessions
                this._cleanupExpiredSessions();

                console.info('✅ SecureStorage initialized');
                return true;
            } catch (error) {
                console.error('❌ SecureStorage initialization failed:', error);
                return false;
            }
        },

        /**
         * Store encrypted data in localStorage
         */
        async setSecure(key, data, options = {}) {
            try {
                if (!this._masterKey) {
                    throw new Error('SecureStorage not initialized');
                }

                const dataToStore = {
                    value: data,
                    timestamp: Date.now(),
                    expires: options.expires || null,
                    sessionBound: options.sessionBound || false,
                    metadata: options.metadata || {}
                };

                // Encrypt the data
                const encryptedData = await this._encrypt(dataToStore);

                // Store with secure prefix
                localStorage.setItem(`secure_${key}`, encryptedData);

                console.debug(`🔒 Secure data stored: ${key}`);
                return true;
            } catch (error) {
                console.error('❌ Failed to store secure data:', error);
                return false;
            }
        },

        /**
         * Retrieve and decrypt data from localStorage
         */
        async getSecure(key, defaultValue = null) {
            try {
                if (!this._masterKey) {
                    throw new Error('SecureStorage not initialized');
                }

                const encryptedData = localStorage.getItem(`secure_${key}`);
                if (!encryptedData) {
                    return defaultValue;
                }

                // Decrypt the data
                const decryptedData = await this._decrypt(encryptedData);

                // Check expiration
                if (decryptedData.expires && Date.now() > decryptedData.expires) {
                    this.removeSecure(key);
                    return defaultValue;
                }

                // Check session binding
                if (decryptedData.sessionBound && !this._isValidSession()) {
                    this.removeSecure(key);
                    return defaultValue;
                }

                console.debug(`🔓 Secure data retrieved: ${key}`);
                return decryptedData.value;
            } catch (error) {
                console.error('❌ Failed to retrieve secure data:', error);
                // Remove corrupted data
                this.removeSecure(key);
                return defaultValue;
            }
        },

        /**
         * Remove encrypted data from localStorage
         */
        removeSecure(key) {
            try {
                localStorage.removeItem(`secure_${key}`);
                console.debug(`🗑️ Secure data removed: ${key}`);
                return true;
            } catch (error) {
                console.error('❌ Failed to remove secure data:', error);
                return false;
            }
        },

        /**
         * Store customer data securely
         */
        async setCustomerData(customerData) {
            return await this.setSecure('customerData', customerData, {
                sessionBound: true,
                expires: Date.now() + this._sessionTimeout,
                metadata: { type: 'customerData' }
            });
        },

        /**
         * Retrieve customer data securely
         */
        async getCustomerData() {
            return await this.getSecure('customerData', null);
        },

        /**
         * Store user session securely
         */
        async setSession(sessionData) {
            const sessionInfo = {
                ...sessionData,
                sessionId: this._generateSessionId(),
                createdAt: Date.now(),
                expiresAt: Date.now() + this._sessionTimeout
            };

            const success = await this.setSecure('userSession', sessionInfo, {
                sessionBound: false,
                expires: sessionInfo.expiresAt,
                metadata: { type: 'session' }
            });

            // Also store session ID separately for validation
            if (success) {
                localStorage.setItem(this._sessionKey, sessionInfo.sessionId);
            }

            return success;
        },

        /**
         * Get current session
         */
        async getSession() {
            return await this.getSecure('userSession', null);
        },

        /**
         * Clear session data
         */
        async clearSession() {
            this.removeSecure('userSession');
            this.removeSecure('customerData');
            localStorage.removeItem(this._sessionKey);
            console.info('🔐 Session cleared securely');
        },

        /**
         * Store shopping cart securely
         */
        async setCart(cartData) {
            return await this.setSecure('shoppingCart', cartData, {
                expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
                metadata: { type: 'cart' }
            });
        },

        /**
         * Retrieve shopping cart
         */
        async getCart() {
            return await this.getSecure('shoppingCart', {});
        },

        /**
         * Clear all secure storage
         */
        clearAll() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('secure_')) {
                    localStorage.removeItem(key);
                }
            });
            localStorage.removeItem(this._sessionKey);
            console.info('🗑️ All secure storage cleared');
        },

        /**
         * Private: Generate or derive master encryption key
         */
        async _generateMasterKey(passphrase) {
            // Use browser fingerprint + hostname as base
            const baseString = passphrase ||
                (window.location.hostname + navigator.userAgent.slice(0, 100) + new Date().toDateString());

            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(baseString),
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            return crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode('plaas-hoenders-storage-salt-2025'),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        },

        /**
         * Private: Encrypt data using AES-GCM
         */
        async _encrypt(data) {
            const encoder = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                this._masterKey,
                encoder.encode(JSON.stringify(data))
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode.apply(null, combined));
        },

        /**
         * Private: Decrypt data using AES-GCM
         */
        async _decrypt(encryptedData) {
            const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this._masterKey,
                encrypted
            );

            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        },

        /**
         * Private: Generate unique session ID
         */
        _generateSessionId() {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return btoa(String.fromCharCode.apply(null, array)).replace(/[+/=]/g, '');
        },

        /**
         * Private: Check if current session is valid
         */
        _isValidSession() {
            try {
                const sessionId = localStorage.getItem(this._sessionKey);
                return sessionId && sessionId.length > 10;
            } catch (error) {
                return false;
            }
        },

        /**
         * Private: Clean up expired sessions and data
         */
        _cleanupExpiredSessions() {
            const keys = Object.keys(localStorage);
            const now = Date.now();

            keys.forEach(async key => {
                if (key.startsWith('secure_')) {
                    try {
                        const data = await this.getSecure(key.substring(7));
                        // getSecure automatically removes expired data
                    } catch (error) {
                        // Remove corrupted data
                        localStorage.removeItem(key);
                    }
                }
            });
        },

        /**
         * Get storage statistics
         */
        getStats() {
            const keys = Object.keys(localStorage);
            const secureKeys = keys.filter(key => key.startsWith('secure_'));

            return {
                totalKeys: keys.length,
                secureKeys: secureKeys.length,
                initialized: !!this._masterKey,
                sessionActive: this._isValidSession()
            };
        }
    };

    /**
     * Legacy localStorage wrapper for backwards compatibility
     * Automatically encrypts sensitive data patterns
     */
    const LegacyStorageWrapper = {
        // Patterns that should be encrypted
        _sensitivePatterns: [
            'customer', 'user', 'session', 'auth', 'token',
            'email', 'phone', 'address', 'profile', 'cart'
        ],

        /**
         * Check if key contains sensitive data
         */
        _isSensitive(key) {
            const lowerKey = key.toLowerCase();
            return this._sensitivePatterns.some(pattern =>
                lowerKey.includes(pattern)
            );
        },

        /**
         * Wrapper for localStorage.setItem
         */
        async setItem(key, value) {
            if (this._isSensitive(key)) {
                console.warn(`🔒 Automatically encrypting sensitive data: ${key}`);
                return await SecureStorage.setSecure(key, value);
            } else {
                return localStorage.setItem(key, value);
            }
        },

        /**
         * Wrapper for localStorage.getItem
         */
        async getItem(key, defaultValue = null) {
            if (this._isSensitive(key)) {
                return await SecureStorage.getSecure(key, defaultValue);
            } else {
                return localStorage.getItem(key) || defaultValue;
            }
        },

        /**
         * Wrapper for localStorage.removeItem
         */
        removeItem(key) {
            if (this._isSensitive(key)) {
                return SecureStorage.removeSecure(key);
            } else {
                return localStorage.removeItem(key);
            }
        }
    };

    // Make utilities globally available
    window.SecureStorage = SecureStorage;
    window.LegacyStorageWrapper = LegacyStorageWrapper;

    // Export for Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SecureStorage, LegacyStorageWrapper };
    }

    // Auto-initialize on load
    document.addEventListener('DOMContentLoaded', async () => {
        await SecureStorage.init();
    });

})();