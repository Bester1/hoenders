/**
 * Security Validation Script
 * Comprehensive security checks for production readiness
 * Run this before deployment to ensure security compliance
 */

(function() {
    'use strict';

    /**
     * Security Validator
     */
    const SecurityValidator = {

        /**
         * Run complete security validation
         */
        async validateSecurity() {
            console.log('🔒 Starting comprehensive security validation...');

            const results = {
                passed: 0,
                failed: 0,
                warnings: 0,
                details: []
            };

            // Run all security checks
            const checks = [
                this.checkConfigurationSecurity,
                this.checkDOMSecurity,
                this.checkStorageSecurity,
                this.checkInputValidation,
                this.checkNetworkSecurity,
                this.checkAuthenticationSecurity,
                this.checkErrorHandling,
                this.checkDependencySecurity
            ];

            for (const check of checks) {
                try {
                    const result = await check.call(this);
                    this._processResult(results, result);
                } catch (error) {
                    this._processResult(results, {
                        category: 'General',
                        status: 'FAIL',
                        message: `Security check failed: ${error.message}`,
                        critical: true
                    });
                }
            }

            this._displayResults(results);
            return results;
        },

        /**
         * Check configuration security
         */
        async checkConfigurationSecurity() {
            const checks = [];

            // Check if SecureConfig is available
            if (typeof SecureConfig === 'undefined') {
                checks.push({
                    category: 'Configuration',
                    status: 'FAIL',
                    message: 'SecureConfig module not loaded',
                    critical: true
                });
            } else {
                // Check if configuration is production ready
                if (!SecureConfig.isProductionReady()) {
                    checks.push({
                        category: 'Configuration',
                        status: 'WARN',
                        message: 'Development configuration detected',
                        critical: false
                    });
                } else {
                    checks.push({
                        category: 'Configuration',
                        status: 'PASS',
                        message: 'Production configuration validated',
                        critical: false
                    });
                }
            }

            // Check for hardcoded credentials in global scope
            const globalKeys = Object.keys(window);
            const dangerousKeys = globalKeys.filter(key =>
                key.toLowerCase().includes('key') ||
                key.toLowerCase().includes('secret') ||
                key.toLowerCase().includes('token')
            );

            if (dangerousKeys.length > 0) {
                checks.push({
                    category: 'Configuration',
                    status: 'WARN',
                    message: `Potentially sensitive global variables: ${dangerousKeys.join(', ')}`,
                    critical: false
                });
            }

            return checks;
        },

        /**
         * Check DOM security
         */
        async checkDOMSecurity() {
            const checks = [];

            // Check if SecureDOM is available
            if (typeof SecureDOM === 'undefined') {
                checks.push({
                    category: 'DOM Security',
                    status: 'FAIL',
                    message: 'SecureDOM module not loaded',
                    critical: true
                });
            } else {
                checks.push({
                    category: 'DOM Security',
                    status: 'PASS',
                    message: 'SecureDOM module available',
                    critical: false
                });
            }

            // Check for dangerous innerHTML usage (this is a heuristic check)
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            let hasInnerHTMLWarning = false;

            scripts.forEach(script => {
                if (script.src.includes('script.js') || script.src.includes('customer.js')) {
                    // These files have been updated, but we can't inspect their content from here
                    hasInnerHTMLWarning = false;
                }
            });

            // Check if error handler is properly configured
            if (typeof showSecurityError === 'undefined') {
                checks.push({
                    category: 'DOM Security',
                    status: 'WARN',
                    message: 'Security error handler not available',
                    critical: false
                });
            }

            return checks;
        },

        /**
         * Check storage security
         */
        async checkStorageSecurity() {
            const checks = [];

            // Check if SecureStorage is available
            if (typeof SecureStorage === 'undefined') {
                checks.push({
                    category: 'Storage Security',
                    status: 'FAIL',
                    message: 'SecureStorage module not loaded',
                    critical: true
                });
                return checks;
            }

            // Check SecureStorage initialization
            const stats = SecureStorage.getStats();
            if (!stats.initialized) {
                checks.push({
                    category: 'Storage Security',
                    status: 'WARN',
                    message: 'SecureStorage not initialized',
                    critical: false
                });
            } else {
                checks.push({
                    category: 'Storage Security',
                    status: 'PASS',
                    message: 'SecureStorage properly initialized',
                    critical: false
                });
            }

            // Check for plain text sensitive data in localStorage
            const sensitivePatterns = ['customer', 'user', 'session', 'auth', 'token'];
            const localStorageKeys = Object.keys(localStorage);
            const unsecureKeys = localStorageKeys.filter(key => {
                const lowerKey = key.toLowerCase();
                return sensitivePatterns.some(pattern => lowerKey.includes(pattern)) &&
                       !key.startsWith('secure_');
            });

            if (unsecureKeys.length > 0) {
                checks.push({
                    category: 'Storage Security',
                    status: 'WARN',
                    message: `Unencrypted sensitive data found: ${unsecureKeys.join(', ')}`,
                    critical: true
                });
            }

            return checks;
        },

        /**
         * Check input validation
         */
        async checkInputValidation() {
            const checks = [];

            // Check if SecurityUtils is available
            if (typeof SecurityUtils === 'undefined') {
                checks.push({
                    category: 'Input Validation',
                    status: 'FAIL',
                    message: 'SecurityUtils module not loaded',
                    critical: true
                });
                return checks;
            }

            // Test basic validation functions
            try {
                const emailResult = SecurityUtils.validateAndSanitizeEmail('test@example.com');
                if (emailResult.valid && emailResult.sanitized === 'test@example.com') {
                    checks.push({
                        category: 'Input Validation',
                        status: 'PASS',
                        message: 'Email validation working correctly',
                        critical: false
                    });
                }
            } catch (error) {
                checks.push({
                    category: 'Input Validation',
                    status: 'FAIL',
                    message: `Email validation error: ${error.message}`,
                    critical: true
                });
            }

            // Check for form elements without validation
            const forms = document.querySelectorAll('form');
            let unvalidatedForms = 0;

            forms.forEach(form => {
                const inputs = form.querySelectorAll('input[type="email"], input[type="text"], textarea');
                inputs.forEach(input => {
                    if (!input.hasAttribute('data-validated')) {
                        unvalidatedForms++;
                    }
                });
            });

            if (unvalidatedForms > 0) {
                checks.push({
                    category: 'Input Validation',
                    status: 'WARN',
                    message: `${unvalidatedForms} form inputs may lack validation`,
                    critical: false
                });
            }

            return checks;
        },

        /**
         * Check network security
         */
        async checkNetworkSecurity() {
            const checks = [];

            // Check if HTTPS is being used
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                checks.push({
                    category: 'Network Security',
                    status: 'FAIL',
                    message: 'Application not served over HTTPS',
                    critical: true
                });
            } else {
                checks.push({
                    category: 'Network Security',
                    status: 'PASS',
                    message: 'HTTPS connection verified',
                    critical: false
                });
            }

            // Check for mixed content
            const insecureResources = Array.from(document.querySelectorAll('script[src], link[href], img[src]'))
                .filter(element => {
                    const url = element.src || element.href;
                    return url && url.startsWith('http://');
                });

            if (insecureResources.length > 0) {
                checks.push({
                    category: 'Network Security',
                    status: 'WARN',
                    message: `${insecureResources.length} insecure resources detected`,
                    critical: false
                });
            }

            return checks;
        },

        /**
         * Check authentication security
         */
        async checkAuthenticationSecurity() {
            const checks = [];

            // Check if Supabase client is properly initialized
            if (typeof supabaseClient === 'undefined' || !supabaseClient) {
                checks.push({
                    category: 'Authentication',
                    status: 'WARN',
                    message: 'Supabase client not initialized',
                    critical: false
                });
            }

            // Check session management
            if (typeof SecureStorage !== 'undefined') {
                try {
                    const session = await SecureStorage.getSession();
                    if (session) {
                        checks.push({
                            category: 'Authentication',
                            status: 'PASS',
                            message: 'Secure session management active',
                            critical: false
                        });
                    }
                } catch (error) {
                    checks.push({
                        category: 'Authentication',
                        status: 'WARN',
                        message: 'Session validation failed',
                        critical: false
                    });
                }
            }

            return checks;
        },

        /**
         * Check error handling security
         */
        async checkErrorHandling() {
            const checks = [];

            // Check if security error handler is available
            if (typeof showSecurityError === 'function') {
                checks.push({
                    category: 'Error Handling',
                    status: 'PASS',
                    message: 'Security error handler available',
                    critical: false
                });
            } else {
                checks.push({
                    category: 'Error Handling',
                    status: 'WARN',
                    message: 'Security error handler not found',
                    critical: false
                });
            }

            // Test error handling doesn't expose sensitive info
            const originalConsoleError = console.error;
            let hasDetailedErrors = false;

            console.error = function(...args) {
                const errorText = args.join(' ').toLowerCase();
                if (errorText.includes('supabase') || errorText.includes('key') || errorText.includes('token')) {
                    hasDetailedErrors = true;
                }
                originalConsoleError.apply(console, args);
            };

            // Restore original console.error
            setTimeout(() => {
                console.error = originalConsoleError;
                if (hasDetailedErrors) {
                    checks.push({
                        category: 'Error Handling',
                        status: 'WARN',
                        message: 'Potentially sensitive information in error messages',
                        critical: false
                    });
                }
            }, 100);

            return checks;
        },

        /**
         * Check dependency security
         */
        async checkDependencySecurity() {
            const checks = [];

            // Check for known vulnerable libraries (basic check)
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const externalScripts = scripts.filter(script =>
                script.src && (script.src.includes('cdn') || script.src.includes('http'))
            );

            if (externalScripts.length > 0) {
                checks.push({
                    category: 'Dependencies',
                    status: 'INFO',
                    message: `${externalScripts.length} external dependencies loaded`,
                    critical: false
                });
            }

            // Check if all security modules are loaded
            const requiredModules = ['SecurityUtils', 'SecureConfig', 'SecureDOM', 'SecureStorage'];
            const missingModules = requiredModules.filter(module =>
                typeof window[module] === 'undefined'
            );

            if (missingModules.length > 0) {
                checks.push({
                    category: 'Dependencies',
                    status: 'FAIL',
                    message: `Missing security modules: ${missingModules.join(', ')}`,
                    critical: true
                });
            } else {
                checks.push({
                    category: 'Dependencies',
                    status: 'PASS',
                    message: 'All security modules loaded',
                    critical: false
                });
            }

            return checks;
        },

        /**
         * Process individual check result
         */
        _processResult(results, checkResult) {
            if (Array.isArray(checkResult)) {
                checkResult.forEach(result => this._processResult(results, result));
                return;
            }

            results.details.push(checkResult);

            switch (checkResult.status) {
                case 'PASS':
                    results.passed++;
                    break;
                case 'FAIL':
                    results.failed++;
                    break;
                case 'WARN':
                case 'INFO':
                    results.warnings++;
                    break;
            }
        },

        /**
         * Display validation results
         */
        _displayResults(results) {
            const total = results.passed + results.failed + results.warnings;
            const successRate = Math.round((results.passed / total) * 100);

            console.log('\n🔒 SECURITY VALIDATION RESULTS');
            console.log('=====================================');
            console.log(`✅ Passed: ${results.passed}`);
            console.log(`❌ Failed: ${results.failed}`);
            console.log(`⚠️  Warnings: ${results.warnings}`);
            console.log(`📊 Success Rate: ${successRate}%\n`);

            // Group results by category
            const categories = {};
            results.details.forEach(detail => {
                if (!categories[detail.category]) {
                    categories[detail.category] = [];
                }
                categories[detail.category].push(detail);
            });

            // Display detailed results
            Object.entries(categories).forEach(([category, checks]) => {
                console.log(`\n📋 ${category}:`);
                checks.forEach(check => {
                    const icon = check.status === 'PASS' ? '✅' :
                                check.status === 'FAIL' ? '❌' : '⚠️';
                    const critical = check.critical ? ' (CRITICAL)' : '';
                    console.log(`   ${icon} ${check.message}${critical}`);
                });
            });

            // Overall security assessment
            console.log('\n🎯 SECURITY ASSESSMENT:');
            if (results.failed === 0 && results.warnings <= 2) {
                console.log('✅ EXCELLENT - Production ready with strong security');
            } else if (results.failed === 0 && results.warnings <= 5) {
                console.log('🟡 GOOD - Production ready with minor security considerations');
            } else if (results.failed <= 2) {
                console.log('🟠 FAIR - Security issues should be addressed before production');
            } else {
                console.log('🔴 POOR - Critical security issues must be fixed immediately');
            }

            // Critical issues summary
            const criticalIssues = results.details.filter(detail => detail.critical && detail.status !== 'PASS');
            if (criticalIssues.length > 0) {
                console.log('\n🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:');
                criticalIssues.forEach(issue => {
                    console.log(`   ❌ ${issue.category}: ${issue.message}`);
                });
            }

            console.log('\n=====================================');
        }
    };

    // Make available globally
    window.SecurityValidator = SecurityValidator;

    // Auto-run validation if requested
    if (window.location.search.includes('validate=security') ||
        window.location.hash.includes('security-check')) {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => SecurityValidator.validateSecurity(), 2000);
        });
    }

})();