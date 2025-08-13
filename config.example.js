// Example configuration file for Plaas Hoenders Admin Dashboard
// Copy this file to config.js and replace with your actual values
// IMPORTANT: Never commit config.js with real API keys to git

const AppConfig = {
    // Supabase Configuration
    SUPABASE_URL: 'YOUR_SUPABASE_PROJECT_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
    
    // Google Apps Script Configuration  
    GOOGLE_SCRIPT_URL: 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL',
    
    // Application Settings
    APP_VERSION: '1.0.0',
    DEBUG_MODE: false
};

// For production on GitHub Pages, you can:
// 1. Use GitHub Secrets and GitHub Actions to inject values at build time
// 2. Use a server-side proxy to hide API keys
// 3. Use environment-specific config files loaded dynamically