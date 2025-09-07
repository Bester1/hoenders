#!/bin/bash

# Create secure environment configuration
# This script is called by GitHub Actions

echo "🔧 Creating secure environment configuration..."

cat > env-config.js << 'EOF'
/**
 * Secure Environment Configuration
 * Generated automatically by GitHub Actions
 * DO NOT commit this file with real values
 */

(function() {
    'use strict';
    
    // Configuration loaded from environment
    window.ENV = {
        SUPABASE_URL: "${SUPABASE_URL}",
        SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}",
        GOOGLE_SCRIPT_URL: "${GOOGLE_SCRIPT_URL}"
    };
    
    // Log configuration status (without exposing actual values)
    console.log('Environment configuration loaded:', {
        hasSupabaseUrl: !!window.ENV.SUPABASE_URL,
        hasSupabaseKey: !!window.ENV.SUPABASE_ANON_KEY,
        hasGoogleScriptUrl: !!window.ENV.GOOGLE_SCRIPT_URL,
        isProductionReady: !window.ENV.SUPABASE_URL.includes('your-project')
    });
    
    // Security warning for development
    if (!window.ENV.SUPABASE_URL || window.ENV.SUPABASE_URL.includes('your-project')) {
        console.warn('Using development configuration. Please set up proper environment variables for production deployment.');
        console.info('To set up production configuration:');
        console.info('1. Add your credentials to GitHub Secrets');
        console.info('2. Use the GitHub Actions deployment workflow');
        console.info('3. Or create a local env-config.js with real values');
    }
})();
EOF

echo "✅ Environment configuration created"