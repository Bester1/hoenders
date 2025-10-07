// Auth Storage Fix for Customer Portal
// This fixes the mismatch between Supabase default storage key and custom storage

// Fix for the auth storage key mismatch
(function() {
    console.log('🔧 Applying auth storage fix...');

    // Check if there's a Supabase token that needs to be migrated
    const supabaseTokenKey = 'sb-ukdmlzuxgnjucwidsygj-auth-token';
    const customTokenKey = 'plaas-hoenders-auth';

    // Get the Supabase token from localStorage
    const supabaseToken = localStorage.getItem(supabaseTokenKey);

    if (supabaseToken) {
        try {
            const tokenData = JSON.parse(supabaseToken);

            // Check if it's a valid token
            if (tokenData.access_token && tokenData.user) {
                console.log('✅ Found valid Supabase token, migrating...');

                // Store it with the custom key as well
                localStorage.setItem(customTokenKey, supabaseToken);

                // Also store any session backups
                const sessionBackup = {
                    user: tokenData.user,
                    session: tokenData,
                    timestamp: Date.now()
                };
                localStorage.setItem(`${customTokenKey}_backup`, JSON.stringify(sessionBackup));

                console.log('✅ Token migrated to custom storage key');

                // Trigger a session reload
                window.dispatchEvent(new CustomEvent('authSessionMigrated', {
                    detail: { session: tokenData }
                }));
            }
        } catch (error) {
            console.error('❌ Error parsing Supabase token:', error);
        }
    }

    // Override the CustomStorage methods to handle both keys
    if (window.CustomStorage && window.CustomStorage.prototype) {
        const originalGetItem = window.CustomStorage.prototype.getItem;
        const originalSetItem = window.CustomStorage.prototype.setItem;

        window.CustomStorage.prototype.getItem = function(key) {
            // First try the custom key
            let result = originalGetItem.call(this, key);

            // If not found and it's the auth key, try the Supabase key
            if (!result && key === customTokenKey) {
                result = localStorage.getItem(supabaseTokenKey);
                if (result) {
                    console.log('✅ Retrieved auth token from Supabase storage key');
                }
            }

            return result;
        };

        window.CustomStorage.prototype.setItem = function(key, value) {
            // Save to both keys if it's the auth token
            const result = originalSetItem.call(this, key, value);

            if (key === customTokenKey) {
                localStorage.setItem(supabaseTokenKey, value);
                console.log('✅ Auth token saved to both storage keys');
            }

            return result;
        };
    }

    console.log('✅ Auth storage fix applied');
})();

// Add a function to check and fix auth state
window.fixAuthState = async function() {
    console.log('🔧 Checking auth state...');

    const supabaseTokenKey = 'sb-ukdmlzuxgnjucwidsygj-auth-token';
    const token = localStorage.getItem(supabaseTokenKey);

    if (token) {
        try {
            const tokenData = JSON.parse(token);

            // Check if token is still valid
            if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
                console.log('✅ Valid token found, restoring session...');

                // Trigger auth state change
                if (window.supabase) {
                    await window.supabase.auth.setSession(tokenData);
                    console.log('✅ Session restored successfully');
                    return true;
                }
            } else {
                console.log('⚠️ Token expired, clearing...');
                localStorage.removeItem(supabaseTokenKey);
                localStorage.removeItem('plaas-hoenders-auth');
            }
        } catch (error) {
            console.error('❌ Error checking auth state:', error);
        }
    }

    return false;
};

// Auto-fix on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for Supabase to initialize
    setTimeout(async () => {
        const fixed = await window.fixAuthState();
        if (fixed) {
            // Reload the page to apply the fixed session
            window.location.reload();
        }
    }, 1000);
});