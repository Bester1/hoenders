# 🔄 CREDENTIAL RESTORATION GUIDE

## OPTION 1: Quick Restore (Less Secure)
Add these lines back to your files:

### In `customer.js` (line 6-8):
```javascript
// Supabase Configuration - Same as admin dashboard
const SUPABASE_URL = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### In `script.js` (line 154-165):
```javascript
// Configuration - Direct inline for GitHub Pages deployment
const AppConfig = {
    SUPABASE_URL: 'https://ukdmlzuxgnjucwidsygj.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w',
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'
};

// Supabase Configuration
const SUPABASE_URL = AppConfig.SUPABASE_URL;
const SUPABASE_ANON_KEY = AppConfig.SUPABASE_ANON_KEY;
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Email Service Configuration - Google Apps Script
const GOOGLE_SCRIPT_URL = AppConfig.GOOGLE_SCRIPT_URL;
```

## OPTION 2: Secure Setup (Recommended)
Create `.env` file:
```
SUPABASE_URL=https://ukdmlzuxgnjucwidsygj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec
```

## OPTION 3: Hybrid Approach
Keep new security features but add temporary fallback for quick deployment.