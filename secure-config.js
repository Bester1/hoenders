/**
 * Secure Configuration Management System
 * Replaces hardcoded credentials with secure environment-based configuration
 * Implements encryption for sensitive data storage
 */

(function() {
    'use strict';

    // Encryption utilities for sensitive data
    const CryptoUtils = {
        /**
         * Generate a secure key from a passphrase
         */
        async generateKey(passphrase) {
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(passphrase),
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            return crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode('plaas-hoenders-salt'),
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
         * Encrypt data using AES-GCM
         */
        async encryptData(data, key) {
            const encoder = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(JSON.stringify(data))
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode.apply(null, combined));
        },

        /**
         * Decrypt data using AES-GCM
         */
        async decryptData(encryptedData, key) {
            const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        }
    };

    /**
     * Secure Configuration Manager
     */
    const SecureConfig = {
        // Configuration validation schema
        SCHEMA: {
            SUPABASE_URL: {
                required: true,
                pattern: /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/
            },
            SUPABASE_ANON_KEY: {
                required: true,
                pattern: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
            },
            GOOGLE_SCRIPT_URL: {
                required: true,
                pattern: /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9-_]+\/exec$/
            }
        },

        // Runtime configuration cache
        _config: null,
        _encryptionKey: null,

        /**
         * Initialize secure configuration
         */
        async init() {
            try {
                // Initialize encryption key
                this._encryptionKey = await CryptoUtils.generateKey(
                    window.location.hostname + navigator.userAgent.slice(0, 50)
                );

                // Load configuration from secure sources
                this._config = await this._loadConfiguration();

                // Validate configuration
                this._validateConfiguration(this._config);

                console.info('✅ Secure configuration initialized');
                return true;
            } catch (error) {
                console.error('❌ Configuration initialization failed:', error);
                this._showConfigurationError(error.message);
                return false;
            }
        },

        /**
         * Load configuration from multiple secure sources
         */
        async _loadConfiguration() {
            // Priority 1: Environment variables (GitHub Actions/Server deployment)
            if (typeof process !== 'undefined' && process.env) {
                const envConfig = {
                    SUPABASE_URL: process.env.SUPABASE_URL,
                    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
                    GOOGLE_SCRIPT_URL: process.env.GOOGLE_SCRIPT_URL
                };

                if (this._isValidConfiguration(envConfig)) {
                    console.info('📋 Configuration loaded from environment variables');
                    return envConfig;
                }
            }

            // Priority 2: Window environment (injected by deployment script)
            if (window.ENV && this._isValidConfiguration(window.ENV)) {
                console.info('📋 Configuration loaded from window environment');
                return window.ENV;
            }

            // Priority 3: Secure localStorage (encrypted)
            const storedConfig = await this._loadFromSecureStorage();
            if (storedConfig) {
                console.info('📋 Configuration loaded from secure storage');
                return storedConfig;
            }

            // Priority 4: User configuration prompt (development mode)
            if (this._isDevelopmentMode()) {
                return await this._promptForConfiguration();
            }

            throw new Error('No valid configuration found. Please set up environment variables or configure manually.');
        },

        /**
         * Load configuration from encrypted localStorage
         */
        async _loadFromSecureStorage() {
            try {
                const encryptedConfig = localStorage.getItem('plaasHoendersSecureConfig');
                if (!encryptedConfig) return null;

                const config = await CryptoUtils.decryptData(encryptedConfig, this._encryptionKey);
                return this._isValidConfiguration(config) ? config : null;
            } catch (error) {
                console.warn('Failed to load secure configuration:', error);
                localStorage.removeItem('plaasHoendersSecureConfig');
                return null;
            }
        },

        /**
         * Save configuration to encrypted localStorage
         */
        async _saveToSecureStorage(config) {
            try {
                const encryptedConfig = await CryptoUtils.encryptData(config, this._encryptionKey);
                localStorage.setItem('plaasHoendersSecureConfig', encryptedConfig);
                console.info('💾 Configuration securely saved to storage');
            } catch (error) {
                console.error('Failed to save secure configuration:', error);
            }
        },

        /**
         * Prompt user for configuration in development mode
         */
        async _promptForConfiguration() {
            return new Promise((resolve, reject) => {
                const modal = this._createConfigurationModal();
                document.body.appendChild(modal);

                // Handle form submission
                const form = modal.querySelector('#configForm');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const config = {
                        SUPABASE_URL: form.supabaseUrl.value.trim(),
                        SUPABASE_ANON_KEY: form.supabaseKey.value.trim(),
                        GOOGLE_SCRIPT_URL: form.googleScriptUrl.value.trim()
                    };

                    try {
                        this._validateConfiguration(config);
                        await this._saveToSecureStorage(config);
                        modal.remove();
                        resolve(config);
                    } catch (error) {
                        this._showFieldError(form, error.message);
                    }
                });

                // Handle cancel
                modal.querySelector('#cancelConfig').addEventListener('click', () => {
                    modal.remove();
                    reject(new Error('Configuration cancelled by user'));
                });
            });
        },

        /**
         * Create configuration modal for development
         */
        _createConfigurationModal() {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                font-family: Arial, sans-serif;
            `;

            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;">
                    <h2 style="margin-top: 0; color: #333;">🔐 Configure Application</h2>
                    <p style="color: #666; margin-bottom: 20px;">
                        Please provide your configuration details to continue.
                    </p>

                    <form id="configForm">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">
                                Supabase URL:
                            </label>
                            <input type="url" name="supabaseUrl" required
                                placeholder="https://your-project.supabase.co"
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">
                                Supabase Anon Key:
                            </label>
                            <textarea name="supabaseKey" required rows="3"
                                placeholder="eyJ..."
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">
                                Google Apps Script URL:
                            </label>
                            <input type="url" name="googleScriptUrl" required
                                placeholder="https://script.google.com/macros/s/your-script-id/exec"
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>

                        <div id="configError" style="color: red; margin-bottom: 15px; display: none;"></div>

                        <div style="text-align: right;">
                            <button type="button" id="cancelConfig"
                                style="padding: 8px 16px; margin-right: 10px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                                Cancel
                            </button>
                            <button type="submit"
                                style="padding: 8px 16px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Save Configuration
                            </button>
                        </div>
                    </form>
                </div>
            `;

            return modal;
        },

        /**
         * Show field validation error
         */
        _showFieldError(form, message) {
            const errorDiv = form.querySelector('#configError');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        },

        /**
         * Validate configuration against schema
         */
        _validateConfiguration(config) {
            const errors = [];

            for (const [key, rules] of Object.entries(this.SCHEMA)) {
                const value = config[key];

                if (rules.required && (!value || value.includes('your-'))) {
                    errors.push(`${key} is required and cannot be a placeholder value`);
                    continue;
                }

                if (value && rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${key} has invalid format`);
                }
            }

            if (errors.length > 0) {
                throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
            }

            return true;
        },

        /**
         * Check if configuration is valid (non-placeholder values)
         */
        _isValidConfiguration(config) {
            return config &&
                   config.SUPABASE_URL && !config.SUPABASE_URL.includes('your-') &&
                   config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('your-') &&
                   config.GOOGLE_SCRIPT_URL && !config.GOOGLE_SCRIPT_URL.includes('your-');
        },

        /**
         * Check if running in development mode
         */
        _isDevelopmentMode() {
            return window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.protocol === 'file:';
        },

        /**
         * Show configuration error to user
         */
        _showConfigurationError(message) {
            if (typeof document === 'undefined') return;

            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; left: 20px;
                background: #ff6b6b; color: white; padding: 20px;
                border-radius: 8px; z-index: 10000; max-width: 500px;
                margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-family: Arial, sans-serif;
            `;

            errorDiv.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 24px; margin-right: 10px;">🚨</span>
                    <strong>Configuration Error</strong>
                </div>
                <div style="margin-bottom: 10px;">${message}</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Please check your environment setup or contact your administrator.
                </div>
                <button onclick="this.parentElement.remove()"
                    style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">
                    ×
                </button>
            `;

            document.body.appendChild(errorDiv);

            // Auto-remove after 15 seconds
            setTimeout(() => {
                if (errorDiv.parentElement) {
                    errorDiv.remove();
                }
            }, 15000);
        },

        /**
         * Get a configuration value
         */
        get(key) {
            if (!this._config) {
                throw new Error('Configuration not initialized. Call SecureConfig.init() first.');
            }

            const value = this._config[key];
            if (!value) {
                console.warn(`Configuration key not found: ${key}`);
                return null;
            }

            return value;
        },

        /**
         * Get all configuration values (for debugging only)
         */
        getAll() {
            if (!this._config) {
                throw new Error('Configuration not initialized. Call SecureConfig.init() first.');
            }

            // Return sanitized version for security
            return {
                SUPABASE_URL: this._config.SUPABASE_URL,
                SUPABASE_ANON_KEY: this._config.SUPABASE_ANON_KEY ? '***' : null,
                GOOGLE_SCRIPT_URL: this._config.GOOGLE_SCRIPT_URL ? '***' : null,
                initialized: true
            };
        },

        /**
         * Check if configuration is production-ready
         */
        isProductionReady() {
            return this._config && this._isValidConfiguration(this._config);
        },

        /**
         * Update configuration at runtime
         */
        async update(updates) {
            const newConfig = { ...this._config, ...updates };
            this._validateConfiguration(newConfig);

            this._config = newConfig;
            await this._saveToSecureStorage(newConfig);

            console.info('✅ Configuration updated successfully');
        },

        /**
         * Clear stored configuration
         */
        clear() {
            localStorage.removeItem('plaasHoendersSecureConfig');
            this._config = null;
            console.info('🗑️ Configuration cleared');
        }
    };

    // Make available globally
    window.SecureConfig = SecureConfig;

    // Export for Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SecureConfig;
    }

})();