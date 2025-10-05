/**
 * Development Environment Configuration
 * Safe fallback values for testing and development
 */

(function() {
    'use strict';
    
    // Development configuration with safe fallback values
    window.ENV = {
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjI3MjA3NjAwLCJleHAiOjE5NDI3ODM2MDB9.example',
        GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/test-script-id/exec'
    };
    
    // Log configuration status (without exposing actual values)
    console.log('Development environment configuration loaded:', {
        hasSupabaseUrl: !!window.ENV.SUPABASE_URL,
        hasSupabaseKey: !!window.ENV.SUPABASE_ANON_KEY,
        hasGoogleScriptUrl: !!window.ENV.GOOGLE_SCRIPT_URL,
        isProductionReady: !window.ENV.SUPABASE_URL.includes('your-project')
    });
    
    console.info('🛠️  Using development configuration for testing');
    console.info('⚠️  This configuration is for development/testing only');
})();