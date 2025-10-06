/**
 * Development Environment Configuration
 * Safe fallback values for testing and development
 */

(function() {
    'use strict';
    
    // Development configuration with actual production values
    window.ENV = {
        SUPABASE_URL: 'https://ukdmlzuxgnjucwidsygj.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w',
        GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'
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