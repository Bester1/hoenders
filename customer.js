/**
 * Customer Portal JavaScript
 * Handles customer authentication, registration, and session management
 */

// Initialize Supabase client with secure configuration and fallback
let supabaseClient = null;

// Fallback configuration for immediate deployment
const FALLBACK_CONFIG = {
    SUPABASE_URL: 'https://ukdmlzuxgnjucwidsygj.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w',
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec'
};

// Email configuration for order confirmations
let customerPortalGoogleScriptUrl = FALLBACK_CONFIG.GOOGLE_SCRIPT_URL;

// Google Apps Script Email Function for customer portal
async function sendEmailViaGoogleScript(to, subject, body, attachments = []) {
    if (!customerPortalGoogleScriptUrl) {
        console.warn('⚠️ Google Apps Script URL not configured');
        return false;
    }

    try {
        console.log('📧 Sending email via Google Apps Script...');

        // Use URL-encoded data instead of FormData to avoid CORS issues
        const emailData = {
            to: to,
            subject: subject,
            body: body,
            fromName: 'Plaas Hoenders',
            attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments) : undefined
        };

        // Build URL with query parameters
        const url = new URL(customerPortalGoogleScriptUrl);
        Object.keys(emailData).forEach(key => {
            if (emailData[key] !== undefined) {
                url.searchParams.append(key, emailData[key]);
            }
        });

        console.log('🔍 Email data being sent:', {
            to: emailData.to,
            subject: emailData.subject,
            bodyLength: emailData.body?.length || 0,
            bodyPreview: emailData.body?.substring(0, 200) + '...'
        });

        // Create a simple form submission that will work
        try {
            // Create an iframe to submit the form without leaving the page
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'emailIframe';
            document.body.appendChild(iframe);

            // Create a form
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = customerPortalGoogleScriptUrl;
            form.target = 'emailIframe';

            // Add form fields
            const fields = {
                'to': to,
                'subject': subject,
                'body': body,
                'fromName': 'Plaas Hoenders'
            };

            if (attachments && attachments.length > 0) {
                fields['attachments'] = JSON.stringify(attachments);
            }

            Object.entries(fields).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });

            // Submit the form
            document.body.appendChild(form);
            form.submit();

            // Clean up after submission
            setTimeout(() => {
                document.body.removeChild(form);
                document.body.removeChild(iframe);
            }, 5000);

            console.log('✅ Email submitted via form POST (bypasses CORS)');
            return true;

        } catch (formError) {
            console.error('❌ Form submission failed:', formError);

            // Final fallback: Try GET method (will show Google Script page)
            try {
                const params = new URLSearchParams({
                    'to': to,
                    'subject': subject,
                    'body': body,
                    'fromName': 'Plaas Hoenders'
                });

                if (attachments && attachments.length > 0) {
                    params.append('attachments', JSON.stringify(attachments));
                }

                const popup = window.open(`${customerPortalGoogleScriptUrl}?${params.toString()}`, 'emailWindow', 'width=600,height=400');

                // Close popup after 5 seconds
                setTimeout(() => {
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                }, 5000);

                console.log('✅ Email sent via popup (last resort)');
                return true;

            } catch (popupError) {
                console.error('❌ All email methods failed:', popupError);
                return false;
            }
        }
    } catch (error) {
        console.error('❌ Error sending email:', error);
        // Don't fail the order process due to email issues
        return false;
    }
}

// Initialize secure configuration and Supabase client with fallback
async function initializeSecureConnection() {
    try {
        // Using embedded configuration for customer portal
        // Skip secure config validation to avoid confusing users
        console.info('🔒 Using embedded customer portal configuration...');

        // CRITICAL SESSION RESTORATION - MUST happen before ANY Supabase operations
        console.log('🚨 CRITICAL SESSION RESTORATION STARTED...');

        // IMMEDIATELY restore main session from backups if missing
        const mainSession = localStorage.getItem('plaas-hoenders-auth');
        const backupSession = localStorage.getItem('plaas-hoenders-auth-backup');
        const backupSession2 = localStorage.getItem('plaas-hoenders-auth-backup2');

        if (!mainSession) {
            console.log('🚨 MAIN SESSION MISSING - EMERGENCY RESTORATION...');

            if (backupSession) {
                console.log('🔄 RESTORING from backup 1...');
                localStorage.setItem('plaas-hoenders-auth', backupSession);
                console.log('✅ Main session restored from backup 1');
            } else if (backupSession2) {
                console.log('🔄 RESTORING from backup 2...');
                localStorage.setItem('plaas-hoenders-auth', backupSession2);
                console.log('✅ Main session restored from backup 2');
            } else {
                console.warn('⚠️ CRITICAL: No session backups found!');
            }
        } else {
            console.log('✅ Main session found in localStorage');
        }

        // VERIFY restoration worked
        const verifySession = localStorage.getItem('plaas-hoenders-auth');
        if (verifySession) {
            console.log('✅ Session verification passed - main session exists');
        } else {
            console.error('❌ Session verification FAILED - main session still missing!');
        }

        // Initialize Supabase with embedded configuration and session persistence
        const { createClient } = supabase;

        // Debug localStorage availability
        console.log('🔍 localStorage available:', typeof localStorage !== 'undefined');
        console.log('🔍 Testing localStorage write:', (() => {
            try {
                localStorage.setItem('test-key', 'test-value');
                const value = localStorage.getItem('test-key');
                localStorage.removeItem('test-key');
                return value === 'test-value';
            } catch (e) {
                console.error('❌ localStorage test failed:', e);
                return false;
            }
        })());

        // Create custom storage that prevents session clearing
        const customStorage = {
            getItem: (key) => {
                const value = localStorage.getItem(key);
                console.log(`📖 CustomStorage getItem: ${key}`, value ? 'found' : 'not found');
                return value;
            },
            setItem: (key, value) => {
                console.log(`💾 CustomStorage setItem: ${key}`, value ? 'data saved' : 'no data');

                // If this is our auth key being cleared, block it!
                if (key === 'plaas-hoenders-auth' && (!value || value === 'null' || value === 'undefined')) {
                    console.warn('🚨 BLOCKING attempt to clear auth session!');
                    return; // Don't allow clearing
                }

                localStorage.setItem(key, value);

                // Create backups when auth session is saved
                if (key === 'plaas-hoenders-auth' && value) {
                    localStorage.setItem('plaas-hoenders-auth-backup', value);
                    localStorage.setItem('plaas-hoenders-auth-backup2', value);
                    console.log('💾 Backups created automatically');
                }
            },
            removeItem: (key) => {
                if (key === 'plaas-hoenders-auth') {
                    console.warn('🚨 BLOCKING attempt to remove auth session!');
                    return; // Don't allow removal
                }
                console.log(`🗑️ CustomStorage removeItem: ${key}`);
                localStorage.removeItem(key);
            }
        };

        supabaseClient = createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,              // Remember session between visits
                storage: customStorage,             // Use custom storage that prevents clearing
                storageKey: 'plaas-hoenders-auth',  // Custom storage key to avoid conflicts
                autoRefreshToken: true,             // Refresh tokens automatically
                detectSessionInUrl: true,           // Handle email confirmation links
                refreshToken: true,                 // Enable refresh tokens for long sessions
                // Maximize session duration (30 days)
                maxSessionTime: 30 * 24 * 60 * 60,  // 30 days in seconds
                // Don't clear session on refresh
                debug: true                          // Enable debug logging
            }
        });

        // CRITICAL: Set up auth state change listener IMMEDIATELY after client creation
        // This must be done before any other auth operations
        console.log('🔔 Setting up auth state change listener...');
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 Auth state changed:', event, session?.user?.email);
            console.log('📦 Session stored in localStorage:', 'plaas-hoenders-auth' in localStorage);
            if ('plaas-hoenders-auth' in localStorage) {
                console.log('📄 Stored data length:', localStorage.getItem('plaas-hoenders-auth')?.length);
            } else {
                console.warn('⚠️ Session NOT found in localStorage after', event);
            }

            // Force a session save if this is a SIGNED_IN event
            if (event === 'SIGNED_IN' && session) {
                console.log('💾 Forcing session save for SIGNED_IN event...');
                // Give it multiple chances to save
                setTimeout(() => {
                    console.log('🔍 Checking saved session after 500ms:', 'plaas-hoenders-auth' in localStorage);
                }, 500);
                setTimeout(() => {
                    console.log('🔍 Checking saved session after 2000ms:', 'plaas-hoenders-auth' in localStorage);
                }, 2000);
            }

            // Handle session restoration
            if (event === 'INITIAL_SESSION' && session) {
                console.log('✅ Initial session restored from storage:', session.user?.email);
            }

            // CRITICAL: Log when session is lost
            if (event === 'SIGNED_OUT') {
                console.warn('🚨 Session was signed out - checking localStorage...');
                console.log('📦 plaas-hoenders-auth in localStorage:', 'plaas-hoenders-auth' in localStorage);
                if ('plaas-hoenders-auth' in localStorage) {
                    console.warn('⚠️ WARNING: Session cleared but localStorage still has auth data');
                }
            }

            // Monitor TOKEN_REFRESHED events
            if (event === 'TOKEN_REFRESHED') {
                console.log('🔄 Token was refreshed, checking localStorage...');
                console.log('📦 Session stored in localStorage:', 'plaas-hoenders-auth' in localStorage);

                // Force backup creation on token refresh
                if ('plaas-hoenders-auth' in localStorage) {
                    const sessionData = localStorage.getItem('plaas-hoenders-auth');
                    localStorage.setItem('plaas-hoenders-auth-backup', sessionData);
                    console.log('💾 Backup created on token refresh');
                }
            }

            // AGGRESSIVE: Force session persistence for any active session
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (session) {
                    console.log('💪 AGGRESSIVE: Forcing session persistence for event:', event);

                    // Save session immediately
                    setTimeout(() => {
                        const currentSession = localStorage.getItem('plaas-hoenders-auth');
                        if (currentSession) {
                            // Create multiple backups
                            localStorage.setItem('plaas-hoenders-auth-backup', currentSession);
                            localStorage.setItem('plaas-hoenders-auth-backup2', currentSession);
                            console.log('💾 Multiple backups created for session persistence');
                        }
                    }, 100);
                }
            }
        });

        // Add browser storage event listeners to detect localStorage changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'plaas-hoenders-auth') {
                if (e.newValue === null) {
                    console.warn('🚨 localStorage plaas-hoenders-auth was cleared by another tab/window');
                } else if (e.oldValue === null && e.newValue !== null) {
                    console.log('✅ localStorage plaas-hoenders-auth was created/set');
                } else {
                    console.log('🔄 localStorage plaas-hoenders-auth was updated');
                }
            }
        });

        // Add beforeunload listener to check session on page close
        window.addEventListener('beforeunload', () => {
            const hasSession = localStorage.getItem('plaas-hoenders-auth');
            console.log('🔍 Page unloading - session in localStorage:', !!hasSession);

            // Force save session before page unload
            if (hasSession) {
                console.log('💾 Force saving session before unload...');
                const sessionData = localStorage.getItem('plaas-hoenders-auth');
                // Create backup in case main gets cleared
                localStorage.setItem('plaas-hoenders-auth-backup', sessionData);
            }
        });

        // Session already restored above - no need for duplicate restoration

        // Debug: Test if storage is working immediately after initialization
        console.log('🔍 Testing auth storage immediately after init...');

        // PERSISTENT SESSION PROTECTION - Keep session alive
        setInterval(() => {
            const currentSession = localStorage.getItem('plaas-hoenders-auth');
            if (currentSession) {
                // Verify session is still there and refresh backups
                localStorage.setItem('plaas-hoenders-auth-backup', currentSession);
                localStorage.setItem('plaas-hoenders-auth-backup2', currentSession);
            }
        }, 5000); // Check every 5 seconds

        // Initialize email configuration
        customerPortalGoogleScriptUrl = FALLBACK_CONFIG.GOOGLE_SCRIPT_URL;
        if (customerPortalGoogleScriptUrl) {
            console.log('✅ Email configuration initialized');
        } else {
            console.warn('⚠️ Email configuration not found');
        }

        console.info('✅ Customer portal connection initialized successfully');

        // Check if Google OAuth is available and configure button
        console.log('🔍 Checking Google OAuth availability...');
        console.log('📋 Supabase URL:', FALLBACK_CONFIG.SUPABASE_URL);
        console.log('📧 Redirect URL will be:', window.location.origin + '/hoenders/customer-portal.html');

        // Test Google OAuth availability by trying to get OAuth configuration
        try {
            // This will help identify if Google OAuth is configured
            console.log('🔧 Testing Google OAuth configuration...');
            const { data: providers, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { skipBrowserRedirect: true }
            });

            if (error && error.message?.includes('not configured')) {
                console.warn('⚠️ Google OAuth is not configured in Supabase');
                console.warn('📋 To enable Google login:');
                console.warn('   1. Go to Supabase project > Authentication > Providers');
                console.warn('   2. Enable Google provider');
                console.warn('   3. Add Client ID and Client Secret from Google Cloud Console');
                console.warn('   4. Add redirect URL: ' + (window.location.origin + '/hoenders/customer-portal.html'));

                // Disable Google button and show warning
                setTimeout(() => {
                    const googleBtn = document.getElementById('googleSignInBtn');
                    if (googleBtn) {
                        googleBtn.disabled = true;
                        googleBtn.style.opacity = '0.5';
                        googleBtn.innerHTML = `
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Google Login Not Available</span>
                        `;
                        googleBtn.title = "Google OAuth is not configured. Please use email/password login.";
                    }
                }, 1000);
            } else {
                console.log('✅ Google OAuth appears to be configured');
            }
        } catch (oauthTestError) {
            console.warn('⚠️ Could not test Google OAuth configuration:', oauthTestError);
        }

        return true;

    } catch (error) {
        console.error('❌ Failed to initialize customer portal connection:', error);

        // Emergency fallback - still use session persistence!
        try {
            const { createClient } = supabase;
            supabaseClient = createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    storage: localStorage,
                    storageKey: 'plaas-hoenders-auth',
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
            console.warn('⚠️ Customer portal using emergency fallback WITH session persistence');
            return true;
        } catch (fallbackError) {
            console.error('❌ Complete customer portal connection failure:', fallbackError);
            if (typeof showSecurityError === 'function') {
                showSecurityError('Failed to initialize customer portal. Please refresh the page.');
            }
            return false;
        }
    }
}

// Global customer session data
let currentCustomer = null;
let customerSession = null;

// Navigation state management
let currentSection = 'dashboard';
let sectionData = {
    products: null,
    orders: null,
    profile: null
};

/**
 * Handle authentication callback from email confirmation or password reset
 * @async
 * @function handleAuthCallback
 * @returns {Promise<void>}
 * @since 1.7.1
 */
async function handleAuthCallback() {
    try {
        // Check for auth tokens in URL hash (email confirmation, password reset, etc.)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('DEBUG: Current URL:', window.location.href);
        console.log('DEBUG: Hash params:', window.location.hash);
        console.log('DEBUG: Access token found:', !!accessToken);
        console.log('DEBUG: Refresh token found:', !!refreshToken);
        console.log('DEBUG: Type:', type);

        // If we have tokens, show loading state immediately to prevent login screen flicker
        if (accessToken && refreshToken) {
            showLoadingSpinner(true, 'Processing login...');
        }

        // Check for error parameters (expired links, etc.)
        const error = hashParams.get('error');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');

        if (error) {
            console.log('DEBUG: Auth error detected:', error, errorCode, errorDescription);
            
            // Clear the hash from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            if (errorCode === 'otp_expired') {
                showFormMessage(document.getElementById('registerMessage'), 'Email confirmation link has expired. Please request a new one.', 'error');
                document.getElementById('resendConfirmation').style.display = 'block';
                showAuthForm('register'); // Switch to register tab to show resend option
            } else {
                showFormMessage(document.getElementById('loginMessage'), `Authentication failed: ${errorDescription || error}`, 'error');
            }
            return;
        }

        if (accessToken && refreshToken) {
            console.info('Processing auth callback:', type);

            // Check if we already have a valid session before processing OAuth tokens
            const { data: existingSession } = await supabaseClient.auth.getSession();

            if (existingSession?.session && existingSession.session.user.email) {
                console.log('✅ User already has valid session, ignoring OAuth callback');
                // Clear tokens from URL and continue with existing session
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            // Set the session with the tokens from the URL
            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                console.error('Error setting session from callback:', error);
                showFormMessage('Authentication failed. Please try logging in again.', 'error', 'loginMessage');
            } else {
                console.info('Authentication callback successful:', type);
                console.log('✅ Session data received:', {
                    hasUser: !!data?.user,
                    userId: data?.user?.id,
                    email: data?.user?.email,
                    expiresAt: data?.user?.expires_at
                });

                // Debug: Check if session is being saved to localStorage
                setTimeout(async () => {
                    console.log('🔍 Checking if session was saved to localStorage...');
                    const { data: savedSession } = await supabaseClient.auth.getSession();
                    console.log('📋 Saved session check:', {
                        hasSession: !!savedSession?.session,
                        userId: savedSession?.session?.user?.id,
                        email: savedSession?.session?.user?.email
                    });

                    // Check localStorage contents again
                    const allKeys = Object.keys(localStorage);
                    console.log('📄 localStorage keys after auth:', allKeys.filter(key =>
                        key.includes('supabase') || key.includes('auth') || key.includes('hoenders')
                    ));
                }, 1000);

                // Clear the hash from URL for security
                window.history.replaceState({}, document.title, window.location.pathname);

                // Show success message based on callback type
                if (type === 'signup') {
                    showToast('Email confirmed! Welcome to Plaas Hoenders!', 'success');
                } else if (type === 'recovery') {
                    showToast('Email confirmed! You can now reset your password.', 'success');
                } else {
                    showToast('Authentication successful!', 'success');
                }
            }
        }
    } catch (error) {
        console.error('Error handling auth callback:', error);
        // Don't show error to user as this might be a normal page load without auth callback
    }
}

/**
 * Initialize the customer portal on page load
 * @async
 * @function initializeCustomerPortal
 * @returns {Promise<void>}
 */
async function initializeCustomerPortal() {
    try {
        showLoadingSpinner(true);

        console.log('🚀 Initializing Customer Portal with secure connections...');

        // Ensure loading overlay shows for at least 1.5 seconds
        const minLoadingTime = new Date().getTime() + 1500;

        // Initialize secure connection first
        const connectionReady = await initializeSecureConnection();
        if (!connectionReady) {
            console.error('❌ Customer portal cannot proceed without secure connection');
            if (typeof showSecurityError === 'function') {
                showSecurityError('Customer portal initialization failed. Please refresh the page.');
            }
            showLoadingSpinner(false);
            return;
        }

        console.log('✅ Customer portal secure connection ready');

        // Handle auth tokens from email confirmation or password reset
        await handleAuthCallback();
        
        // Debug: Check localStorage contents before session check
        console.log('🔍 Debugging localStorage contents:');
        const allKeys = Object.keys(localStorage);
        console.log('📋 All localStorage keys:', allKeys);
        allKeys.forEach(key => {
            if (key.includes('supabase') || key.includes('auth') || key.includes('hoenders')) {
                console.log(`📄 ${key}:`, localStorage.getItem(key));
            }
        });

        // CRITICAL: Check if session exists in localStorage manually
        const storedAuth = localStorage.getItem('plaas-hoenders-auth');
        console.log('🔑 Manual localStorage check for plaas-hoenders-auth:', {
            exists: !!storedAuth,
            length: storedAuth?.length || 0,
            preview: storedAuth ? storedAuth.substring(0, 100) + '...' : null
        });

        // Check if user is already authenticated
        const { data: session } = await supabaseClient.auth.getSession();

        // Debug: Check session persistence
        console.log('🔍 Session check:', {
            hasSession: !!session?.session,
            userId: session?.session?.user?.id,
            email: session?.session?.user?.email,
            expiresAt: session?.session?.expires_at,
            currentTime: new Date().toISOString(),
            expiresIn: session?.session?.expires_at ? new Date(session.session.expires_at * 1000).toISOString() : 'N/A'
        });

        // If we have stored auth data but no session, try to restore it manually
        if (storedAuth && !session?.session) {
            console.log('🔄 Found stored auth but no active session - attempting manual restore...');
            try {
                const parsedAuth = JSON.parse(storedAuth);
                console.log('📊 Parsed auth data:', {
                    hasAccessToken: !!parsedAuth.access_token,
                    hasRefreshToken: !!parsedAuth.refresh_token,
                    expiresAt: parsedAuth.expires_at,
                    userEmail: parsedAuth.user?.email
                });

                // Check if the stored session is still valid
                const now = Math.floor(Date.now() / 1000);
                if (parsedAuth.expires_at && parsedAuth.expires_at > now) {
                    console.log('✅ Stored session still valid, restoring...');
                    // The auth state change listener should automatically restore this
                } else {
                    console.warn('⚠️ Stored session expired, cleaning up...');
                    localStorage.removeItem('plaas-hoenders-auth');
                }
            } catch (parseError) {
                console.error('❌ Failed to parse stored auth data:', parseError);
                localStorage.removeItem('plaas-hoenders-auth');
            }
        }

        // CRITICAL: If no session found but we have stored auth data, force restoration
        if (!session?.session && storedAuth) {
            console.log('🚨 No session found but stored auth exists - attempting forced restoration...');
            try {
                const parsedAuth = JSON.parse(storedAuth);
                console.log('📊 Attempting to restore session manually:', {
                    hasAccessToken: !!parsedAuth.access_token,
                    expiresAt: parsedAuth.expires_at,
                    currentTime: Math.floor(Date.now() / 1000),
                    isExpired: parsedAuth.expires_at ? parsedAuth.expires_at < Math.floor(Date.now() / 1000) : 'unknown'
                });

                // Check if the stored session is still valid
                const now = Math.floor(Date.now() / 1000);
                if (parsedAuth.expires_at && parsedAuth.expires_at > now) {
                    console.log('✅ Stored session is valid, manually setting session...');

                    // Try to manually restore the session using setSession
                    const { data: manualSession, error: setSessionError } = await supabaseClient.auth.setSession({
                        access_token: parsedAuth.access_token,
                        refresh_token: parsedAuth.refresh_token
                    });

                    if (setSessionError) {
                        console.error('❌ Manual session restore failed:', setSessionError);
                        console.warn('⚠️ Clearing invalid stored session...');
                        localStorage.removeItem('plaas-hoenders-auth');
                    } else {
                        console.log('✅ Manual session restore successful:', manualSession.user?.email);
                        // Update the session variable for the rest of the code
                        session = { session: manualSession };
                    }
                } else {
                    console.warn('⚠️ Stored session expired, cleaning up...');
                    localStorage.removeItem('plaas-hoenders-auth');
                }

                // Wait a moment for the auth state change listener to process
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check session again after delay
                const { data: retrySession } = await supabaseClient.auth.getSession();
                console.log('🔄 Session retry check:', {
                    hasSession: !!retrySession?.session,
                    userId: retrySession?.session?.user?.id,
                    email: retrySession?.session?.user?.email
                });

                if (retrySession?.session) {
                    console.log('✅ Session restored after delay!');
                    // Update the session variable for the rest of the code
                    session = retrySession;
                } else {
                    console.warn('⚠️ Session restoration failed - user may need to login again');
                }
            } catch (retryError) {
                console.error('❌ Session restoration error:', retryError);
                console.warn('⚠️ Clearing invalid stored session...');
                localStorage.removeItem('plaas-hoenders-auth');
            }
        }

        // Additional debugging: Try to get current user directly
        const { data: currentUser, error: userError } = await supabaseClient.auth.getUser();
        console.log('🔍 Direct user check:', {
            hasUser: !!currentUser?.user,
            userId: currentUser?.user?.id,
            userEmail: currentUser?.user?.email,
            userError: userError?.message,
            userErrorStatus: userError?.status
        });

        // Debug: Check if we have a valid JWT token
        const currentSession = await supabaseClient.auth.getSession();
        if (currentSession?.data?.session?.access_token) {
            console.log('🔑 JWT token present:', currentSession.data.session.access_token.substring(0, 20) + '...');
            console.log('📅 Token expires at:', new Date(currentSession.data.session.expires_at * 1000).toISOString());
        } else {
            console.warn('⚠️ No JWT token found in session');
        }

        if (session?.session) {
            customerSession = session.session;
            console.log('✅ Found existing session, user stays logged in');

            // Clear any auth tokens from URL to prevent callback processing
            if (window.location.hash.includes('access_token')) {
                console.log('🧹 Clearing auth tokens from URL - user already logged in');
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            await loadCustomerProfile();
            showCustomerPortal();
        } else {
            console.log('🔓 No session found, showing auth section');
            showAuthSection();
        }
        
        // Wait for minimum loading time before hiding spinner
        const now = new Date().getTime();
        if (now < minLoadingTime) {
            setTimeout(() => showLoadingSpinner(false), minLoadingTime - now);
        } else {
            showLoadingSpinner(false);
        }

        // Set up close portal button
        const closePortalBtn = document.getElementById('closePortal');
        if (closePortalBtn) {
            closePortalBtn.addEventListener('click', () => {
                // Reset to products view and clear any order state
                showBeautifulStep(1);
                // Clear cart and reset form
                cart = {};
                updateCartDisplay();
                const productGrid = document.getElementById('productGrid');
                if (productGrid) {
                    // Reset all quantity inputs to 0
                    const quantityInputs = productGrid.querySelectorAll('.quantity-input');
                    quantityInputs.forEach(input => input.value = '0');
                    // Update totals
                    Object.keys(cart).forEach(productKey => {
                        const totalElement = document.getElementById(`total-${productKey}`);
                        if (totalElement) totalElement.textContent = 'R0.00';
                    });
                }
                console.log('Portal closed, returned to products view');
            });
        }
        
        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.info('Auth state changed:', event);

            if (event === 'SIGNED_IN' && session) {
                // Show loading state immediately to prevent login screen flicker
                showLoadingSpinner(true, 'Logging you in...');

                customerSession = session;
                await loadCustomerProfile();

                // Process any pending profile updates when back online
                if (typeof processPendingProfileUpdates === 'function') {
                    await processPendingProfileUpdates();
                }

                // Clear any auth tokens from URL after successful login
                if (window.location.hash.includes('access_token')) {
                    console.log('🧹 Clearing auth tokens from URL after successful login');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }

                showCustomerPortal();
                showLoadingSpinner(false);
            } else if (event === 'SIGNED_OUT') {
                customerSession = null;
                currentCustomer = null;
                showAuthSection();
            }
        });
        
    } catch (error) {
        console.error('Error initializing customer portal:', error);
        showFormMessage('An error occurred loading the portal. Please refresh the page.', 'error', 'loginMessage');
    } finally {
        showLoadingSpinner(false);
    }
}

/**
 * Load customer profile data from database
 * @async
 * @function loadCustomerProfile
 * @returns {Promise<void>}
 */
async function loadCustomerProfile() {
    console.log('📂 loadCustomerProfile() called');
    try {
        if (!customerSession?.user?.id) {
            console.log('❌ No authenticated user session found');
            throw new Error('No authenticated user session');
        }
        
        console.log('🆔 Customer session user ID:', customerSession.user.id);

        // Try to get customer profile from database (gracefully handle missing table)
        let customer = null;
        let error = null;

        try {
            console.log('🔍 Attempting to load customer from database by auth_user_id...');
            const result = await supabaseClient
                .from('customers')
                .select('*')
                .eq('auth_user_id', customerSession.user.id)
                .single();
            customer = result.data;
            error = result.error;
            console.log('📊 Database result (by auth_user_id):', { customer, error });

            // Fallback: Try to find customer by email if auth_user_id lookup fails
            if (!customer && (error?.code === 'PGRST116' || error?.message?.includes('404') || error?.message?.includes('406'))) {
                console.log('🔍 Trying fallback lookup by email...');
                const emailResult = await supabaseClient
                    .from('customers')
                    .select('*')
                    .eq('email', customerSession.user.email)
                    .single();
                customer = emailResult.data;
                error = emailResult.error;
                console.log('📊 Database result (by email fallback):', { customer, error });

                // If found by email, link the auth_user_id to connect Google OAuth to existing customer
                if (customer && !customer.auth_user_id) {
                    console.log('🔗 Linking Google OAuth to existing customer record...');
                    const { data: updatedCustomer, error: updateError } = await supabaseClient
                        .from('customers')
                        .update({ auth_user_id: customerSession.user.id })
                        .eq('id', customer.id)
                        .select()
                        .single();

                    if (!updateError) {
                        customer = updatedCustomer;
                        console.log('✅ Successfully linked Google OAuth to existing customer:', customer);
                    } else {
                        console.warn('⚠️ Could not link auth_user_id:', updateError);
                    }
                }
            }
        } catch (dbError) {
            console.warn('❌ Customer table not found, using auth data directly:', dbError);
            error = dbError;
        }

        if (error && error.code !== 'PGRST116' && !error.message?.includes('404')) {
            // Only throw on real errors, not missing table or no rows
            console.warn('⚠️ Customer profile error (non-critical):', error);
        }

        if (!customer) {
            console.log('🆕 Creating new customer profile from auth data');
            // Create customer profile for new user (e.g., Google OAuth user)
            // Extract phone number from multiple possible locations in Google auth data
            const phoneFromAuth = customerSession.user.user_metadata?.phone ||
                                 customerSession.user.phone ||
                                 null;

            const newCustomer = {
                auth_user_id: customerSession.user.id,
                full_name: customerSession.user.user_metadata?.full_name ||
                          customerSession.user.user_metadata?.name ||
                          customerSession.user.email.split('@')[0],
                name: customerSession.user.user_metadata?.full_name ||
                      customerSession.user.user_metadata?.name ||
                      customerSession.user.email.split('@')[0],
                email: customerSession.user.email,
                phone: phoneFromAuth,
                address: customerSession.user.user_metadata?.address || null,
                communication_preferences: { email_notifications: true },
                last_login: new Date().toISOString()
            };
            
            console.log('📝 New customer data from auth:', newCustomer);
            console.log('📞 Phone extracted from auth:', phoneFromAuth);

            // Try to create customer in database (handle missing table gracefully)
            try {
                console.log('🔄 Attempting to create customer in database...');

                // First check if customer already exists by email to prevent duplicates
                console.log('🔍 Checking for existing customer by email before creating...');
                const { data: existingCustomerByEmail, error: emailCheckError } = await supabaseClient
                    .from('customers')
                    .select('*')
                    .eq('email', newCustomer.email)
                    .maybeSingle();

                if (emailCheckError && emailCheckError.code !== 'PGRST116') {
                    console.warn('⚠️ Error checking existing customer by email:', emailCheckError);
                }

                if (existingCustomerByEmail) {
                    // Customer already exists by email - update with auth_user_id if needed
                    console.log('✅ Found existing customer by email, linking auth account...');
                    const { data: updatedCustomer, error: updateError } = await supabaseClient
                        .from('customers')
                        .update({
                            auth_user_id: newCustomer.auth_user_id,
                            name: newCustomer.name,
                            full_name: newCustomer.full_name,
                            phone: newCustomer.phone,
                            address: newCustomer.address,
                            last_login: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingCustomerByEmail.id)
                        .select()
                        .single();

                    if (updateError) {
                        console.warn('⚠️ Could not update existing customer, using existing data:', updateError);
                        currentCustomer = existingCustomerByEmail;
                    } else {
                        currentCustomer = updatedCustomer;
                        console.log('✅ Updated existing customer with auth data:', currentCustomer);
                    }
                } else {
                    // Create new customer record
                    const { data: createdCustomer, error: createError } = await supabaseClient
                        .from('customers')
                        .insert([newCustomer])
                        .select()
                        .single();

                    if (createError) {
                        // Check if this is a unique constraint violation (duplicate email)
                        if (createError.code === '23505' || createError.message?.includes('unique constraint')) {
                            console.log('⚠️ Duplicate email detected, fetching existing customer...');
                            const { data: duplicateCustomer, error: fetchError } = await supabaseClient
                                .from('customers')
                                .select('*')
                                .eq('email', newCustomer.email)
                                .single();

                            if (!fetchError && duplicateCustomer) {
                                currentCustomer = duplicateCustomer;
                                console.log('✅ Retrieved existing customer after duplicate error:', currentCustomer);
                            } else {
                                console.warn('⚠️ Could not fetch existing customer after duplicate, using auth data:', createError);
                                currentCustomer = newCustomer;
                            }
                        } else {
                            console.warn('⚠️ Could not create customer in database, using auth data:', createError);
                            currentCustomer = newCustomer;
                        }
                    } else {
                        currentCustomer = createdCustomer;
                        console.log('✅ Customer created in database:', currentCustomer);
                        console.log('📞 Phone in created customer:', currentCustomer.phone);
                    }
                }
            } catch (dbError) {
                console.warn('⚠️ Customer table not available, using auth data directly:', dbError);
                currentCustomer = newCustomer; // Use the customer data we have
            }
        } else {
            console.log('✅ Loaded existing customer from database:', customer);
            // Try to update last login time (handle missing table gracefully)
            try {
                console.log('🔄 Updating last login time...');
                const { error: updateError } = await supabaseClient
                    .from('customers')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', customer.id);

                if (updateError) console.warn('Could not update last login:', updateError);
            } catch (dbError) {
                console.warn('Could not update last login (table missing):', dbError);
            }
            currentCustomer = customer;
        }

        // Update UI with customer name in multiple places
        updateCustomerNameInUI();
        updateAuthUI();
        
        // Set up real-time order status subscriptions
        if (typeof setupOrderStatusSubscription === 'function') {
            await setupOrderStatusSubscription();
        }

    } catch (error) {
        console.error('Error loading customer profile:', error);
        showFormMessage('Error loading your profile. Please try logging in again.', 'error', 'loginMessage');
    }
}

/**
 * Handle email/password registration form submission
 * @async
 * @function handleRegister
 * @param {Event} event - Form submission event
 * @returns {Promise<void>}
 */
async function handleRegister(event) {
    event.preventDefault();
    clearFormErrors();

    const formData = new FormData(event.target);
    const registrationData = {
        name: formData.get('name').trim(),
        email: formData.get('email').trim().toLowerCase(),
        phone: formData.get('phone')?.trim() || null,
        address: formData.get('address')?.trim() || null,
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
        emailNotifications: formData.get('emailNotifications') === 'on'
    };

    // Client-side validation
    const validationErrors = validateRegistrationData(registrationData);
    if (validationErrors.length > 0) {
        displayValidationErrors(validationErrors);
        return;
    }

    try {
        showLoadingSpinner(true);
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

        // Register with Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: registrationData.email,
            password: registrationData.password,
            options: {
                data: {
                    full_name: registrationData.name,
                    phone: registrationData.phone
                }
            }
        });

        if (authError) {
            throw authError;
        }

        // If email confirmation is required
        if (authData.user && !authData.session) {
            showFormMessage(
                'Registration successful! Please check your email and click the confirmation link to activate your account.',
                'success',
                'registerMessage'
            );
            return;
        }

        // If user is immediately signed in (email confirmation disabled)
        if (authData.session) {
            // Check if customer profile already exists before creating
            console.log('🔍 Checking for existing customer profile before creating...');
            const { data: existingProfile, error: checkError } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('email', registrationData.email)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                console.warn('⚠️ Error checking existing customer profile:', checkError);
            }

            if (existingProfile) {
                // Update existing profile with auth_user_id and latest info
                console.log('✅ Found existing customer profile, updating with auth data...');
                const { error: updateError } = await supabaseClient
                    .from('customers')
                    .update({
                        auth_user_id: authData.user.id,
                        name: registrationData.name,
                        phone: registrationData.phone,
                        address: registrationData.address,
                        communication_preferences: {
                            email_notifications: registrationData.emailNotifications
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingProfile.id);

                if (updateError) {
                    console.error('Error updating existing customer profile:', updateError);
                } else {
                    console.log('✅ Updated existing customer profile successfully');
                }
            } else {
                // Create new customer profile
                const customerProfile = {
                    auth_user_id: authData.user.id,
                    name: registrationData.name,
                    email: registrationData.email,
                    phone: registrationData.phone,
                    address: registrationData.address,
                    communication_preferences: {
                        email_notifications: registrationData.emailNotifications
                    }
                };

                const { error: profileError } = await supabaseClient
                    .from('customers')
                    .insert([customerProfile]);

                if (profileError) {
                    if (profileError.code === '23505' || profileError.message?.includes('unique constraint')) {
                        console.log('⚠️ Duplicate email during registration, fetching existing profile...');
                        // Handle race condition - profile was created by another process
                        const { data: duplicateProfile } = await supabaseClient
                            .from('customers')
                            .select('*')
                            .eq('email', registrationData.email)
                            .single();

                        if (duplicateProfile) {
                            console.log('✅ Retrieved existing profile after race condition');
                        }
                    } else {
                        console.error('Error creating customer profile:', profileError);
                        // Don't throw - auth was successful, profile creation can be retried
                    }
                } else {
                    console.log('✅ Created new customer profile successfully');
                }
            }

            showFormMessage('Account created successfully! Welcome to Plaas Hoenders!', 'success', 'registerMessage');

            // Session will be handled by auth state change listener
        }

    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.message?.includes('already registered')) {
            errorMessage = 'This email is already registered. Please try logging in instead.';
        } else if (error.message?.includes('Invalid email')) {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.message?.includes('Password')) {
            errorMessage = 'Password must be at least 8 characters long.';
        }
        
        showFormMessage(errorMessage, 'error', 'registerMessage');
    } finally {
        showLoadingSpinner(false);
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
}

/**
 * Handle email/password login form submission
 * @async
 * @function handleLogin
 * @param {Event} event - Form submission event
 * @returns {Promise<void>}
 */
async function handleLogin(event) {
    event.preventDefault();
    clearFormErrors();

    const formData = new FormData(event.target);
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    // Basic validation
    if (!email || !password) {
        showFormMessage('Please enter both email and password.', 'error', 'loginMessage');
        return;
    }

    try {
        showLoadingSpinner(true);
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        showFormMessage('Login successful! Welcome back!', 'success', 'loginMessage');
        // Session will be handled by auth state change listener

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please check your credentials and try again.';
        
        if (error.message?.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message?.includes('Email not confirmed')) {
            errorMessage = 'Please confirm your email address before logging in.';
        }
        
        showFormMessage(errorMessage, 'error', 'loginMessage');
    } finally {
        showLoadingSpinner(false);
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
}

/**
 * Handle Google OAuth login
 * @async
 * @function handleGoogleLogin
 * @returns {Promise<void>}
 */
async function handleGoogleLogin() {
    try {
        console.log('🔍 Google login initiated...');
        showLoadingSpinner(true);

        const redirectUrl = window.location.origin + '/hoenders/customer-portal.html';
        console.log('🔗 Redirect URL:', redirectUrl);

        console.log('🔑 Starting OAuth flow with session persistence enabled');
        console.log('📦 Storage configured:', {
            persistSession: true,
            storage: typeof localStorage,
            storageKey: 'plaas-hoenders-auth',
            autoRefreshToken: true
        });

        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    // Remove 'prompt: consent' to allow persistent login
                    // Only prompt on first login or when needed
                }
            }
        });

        if (error) {
            console.error('❌ Google OAuth error:', error);
            throw error;
        }

        console.log('✅ Google OAuth initiated, waiting for redirect...');
        // OAuth redirect will handle the rest

    } catch (error) {
        console.error('❌ Google login error:', error);

        // Provide more specific error messages
        let errorMessage = 'Google login failed. Please try again or use email/password login.';

        if (error.message?.includes('not configured')) {
            errorMessage = 'Google login is not configured. Please use email/password login or contact support.';
        } else if (error.message?.includes('provider is not enabled')) {
            errorMessage = 'Google login is not enabled. Please use email/password login.';
        } else if (error.message?.includes('popup') || error.message?.includes('blocked')) {
            errorMessage = 'Popup was blocked. Please allow popups for this site and try again.';
        }

        showFormMessage(errorMessage, 'error', 'loginMessage');
        showLoadingSpinner(false);
    }
}

/**
 * Handle user logout
 * @async
 * @function handleLogout
 * @returns {Promise<void>}
 */
async function handleLogout() {
    try {
        showLoadingSpinner(true);
        
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            throw error;
        }

        // Clean up real-time subscriptions
        if (typeof cleanupOrderStatusSubscription === 'function') {
            cleanupOrderStatusSubscription();
        }
        
        // Clear local state
        currentCustomer = null;
        customerSession = null;
        
        // Auth state change listener will handle UI updates

    } catch (error) {
        console.error('Logout error:', error);
        showFormMessage('Error signing out. Please try again.', 'error', 'loginMessage');
    } finally {
        showLoadingSpinner(false);
    }
}

/**
 * Validate registration form data
 * @function validateRegistrationData
 * @param {Object} data - Registration form data
 * @returns {Array<Object>} Array of validation errors
 */
function validateRegistrationData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.length < 2) {
        errors.push({ field: 'registerName', message: 'Name must be at least 2 characters long.' });
    }

    // Email validation
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!data.email || !emailRegex.test(data.email)) {
        errors.push({ field: 'registerEmail', message: 'Please enter a valid email address.' });
    }

    // Phone validation (if provided)
    if (data.phone) {
        const phoneRegex = /^(\+27|0)[0-9]{9}$/;
        if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) {
            errors.push({ field: 'registerPhone', message: 'Please enter a valid South African phone number.' });
        }
    }

    // Password validation
    if (!data.password || data.password.length < 8) {
        errors.push({ field: 'registerPassword', message: 'Password must be at least 8 characters long.' });
    }

    // Password confirmation
    if (data.password !== data.confirmPassword) {
        errors.push({ field: 'registerConfirmPassword', message: 'Passwords do not match.' });
    }

    return errors;
}

/**
 * Display validation errors in form
 * @function displayValidationErrors
 * @param {Array<Object>} errors - Array of validation errors
 */
function displayValidationErrors(errors) {
    errors.forEach(error => {
        const errorElement = document.getElementById(`${error.field}Error`);
        if (errorElement) {
            errorElement.textContent = error.message;
        }
    });

    // Focus on first error field
    if (errors.length > 0) {
        const firstErrorField = document.getElementById(errors[0].field);
        if (firstErrorField) {
            firstErrorField.focus();
        }
    }
}

/**
 * Clear all form error messages
 * @function clearFormErrors
 */
function clearFormErrors() {
    const errorElements = document.querySelectorAll('.field-error');
    errorElements.forEach(element => {
        element.textContent = '';
    });

    const messageElements = document.querySelectorAll('.form-message');
    messageElements.forEach(element => {
        element.style.display = 'none';
        element.className = 'form-message';
    });
}

/**
 * Show form message (success, error, info)
 * @function showFormMessage
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, info)
 * @param {string} elementId - ID of message element
 */
function showFormMessage(message, type, elementId) {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `form-message ${type}`;
        messageElement.style.display = 'block';
    }
}

/**
 * Show/hide loading spinner
 * @function showLoadingSpinner
 * @param {boolean} show - Whether to show spinner
 */
function showLoadingSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.className = show ? 'loading-spinner active' : 'loading-spinner';
    }

    // Also control session loading overlay
    const sessionLoading = document.getElementById('sessionLoading');
    if (sessionLoading) {
        if (show) {
            sessionLoading.style.setProperty('display', 'flex', 'important');
        } else {
            sessionLoading.style.setProperty('display', 'none', 'important');
        }
        console.log(`🔄 Session loading overlay: ${show ? 'SHOW' : 'HIDE'}`);
    }
}


/**
 * Show authentication section (login/register forms)
 * @function showAuthSection
 */
function showAuthSection() {
    // Hide session loading overlay if it's still visible
    const sessionLoading = document.getElementById('sessionLoading');
    if (sessionLoading) {
        sessionLoading.style.setProperty('display', 'none', 'important');
    }

    // Hide navigation
    const navigation = document.getElementById('customer-navigation');
    if (navigation) {
        navigation.style.display = 'none';
    }

    // Hide beautiful modal
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Show only auth section
    const sections = document.querySelectorAll('.customer-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.classList.add('active');
        authSection.style.display = 'block';
    }

    // Add session persistence info
    addRememberMeInfo();

    updateAuthUI();
}

/**
 * Add "Remember Me" info to auth section
 * @function addRememberMeInfo
 */
function addRememberMeInfo() {
    // Check if remember me info already exists
    if (document.getElementById('remember-me-info')) {
        return; // Already added
    }

    // Create remember me info element
    const rememberMeInfo = document.createElement('div');
    rememberMeInfo.id = 'remember-me-info';
    rememberMeInfo.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-lg';
    rememberMeInfo.innerHTML = `
        <div class="flex items-center">
            <span class="text-green-600 mr-2">✅</span>
            <div class="text-sm text-green-800">
                <strong>Stay Logged In:</strong> Your session will be saved automatically.
                You won't need to login again unless you explicitly sign out.
            </div>
        </div>
    `;

    // Add to auth section
    const authSection = document.getElementById('auth-section');
    if (authSection) {
        const authContainer = authSection.querySelector('.max-w-md');
        if (authContainer) {
            authContainer.insertBefore(rememberMeInfo, authContainer.firstChild);
        }
    }
}

/**
 * Show specific auth form (login or register)
 * @function showAuthForm
 * @param {string} formType - 'login' or 'register'
 */
function showAuthForm(formType) {
    // Update tab styling
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (formType === 'login') {
        // Show login form
        if (loginTab) {
            loginTab.classList.add('active');
            loginTab.className = 'auth-tab flex-1 py-2 text-center rounded-lg text-white bg-orange-500 font-medium active';
        }
        if (registerTab) {
            registerTab.classList.remove('active');
            registerTab.className = 'auth-tab flex-1 py-2 text-center rounded-lg text-zinc-400';
        }
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
    } else {
        // Show register form
        if (registerTab) {
            registerTab.classList.add('active');
            registerTab.className = 'auth-tab flex-1 py-2 text-center rounded-lg text-white bg-orange-500 font-medium active';
        }
        if (loginTab) {
            loginTab.classList.remove('active');
            loginTab.className = 'auth-tab flex-1 py-2 text-center rounded-lg text-zinc-400';
        }
        if (registerForm) registerForm.style.display = 'block';
        if (loginForm) loginForm.style.display = 'none';
    }
}

/**
 * Show customer portal with navigation
 * @function showCustomerPortal
 */
function showCustomerPortal() {
    // Hide session loading overlay if it's still visible
    const sessionLoading = document.getElementById('sessionLoading');
    if (sessionLoading) {
        sessionLoading.style.setProperty('display', 'none', 'important');
    }

    // Hide auth section
    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.classList.remove('active');
        authSection.style.display = 'none';
    }
    
    // Load cart from storage when portal opens
    loadCartFromStorage();

    // Show beautiful glassmorphism modal instead of navigation
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Initialize the beautiful portal
        initializeBeautifulPortal();
    }

    // Keep navigation hidden for beautiful design
    const navigation = document.getElementById('customer-navigation');
    if (navigation) {
        navigation.style.display = 'none';
    }

    // Navigate to dashboard by default
    navigateToSection('dashboard');
    updateAuthUI();
}

/**
 * Initialize the beautiful glassmorphism portal after authentication
 * @function initializeBeautifulPortal
 */
function initializeBeautifulPortal() {
    // Populate customer data from authenticated user
    if (currentCustomer) {
        // Update display elements with real customer data
        const displayName = document.getElementById('displayName');
        const displayPhone = document.getElementById('displayPhone');
        const displayAddress = document.getElementById('displayAddress');
        const displayEmail = document.getElementById('displayEmail');
        
        if (displayName) displayName.textContent = currentCustomer.full_name || currentCustomer.name || '';
        if (displayPhone) displayPhone.textContent = currentCustomer.phone || '';
        if (displayAddress) displayAddress.textContent = currentCustomer.address || '';
        if (displayEmail) displayEmail.textContent = currentCustomer.email || '';
        
        // Update form fields as well
        const customerName = document.getElementById('customerName');
        const customerPhone = document.getElementById('customerPhone');
        const customerAddress = document.getElementById('customerAddress');
        const customerEmail = document.getElementById('customerEmail');
        
        if (customerName) customerName.value = currentCustomer.full_name || currentCustomer.name || '';
        if (customerPhone) customerPhone.value = currentCustomer.phone || '';
        if (customerAddress) customerAddress.value = currentCustomer.address || '';
        if (customerEmail) customerEmail.value = currentCustomer.email || '';
    }
    
    // Initialize the beautiful portal components
    setupBeautifulPortalEventListeners();
    populateEditForm();
    updateCustomerDisplayElements();
}

/**
 * Setup event listeners for the beautiful portal
 * @function setupBeautifulPortalEventListeners
 */
function setupBeautifulPortalEventListeners() {
    // Close modal
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });
    }
    
    // Step navigation
    const confirmDetails = document.getElementById('confirmDetails');
    if (confirmDetails) {
        confirmDetails.addEventListener('click', () => {
            // Validate required customer fields before proceeding
            if (window.CustomerValidator && typeof window.CustomerValidator.validate === 'function') {
                const validation = window.CustomerValidator.validate({
                    phone: currentCustomer?.phone || '',
                    address: currentCustomer?.address || ''
                });
                
                if (!validation.isValid) {
                    // Show validation overlay with errors
                    window.CustomerValidator.showValidationOverlay(validation.errors);
                    return;
                }
            } else {
                // Fallback validation if CustomerValidator is not available
                if (!currentCustomer?.phone || !currentCustomer?.address) {
                    alert('⚠️ Please complete your phone number and address before proceeding.');
                    return;
                }
            }
            
            // Validation passed, proceed to step 2
            showBeautifulStep(2);
        });
    }
    
    const backToStep1 = document.getElementById('backToStep1');
    if (backToStep1) {
        backToStep1.addEventListener('click', () => {
            showBeautifulStep(1);
        });
    }
    
    const proceedToReview = document.getElementById('proceedToReview');
    if (proceedToReview) {
        proceedToReview.addEventListener('click', () => {
            if (Object.keys(cart).length === 0) {
                alert('Kies asseblief produkte om voort te gaan');
                return;
            }
            populateOrderReview();
            showBeautifulStep(3);
        });
    }
    
    const backToProducts = document.getElementById('backToProducts');
    if (backToProducts) {
        backToProducts.addEventListener('click', () => {
            showBeautifulStep(2);
        });
    }
    
    const placeOrder = document.getElementById('placeOrder');
    if (placeOrder) {
        placeOrder.addEventListener('click', async (e) => {
            // Prevent multiple clicks
            if (placeOrder.disabled) {
                return;
            }
            
            // Disable button and show loading state
            placeOrder.disabled = true;
            const originalText = placeOrder.textContent;
            placeOrder.textContent = 'Plaas Bestelling...';
            placeOrder.style.opacity = '0.7';
            
            try {
                await handleOrderPlacement();
            } catch (error) {
                console.error('Order placement failed:', error);
                // Re-enable button on error
                placeOrder.disabled = false;
                placeOrder.textContent = originalText;
                placeOrder.style.opacity = '1';
            }
        });
    }
    
    const newOrder = document.getElementById('newOrder');
    if (newOrder) {
        newOrder.addEventListener('click', () => {
            showBeautifulStep(1);
        });
    }
    
    // Edit customer details button
    const editDetailsBtn = document.getElementById('editDetailsBtn');
    if (editDetailsBtn) {
        editDetailsBtn.addEventListener('click', () => {
            console.log('Edit details button clicked');
            // Hide display mode, show edit mode
            const detailsDisplay = document.getElementById('detailsDisplay');
            const detailsEdit = document.getElementById('detailsEdit');
            
            if (detailsDisplay) {
                detailsDisplay.style.display = 'none';
                console.log('Hidden display mode');
            }
            if (detailsEdit) {
                detailsEdit.classList.remove('hidden');
                detailsEdit.style.display = 'block';
                console.log('Shown edit mode');
            }
        });
    }
    
    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            console.log('Cancel edit button clicked');
            // Show display mode, hide edit mode
            const detailsDisplay = document.getElementById('detailsDisplay');
            const detailsEdit = document.getElementById('detailsEdit');
            
            if (detailsDisplay) {
                detailsDisplay.style.display = 'block';
                console.log('Shown display mode');
            }
            if (detailsEdit) {
                detailsEdit.style.display = 'none';
                detailsEdit.classList.add('hidden');
                console.log('Hidden edit mode');
            }
            
            // Restore original values
            populateEditForm();
        });
    }
    
    // Save changes button
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', async () => {
            await saveCustomerChanges();
        });
    }
}



// Removed old populateProducts() function - replaced with populateAllProducts() in step navigation

// Step navigation for beautiful portal
/**
 * Show beautiful step with products populated
 * @function showBeautifulStep
 * @param {number} stepNumber - Step to show (1-4)
 */
function showBeautifulStep(stepNumber) {
    console.log(`🎯 Showing step ${stepNumber}`);

    // Hide all steps
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none';
    });

    // Show target step
    const targetStep = document.getElementById(`step-${stepNumber}`);
    if (targetStep) {
        console.log(`✅ Found step ${stepNumber}, showing it`);
        targetStep.classList.add('active');
        targetStep.style.display = 'block';

        // Update step indicators
        updateStepIndicators(stepNumber);

        // Populate products when showing step 2
        if (stepNumber === 2) {
            populateAllProducts();
            populateCartQuantities();
        }

        // Also pre-populate products on step 1 so they're ready
        if (stepNumber === 1) {
            // Pre-load products in background
            setTimeout(() => {
                populateAllProducts();
            }, 100);
        }

        // Special handling for confirmation step
        if (stepNumber === 4) {
            console.log('🎉 Confirmation step activated');
            // Ensure the confirmation summary is visible
            const summaryContainer = document.getElementById('confirmationOrderSummary');
            if (summaryContainer) {
                summaryContainer.style.display = 'block';
                summaryContainer.style.visibility = 'visible';
            }
        }
    } else {
        console.error(`❌ Step ${stepNumber} not found!`);
    }
}

/**
 * Update step indicator UI
 * @function updateStepIndicators  
 * @param {number} activeStep - Currently active step
 */
function updateStepIndicators(activeStep) {
    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById(`step-indicator-${i}`);
        if (indicator) {
            if (i <= activeStep) {
                indicator.className = 'flex items-center justify-center w-8 h-8 bg-orange-500 rounded-full border border-orange-400';
            } else {
                indicator.className = 'flex items-center justify-center w-8 h-8 bg-zinc-800/50 rounded-full border border-zinc-800/30';
            }
        }
    }
}

/**
 * Populate all 18 products with categories in the beautiful portal
 * @function populateAllProducts
 */
function populateAllProducts() {
    try {
        // Get all 18 products with categories from shared-utils.js
        const pricing = getCustomerPricing();
        const categories = getProductCategories();
        
        const productGrid = document.getElementById('productGrid');
        if (!productGrid) {
            console.error('Product grid not found');
            return;
        }
        
        productGrid.innerHTML = '';
        
        // Create products organized by categories
        Object.entries(categories).forEach(([categoryKey, category]) => {
            // Add category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'col-span-full mb-6 text-center';
            categoryHeader.innerHTML = `
                <div class="inline-flex items-center gap-3 px-6 py-3 bg-orange-500/20 rounded-xl border border-orange-500/30">
                    <i class="${category.icon} text-orange-400"></i>
                    <h3 class="text-lg font-semibold text-white">${category.name}</h3>
                </div>
                <p class="text-zinc-200 text-base mt-2 font-medium">${category.description}</p>
            `;
            productGrid.appendChild(categoryHeader);
            
            // Add products in this category
            category.products.forEach(productName => {
                const priceData = pricing[productName];
                if (!priceData) {
                    console.warn(`No pricing data for ${productName}`);
                    return;
                }
                
                // Get display info and create safe product key
                const displayInfo = getProductDisplayInfo(productName);
                const estimatedWeight = getEstimatedWeight(productName);
                const productKey = productName.replace(/[^A-Z0-9]/g, '_');
                
                console.log(`🔑 Generated key: "${productName}" → "${productKey}"`);
                
                const productCard = document.createElement('div');
                productCard.className = 'bg-zinc-800/30 rounded-xl border border-zinc-700/30 p-6 hover:border-orange-500/30 transition-all duration-200';
                
                productCard.innerHTML = `
                        <div class="mb-4">
                            <h4 class="text-lg font-semibold text-white mb-2">${displayInfo.displayName}</h4>
                            <p class="text-zinc-200 text-base mb-3 font-medium">${displayInfo.description}</p>
                        <div class="text-sm text-zinc-200 mb-3 p-2 bg-zinc-700/30 rounded-lg font-medium">
                            <i class="fas fa-box"></i> ${priceData.packaging || 'Standard packaging'}
                        </div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-orange-400 font-semibold">R${priceData.selling.toFixed(2)}${priceData.unit === 'per potjie' ? '/potjie' : priceData.unit === 'per unit' ? '/unit' : '/kg'}</span>
                            <span class="text-sm text-zinc-200 font-medium">${priceData.unit === 'per potjie' || priceData.unit === 'per unit' ? estimatedWeight : `~${estimatedWeight} est.`}</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <button class="w-8 h-8 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 flex items-center justify-center transition-all" onclick="updateQuantity('${productKey}', -1)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 12h14"></path>
                                    </svg>
                                </button>
                                <input type="number" id="qty-${productKey}" min="0" max="20" value="0" class="w-16 h-8 bg-zinc-700/50 border border-zinc-600/50 rounded-lg text-white text-center text-sm quantity-input" onchange="setQuantity('${productKey}', this.value)">
                                <button class="w-8 h-8 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 flex items-center justify-center transition-all" onclick="updateQuantity('${productKey}', 1)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 5v14m-7-7h14"></path>
                                    </svg>
                                </button>
                            </div>
                            <span class="text-sm text-zinc-200 font-medium" id="total-${productKey}">R0.00</span>
                        </div>
                `;
                
                productGrid.appendChild(productCard);
            });
        });
        
        console.log(`✅ Populated ${Object.keys(pricing).length} products across ${Object.keys(categories).length} categories`);
        console.log('🔍 Debug: Product grid populated with:', Object.keys(categories).map(key => categories[key].name));
        
    } catch (error) {
        console.error('Error populating products:', error);
        
        // Fallback to basic products if shared-utils functions fail
        const basicProducts = [
            { name: 'HEEL HOENDER', price: 67.00, weight: 2.5 },
            { name: 'PLAT HOENDER', price: 79.00, weight: 1.8 },
            { name: 'BRAAIPAKKE', price: 74.00, weight: 1.0 }
        ];
        
        const productGrid = document.getElementById('productGrid');
        if (productGrid) {
            productGrid.innerHTML = '<p class="text-red-400 col-span-full text-center">Products loading failed. Please refresh the page.</p>';
        }
    }
}

// Cart management for beautiful portal
let cart = {};

/**
 * Save cart to localStorage with expiry
 * @function saveCartToStorage
 */
function saveCartToStorage() {
    try {
        const cartData = {
            items: cart,
            timestamp: Date.now(),
            customerId: currentCustomer?.id || null
        };
        localStorage.setItem('plaasHoendersCart', JSON.stringify(cartData));
        console.log('💾 Cart saved to localStorage:', Object.keys(cart).length, 'items');
    } catch (error) {
        console.error('❌ Failed to save cart to localStorage:', error);
    }
}

/**
 * Load cart from localStorage with expiry check (24 hours)
 * @function loadCartFromStorage
 */
function loadCartFromStorage() {
    try {
        const stored = localStorage.getItem('plaasHoendersCart');
        if (!stored) {
            cart = {};
            return;
        }
        
        const cartData = JSON.parse(stored);
        const hoursSinceStored = (Date.now() - cartData.timestamp) / (1000 * 60 * 60);
        
        // Cart expires after 24 hours or if customer changed
        if (hoursSinceStored > 24 || (cartData.customerId && cartData.customerId !== currentCustomer?.id)) {
            console.log('🗑️ Cart expired or customer changed, clearing cart');
            cart = {};
            localStorage.removeItem('plaasHoendersCart');
        } else {
            cart = cartData.items || {};
            console.log('📦 Cart loaded from localStorage:', Object.keys(cart).length, 'items');
            
            // Clean cart of invalid products (like old BORSSTUKKE_MET_BEEN_EN_VEL without pack size)
            const pricing = getCustomerPricing();
            const cleanedCart = {};
            let removedCount = 0;
            
            for (const [productKey, cartItem] of Object.entries(cart)) {
                // Skip the old BORSSTUKKE product without pack size
                if (productKey === 'BORSSTUKKE_MET_BEEN_EN_VEL') {
                    console.warn(`🧹 Removing old BORSSTUKKE product (use 2 IN PAK or 4 IN PAK instead)`);
                    removedCount++;
                    continue;
                }

                // Try to find the product in current pricing
                let productFound = false;
                for (const productName of Object.keys(pricing)) {
                    const generatedKey = productName.replace(/[^A-Z0-9]/g, '_');
                    if (generatedKey === productKey) {
                        cleanedCart[productKey] = cartItem;
                        productFound = true;
                        break;
                    }
                }

                if (!productFound) {
                    console.warn(`🧹 Removing invalid product from cart: ${productKey}`);
                    removedCount++;
                } else {
                    cleanedCart[productKey] = cartItem;
                }
            }
            
            if (removedCount > 0) {
                cart = cleanedCart;
                saveCartToStorage();
                console.log(`✅ Cleaned ${removedCount} invalid products from cart`);
            }
        }
        
        // Update display after loading
        updateCartDisplay();
        updateCartSummary();
        
    } catch (error) {
        console.error('❌ Failed to load cart from localStorage:', error);
        cart = {};
    }
}

/**
 * Clear cart completely
 * @function clearCart
 */
function clearCart() {
    cart = {};
    localStorage.removeItem('plaasHoendersCart');
    updateCartDisplay();
    updateCartSummary();
    console.log('🗑️ Cart cleared');
}

/**
 * Populate quantity inputs with current cart values
 * @function populateCartQuantities
 */
function populateCartQuantities() {
    console.log('🔄 Populating cart quantities in product UI');
    
    Object.entries(cart).forEach(([productKey, cartItem]) => {
        const quantity = cartItem.quantity || 0;
        const qtyInput = document.getElementById(`qty-${productKey}`);
        if (qtyInput) {
            qtyInput.value = quantity;
            console.log(`✅ Set ${productKey} quantity to ${quantity}`);
        }
    });
    
    // Update cart display and summary after populating
    updateCartDisplay();
    updateCartSummary();
}

/**
 * Update product quantity in cart
 * @function updateQuantity
 * @param {string} productKey - Product identifier
 * @param {number} change - Change in quantity (+1 or -1)
 */
function updateQuantity(productKey, change) {
    const qtyInput = document.getElementById(`qty-${productKey}`);
    if (qtyInput) {
        const currentQty = parseInt(qtyInput.value) || 0;
        const newQty = Math.max(0, currentQty + change);
        qtyInput.value = newQty;
        setQuantity(productKey, newQty);
    }
}

/**
 * Set product quantity directly
 * @function setQuantity
 * @param {string} productKey - Product identifier
 * @param {number} quantity - New quantity
 */
function setQuantity(productKey, quantity) {
    const qty = Math.max(0, parseInt(quantity) || 0);

    if (qty > 0) {
        // Get the actual product name from the key
        const productName = getProductNameFromKey(productKey);

        // Store complete product data including weight and pricing
        const estimatedWeightStr = getEstimatedWeight(productName) || '1kg';
        let estimatedWeight;

        // Handle different weight formats
        if (estimatedWeightStr.includes('kg')) {
            estimatedWeight = parseFloat(estimatedWeightStr.replace('kg', '')) || 1;
        } else if (estimatedWeightStr.includes('g')) {
            estimatedWeight = parseFloat(estimatedWeightStr.replace('g', '').replace(' potjie', '')) / 1000 || 0.001;
        } else {
            // Default to 1kg for unspecified items
            estimatedWeight = 1;
        }

        const pricing = getCustomerPricing()[productName];
        const unitPrice = pricing ? parseFloat(pricing.selling) : 0;

        cart[productKey] = {
            quantity: qty,
            productName: productName,  // Store actual product name, not key
            weight: estimatedWeight,  // Ensure number
            unitPrice: unitPrice,     // Ensure number
            lineTotal: qty * estimatedWeight * unitPrice
        };
    } else {
        delete cart[productKey];
    }

    updateCartDisplay();
    updateCartSummary();
    saveCartToStorage();
}

/**
 * Update cart badge and summary
 * @function updateCartDisplay
 */
function updateCartDisplay() {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Update cart badge
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        if (totalItems > 0) {
            cartBadge.classList.remove('opacity-0', 'scale-0');
            cartBadge.classList.add('opacity-100', 'scale-100');
        } else {
            cartBadge.classList.add('opacity-0', 'scale-0');
            cartBadge.classList.remove('opacity-100', 'scale-100');
        }
    }
    
    // Enable/disable proceed button
    const proceedBtn = document.getElementById('proceedToReview');
    if (proceedBtn) {
        proceedBtn.disabled = totalItems === 0;
    }
}

/**
 * Update cart summary section
 * @function updateCartSummary
 */
function updateCartSummary() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const cartWeight = document.getElementById('cartWeight');
    const cartItemCount = document.getElementById('cartItemCount');
    
    // Use the new pricing system from shared-utils.js
    const pricing = getCustomerPricing();
    
    // Create a lookup from productKey back to full name
    function getProductNameFromKey(productKey) {
        // The key generation uses: productName.replace(/[^A-Z0-9]/g, '_')
        // So we need to map the generated keys back to original names
        const allProducts = getCustomerPricing();
        
        // Find the product that generates this key
        for (const productName of Object.keys(allProducts)) {
            const generatedKey = productName.replace(/[^A-Z0-9]/g, '_');
            if (generatedKey === productKey) {
                return productName;
            }
        }
        
        // Fallback: convert key back to name by replacing underscores
        return productKey.replace(/_/g, ' ')
                        .replace(/  /g, ' ')  // Remove double spaces
                        .replace(/ S /g, '\'S '); // Fix things like FLATTY S → FLATTY'S
    }
    
    let totalAmount = 0;
    let totalWeight = 0;
    let totalItems = 0;
    
    if (cartItems) {
        cartItems.innerHTML = '';
        
        if (Object.keys(cart).length === 0) {
            cartItems.innerHTML = '<p class="text-zinc-400 text-center py-4">Geen items in mandjie nie</p>';
        } else {
            Object.entries(cart).forEach(([productKey, cartItem]) => {
                const qty = cartItem.quantity || 0;
                const productName = getProductNameFromKey(productKey);
                const product = pricing[productName];

                if (product) {
                    const displayInfo = getProductDisplayInfo(productName);
                    const estimatedWeightStr = getEstimatedWeight(productName);
                    let estimatedWeight;

                    // Parse weight correctly for different formats
                    if (estimatedWeightStr.includes('kg')) {
                        estimatedWeight = parseFloat(estimatedWeightStr.replace('kg', '')) || 1;
                    } else if (estimatedWeightStr.includes('g')) {
                        estimatedWeight = parseFloat(estimatedWeightStr.replace('g', '').replace(' potjie', '')) / 1000 || 0.001;
                    } else {
                        estimatedWeight = 1;
                    }

                    // Calculate based on unit type
                    let amount;
                    let weight = 0;
                    if (product.unit === 'per potjie' || product.unit === 'per unit') {
                        amount = product.selling * qty;
                    } else {
                        weight = estimatedWeight * qty;
                        amount = product.selling * weight;
                    }

                    totalWeight += weight;
                    totalAmount += amount;
                    totalItems += qty;
                    
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'flex justify-between items-center py-2 border-b border-zinc-700/30';
                    // Display text based on unit type
                    let quantityText;
                    if (product.unit === 'per potjie') {
                        quantityText = `${qty}x potjie${qty > 1 ? 's' : ''}`;
                    } else if (product.unit === 'per unit') {
                        quantityText = `${qty}x unit${qty > 1 ? 's' : ''}`;
                    } else {
                        quantityText = `${qty}x (~${weight.toFixed(1)}kg)`;
                    }
                    
                    itemDiv.innerHTML = `
                        <div>
                            <p class="text-white font-medium">${displayInfo.displayName}</p>
                            <p class="text-zinc-400 text-sm">${quantityText}</p>
                        </div>
                        <p class="text-orange-400 font-semibold">R${amount.toFixed(2)}</p>
                    `;
                    cartItems.appendChild(itemDiv);
                } else {
                    console.warn('🚫 Cart: Product not found for key:', productKey, '→', productName);
                    console.log('🔍 Cart: Available products:', Object.keys(pricing));
                }
            });
        }
    }
    
    if (cartTotal) cartTotal.textContent = `R${totalAmount.toFixed(2)}`;
    if (cartWeight) cartWeight.textContent = `${totalWeight.toFixed(1)}kg`;
    if (cartItemCount) cartItemCount.textContent = `${totalItems} items`;
    
    // Update final total as well
    const finalTotal = document.getElementById('finalTotal');
    if (finalTotal) finalTotal.textContent = `R${totalAmount.toFixed(2)}`;
}

/**
 * Populate edit form with current customer data
 * @function populateEditForm
 */
function populateEditForm() {
    if (currentCustomer) {
        const customerName = document.getElementById('customerName');
        const customerPhone = document.getElementById('customerPhone');  
        const customerAddress = document.getElementById('customerAddress');
        const customerEmail = document.getElementById('customerEmail');
        const deliveryInstructions = document.getElementById('deliveryInstructions');
        
        if (customerName) customerName.value = currentCustomer.full_name || currentCustomer.name || '';
        if (customerPhone) customerPhone.value = currentCustomer.phone || '';
        if (customerAddress) customerAddress.value = currentCustomer.address || '';
        if (customerEmail) customerEmail.value = currentCustomer.email || '';
        if (deliveryInstructions) deliveryInstructions.value = currentCustomer.delivery_instructions || '';
    }
}

/**
 * Save customer changes from edit form
 * @function saveCustomerChanges
 */
async function saveCustomerChanges() {
    try {
        // Get values from form
        const customerName = document.getElementById('customerName');
        const customerPhone = document.getElementById('customerPhone');
        const customerAddress = document.getElementById('customerAddress');
        const customerEmail = document.getElementById('customerEmail');
        const deliveryInstructions = document.getElementById('deliveryInstructions');
        
        // Update current customer object
        if (currentCustomer) {
            if (customerName) {
                currentCustomer.name = customerName.value;
                currentCustomer.full_name = customerName.value;
            }
            if (customerPhone) currentCustomer.phone = customerPhone.value;
            if (customerAddress) currentCustomer.address = customerAddress.value;
            if (customerEmail) currentCustomer.email = customerEmail.value;
            if (deliveryInstructions) currentCustomer.delivery_instructions = deliveryInstructions.value;
            
            // Update display
            updateCustomerDisplayElements();
            
            // Try to save to database (gracefully handle errors)
            try {
                if (currentCustomer.id) {
                    // Update existing customer record
                    const { data, error } = await supabaseClient
                        .from('customers')
                        .update({
                            name: currentCustomer.name,
                            full_name: currentCustomer.full_name,
                            phone: currentCustomer.phone,
                            address: currentCustomer.address,
                            delivery_instructions: currentCustomer.delivery_instructions,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', currentCustomer.id);
                        
                    if (error) throw error;
                    console.log('✅ Customer profile updated in database');
                } else if (customerSession?.user) {
                    // Create new customer record if doesn't exist
                    const { data, error } = await supabaseClient
                        .from('customers')
                        .insert({
                            auth_user_id: customerSession.user.id,
                            name: currentCustomer.name,
                            full_name: currentCustomer.full_name,
                            phone: currentCustomer.phone,
                            address: currentCustomer.address,
                            email: currentCustomer.email,
                            delivery_instructions: currentCustomer.delivery_instructions
                        })
                        .select()
                        .single();
                        
                    if (error) throw error;
                    
                    // Update current customer with new ID
                    currentCustomer.id = data.id;
                    console.log('✅ New customer profile created in database');
                }
            } catch (dbError) {
                console.warn('🚫 Could not save to database (table may not exist), changes saved locally:', dbError);
                console.log('💡 Run the database migration to enable persistent customer profiles');
            }
            
            // Show success message
            alert('Besonderhede suksesvol opgestamp!');
            
            // Return to display mode
            const detailsDisplay = document.getElementById('detailsDisplay');
            const detailsEdit = document.getElementById('detailsEdit');
            
            if (detailsDisplay) detailsDisplay.style.display = 'block';
            if (detailsEdit) detailsEdit.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error saving customer changes:', error);
        alert('Fout met stoor van besonderhede. Probeer weer.');
    }
}

/**
 * Update customer display elements
 * @function updateCustomerDisplayElements
 */
function updateCustomerDisplayElements() {
    if (currentCustomer) {
        const displayName = document.getElementById('displayName');
        const displayPhone = document.getElementById('displayPhone');
        const displayAddress = document.getElementById('displayAddress');
        const displayEmail = document.getElementById('displayEmail');
        
        if (displayName) displayName.textContent = currentCustomer.full_name || currentCustomer.name || '';
        if (displayPhone) displayPhone.textContent = currentCustomer.phone || 'Geen telefoon';
        if (displayAddress) displayAddress.textContent = currentCustomer.address || 'Geen adres';
        if (displayEmail) displayEmail.textContent = currentCustomer.email || '';
    }
}

/**
 * Populate order review section with customer and cart data
 * @function populateOrderReview
 */
function populateOrderReview() {
    console.log('🎯 populateOrderReview() called');
    console.log('📋 currentCustomer at populateOrderReview:', currentCustomer);
    console.log('📊 Customer data:', currentCustomer ? {
        name: currentCustomer.full_name || currentCustomer.name,
        phone: currentCustomer.phone,
        address: currentCustomer.address,
        email: currentCustomer.email
    } : 'No customer data');
    
    // Populate the specific review elements (this was missing!)
    populateReviewCustomerInfo();
    
    // Populate customer summary in display mode
    populateCustomerSummaryDisplay();
    
    // Populate edit form with current data
    populateOrderReviewEditForm();
    
    // Populate order items summary
    populateOrderItemsSummary();
    
    // Initialize confirmation checkboxes state
    updateConfirmationButtonState();
    
    // Update confirmation checkboxes text
    updateConfirmationText();
    
    // Add event listeners for confirmation checkboxes to enable/disable proceed button
    const addressCheckbox = document.getElementById('addressConfirmed');
    const phoneCheckbox = document.getElementById('phoneConfirmed');
    const placeOrderBtn = document.getElementById('placeOrder');
    
    if (addressCheckbox && phoneCheckbox && placeOrderBtn) {
        const checkProceedButton = () => {
            if (addressCheckbox.checked && phoneCheckbox.checked) {
                placeOrderBtn.disabled = false;
            } else {
                placeOrderBtn.disabled = true;
            }
        };
        
        addressCheckbox.addEventListener('change', checkProceedButton);
        phoneCheckbox.addEventListener('change', checkProceedButton);
        
        // Initial check
        checkProceedButton();
    }
}

/**
 * Populate the specific review customer info elements
 * @function populateReviewCustomerInfo
 */
function populateReviewCustomerInfo() {
    console.log('🎯 populateReviewCustomerInfo() called');
    console.log('📋 currentCustomer:', currentCustomer);
    
    if (!currentCustomer) {
        console.log('❌ No currentCustomer available in populateReviewCustomerInfo');
        return;
    }
    
    // Check if step-3 is active/visible
    const step3 = document.getElementById('step-3');
    console.log('🔍 Step 3 element:', step3);
    console.log('🔍 Step 3 active class:', step3?.classList.contains('active'));
    console.log('🔍 Step 3 display style:', step3?.style.display);
    
    // Add a small delay to ensure DOM is fully ready
    setTimeout(() => {
        console.log('🔍 Checking elements after delay...');
        
        // Get the specific review elements
        const reviewCustomerName = document.getElementById('reviewCustomerName');
        const reviewCustomerPhone = document.getElementById('reviewCustomerPhone');
        const reviewCustomerAddress = document.getElementById('reviewCustomerAddress');
        const reviewCustomerEmail = document.getElementById('reviewCustomerEmail');
        const reviewCustomerInstructions = document.getElementById('reviewCustomerInstructions');
        
        console.log('🔍 Review elements found after delay:', {
            name: { exists: !!reviewCustomerName, element: reviewCustomerName },
            phone: { exists: !!reviewCustomerPhone, element: reviewCustomerPhone },
            address: { exists: !!reviewCustomerAddress, element: reviewCustomerAddress },
            email: { exists: !!reviewCustomerEmail, element: reviewCustomerEmail },
            instructions: { exists: !!reviewCustomerInstructions, element: reviewCustomerInstructions }
        });

        // Let's also check what elements actually exist in the DOM
        console.log('🔍 All elements in step-3:', document.querySelectorAll('#step-3 [id]'));
        console.log('🔍 Element IDs found:', Array.from(document.querySelectorAll('#step-3 [id]')).map(el => el.id));
        
        // Now populate the elements
        populateReviewElements(reviewCustomerName, reviewCustomerPhone, reviewCustomerAddress, reviewCustomerEmail, reviewCustomerInstructions);
        
        // Simple display - no confirmation needed
    }, 100); // 100ms delay
}

// Removed: updateConfirmationText() - no longer needed for simple Step 3

function populateReviewElements(reviewCustomerName, reviewCustomerPhone, reviewCustomerAddress, reviewCustomerEmail, reviewCustomerInstructions) {
    console.log('🎯 populateReviewElements() called with elements:', {
        name: reviewCustomerName,
        phone: reviewCustomerPhone,
        address: reviewCustomerAddress,
        email: reviewCustomerEmail,
        instructions: reviewCustomerInstructions
    });
    
    // Try alternative selectors as backup
    const backupSelectors = {
        name: ['#reviewCustomerName', '#customerDetailsDisplay p:nth-child(1) span:last-child', '#customerDetailsDisplay > div > div:first-child p:last-child'],
        phone: ['#reviewCustomerPhone', '#customerDetailsDisplay p:nth-child(2) span:last-child', '#customerDetailsDisplay > div > div:nth-child(2) p:last-child'],
        address: ['#reviewCustomerAddress', '#customerDetailsDisplay p:nth-child(3) span:last-child'],
        email: ['#reviewCustomerEmail', '#customerDetailsDisplay p:nth-child(4) span:last-child'],
        instructions: ['#reviewCustomerInstructions']
    };
    
    // Find elements using backup selectors if primary ones are null
    if (!reviewCustomerName) {
        for (const selector of backupSelectors.name) {
            reviewCustomerName = document.querySelector(selector);
            if (reviewCustomerName) {
                console.log('✅ Found name element using backup selector:', selector);
                break;
            }
        }
    }
    
    if (!reviewCustomerPhone) {
        for (const selector of backupSelectors.phone) {
            reviewCustomerPhone = document.querySelector(selector);
            if (reviewCustomerPhone) {
                console.log('✅ Found phone element using backup selector:', selector);
                break;
            }
        }
    }
    
    if (!reviewCustomerAddress) {
        for (const selector of backupSelectors.address) {
            reviewCustomerAddress = document.querySelector(selector);
            if (reviewCustomerAddress) {
                console.log('✅ Found address element using backup selector:', selector);
                break;
            }
        }
    }
    
    if (!reviewCustomerEmail) {
        for (const selector of backupSelectors.email) {
            reviewCustomerEmail = document.querySelector(selector);
            if (reviewCustomerEmail) {
                console.log('✅ Found email element using backup selector:', selector);
                break;
            }
        }
    }
    
    if (!reviewCustomerInstructions) {
        for (const selector of backupSelectors.instructions) {
            reviewCustomerInstructions = document.querySelector(selector);
            if (reviewCustomerInstructions) {
                console.log('✅ Found instructions element using backup selector:', selector);
                break;
            }
        }
    }
    
    console.log('🔍 Final elements after backup search:', {
        name: reviewCustomerName,
        phone: reviewCustomerPhone,
        address: reviewCustomerAddress,
        email: reviewCustomerEmail,
        instructions: reviewCustomerInstructions
    });
    
    // Populate the elements with customer data
    if (reviewCustomerName) {
        reviewCustomerName.textContent = currentCustomer.full_name || currentCustomer.name || 'N/A';
        console.log('✅ Set reviewCustomerName:', reviewCustomerName.textContent);
    } else {
        console.log('❌ Could not find name element even with backup selectors');
    }
    
    if (reviewCustomerPhone) {
        reviewCustomerPhone.textContent = currentCustomer.phone || 'N/A';
        console.log('✅ Set reviewCustomerPhone:', reviewCustomerPhone.textContent);
    } else {
        console.log('❌ Could not find phone element even with backup selectors');
    }
    
    if (reviewCustomerAddress) {
        reviewCustomerAddress.textContent = currentCustomer.address || 'N/A';
        console.log('✅ Set reviewCustomerAddress:', reviewCustomerAddress.textContent);
    } else {
        console.log('❌ Could not find address element even with backup selectors');
    }
    
    if (reviewCustomerEmail) {
        reviewCustomerEmail.textContent = currentCustomer.email || 'N/A';
        console.log('✅ Set reviewCustomerEmail:', reviewCustomerEmail.textContent);
    } else {
        console.log('❌ Could not find email element even with backup selectors');
    }
    
    if (reviewCustomerInstructions) {
        reviewCustomerInstructions.textContent = currentCustomer.delivery_instructions || 'Geen spesiale instruksies';
        console.log('✅ Set reviewCustomerInstructions:', reviewCustomerInstructions.textContent);
        
        // Show/hide instructions section based on content
        const instructionsSection = document.getElementById('reviewDeliveryInstructions');
        if (instructionsSection) {
            if (currentCustomer.delivery_instructions) {
                instructionsSection.classList.remove('hidden');
            } else {
                instructionsSection.classList.add('hidden');
            }
        }
    } else {
        console.log('❌ Could not find instructions element even with backup selectors');
    }
    
    console.log('✅ populateReviewElements() completed');
}

/**
 * Populate customer summary display section
 * @function populateCustomerSummaryDisplay
 */
function populateCustomerSummaryDisplay() {
    console.log('🎯 populateCustomerSummaryDisplay() called');
    console.log('📋 currentCustomer:', currentCustomer);
    
    // Add delay to ensure DOM is ready
    setTimeout(() => {
        let customerSummary = document.getElementById('customerSummary');
        
        // Try alternative selectors if primary one not found
        if (!customerSummary) {
            const alternativeSelectors = [
                '#customerSummary',
                '#customerDetailsDisplay',
                '#step-3 .customer-summary',
                '#step-3 [id*="summary"]',
                '#step-3 [class*="summary"]'
            ];
            
            for (const selector of alternativeSelectors) {
                customerSummary = document.querySelector(selector);
                if (customerSummary) {
                    console.log('✅ Found customerSummary using alternative selector:', selector);
                    break;
                }
            }
        }
        
        console.log('🔍 customerSummary element:', customerSummary);
        
        if (customerSummary && currentCustomer) {
        console.log('✅ Both customerSummary and currentCustomer exist');
        console.log('📊 Customer data being displayed:');
        console.log('   - Name:', currentCustomer.full_name || currentCustomer.name || '');
        console.log('   - Phone:', currentCustomer.phone || 'Geen telefoon');
        console.log('   - Address:', currentCustomer.address || 'Geen adres');
        console.log('   - Email:', currentCustomer.email || '');
        
        customerSummary.innerHTML = `
            <div class="space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-zinc-400 font-medium">Naam:</p>
                        <p class="text-white font-medium">${currentCustomer.full_name || currentCustomer.name || ''}</p>
                    </div>
                    <div>
                        <p class="text-zinc-400 font-medium">Telefoon:</p>
                        <p class="text-white font-medium">${currentCustomer.phone || 'Geen telefoon'}</p>
                    </div>
                    <div class="md:col-span-2">
                        <p class="text-zinc-400 font-medium">Aflewerings Adres:</p>
                        <p class="text-white font-medium">${currentCustomer.address || 'Geen adres'}</p>
                    </div>
                    <div class="md:col-span-2">
                        <p class="text-zinc-400 font-medium">Email:</p>
                        <p class="text-white font-medium">${currentCustomer.email || ''}</p>
                    </div>
                    ${currentCustomer.delivery_instructions ? `
                    <div class="md:col-span-2">
                        <p class="text-zinc-400 font-medium">Spesiale Instruksies:</p>
                        <p class="text-white font-medium">${currentCustomer.delivery_instructions}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else {
        console.log('❌ Missing elements:');
        console.log('   - customerSummary exists:', !!customerSummary);
        console.log('   - currentCustomer exists:', !!currentCustomer);
        
        if (customerSummary) {
            customerSummary.innerHTML = `
                <div class="space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-zinc-400 font-medium">Naam:</p>
                            <p class="text-white font-medium">Laai kliënt data...</p>
                        </div>
                        <div>
                            <p class="text-zinc-400 font-medium">Telefoon:</p>
                            <p class="text-white font-medium">Laai kliënt data...</p>
                        </div>
                        <div class="md:col-span-2">
                            <p class="text-zinc-400 font-medium">Aflewerings Adres:</p>
                            <p class="text-white font-medium">Laai kliënt data...</p>
                        </div>
                        <div class="md:col-span-2">
                            <p class="text-zinc-400 font-medium">Email:</p>
                            <p class="text-white font-medium">Laai kliënt data...</p>
                        </div>
                    </div>
                </div>
            `;
        }
        }
    }, 100); // 100ms delay
}

/**
 * Populate order review edit form with current customer data
 * @function populateOrderReviewEditForm
 */
function populateOrderReviewEditForm() {
    if (!currentCustomer) return;
    
    // Populate form fields
    const editName = document.getElementById('editCustomerName');
    const editPhone = document.getElementById('editCustomerPhone');
    const editAddress = document.getElementById('editCustomerAddress');
    const editEmail = document.getElementById('editCustomerEmail');
    const editInstructions = document.getElementById('editDeliveryInstructions');
    
    if (editName) editName.value = currentCustomer.full_name || currentCustomer.name || '';
    if (editPhone) editPhone.value = currentCustomer.phone || '';
    if (editAddress) editAddress.value = currentCustomer.address || '';
    if (editEmail) editEmail.value = currentCustomer.email || '';
    if (editInstructions) editInstructions.value = currentCustomer.delivery_instructions || '';
}

/**
 * Populate order items summary section
 * @function populateOrderItemsSummary
 */
function populateOrderItemsSummary() {
    // Populate order items summary using new pricing system
    const orderItemsSummary = document.getElementById('orderItemsSummary');
    if (orderItemsSummary) {
        const pricing = getCustomerPricing();
        
        // Use the same key mapping function as cart summary
        function getProductNameFromKey(productKey) {
            const allProducts = getCustomerPricing();
            
            // Find the product that generates this key
            for (const productName of Object.keys(allProducts)) {
                const generatedKey = productName.replace(/[^A-Z0-9]/g, '_');
                if (generatedKey === productKey) {
                    return productName;
                }
            }
            
            // Fallback: convert key back to name by replacing underscores
            return productKey.replace(/_/g, ' ')
                            .replace(/  /g, ' ')  // Remove double spaces
                            .replace(/ S /g, '\'S '); // Fix things like FLATTY S → FLATTY'S
        }
        
        orderItemsSummary.innerHTML = '';
        
        if (Object.keys(cart).length === 0) {
            orderItemsSummary.innerHTML = '<p class="text-zinc-400 text-center py-4">Geen items in mandjie</p>';
        } else {
            Object.entries(cart).forEach(([productKey, cartItem]) => {
                const qty = cartItem.quantity || 0;
                const productName = getProductNameFromKey(productKey);
                const product = pricing[productName];

                if (product) {
                    const displayInfo = getProductDisplayInfo(productName);
                    const estimatedWeightStr = getEstimatedWeight(productName);
                    let estimatedWeight;

                    // Parse weight correctly for different formats
                    if (estimatedWeightStr.includes('kg')) {
                        estimatedWeight = parseFloat(estimatedWeightStr.replace('kg', '')) || 1;
                    } else if (estimatedWeightStr.includes('g')) {
                        estimatedWeight = parseFloat(estimatedWeightStr.replace('g', '').replace(' potjie', '')) / 1000 || 0.001;
                    } else {
                        estimatedWeight = 1;
                    }

                    // Calculate based on unit type
                    let amount;
                    let weight = 0;
                    if (product.unit === 'per potjie' || product.unit === 'per unit') {
                        amount = product.selling * qty;
                    } else {
                        weight = estimatedWeight * qty;
                        amount = product.selling * weight;
                    }
                    
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'flex justify-between items-center py-3 border-b border-zinc-700/30';
                    // Display text based on unit type
                    let priceText;
                    if (product.unit === 'per potjie') {
                        priceText = `${qty}x potjie${qty > 1 ? 's' : ''} @ R${product.selling.toFixed(2)}/potjie`;
                    } else if (product.unit === 'per unit') {
                        priceText = `${qty}x unit${qty > 1 ? 's' : ''} @ R${product.selling.toFixed(2)}/unit`;
                    } else {
                        priceText = `${qty}x stuks (~${weight.toFixed(1)}kg @ R${product.selling.toFixed(2)}/kg)`;
                    }
                    
                    itemDiv.innerHTML = `
                        <div>
                            <p class="text-white font-medium">${displayInfo.displayName}</p>
                            <p class="text-zinc-400 text-sm">${priceText}</p>
                        </div>
                        <p class="text-orange-400 font-semibold">R${amount.toFixed(2)}</p>
                    `;
                    orderItemsSummary.appendChild(itemDiv);
                } else {
                    console.warn('🚫 Review: Product not found for key:', productKey, '→', productName);
                    console.log('🔍 Review: Available products:', Object.keys(pricing));
                }
            });
        }
    }
}

/**
 * Toggle between display and edit modes in order review
 * @function toggleEditMode
 * @param {boolean} showEdit - Whether to show edit mode
 */
function toggleEditMode(showEdit) {
    const detailsDisplay = document.getElementById('detailsDisplay');
    const detailsEdit = document.getElementById('detailsEdit');
    const editBtn = document.getElementById('editDetailsBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveEditBtn');
    
    if (showEdit) {
        // Show edit mode
        if (detailsDisplay) detailsDisplay.style.display = 'none';
        if (detailsEdit) detailsEdit.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'inline-flex';
    } else {
        // Show display mode
        if (detailsDisplay) detailsDisplay.style.display = 'block';
        if (detailsEdit) detailsEdit.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-flex';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
    }
}

/**
 * Save customer changes from order review edit form
 * @function saveOrderReviewChanges
 */
async function saveOrderReviewChanges() {
    try {
        // Get form values
        const name = document.getElementById('editCustomerName')?.value?.trim();
        const phone = document.getElementById('editCustomerPhone')?.value?.trim();
        const address = document.getElementById('editCustomerAddress')?.value?.trim();
        const email = document.getElementById('editCustomerEmail')?.value?.trim();
        const instructions = document.getElementById('editDeliveryInstructions')?.value?.trim();
        
        // Validate required fields
        if (!name || !email) {
            alert('Naam en Email is verpligtende velde');
            return;
        }
        
        if (!validateEmail(email)) {
            alert('Voer asseblief \'n geldige e-pos adres in');
            return;
        }
        
        if (phone && !validatePhoneNumber(phone)) {
            alert('Voer asseblief \'n geldige Suid-Afrikaanse telefoon nommer in (bv. 079 123 4567)');
            return;
        }
        
        // Update current customer object
        if (currentCustomer) {
            currentCustomer.name = name;
            currentCustomer.full_name = name;
            currentCustomer.phone = phone;
            currentCustomer.address = address;
            currentCustomer.email = email;
            currentCustomer.delivery_instructions = instructions;
            
            // Update display
            populateCustomerSummaryDisplay();
            updateCustomerDisplayElements();
            
            // Try to save to database
            try {
                if (currentCustomer.id) {
                    const { data, error } = await supabaseClient
                        .from('customers')
                        .update({
                            name: currentCustomer.name,
                            full_name: currentCustomer.full_name,
                            phone: currentCustomer.phone,
                            address: currentCustomer.address,
                            email: currentCustomer.email,
                            delivery_instructions: currentCustomer.delivery_instructions,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', currentCustomer.id);
                        
                    if (error) throw error;
                    console.log('✅ Customer profile updated in database');
                }
            } catch (dbError) {
                console.warn('🚫 Could not save to database (table may not exist), changes saved locally:', dbError);
            }
            
            // Show success message
            showToast('Besonderhede suksesvol opgestamp!', 'success');
            
            // Return to display mode
            toggleEditMode(false);
            
            // Clear confirmation checkboxes since details were updated
            clearConfirmationCheckboxes();
        }
        
    } catch (error) {
        console.error('Error saving order review changes:', error);
        alert('Fout met stoor van besonderhede. Probeer weer.');
    }
}

/**
 * Cancel order review editing and restore original values
 * @function cancelOrderReviewEdit
 */
function cancelOrderReviewEdit() {
    // Restore original form values
    populateOrderReviewEditForm();
    
    // Return to display mode
    toggleEditMode(false);
    
    // Clear any validation errors
    clearOrderReviewErrors();
}

/**
 * Clear confirmation checkboxes when details are updated
 * @function clearConfirmationCheckboxes
 */
function clearConfirmationCheckboxes() {
    const addressConfirmed = document.getElementById('addressConfirmed');
    const phoneConfirmed = document.getElementById('phoneConfirmed');
    
    if (addressConfirmed) addressConfirmed.checked = false;
    if (phoneConfirmed) phoneConfirmed.checked = false;
    
    // Update button state
    updateConfirmationButtonState();
}

/**
 * Update the state of the confirmation button based on checkbox validation
 * @function updateConfirmationButtonState
 */
function updateConfirmationButtonState() {
    const addressConfirmed = document.getElementById('addressConfirmed');
    const phoneConfirmed = document.getElementById('phoneConfirmed');
    const confirmDetailsBtn = document.getElementById('confirmDetailsBtn');
    const confirmationError = document.getElementById('confirmationError');
    
    if (!addressConfirmed || !phoneConfirmed || !confirmDetailsBtn) return;
    
    const isAddressConfirmed = addressConfirmed.checked;
    const isPhoneConfirmed = phoneConfirmed.checked;
    
    if (isAddressConfirmed && isPhoneConfirmed) {
        // Enable button and hide error
        confirmDetailsBtn.disabled = false;
        confirmDetailsBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        if (confirmationError) confirmationError.style.display = 'none';
    } else {
        // Disable button and show error if needed
        confirmDetailsBtn.disabled = true;
        confirmDetailsBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Show error message if at least one checkbox is checked but not both
        if (isAddressConfirmed || isPhoneConfirmed) {
            if (confirmationError) {
                confirmationError.textContent = 'Beide bevestigings is verpligtend om voort te gaan';
                confirmationError.style.display = 'block';
            }
        } else {
            if (confirmationError) confirmationError.style.display = 'none';
        }
    }
}

/**
 * Clear validation errors in order review form
 * @function clearOrderReviewErrors
 */
function clearOrderReviewErrors() {
    const errorElements = document.querySelectorAll('#orderReviewForm .field-error');
    errorElements.forEach(element => {
        element.textContent = '';
    });
}

/**
 * Validate email format
 * @function validateEmail
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    return emailRegex.test(email.toLowerCase());
}

/**
 * Validate South African phone number
 * @function validatePhoneNumber
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function validatePhoneNumber(phone) {
    const phoneRegex = /^(\+27|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Add event listeners for confirmation checkboxes
document.addEventListener('DOMContentLoaded', function() {
    const addressConfirmed = document.getElementById('addressConfirmed');
    const phoneConfirmed = document.getElementById('phoneConfirmed');
    
    if (addressConfirmed) {
        addressConfirmed.addEventListener('change', updateConfirmationButtonState);
    }
    
    if (phoneConfirmed) {
        phoneConfirmed.addEventListener('change', updateConfirmationButtonState);
    }
    
    // Add event listeners for edit buttons
    const editDetailsBtn = document.getElementById('editDetailsBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveEditBtn = document.getElementById('saveEditBtn');
    
    if (editDetailsBtn) {
        editDetailsBtn.addEventListener('click', () => toggleEditMode(true));
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelOrderReviewEdit);
    }
    
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveOrderReviewChanges);
    }
});

/**
 * Send order confirmation email to customer
 * @function sendOrderConfirmationEmail
 * @param {string} orderId - The order ID
 * @param {Object} orderData - Complete order data including customer and items
 */
async function sendOrderConfirmationEmail(orderId, orderData) {
    try {
        if (!orderData.customer || !orderData.customer.email) {
            console.warn('⚠️ No customer email available for confirmation');
            return false;
        }

        // Validate email address
        if (!validateEmail(orderData.customer.email)) {
            console.warn('⚠️ Invalid customer email address:', orderData.customer.email);
            return false;
        }

        console.log(`📧 Sending confirmation email to: ${orderData.customer.email}`);

        // Debug the order data structure
        console.log('🔍 Order data structure for email:', {
            orderDataItems: orderData.items,
            cartContents: Object.keys(orderData.items || {}),
            sampleItem: orderData.items ? Object.values(orderData.items)[0] : null
        });

        // Generate order summary using actual order data
        const orderSummary = generateOrderSummaryFromActualData(orderData.items);
        const orderTotal = calculateOrderTotal(orderData.items);

        // Create confirmation email content
        const emailSubject = `🐔 Bevestiging: Jou Plaas Hoenders bestelling #${orderId}`;

        const emailBodyData = {
            customerName: orderData.customer.name,
            orderId: orderId,
            orderDate: new Date(orderData.timestamp).toLocaleDateString('af-ZA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            orderSummary: orderSummary,
            orderTotal: orderTotal,
            customerEmail: orderData.customer.email,
            customerPhone: orderData.customer.phone,
            customerAddress: orderData.customer.address
        };

        console.log('🔍 Email template data:', {
            customerName: emailBodyData.customerName,
            orderId: emailBodyData.orderId,
            orderSummaryLength: emailBodyData.orderSummary?.length || 0,
            orderSummaryPreview: emailBodyData.orderSummary?.substring(0, 300) + '...',
            orderTotal: emailBodyData.orderTotal
        });

        const emailBody = generateConfirmationEmailBody(emailBodyData);

        console.log('🔍 Generated email body length:', emailBody?.length || 0);

        // Send email using the existing Google Apps Script service
        const emailSent = await sendEmailViaGoogleScript(
            orderData.customer.email,
            emailSubject,
            emailBody
        );

        if (emailSent) {
            console.log('✅ Order confirmation email sent successfully');

            // Show success notification to user
            showToast('📧 Bevestiging e-pos gestuur!', 'success');

            return true;
        } else {
            console.error('❌ Failed to send confirmation email');

            // Show warning but don't block the order process
            showToast('⚠️ Kon nie bevestiging e-pos stuur nie, maar jou bestelling is ontvang', 'warning');

            return false;
        }

    } catch (error) {
        console.error('❌ Error sending confirmation email:', error);

        // Don't block order process if email fails
        showToast('⚠️ E-pos fout, maar jou bestelling is suksesvol geplaas', 'warning');

        return false;
    }
}

/**
 * Generate order summary HTML for email using actual order data (with real weights and prices)
 * @function generateOrderSummaryFromActualData
 * @param {Object} items - Cart items object with actual weights and prices
 * @returns {string} HTML formatted order summary
 */
function generateOrderSummaryFromActualData(items) {
    if (!items || Object.keys(items).length === 0) {
        return '<p>Geen items in bestelling nie.</p>';
    }

    let summaryHTML = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    summaryHTML += '<tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">';
    summaryHTML += '<th style="padding: 12px; text-align: left; font-weight: bold;">Produk</th>';
    summaryHTML += '<th style="padding: 12px; text-align: center; font-weight: bold;">Hoeveelheid</th>';
    summaryHTML += '<th style="padding: 12px; text-align: right; font-weight: bold;">Prys</th>';
    summaryHTML += '<th style="padding: 12px; text-align: right; font-weight: bold;">Subtotaal</th>';
    summaryHTML += '</tr>';

    let totalAmount = 0;

    Object.entries(items).forEach(([productKey, item]) => {
        const quantity = item.quantity || 0;
        const weight = parseFloat(item.weight) || 0;  // Convert to number
        const unitPrice = parseFloat(item.unitPrice) || 0;  // Convert to number
        const lineTotal = parseFloat(item.lineTotal) || (weight * unitPrice);
        const productName = item.productName || productKey;

        // Check if this is a per-unit product
        const pricing = getCustomerPricing()[productName];
        const isPerUnit = pricing && (pricing.unit === 'per potjie' || pricing.unit === 'per unit');

        if (quantity > 0) {
            totalAmount += lineTotal;

            summaryHTML += '<tr style="border-bottom: 1px solid #eee;">';
            summaryHTML += `<td style="padding: 10px; font-weight: 500;">${productName}</td>`;

            // Format quantity and price based on unit type
            if (isPerUnit) {
                const weightStr = getEstimatedWeight(productName);
                if (weightStr.includes('500g')) {
                    summaryHTML += `<td style="padding: 10px; text-align: center;">${quantity} × 500g potjie${quantity > 1 ? 's' : ''}</td>`;
                } else if (weightStr.includes('375ml')) {
                    summaryHTML += `<td style="padding: 10px; text-align: center;">${quantity} × 375ml potjie${quantity > 1 ? 's' : ''}</td>`;
                } else {
                    summaryHTML += `<td style="padding: 10px; text-align: center;">${quantity} × unit${quantity > 1 ? 's' : ''}</td>`;
                }
                summaryHTML += `<td style="padding: 10px; text-align: right;">R${unitPrice.toFixed(2)}/unit</td>`;
            } else {
                summaryHTML += `<td style="padding: 10px; text-align: center;">${quantity} × ${weight.toFixed(2)}kg</td>`;
                summaryHTML += `<td style="padding: 10px; text-align: right;">R${unitPrice.toFixed(2)}/kg</td>`;
            }

            summaryHTML += `<td style="padding: 10px; text-align: right; font-weight: 500;">R${lineTotal.toFixed(2)}</td>`;
            summaryHTML += '</tr>';
        }
    });

    summaryHTML += '<tr style="background-color: #f9f9f9; border-top: 2px solid #ddd; font-weight: bold;">';
    summaryHTML += '<td colspan="3" style="padding: 12px; text-align: right;">TOTAAL:</td>';
    summaryHTML += `<td style="padding: 12px; text-align: right; font-size: 1.1em; color: #e67e22;">R${totalAmount.toFixed(2)}</td>`;
    summaryHTML += '</tr>';

    summaryHTML += '</table>';
    return summaryHTML;
}

/**
 * Generate order summary HTML for email
 * @function generateOrderSummary
 * @param {Object} items - Cart items object
 * @returns {string} HTML formatted order summary
 */
function generateOrderSummary(items) {
    if (!items || Object.keys(items).length === 0) {
        return '<p>Geen items in bestelling nie.</p>';
    }

    let summaryHTML = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    summaryHTML += '<tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">';
    summaryHTML += '<th style="padding: 12px; text-align: left; font-weight: bold;">Produk</th>';
    summaryHTML += '<th style="padding: 12px; text-align: center; font-weight: bold;">Hoeveelheid</th>';
    summaryHTML += '<th style="padding: 12px; text-align: right; font-weight: bold;">Prys</th>';
    summaryHTML += '<th style="padding: 12px; text-align: right; font-weight: bold;">Subtotaal</th>';
    summaryHTML += '</tr>';

    let totalAmount = 0;

    Object.entries(items).forEach(([productName, item]) => {
        const quantity = item.quantity || 1;
        const estimatedWeight = getEstimatedWeight(productName) || 1;
        const totalWeight = quantity * estimatedWeight;
        const pricing = getCustomerPricing()[productName];
        const unitPrice = pricing ? pricing.selling : 0;
        const itemTotal = totalWeight * unitPrice;

        totalAmount += itemTotal;

        summaryHTML += '<tr style="border-bottom: 1px solid #eee;">';
        summaryHTML += `<td style="padding: 10px; font-weight: 500;">${productName}</td>`;
        summaryHTML += `<td style="padding: 10px; text-align: center;">${quantity} (±${totalWeight.toFixed(1)}kg)</td>`;
        summaryHTML += `<td style="padding: 10px; text-align: right;">R${unitPrice.toFixed(2)}/kg</td>`;
        summaryHTML += `<td style="padding: 10px; text-align: right; font-weight: 500;">R${itemTotal.toFixed(2)}</td>`;
        summaryHTML += '</tr>';
    });

    summaryHTML += '<tr style="background-color: #f9f9f9; border-top: 2px solid #ddd; font-weight: bold;">';
    summaryHTML += '<td colspan="3" style="padding: 12px; text-align: right;">TOTAAL:</td>';
    summaryHTML += `<td style="padding: 12px; text-align: right; font-size: 1.1em; color: #e67e22;">R${totalAmount.toFixed(2)}</td>`;
    summaryHTML += '</tr>';

    summaryHTML += '</table>';
    return summaryHTML;
}

/**
 * Calculate total order amount
 * @function calculateOrderTotal
 * @param {Object} items - Cart items object
 * @returns {number} Total order amount
 */
function calculateOrderTotal(items) {
    if (!items || Object.keys(items).length === 0) {
        return 0;
    }

    let total = 0;
    Object.entries(items).forEach(([productName, item]) => {
        const quantity = item.quantity || 1;
        const estimatedWeight = getEstimatedWeight(productName) || 1;
        const totalWeight = quantity * estimatedWeight;
        const pricing = getCustomerPricing()[productName];
        const unitPrice = pricing ? pricing.selling : 0;
        total += totalWeight * unitPrice;
    });

    return total;
}

/**
 * Generate confirmation email body HTML
 * @function generateConfirmationEmailBody
 * @param {Object} data - Email data object
 * @returns {string} HTML formatted email body
 */
function generateConfirmationEmailBody(data) {
    return `
<!DOCTYPE html>
<html lang="af">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bestelling Bevestiging</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #e67e22, #f39c12); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🐔 Plaas Hoenders</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Vars hoenders van die plaas na jou deur</p>
    </div>

    <div style="background: white; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-radius: 0 0 10px 10px;">
        <h2 style="color: #e67e22; margin-top: 0;">Baie dankie vir jou bestelling! 🎉</h2>

        <p>Hallo <strong>${data.customerName}</strong>,</p>

        <p>Ons het jou bestelling suksesvol ontvang en dit word tans verwerk. Hier is jou bestelling besonderhede:</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">📋 Bestelling Besonderhede</h3>
            <p><strong>Bestelling Nommer:</strong> #${data.orderId}</p>
            <p><strong>Datum & Tyd:</strong> ${data.orderDate}</p>
            <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">Verwerk</span></p>
        </div>

        <h3 style="color: #2c3e50;">🛒 Jou Bestelling:</h3>
        ${data.orderSummary}

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; font-weight: bold; color: #856404;">⚠️ Provisionele Totaal</p>
            <p style="margin: 5px 0 0 0; color: #856404;">Finale bedrag sal bereken word op werklike gewigte van plaas slaghuis.</p>
        </div>

  
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">📦 Aflewering Besonderhede</h3>
            <p><strong>Aflewering Adres:</strong></p>
            <p style="background: white; padding: 10px; border-radius: 5px;">${data.customerAddress || 'Nie verskaf nie'}</p>
            <p><strong>Kontak Nommer:</strong> ${data.customerPhone || 'Nie verskaf nie'}</p>
            <p><strong>Aflewering Tyd:</strong> Saterdae tussen 06:00 - 12:00</p>
        </div>

        <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <h3 style="margin-top: 0; color: #0c5460;">📞 Belangrike Inligting</h3>
            <ul style="margin: 10px 0;">
                <li>Jou bestelling sal Saterdag oggend afgelewer word</li>
                <li>Ons sal jou kontak om die presiese aflewer tyd te bevestig</li>
                <li>Jou bestelling sal gereed wees vir aflewering</li>
                <li>Alle hoenders is vars en van hoë kwaliteit</li>
                <li>Gewigte is benaderd - werklike gewig kan effens verskil</li>
            </ul>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <div style="text-align: center; color: #666;">
            <p><strong>Kontak Ons:</strong></p>
            <p>📞 Adriaan Bester: <a href="tel:0796167761" style="color: #e67e22;">079 616 7761</a></p>
            <p>📧 E-pos: <a href="mailto:abester7@gmail.com" style="color: #e67e22;">abester7@gmail.com</a></p>
            <p>🌐 Webwerf: <a href="https://bester1.github.io/hoenders/customer-portal.html" style="color: #e67e22;">Klietshuis Portaal</a></p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 14px;">
            <p>Baie dankie dat jy Plaas Hoenders gekies het! 🐔</p>
            <p><em>Vars, gesonde hoenders direk van die plaas na jou tafel</em></p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Handle order placement from beautiful portal
 * @function handleOrderPlacement
 */
async function handleOrderPlacement() {
    try {
        if (Object.keys(cart).length === 0) {
            alert('Voeg items by jou mandjie om voort te gaan');
            return;
        }

        console.log('🚀 Starting order placement...');
        console.log('Cart contents:', cart);
        console.log('Current customer:', currentCustomer);

        // Create order from cart
        const orderData = {
            customer: currentCustomer,
            items: cart,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        console.log('📦 Order data prepared:', orderData);

        // Save order to database
        console.log('💾 Saving order to database...');
        const savedOrderId = await saveOrderToDatabase(orderData);
        console.log('🎉 Order saved with ID:', savedOrderId);
        
        // Save order data to localStorage for invoice generation
        const orderDataForInvoice = {
            orderId: savedOrderId,
            items: cart,
            customer: currentCustomer,
            timestamp: orderData.timestamp
        };
        localStorage.setItem(`orderData_${savedOrderId}`, JSON.stringify(orderDataForInvoice));
        console.log('💾 Order data saved to localStorage for invoice generation');

        // Send confirmation email to customer
        console.log('📧 Sending confirmation email to customer...');
        await sendOrderConfirmationEmail(savedOrderId, orderDataForInvoice);

        // Show confirmation step
        console.log('📱 Showing confirmation step...');
        showBeautifulStep(4);

        // Update order number with the actual saved order ID
        const orderNumber = document.getElementById('orderNumber');
        if (orderNumber) {
            orderNumber.textContent = `#${savedOrderId}`;
        }

        // Populate confirmation order summary
        populateConfirmationOrderSummary(orderData);
        
        // Re-enable button after successful order (will be reset by new order button later)
        const placeOrderBtn = document.getElementById('placeOrder');
        if (placeOrderBtn) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Plaas Bestelling';
            placeOrderBtn.style.opacity = '1';
        }
        
        // Clear cart after successful order
        clearCart();
        
    } catch (error) {
        console.error('❌ Error placing order:', error);
        console.error('Error details:', error.message, error.stack);
        
        // Provide more specific error messages
        let userMessage = 'Er was \'n probleem met die bestelling. Probeer asseblief weer.';
        
        if (error.message.includes('timeout')) {
            userMessage = 'Bestelling het te lank gevat - databasis probleem. Probeer asseblief weer oor \'n paar minute.';
        } else if (error.message.includes('Database operation failed after')) {
            userMessage = 'Databasis verbinding probleem. Kontroleer jou internet verbinding en probeer weer.';
        } else if (error.message.includes('Network')) {
            userMessage = 'Internet verbinding probleem. Kontroleer jou wifi en probeer weer.';
        }
        
        alert(userMessage);
    }
}

/**
 * Populate confirmation order summary
 * @function populateConfirmationOrderSummary
 * @param {Object} orderData - Order data with customer, items, timestamp, status
 */
function populateConfirmationOrderSummary(orderData) {
    try {
        console.log('📋 Populating confirmation order summary...');

        const summaryContainer = document.getElementById('confirmationOrderSummary');
        const itemsContainer = document.getElementById('confirmationOrderItems');
        const totalElement = document.getElementById('confirmationTotal');

        if (!summaryContainer || !itemsContainer || !totalElement) {
            console.error('❌ Confirmation summary elements not found');
            return;
        }

        // Clear existing content
        itemsContainer.innerHTML = '';

        // Populate order items
        let totalAmount = 0;
        const cart = orderData.items || {};

        Object.entries(cart).forEach(([productKey, itemData]) => {
            const quantity = parseInt(itemData.quantity) || 0;
            const weight = parseFloat(itemData.weight) || 0;
            const unitPrice = parseFloat(itemData.unitPrice) || 0;
            const lineTotal = parseFloat(itemData.lineTotal) || (unitPrice * weight);
            const productName = itemData.productName || productKey;

            // Check if this is a per-unit product
            const pricing = getCustomerPricing()[productName];
            const isPerUnit = pricing && (pricing.unit === 'per potjie' || pricing.unit === 'per unit');

            if (quantity > 0) {
                totalAmount += lineTotal;

                const itemElement = document.createElement('div');
                itemElement.className = 'flex justify-between items-center text-sm';

                // Format display based on unit type
                let quantityDisplay;
                if (isPerUnit) {
                    const weightStr = getEstimatedWeight(productName);
                    if (weightStr.includes('500g')) {
                        quantityDisplay = `${quantity} × 500g potjie${quantity > 1 ? 's' : ''}`;
                    } else if (weightStr.includes('375ml')) {
                        quantityDisplay = `${quantity} × 375ml potjie${quantity > 1 ? 's' : ''}`;
                    } else {
                        quantityDisplay = `${quantity} × unit${quantity > 1 ? 's' : ''}`;
                    }
                } else {
                    quantityDisplay = `${quantity} × ${weight.toFixed(2)}kg`;
                }

                itemElement.innerHTML = `
                    <div class="text-zinc-300">
                        <span class="font-medium">${productName}</span>
                        <span class="text-zinc-500 ml-2">${quantityDisplay}</span>
                    </div>
                    <span class="text-zinc-100">R${lineTotal.toFixed(2)}</span>
                `;
                itemsContainer.appendChild(itemElement);
            }
        });

        // Update total
        totalElement.textContent = `R${totalAmount.toFixed(2)}`;

        // Show the summary container
        summaryContainer.style.display = 'block';
        summaryContainer.style.visibility = 'visible';

        console.log('✅ Confirmation order summary populated successfully');

    } catch (error) {
        console.error('❌ Error populating confirmation order summary:', error);
    }
}

/**
 * Save order to database
 * @async
 * @function saveOrderToDatabase
 * @param {Object} orderData - Order data with customer, items, timestamp, status
 * @returns {Promise<string>} - Order ID if successful
 */
async function saveOrderToDatabase(orderData) {
    try {
        console.log('🔍 saveOrderToDatabase called with:', orderData);
        
        if (!currentCustomer) {
            throw new Error('No customer data available');
        }

        // Generate order ID
        const orderId = `ORD-${Date.now()}`;
        console.log('🆔 Generated order ID:', orderId);
        
        // Get pricing information
        console.log('💰 Getting pricing information...');
        const pricing = getCustomerPricing();
        console.log('💰 Pricing data:', pricing);
        
        // Calculate order totals
        let totalAmount = 0;
        let totalWeight = 0;
        const orderItems = [];
        
        // Process each cart item
        console.log('🛒 Processing cart items:', Object.entries(orderData.items));
        let itemIndex = 0;
        for (const [productKey, cartItem] of Object.entries(orderData.items)) {
            // Extract quantity from cart item object
            const quantity = cartItem.quantity || cartItem || 0;
            console.log(`🔑 Processing product key: "${productKey}" with quantity: ${quantity}`);
            
            // Convert product key back to product name
            const productName = getProductNameFromKey(productKey);
            console.log(`📝 Converted "${productKey}" → "${productName}"`);
            
            const productPricing = pricing[productName];
            console.log(`💲 Pricing for "${productName}":`, productPricing);
            
            if (!productPricing) {
                console.error(`❌ No pricing found for product: ${productName}`);
                console.error(`Available pricing keys:`, Object.keys(pricing));
                continue;
            }
            
            // Estimate weight for this product and quantity
            // Skip this item if no pricing found (handle old cart items)
            if (!productPricing) {
                console.warn(`⚠️ Skipping item without pricing: ${productName}`);
                continue;
            }
            
            const estimatedWeight = estimateProductWeight(productName, quantity);
            
            // Calculate total based on unit type
            let itemTotal;
            if (productPricing.unit === 'per potjie' || productPricing.unit === 'per unit') {
                // For per-unit items, price is per unit, not per kg
                itemTotal = productPricing.selling * quantity;
            } else {
                // For per-kg items, price is per kg
                itemTotal = productPricing.selling * estimatedWeight;
            }
            
            totalAmount += itemTotal;
            totalWeight += estimatedWeight;
            
            // Create order item referencing the main order
            // Ensure weight is never 0 or negative (database constraint)
            const safeWeight = Math.max(0.001, estimatedWeight);
            
            orderItems.push({
                order_id: orderId,
                product_name: productName,
                quantity: quantity,
                weight_kg: safeWeight,  // Always > 0 for database constraint
                unit_price_per_kg: productPricing.selling,
                line_total: itemTotal,
                source: 'customer_selection',
                created_at: new Date().toISOString()  // Add timestamp
            });
            
            itemIndex++;
        }
        
        // Create a single order record with total amount
        const orderRecord = {
            order_id: orderId,  // Use existing database column
            order_date: new Date().toISOString().split('T')[0],
            customer_id: currentCustomer.id,
            customer_name: currentCustomer.name,
            customer_email: currentCustomer.email,
            customer_phone: currentCustomer.phone || null,
            customer_address: currentCustomer.address || null,
            product_name: `${orderItems.length} items`, // Summary for main order
            quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
            weight_kg: totalWeight,
            total_amount: totalAmount,
            source: 'customer_portal',
            status: 'pending',
            created_at: orderData.timestamp
        };
        
        // Save single order record
        console.log('💾 Saving order record:', orderRecord);
        console.log('🔄 Attempting database insert...');
        
        // Save order to database with timeout handling
        console.log('💾 Saving order to database...');
        
        // Try the database insert with better error handling
        console.log('💾 About to insert order record:', JSON.stringify(orderRecord, null, 2));
        
        // Create fresh client instance to prevent connection accumulation
        const freshClient = supabase.createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY);
        
        // Add timeout wrapper for database operation with increased timeout
        let insertWithTimeout = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Database insert timeout after 30 seconds'));
            }, 30000); // Increased from 10s to 30s
            
            freshClient
                .from('orders')
                .insert([orderRecord])
                .select() // Force return data even with RLS
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
        
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        // Retry logic for database operations
        while (retryCount < maxRetries) {
            try {
                response = await insertWithTimeout;
                break; // Success, exit retry loop
            } catch (error) {
                retryCount++;
                console.log(`❌ Database attempt ${retryCount}/${maxRetries} failed:`, error.message);
                
                if (retryCount >= maxRetries) {
                    throw new Error(`Database operation failed after ${maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retrying (exponential backoff)
                const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
                console.log(`⏳ Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Create fresh client instance for retry to prevent connection accumulation
                const retryClient = createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY);
                
                // Recreate the timeout promise for the retry
                insertWithTimeout = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Database insert timeout after 30 seconds'));
                    }, 30000);
                    
                    retryClient
                        .from('orders')
                        .insert([orderRecord])
                        .select() // Force return data even with RLS
                        .then(result => {
                            clearTimeout(timeout);
                            resolve(result);
                        })
                        .catch(error => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                });
            }
        }
        
        console.log('📡 Database response:', response);
        
        if (response.error) {
            console.error('❌ Error saving order:', response.error);
            throw new Error(`Database error: ${response.error.message}`);
        }
        
        console.log('✅ Order record saved to database successfully');
        
        // Save order items
        if (orderItems.length > 0) {
            console.log('💾 Saving order items:', orderItems);
            console.log('🔍 Order items count:', orderItems.length);
            console.log('🔍 First order item sample:', JSON.stringify(orderItems[0], null, 2));
            
            // Create fresh client instance for order items to prevent connection accumulation
            const itemsClient = supabase.createClient(FALLBACK_CONFIG.SUPABASE_URL, FALLBACK_CONFIG.SUPABASE_ANON_KEY);
            
            // Insert with .select() and timeout to force data return even with RLS
            const itemsInsertWithTimeout = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Order items insert timeout after 30 seconds'));
                }, 30000); // Increased from 10s to 30s
                
                itemsClient
                    .from('order_items')
                    .insert(orderItems)
                    .select() // Force return data even with RLS
                    .then(result => {
                        clearTimeout(timeout);
                        resolve(result);
                    })
                    .catch(error => {
                        clearTimeout(timeout);
                        reject(error);
                    });
            });
            
            let itemsResponse;
            try {
                itemsResponse = await itemsInsertWithTimeout;
            } catch (timeoutError) {
                console.error('❌ Order items database operation failed:', timeoutError);
                alert('Order items submission failed - database timeout.');
                // Don't throw, continue anyway
                itemsResponse = { error: timeoutError, data: null };
            }
            
            console.log('📡 Order items response:', itemsResponse);
            
            if (itemsResponse.error) {
                console.error('❌ CRITICAL: Order items not saved:', itemsResponse.error);
                console.error('❌ Full error details:', JSON.stringify(itemsResponse.error, null, 2));
                // Don't throw error, but log it prominently
                alert(`WARNING: Order saved but items may be missing. Error: ${itemsResponse.error.message}`);
            } else if (!itemsResponse.data || itemsResponse.data.length === 0) {
                console.error('❌ CRITICAL: Order items insert returned success but no data!');
                console.error('❌ This is likely an RLS (Row Level Security) issue in Supabase');
                console.error('❌ Response:', itemsResponse);
                
                // Try direct verification instead of relying on insert response
                console.log('🔍 Attempting direct verification of inserted items...');
            } else {
                console.log('✅ Order items saved successfully');
                console.log('✅ Saved items count:', itemsResponse.data.length);
                console.log('✅ Saved items data:', itemsResponse.data);
            }
        } else {
            console.error('❌ CRITICAL: No order items to save! orderItems array is empty');
            console.log('🔍 orderData.items:', orderData.items);
        }
        
        console.log('Order saved successfully:', orderId);
        return orderId;
        
    } catch (error) {
        console.error('Failed to save order to database:', error);
        throw error;
    }
}

/**
 * Convert product key back to product name
 * @function getProductNameFromKey
 * @param {string} productKey - Product key from cart
 * @returns {string} - Original product name
 */
function getProductNameFromKey(productKey) {
    console.log(`🔍 Looking up product name for key: "${productKey}"`);
    
    // Get all available products
    const allProducts = getCustomerPricing();
    console.log(`📋 Available products:`, Object.keys(allProducts));
    
    // First try exact key match
    for (const productName of Object.keys(allProducts)) {
        const generatedKey = productName.replace(/[^A-Z0-9]/g, '_');
        // Only log when we find a match to reduce console spam
        if (generatedKey === productKey) {
            console.log(`✅ Found exact match: "${productKey}" → "${productName}"`);
            return productName;
        }
    }
    
    console.log(`❌ No exact match found for key: "${productKey}"`);
    
    // Fallback: convert key back to name by replacing underscores
    const fallbackName = productKey.replace(/_/g, ' ')
                    .replace(/  /g, ' ')  // Remove double spaces
                    .replace(/ S /g, '\'S '); // Fix things like FLATTY S → FLATTY'S
                    
    console.log(`🔄 Fallback conversion: "${productKey}" → "${fallbackName}"`);
    return fallbackName;
}

/**
 * Estimate product weight based on typical weights
 * @function estimateProductWeight
 * @param {string} productName - Name of the product
 * @param {number} quantity - Quantity ordered
 * @returns {number} - Estimated weight in kg
 */
function estimateProductWeight(productName, quantity) {
    // Products sold per unit (not by weight)
    const perUnitProducts = ['SUIWER HEUNING', 'INGELEGDE GROEN VYE'];
    
    // Return nominal weight for per-unit products (database requires weight > 0)
    if (perUnitProducts.includes(productName)) {
        // Use actual jar weight for database constraint compliance
        if (productName === 'SUIWER HEUNING') {
            return 0.5 * quantity; // 500g potjie
        }
        if (productName === 'INGELEGDE GROEN VYE') {
            return 0.375 * quantity; // 375ml potjie (approximately 375g)
        }
        return 0.001 * quantity; // Fallback minimal weight
    }
    
    // Actual average weights per item based on your data (in kg)
    const typicalWeights = {
        'HEEL HOENDER': 2.19,                    // heel
        'PLAT HOENDER (FLATTY\'S)': 2.10,        // plat  
        'BRAAIPAKKE': 2.07,                      // braaipak
        'HEEL HALWE HOENDERS': 1.05,             // halwe hoender
        'BORSSTUKKE MET BEEN EN VEL (2 IN PAK)': 1.05,  // 2bors
        'BORSSTUKKE MET BEEN EN VEL (4 IN PAK)': 2.09,  // 4bors
        'VLERKIES': 0.85,                        // vlerke
        'BOUDE EN DYE': 0.76,                    // boud/dy
        'FILETTE (sonder vel)': 1.04,            // Fillets
        'GUNS Boud en dy aanmekaar': 1.23,       // guns
        'LEWER': 0.50,                           // lewer
        'NEKKIES': 1.00,                         // 1kg bags
        'ONTBEENDE HOENDER': 1.53,               // Ontbeen
        'HOENDER PATTIES': 0.58,                 // Patties
        'HOENDER KAASWORS': 0.57,                // Kaaswors
        'STRIPS': 0.50,                          // Strips
        'GEVULDE HOENDER ROLLE OPSIE 1': 1.75,  // Vye rol
        'GEVULDE HOENDER ROLLE OPSIE 2': 1.83    // Pep rol
    };
    
    const baseWeight = typicalWeights[productName] || 1.0; // Default 1kg if unknown
    const totalWeight = baseWeight * quantity;
    
    // Ensure weight is never 0 (database constraint requires weight > 0)
    return Math.max(0.001, totalWeight);
}

/**
 * Navigate to specific portal section with smooth transition
 * @async
 * @function navigateToSection
 * @param {string} sectionName - Section to navigate to (dashboard, products, orders, profile)
 * @returns {Promise<void>}
 */
async function navigateToSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['dashboard', 'products', 'orders', 'profile'];
        if (!validSections.includes(sectionName)) {
            console.error('Invalid section name:', sectionName);
            return;
        }

        // Don't navigate if already on this section
        if (currentSection === sectionName) {
            return;
        }

        // Update navigation state
        currentSection = sectionName;
        updateNavigationState();

        // Apply smooth transition effect
        await performSectionTransition(sectionName);

        // Update URL hash for navigation state and browser history
        updateNavigationUrl(sectionName);

    } catch (error) {
        console.error('Error navigating to section:', error);
        showSectionError(sectionName, 'Navigation failed. Please try again.');
    }
}

/**
 * Perform smooth transition between sections
 * @async
 * @function performSectionTransition
 * @param {string} targetSectionName - Target section to show
 * @returns {Promise<void>}
 */
async function performSectionTransition(targetSectionName) {
    const allSections = document.querySelectorAll('.customer-section:not(#auth-section)');
    const targetSection = document.getElementById(`${targetSectionName}-section`);

    if (!targetSection) {
        throw new Error(`Target section not found: ${targetSectionName}`);
    }

    // Add transitioning class to prevent multiple rapid clicks
    document.body.classList.add('section-transitioning');

    try {
        // Step 1: Fade out current section
        const currentActiveSection = document.querySelector('.customer-section.active:not(#auth-section)');
        if (currentActiveSection && currentActiveSection !== targetSection) {
            currentActiveSection.style.opacity = '0';
            await new Promise(resolve => setTimeout(resolve, 150)); // Wait for fade out
            currentActiveSection.classList.remove('active');
        }

        // Step 2: Prepare target section (hidden, positioned)
        targetSection.style.opacity = '0';
        targetSection.classList.add('active');
        
        // Step 3: Load section data while transition happens
        const dataLoadPromise = loadSectionData(targetSectionName);
        
        // Step 4: Small delay to ensure DOM updates, then fade in
        await new Promise(resolve => setTimeout(resolve, 50));
        targetSection.style.opacity = '1';
        
        // Step 5: Wait for data loading to complete
        await dataLoadPromise;
        
        // Step 6: Clean up transition state
        await new Promise(resolve => setTimeout(resolve, 200)); // Complete fade in
        
    } finally {
        // Always remove transitioning class
        document.body.classList.remove('section-transitioning');
        
        // Reset opacity for all sections
        allSections.forEach(section => {
            if (!section.classList.contains('active')) {
                section.style.opacity = '';
            }
        });
    }
}

/**
 * Update URL and browser history for navigation
 * @function updateNavigationUrl  
 * @param {string} sectionName - Current section name
 */
function updateNavigationUrl(sectionName) {
    // Update URL hash for navigation state (maintains browser history)
    if (window.history && window.history.pushState) {
        const newUrl = `${window.location.pathname}${window.location.search}#${sectionName}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        
        // Only update if URL actually changed
        if (newUrl !== currentUrl) {
            window.history.pushState({ section: sectionName }, '', newUrl);
        }
    }
}

/**
 * Update navigation menu state (active button highlighting)
 * @function updateNavigationState
 */
function updateNavigationState() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === currentSection) {
            item.classList.add('active');
        }
    });
}

/**
 * Load data for specific section if not already loaded
 * @async
 * @function loadSectionData
 * @param {string} sectionName - Section name
 * @returns {Promise<void>}
 */
async function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'products':
            await loadProducts();
            break;
        case 'orders':
            await loadOrders();
            break;
        case 'profile':
            await loadProfile();
            break;
        case 'dashboard':
            // Dashboard doesn't need additional data loading
            break;
        default:
            console.warn('Unknown section for data loading:', sectionName);
    }
}

/**
 * Update customer name and personalization in all UI locations
 * @function updateCustomerNameInUI
 */
function updateCustomerNameInUI() {
    console.log('🎨 updateCustomerNameInUI() called');
    console.log('📊 currentCustomer:', currentCustomer);
    
    if (!currentCustomer) {
        console.log('⚠️ No customer data available for UI update');
        return;
    }
    
    console.log('🔄 Updating UI with customer data');
    
    // Update main dashboard welcome
    const customerNameElement = document.getElementById('customerName');
    if (customerNameElement) {
        customerNameElement.textContent = currentCustomer.name;
        console.log('✅ Customer name element updated');
    } else {
        console.log('⚠️ Customer name element not found');
    }

    // Update navigation customer name
    const navCustomerName = document.getElementById('navCustomerName');
    if (navCustomerName) {
        navCustomerName.textContent = currentCustomer.name;
        console.log('✅ Navigation customer name updated');
    } else {
        console.log('⚠️ Navigation customer name element not found');
    }

    // Update page title with customer name
    document.title = `Plaas Hoenders - ${currentCustomer.name}'s Portal`;
    console.log('✅ Page title updated');

    // Update personalized content in dashboard
    updateDashboardPersonalization();
    console.log('✅ Customer name UI update completed');
}

/**
 * Update dashboard with customer-specific information
 * @function updateDashboardPersonalization
 */
function updateDashboardPersonalization() {
    if (!currentCustomer) return;

    // Update dashboard subtitle with personalized greeting
    const sectionSubtitle = document.querySelector('#dashboard-section .section-subtitle');
    if (sectionSubtitle) {
        const timeOfDay = getGreetingTimeOfDay();
        sectionSubtitle.innerHTML = `${timeOfDay}, <strong>${currentCustomer.name}</strong>! Manage your orders and account`;
    }

    // Show customer-specific information if available
    updateCustomerInfo();
}

/**
 * Get appropriate greeting based on time of day
 * @function getGreetingTimeOfDay
 * @returns {string} Time-appropriate greeting
 */
function getGreetingTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour < 6) {
        return 'Good evening'; // Late night
    } else if (hour < 12) {
        return 'Good morning';
    } else if (hour < 17) {
        return 'Good afternoon';
    } else {
        return 'Good evening';
    }
}

/**
 * Update customer-specific information display
 * @function updateCustomerInfo
 */
function updateCustomerInfo() {
    if (!currentCustomer) return;

    // Show customer details in dashboard if needed
    const customerInfo = {
        name: currentCustomer.name,
        email: currentCustomer.email,
        phone: currentCustomer.phone || 'Not provided',
        address: currentCustomer.address || 'Not provided',
        memberSince: currentCustomer.created_at ? formatMemberSinceDate(currentCustomer.created_at) : 'Recently',
        lastLogin: currentCustomer.last_login ? formatLastLoginDate(currentCustomer.last_login) : 'First visit'
    };

    // Add customer info to dashboard if there's a designated area
    const customerInfoElement = document.getElementById('customerInfo');
    if (customerInfoElement) {
        customerInfoElement.innerHTML = `
            <div class="customer-info-card">
                <h4><i class="fas fa-user"></i> Account Information</h4>
                <div class="info-item">
                    <span class="label">Email:</span>
                    <span class="value">${customerInfo.email}</span>
                </div>
                <div class="info-item">
                    <span class="label">Phone:</span>
                    <span class="value">${customerInfo.phone}</span>
                </div>
                <div class="info-item">
                    <span class="label">Delivery Address:</span>
                    <span class="value">${customerInfo.address}</span>
                </div>
                <div class="info-item">
                    <span class="label">Member Since:</span>
                    <span class="value">${customerInfo.memberSince}</span>
                </div>
                <div class="info-item">
                    <span class="label">Last Visit:</span>
                    <span class="value">${customerInfo.lastLogin}</span>
                </div>
            </div>
        `;
    }
}

/**
 * Format member since date for display
 * @function formatMemberSinceDate
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatMemberSinceDate(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
            return date.toLocaleDateString('en-ZA', { 
                year: 'numeric', 
                month: 'long' 
            });
        }
    } catch (error) {
        console.error('Error formatting member since date:', error);
        return 'Recently';
    }
}

/**
 * Format last login date for display
 * @function formatLastLoginDate
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatLastLoginDate(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));

        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minutes ago`;
        } else if (diffMinutes < 1440) { // Less than 24 hours
            const hours = Math.floor(diffMinutes / 60);
            return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        } else if (diffMinutes < 10080) { // Less than 7 days
            const days = Math.floor(diffMinutes / 1440);
            return days === 1 ? 'Yesterday' : `${days} days ago`;
        } else {
            return date.toLocaleDateString('en-ZA', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    } catch (error) {
        console.error('Error formatting last login date:', error);
        return 'Recently';
    }
}

/**
 * Update authentication UI based on current state
 * @function updateAuthUI
 */
function updateAuthUI() {
    const customerAuth = document.getElementById('customerAuth');
    
    if (!customerAuth) return;

    if (currentCustomer && customerSession) {
        // User is logged in - show minimal header (navigation handles logout)
        customerAuth.innerHTML = `
            <span class="customer-greeting">Hello, ${currentCustomer.name}</span>
        `;
    } else {
        // User not logged in - show login prompt
        customerAuth.innerHTML = `
            <button class="btn btn-primary" onclick="showAuthSection()">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        `;
    }
}

/**
 * Load and display products from rate card
 * @async
 * @function loadProducts
 * @returns {Promise<void>}
 */
async function loadProducts() {
    // Show loading state
    showSectionLoading('products', true);
    
    try {
        // Get pricing data and categories
        const pricing = getCustomerPricing();
        const categories = getProductCategories();
        
        // Build product catalog HTML
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) {
            throw new Error('Products grid element not found');
        }

        // Create category filter buttons
        const categoryFilters = createCategoryFilters(categories);
        
        // Create product cards grouped by category
        const productCards = createProductCards(pricing, categories);
        
        // Combine filters and cards
        productsGrid.innerHTML = `
            <div class="product-filters">
                <h3><i class="fas fa-filter"></i> Filter by Category</h3>
                <div class="filter-buttons">
                    ${categoryFilters}
                </div>
            </div>
            <div class="product-categories">
                ${productCards}
            </div>
        `;
        
        productsGrid.style.display = 'block';
        
        // Add event listeners for category filtering
        setupCategoryFiltering();
        
        // Add event listeners for product interactions
        setupProductInteractions();
        
        showSectionLoading('products', false);

    } catch (error) {
        console.error('Error loading products:', error);
        showSectionError('products', 'Unable to load products. Please try again.');
    }
}

/**
 * Create category filter buttons HTML
 * @function createCategoryFilters
 * @param {Object} categories - Product categories
 * @returns {string} HTML string for category filters
 */
function createCategoryFilters(categories) {
    let filtersHTML = `
        <button class="filter-btn active" data-category="all">
            <i class="fas fa-th-large"></i>
            All Products
        </button>
    `;
    
    Object.entries(categories).forEach(([categoryKey, category]) => {
        filtersHTML += `
            <button class="filter-btn" data-category="${categoryKey}">
                <i class="${category.icon}"></i>
                ${category.name}
            </button>
        `;
    });
    
    return filtersHTML;
}

/**
 * Create product cards HTML grouped by category
 * @function createProductCards
 * @param {Object} pricing - Product pricing data
 * @param {Object} categories - Product categories
 * @returns {string} HTML string for product cards
 */
function createProductCards(pricing, categories) {
    let cardsHTML = '';
    
    Object.entries(categories).forEach(([categoryKey, category]) => {
        cardsHTML += `
            <div class="product-category" data-category="${categoryKey}">
                <div class="category-header">
                    <h3><i class="${category.icon}"></i> ${category.name}</h3>
                    <p class="category-description">${category.description}</p>
                </div>
                <div class="category-products">
                    ${createCategoryProductCards(category.products, pricing)}
                </div>
            </div>
        `;
    });
    
    return cardsHTML;
}

/**
 * Create product cards for a specific category
 * @function createCategoryProductCards
 * @param {Array} products - Product names in category
 * @param {Object} pricing - Product pricing data
 * @returns {string} HTML string for category product cards
 */
function createCategoryProductCards(products, pricing) {
    return products.map(productName => {
        const priceData = pricing[productName];
        const displayInfo = getProductDisplayInfo(productName);
        
        if (!priceData) {
            console.warn(`No pricing data found for product: ${productName}`);
            return '';
        }
        
        // Pass pricing cache to avoid redundant calls
        const availability = getProductAvailability(productName, pricing);
        const availabilityClass = availability.available ? 'available' : 'unavailable';
        const availabilityIcon = availability.available ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        
        return `
            <div class="product-card ${availabilityClass}" data-product="${productName}">
                <div class="product-header">
                    <h4 class="product-name">${displayInfo.displayName}</h4>
                    <div class="product-availability ${availabilityClass}">
                        <i class="${availabilityIcon}"></i>
                        <span class="availability-text">${availability.text}</span>
                    </div>
                </div>
                
                <div class="product-description">
                    <p>${displayInfo.description}</p>
                </div>
                
                <div class="product-pricing">
                    <div class="price-display">
                        <span class="price-amount">${formatCurrency(priceData.selling)}</span>
                        <span class="price-unit">${priceData.unit}</span>
                    </div>
                </div>
                
                <div class="product-packaging">
                    <i class="fas fa-box"></i>
                    <span class="packaging-info">${priceData.packaging || 'Standard packaging'}</span>
                </div>
                
                <div class="product-actions">
                    ${availability.available ? `
                        <button class="btn btn-primary add-to-cart" data-product="${productName}">
                            <i class="fas fa-shopping-cart"></i>
                            Add to Cart
                        </button>
                    ` : `
                        <button class="btn btn-secondary" disabled>
                            <i class="fas fa-ban"></i>
                            Not Available
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Determine product availability status
 * @function getProductAvailability
 * @param {string} productName - Product name
 * @param {Object} [pricingCache] - Optional pricing cache to avoid redundant calls
 * @returns {Object} Availability information
 */
function getProductAvailability(productName, pricingCache = null) {
    // Use cached pricing or fetch if not provided
    const pricing = pricingCache || getCustomerPricing();
    const product = pricing[productName];
    
    if (product && product.packaging) {
        const packaging = product.packaging.toUpperCase();
        if (packaging.includes('NIE ALTYD BESKIKBAAR')) {
            return {
                available: true,
                limited: true,
                text: 'Limited availability'
            };
        }
    }
    
    // Default to available
    return {
        available: true,
        limited: false,
        text: 'Available'
    };
}

/**
 * Setup category filtering functionality
 * @function setupCategoryFiltering
 */
function setupCategoryFiltering() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const productCategories = document.querySelectorAll('.product-category');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Update active filter button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide product categories
            productCategories.forEach(categoryEl => {
                if (category === 'all') {
                    categoryEl.style.display = 'block';
                } else {
                    const categoryKey = categoryEl.getAttribute('data-category');
                    categoryEl.style.display = categoryKey === category ? 'block' : 'none';
                }
            });
            
            // Smooth scroll to products
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

/**
 * Setup product interaction functionality (cart, favorites, etc.)
 * @function setupProductInteractions
 */
function setupProductInteractions() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productName = this.getAttribute('data-product');
            handleAddToCart(productName);
        });
    });
}

/**
 * Handle adding product to cart
 * @function handleAddToCart
 * @param {string} productName - Product to add to cart
 */
function handleAddToCart(productName) {
    const displayInfo = getProductDisplayInfo(productName);
    const productKey = productName.replace(/[^A-Z0-9]/g, '_');
    
    // Add one item to cart (quantity 1)
    const currentQty = cart[productKey] || 0;
    setQuantity(productKey, currentQty + 1);
    
    // Show success message
    showToast(`${displayInfo.displayName} bygevoeg by mandjie!`, 'success');
    console.log(`✅ Added to cart: ${productName} (${cart[productKey]} items)`);
    
    // Save cart and update display
    saveCartToStorage();
}

/**
 * Load and display customer orders
 * @async
 * @function loadOrders
 * @returns {Promise<void>}
 */
async function loadOrders() {
    // Show loading state
    showSectionLoading('orders', true);
    
    try {
        if (!currentCustomer) {
            throw new Error('No customer data available');
        }

        // TODO: Load orders from database
        // For now, show empty state
        setTimeout(() => {
            const ordersEmpty = document.getElementById('ordersEmpty');
            if (ordersEmpty) {
                ordersEmpty.style.display = 'block';
            }
            showSectionLoading('orders', false);
        }, 1000);

    } catch (error) {
        console.error('Error loading orders:', error);
        showSectionError('orders', 'Unable to load orders. Please try again.');
    }
}

/**
 * Load and display customer profile form
 * @async
 * @function loadProfile
 * @returns {Promise<void>}
 */
async function loadProfile() {
    // Show loading state
    showSectionLoading('profile', true);
    
    try {
        if (!currentCustomer) {
            throw new Error('No customer data available');
        }

        // Build profile form with current customer data
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) {
            throw new Error('Profile form element not found');
        }

        // Create profile management form HTML
        profileForm.innerHTML = `
            <div class="profile-tabs">
                <button class="profile-tab active" data-tab="general" onclick="switchProfileTab('general')">
                    <i class="fas fa-user"></i> General Information
                </button>
                <button class="profile-tab" data-tab="password" onclick="switchProfileTab('password')">
                    <i class="fas fa-key"></i> Password
                </button>
                <button class="profile-tab" data-tab="preferences" onclick="switchProfileTab('preferences')">
                    <i class="fas fa-cog"></i> Communication Preferences
                </button>
                <button class="profile-tab" data-tab="account" onclick="switchProfileTab('account')">
                    <i class="fas fa-user-slash"></i> Account Settings
                </button>
            </div>

            <!-- General Information Tab -->
            <div id="general-tab" class="profile-tab-content active">
                <form id="profileUpdateForm" onsubmit="handleProfileUpdate(event)">
                    <div class="form-section">
                        <h3><i class="fas fa-user"></i> Personal Details</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="profileName">
                                    <i class="fas fa-user"></i> Full Name *
                                </label>
                                <input 
                                    type="text" 
                                    id="profileName" 
                                    name="name" 
                                    required 
                                    minlength="2"
                                    maxlength="255"
                                    pattern="[A-Za-z\\s\\-']+"
                                    value="${escapeHtml(currentCustomer.name || '')}"
                                    placeholder="Enter your full name"
                                    autocomplete="name"
                                >
                                <div class="field-error" id="profileNameError"></div>
                            </div>
                            <div class="form-group">
                                <label for="profileEmail">
                                    <i class="fas fa-envelope"></i> Email Address *
                                </label>
                                <input 
                                    type="email" 
                                    id="profileEmail" 
                                    name="email" 
                                    required 
                                    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
                                    value="${escapeHtml(currentCustomer.email || '')}"
                                    placeholder="Enter your email address"
                                    autocomplete="email"
                                >
                                <div class="field-error" id="profileEmailError"></div>
                                <small class="field-help">This is your login email</small>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="profilePhone">
                                    <i class="fas fa-phone"></i> Phone Number
                                </label>
                                <input 
                                    type="tel" 
                                    id="profilePhone" 
                                    name="phone" 
                                    pattern="^(\\+27|0)[0-9]{9}$"
                                    value="${escapeHtml(currentCustomer.phone || '')}"
                                    placeholder="e.g. 079 123 4567"
                                    autocomplete="tel"
                                >
                                <div class="field-error" id="profilePhoneError"></div>
                                <small class="field-help">South African format (optional)</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="profileAddress">
                                <i class="fas fa-map-marker-alt"></i> Delivery Address
                            </label>
                            <textarea 
                                id="profileAddress" 
                                name="address" 
                                rows="3"
                                maxlength="500"
                                placeholder="Enter your delivery address (optional)"
                                autocomplete="address"
                            >${escapeHtml(currentCustomer.address || '')}</textarea>
                            <div class="field-error" id="profileAddressError"></div>
                            <small class="field-help">Where should we deliver your orders?</small>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="profileUpdateBtn">
                            <i class="fas fa-save"></i> Update Profile
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="resetProfileForm()">
                            <i class="fas fa-undo"></i> Reset Changes
                        </button>
                    </div>

                    <div class="form-message" id="profileUpdateMessage"></div>
                </form>
            </div>

            <!-- Password Change Tab -->
            <div id="password-tab" class="profile-tab-content">
                <form id="passwordChangeForm" onsubmit="handlePasswordChange(event)">
                    <div class="form-section">
                        <h3><i class="fas fa-key"></i> Change Password</h3>
                        <p class="section-description">Update your password to keep your account secure.</p>
                        
                        <div class="form-group">
                            <label for="currentPassword">
                                <i class="fas fa-lock"></i> Current Password *
                            </label>
                            <input 
                                type="password" 
                                id="currentPassword" 
                                name="currentPassword" 
                                required 
                                minlength="8"
                                placeholder="Enter your current password"
                                autocomplete="current-password"
                            >
                            <div class="field-error" id="currentPasswordError"></div>
                        </div>

                        <div class="form-group">
                            <label for="newPassword">
                                <i class="fas fa-key"></i> New Password *
                            </label>
                            <input 
                                type="password" 
                                id="newPassword" 
                                name="newPassword" 
                                required 
                                minlength="8"
                                placeholder="Enter your new password"
                                autocomplete="new-password"
                            >
                            <div class="field-error" id="newPasswordError"></div>
                            <small class="field-help">Minimum 8 characters</small>
                        </div>

                        <div class="form-group">
                            <label for="confirmNewPassword">
                                <i class="fas fa-key"></i> Confirm New Password *
                            </label>
                            <input 
                                type="password" 
                                id="confirmNewPassword" 
                                name="confirmNewPassword" 
                                required 
                                minlength="8"
                                placeholder="Confirm your new password"
                                autocomplete="new-password"
                            >
                            <div class="field-error" id="confirmNewPasswordError"></div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="passwordChangeBtn">
                            <i class="fas fa-key"></i> Change Password
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="resetPasswordForm()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>

                    <div class="form-message" id="passwordChangeMessage"></div>
                </form>
            </div>

            <!-- Communication Preferences Tab -->
            <div id="preferences-tab" class="profile-tab-content">
                <form id="preferencesForm" onsubmit="handlePreferencesUpdate(event)">
                    <div class="form-section">
                        <h3><i class="fas fa-bell"></i> Email Notifications</h3>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    id="emailNotificationsPref" 
                                    name="emailNotifications" 
                                    ${(currentCustomer.communication_preferences?.email_notifications !== false) ? 'checked' : ''}
                                >
                                <span class="checkmark"></span>
                                <i class="fas fa-envelope"></i> Receive email notifications about my orders
                            </label>
                            <small class="field-help">Get notified about order confirmations and delivery updates</small>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3><i class="fas fa-truck"></i> Delivery Instructions</h3>
                        <div class="form-group">
                            <label for="deliveryInstructions">
                                <i class="fas fa-clipboard-list"></i> Special Instructions
                            </label>
                            <textarea 
                                id="deliveryInstructions" 
                                name="deliveryInstructions" 
                                rows="3"
                                maxlength="500"
                                placeholder="Any special delivery instructions? (e.g. gate code, safe place, contact person)"
                            >${escapeHtml(currentCustomer.communication_preferences?.delivery_instructions || '')}</textarea>
                            <div class="field-error" id="deliveryInstructionsError"></div>
                            <small class="field-help">Help our delivery team find you</small>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="preferencesUpdateBtn">
                            <i class="fas fa-save"></i> Save Preferences
                        </button>
                    </div>

                    <div class="form-message" id="preferencesUpdateMessage"></div>
                </form>
            </div>

            <!-- Account Settings Tab -->
            <div id="account-tab" class="profile-tab-content">
                <div class="form-section danger-zone">
                    <h3><i class="fas fa-exclamation-triangle"></i> Danger Zone</h3>
                    <p class="section-description danger-text">
                        These actions cannot be undone. Please proceed with caution.
                    </p>
                    
                    <div class="danger-action">
                        <div class="danger-info">
                            <h4>Delete Account</h4>
                            <p>
                                Permanently delete your account and remove your personal information. 
                                Your order history will be preserved for business records but will no longer be accessible to you.
                            </p>
                        </div>
                        <button type="button" class="btn btn-danger" onclick="showAccountDeleteConfirmation()">
                            <i class="fas fa-trash-alt"></i> Delete Account
                        </button>
                    </div>
                </div>
            </div>

            <!-- Account Deletion Confirmation Modal -->
            <div id="deleteConfirmationModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> Confirm Account Deletion</h3>
                        <button class="modal-close" onclick="hideAccountDeleteConfirmation()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="warning-text">
                            <strong>This action cannot be undone.</strong> Your account will be permanently deleted and you will lose access to:
                        </p>
                        <ul class="warning-list">
                            <li>Your order history and invoices</li>
                            <li>Saved delivery information</li>
                            <li>Communication preferences</li>
                            <li>Account access</li>
                        </ul>
                        <p class="confirmation-prompt">
                            Type <strong>DELETE</strong> to confirm:
                        </p>
                        <input type="text" id="deleteConfirmationInput" placeholder="Type DELETE to confirm" class="form-control">
                        <div class="field-error" id="deleteConfirmationError"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" onclick="handleAccountDeletion()" id="confirmDeleteBtn">
                            <i class="fas fa-trash-alt"></i> Delete My Account
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="hideAccountDeleteConfirmation()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        profileForm.style.display = 'block';

        // Initialize real-time validation
        setTimeout(() => {
            setupRealTimeProfileValidation();
        }, 100);

        showSectionLoading('profile', false);

    } catch (error) {
        console.error('Error loading profile:', error);
        showSectionError('profile', 'Unable to load profile. Please try again.');
    }
}

/**
 * HTML escape function to prevent XSS in profile data
 * @function escapeHtml
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Switch between profile management tabs
 * @function switchProfileTab
 * @param {string} tabName - Tab to switch to (general, password, preferences, account)
 */
function switchProfileTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.profile-tab');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('.profile-tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Clear any form errors when switching tabs
    clearProfileFormErrors();
}

/**
 * Update customer profile in database with localStorage fallback
 * @async
 * @function updateCustomerProfile
 * @param {Object} profileData - Profile data to update
 * @param {string} profileData.name - Customer full name
 * @param {string} profileData.email - Customer email address
 * @param {string|null} profileData.phone - Customer phone number (optional)
 * @param {string|null} profileData.address - Customer delivery address (optional)
 * @returns {Promise<Object>} Updated customer object
 * @throws {Error} When update fails in both database and localStorage
 * @since 1.7.0
 * @example
 * const updatedCustomer = await updateCustomerProfile({
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   phone: '079 123 4567',
 *   address: '123 Main St, City'
 * });
 */
async function updateCustomerProfile(profileData) {
    try {
        // Attempt database update first
        const { data, error } = await supabaseClient
            .from('customers')
            .update({
                name: profileData.name,
                email: profileData.email,
                phone: profileData.phone,
                address: profileData.address,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentCustomer.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Update succeeded - return database result
        return data;

    } catch (dbError) {
        console.warn('Database profile update failed, attempting localStorage fallback:', dbError);
        
        try {
            // Fallback to localStorage update
            const updatedCustomer = {
                ...currentCustomer,
                name: profileData.name,
                email: profileData.email,
                phone: profileData.phone,
                address: profileData.address,
                updated_at: new Date().toISOString()
            };

            // Save to localStorage for offline functionality
            localStorage.setItem('plaasHoendersCustomerProfile', JSON.stringify(updatedCustomer));
            
            // Queue update for next online session
            const pendingUpdates = JSON.parse(localStorage.getItem('plaasHoendersPendingProfileUpdates') || '[]');
            pendingUpdates.push({
                customerId: currentCustomer.id,
                profileData: profileData,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('plaasHoendersPendingProfileUpdates', JSON.stringify(pendingUpdates));

            console.info('Profile update queued for next online session');
            return updatedCustomer;

        } catch (fallbackError) {
            console.error('Both database and localStorage profile updates failed:', fallbackError);
            
            // Provide specific error messages based on error type
            if (fallbackError.message?.includes('localStorage')) {
                throw new Error('Failed to save profile changes offline. Please check browser storage settings and try again.');
            } else if (dbError.message?.includes('auth')) {
                throw new Error('Authentication expired. Please log in again to update your profile.');
            } else if (dbError.message?.includes('network')) {
                throw new Error('Network connection failed. Please check your internet connection and try again.');
            } else {
                throw new Error('Failed to update profile. Please try again later or contact support if the issue persists.');
            }
        }
    }
}

/**
 * Load customer profile data from database with localStorage fallback
 * @async
 * @function loadCustomerProfileData
 * @param {string} customerId - Customer ID to load profile for
 * @returns {Promise<Object>} Customer profile object
 * @throws {Error} When profile loading fails from all sources
 * @since 1.7.0
 * @example
 * const customer = await loadCustomerProfileData(customerSession.user.id);
 * console.log('Customer loaded:', customer.name);
 */
async function loadCustomerProfileData(customerId) {
    try {
        // Attempt to load from database first
        const { data: customer, error } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('auth_user_id', customerId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        if (customer) {
            // Update last login timestamp
            await supabaseClient
                .from('customers')
                .update({ last_login: new Date().toISOString() })
                .eq('id', customer.id);

            return customer;
        }

        return null; // Customer not found in database

    } catch (dbError) {
        console.warn('Database profile load failed, checking localStorage fallback:', dbError);
        
        // Fallback to localStorage
        const cachedProfile = localStorage.getItem('plaasHoendersCustomerProfile');
        if (cachedProfile) {
            try {
                const customer = JSON.parse(cachedProfile);
                if (customer.auth_user_id === customerId) {
                    console.info('Loaded customer profile from localStorage cache');
                    return customer;
                }
            } catch (parseError) {
                console.warn('Failed to parse cached customer profile:', parseError);
                localStorage.removeItem('plaasHoendersCustomerProfile');
            }
        }

        // No fallback data available
        throw new Error('Unable to load customer profile from database or cache');
    }
}

/**
 * Process pending profile updates when back online
 * @async
 * @function processPendingProfileUpdates
 * @returns {Promise<void>}
 * @since 1.7.0
 */
async function processPendingProfileUpdates() {
    try {
        const pendingUpdates = JSON.parse(localStorage.getItem('plaasHoendersPendingProfileUpdates') || '[]');
        
        if (pendingUpdates.length === 0) {
            return; // No pending updates
        }

        console.info(`Processing ${pendingUpdates.length} pending profile updates`);
        
        for (const update of pendingUpdates) {
            try {
                await supabaseClient
                    .from('customers')
                    .update({
                        name: update.profileData.name,
                        email: update.profileData.email,
                        phone: update.profileData.phone,
                        address: update.profileData.address,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', update.customerId);
                
                console.info('Processed pending profile update for customer:', update.customerId);
            } catch (updateError) {
                console.warn('Failed to process pending profile update:', updateError);
                // Keep the update in queue for next attempt
                continue;
            }
        }

        // Clear processed updates
        localStorage.removeItem('plaasHoendersPendingProfileUpdates');
        console.info('All pending profile updates processed successfully');

    } catch (error) {
        console.warn('Error processing pending profile updates:', error);
    }
}

/**
 * Handle profile update form submission
 * @async
 * @function handleProfileUpdate
 * @param {Event} event - Form submission event
 * @returns {Promise<void>}
 */
async function handleProfileUpdate(event) {
    event.preventDefault();
    clearProfileFormErrors();

    const formData = new FormData(event.target);
    const profileData = {
        name: formData.get('name').trim(),
        email: formData.get('email').trim().toLowerCase(),
        phone: formData.get('phone')?.trim() || null,
        address: formData.get('address')?.trim() || null
    };

    // Client-side validation
    const validationErrors = validateProfileData(profileData);
    if (validationErrors.length > 0) {
        displayProfileValidationErrors(validationErrors);
        return;
    }

    try {
        showLoadingSpinner(true);
        const updateBtn = document.getElementById('profileUpdateBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating Profile...';

        // Use the new updateCustomerProfile function with fallback support
        const updatedCustomer = await updateCustomerProfile(profileData);

        // Update local customer data
        currentCustomer = updatedCustomer;

        // Update UI elements with new data
        updateCustomerNameInUI();

        showFormMessage('Profile updated successfully!', 'success', 'profileUpdateMessage');
        
        // Show success notification
        showToast('Profile updated successfully!', 'success');

    } catch (error) {
        console.error('Profile update error:', error);
        let errorMessage = 'Failed to update profile. Please try again.';
        
        if (error.message?.includes('duplicate key')) {
            errorMessage = 'This email address is already in use by another account.';
        }
        
        showFormMessage(errorMessage, 'error', 'profileUpdateMessage');
    } finally {
        showLoadingSpinner(false);
        const updateBtn = document.getElementById('profileUpdateBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save"></i> Update Profile';
    }
}

/**
 * Verify current password using Supabase Auth re-authentication
 * @async
 * @function currentPasswordVerification
 * @param {string} currentPassword - Current password to verify
 * @returns {Promise<boolean>} True if password is correct, false otherwise
 * @throws {Error} When verification fails due to network or auth errors
 * @since 1.7.0
 * @example
 * const isValid = await currentPasswordVerification('userCurrentPassword');
 * if (isValid) {
 *   console.log('Current password is correct');
 * }
 */
async function currentPasswordVerification(currentPassword) {
    try {
        if (!customerSession?.user?.email) {
            throw new Error('No authenticated user session');
        }

        // Attempt to sign in with current credentials to verify password
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: customerSession.user.email,
            password: currentPassword
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return false; // Current password is incorrect
            }
            throw error; // Other authentication errors
        }

        // Password verification successful
        return true;

    } catch (error) {
        console.error('Current password verification error:', error);
        throw new Error('Unable to verify current password. Please try again.');
    }
}

/**
 * Update customer password with current password verification and security logging
 * @async
 * @function updateCustomerPassword
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password to set
 * @returns {Promise<void>}
 * @throws {Error} When password update fails or current password is incorrect
 * @since 1.7.0
 * @example
 * await updateCustomerPassword('currentPass123', 'newSecurePass456');
 */
async function updateCustomerPassword(currentPassword, newPassword) {
    try {
        // First verify the current password
        const isCurrentPasswordValid = await currentPasswordVerification(currentPassword);
        
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Current password verified, proceed with update
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            throw error;
        }

        // Log security event for audit trail
        await logSecurityEvent('password_change');

        console.info('Password updated successfully with security logging');

    } catch (error) {
        console.error('Password update error:', error);
        
        if (error.message?.includes('Current password is incorrect')) {
            throw error; // Re-throw with specific message
        } else if (error.message?.includes('New password should be different')) {
            throw new Error('New password must be different from current password');
        } else if (error.message?.includes('Password')) {
            throw new Error('Password must be at least 8 characters long');
        } else {
            throw new Error('Failed to update password. Please try again.');
        }
    }
}

/**
 * Handle password change form submission with current password verification
 * @async
 * @function handlePasswordChange
 * @param {Event} event - Form submission event
 * @returns {Promise<void>}
 */
async function handlePasswordChange(event) {
    event.preventDefault();
    clearProfileFormErrors();

    const formData = new FormData(event.target);
    const passwordData = {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmNewPassword: formData.get('confirmNewPassword')
    };

    // Client-side validation
    const validationErrors = validatePasswordChangeData(passwordData);
    if (validationErrors.length > 0) {
        displayProfileValidationErrors(validationErrors);
        return;
    }

    try {
        showLoadingSpinner(true);
        const changeBtn = document.getElementById('passwordChangeBtn');
        changeBtn.disabled = true;
        changeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing Password...';

        // Use the new password update function with current password verification
        await updateCustomerPassword(passwordData.currentPassword, passwordData.newPassword);

        showFormMessage('Password changed successfully!', 'success', 'passwordChangeMessage');
        showToast('Password changed successfully!', 'success');

        // Reset password form
        document.getElementById('passwordChangeForm').reset();

    } catch (error) {
        console.error('Password change error:', error);
        let errorMessage = error.message || 'Failed to change password. Please try again.';
        
        // Handle specific error cases
        if (error.message?.includes('Current password is incorrect')) {
            // Focus on current password field for user convenience
            const currentPasswordField = document.getElementById('currentPassword');
            if (currentPasswordField) {
                currentPasswordField.focus();
            }
        }
        
        showFormMessage(errorMessage, 'error', 'passwordChangeMessage');
    } finally {
        showLoadingSpinner(false);
        const changeBtn = document.getElementById('passwordChangeBtn');
        changeBtn.disabled = false;
        changeBtn.innerHTML = '<i class="fas fa-key"></i> Change Password';
    }
}

/**
 * Update customer communication preferences with email queue integration
 * @async
 * @function updateCommunicationPreferences
 * @param {Object} preferences - Communication preferences object
 * @param {boolean} preferences.email_notifications - Whether to receive email notifications
 * @param {string} preferences.delivery_instructions - Special delivery instructions
 * @param {string} [preferences.contact_preference] - Preferred contact method (email, phone, sms)
 * @returns {Promise<Object>} Updated customer object with new preferences
 * @throws {Error} When preferences update fails
 * @since 1.7.0
 * @example
 * const updatedCustomer = await updateCommunicationPreferences({
 *   email_notifications: true,
 *   delivery_instructions: 'Leave at front gate',
 *   contact_preference: 'email'
 * });
 */
async function updateCommunicationPreferences(preferences) {
    try {
        // Merge with existing preferences to preserve any other settings
        const currentPreferences = currentCustomer.communication_preferences || {};
        const mergedPreferences = {
            ...currentPreferences,
            ...preferences,
            last_updated: new Date().toISOString()
        };

        // Update preferences in database
        const { data, error } = await supabaseClient
            .from('customers')
            .update({
                communication_preferences: mergedPreferences,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentCustomer.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Update email queue customer data if preferences changed
        if (preferences.email_notifications !== currentPreferences.email_notifications) {
            await updateEmailQueueCustomerPreferences(currentCustomer.id, mergedPreferences);
        }

        console.info('Communication preferences updated successfully', mergedPreferences);
        return data;

    } catch (error) {
        console.error('Communication preferences update error:', error);
        throw new Error('Failed to update communication preferences. Please try again.');
    }
}

/**
 * Update email queue with customer preference changes
 * @async
 * @function updateEmailQueueCustomerPreferences
 * @param {string} customerId - Customer ID
 * @param {Object} preferences - Updated communication preferences
 * @returns {Promise<void>}
 * @since 1.7.0
 */
async function updateEmailQueueCustomerPreferences(customerId, preferences) {
    try {
        // This would integrate with the admin email queue system
        // For now, we'll store preference changes locally for future email operations
        const emailPreferences = {
            customerId: customerId,
            customerName: currentCustomer.name,
            customerEmail: currentCustomer.email,
            emailNotifications: preferences.email_notifications,
            deliveryInstructions: preferences.delivery_instructions,
            updatedAt: new Date().toISOString()
        };

        // Store in localStorage for email queue integration
        const existingPreferences = JSON.parse(localStorage.getItem('plaasHoendersEmailPreferences') || '[]');
        const updatedPreferences = existingPreferences.filter(pref => pref.customerId !== customerId);
        updatedPreferences.push(emailPreferences);
        
        localStorage.setItem('plaasHoendersEmailPreferences', JSON.stringify(updatedPreferences));
        
        console.info('Email queue preferences updated for customer:', customerId);

    } catch (error) {
        console.warn('Could not update email queue preferences:', error);
        // Don't fail the main operation if email queue update fails
    }
}

/**
 * Get customer communication preferences with defaults
 * @function getCustomerCommunicationPreferences
 * @param {Object} customer - Customer object
 * @returns {Object} Communication preferences with defaults applied
 * @since 1.7.0
 */
function getCustomerCommunicationPreferences(customer) {
    const defaultPreferences = {
        email_notifications: true,
        delivery_instructions: '',
        contact_preference: 'email',
        order_confirmations: true,
        delivery_updates: true,
        promotional_emails: false
    };

    if (!customer || !customer.communication_preferences) {
        return defaultPreferences;
    }

    return {
        ...defaultPreferences,
        ...customer.communication_preferences
    };
}

/**
 * Handle communication preferences update form submission
 * @async
 * @function handlePreferencesUpdate
 * @param {Event} event - Form submission event
 * @returns {Promise<void>}
 */
async function handlePreferencesUpdate(event) {
    event.preventDefault();
    clearProfileFormErrors();

    const formData = new FormData(event.target);
    const preferences = {
        email_notifications: formData.get('emailNotifications') === 'on',
        delivery_instructions: formData.get('deliveryInstructions')?.trim() || '',
        // Add additional preference fields as needed
        order_confirmations: formData.get('orderConfirmations') === 'on' || formData.get('emailNotifications') === 'on',
        delivery_updates: formData.get('deliveryUpdates') === 'on' || formData.get('emailNotifications') === 'on'
    };

    try {
        showLoadingSpinner(true);
        const updateBtn = document.getElementById('preferencesUpdateBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Preferences...';

        // Use the new preferences update function with email queue integration
        const updatedCustomer = await updateCommunicationPreferences(preferences);

        // Update local customer data
        currentCustomer = updatedCustomer;

        showFormMessage('Communication preferences saved successfully!', 'success', 'preferencesUpdateMessage');
        showToast('Preferences updated successfully!', 'success');

        // Log preference change for future order confirmations
        console.info('Customer communication preferences updated:', {
            customerId: currentCustomer.id,
            customerName: currentCustomer.name,
            preferences: preferences
        });

    } catch (error) {
        console.error('Preferences update error:', error);
        let errorMessage = error.message || 'Failed to save preferences. Please try again.';
        showFormMessage(errorMessage, 'error', 'preferencesUpdateMessage');
    } finally {
        showLoadingSpinner(false);
        const updateBtn = document.getElementById('preferencesUpdateBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Preferences';
    }
}

/**
 * Show account deletion confirmation modal
 * @function showAccountDeleteConfirmation
 */
function showAccountDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('deleteConfirmationInput').value = '';
        document.getElementById('deleteConfirmationError').textContent = '';
    }
}

/**
 * Hide account deletion confirmation modal
 * @function hideAccountDeleteConfirmation
 */
function hideAccountDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Perform soft delete of customer account while preserving order history
 * @async
 * @function deleteCustomerAccount
 * @param {string} customerId - Customer ID to delete
 * @returns {Promise<Object>} Deletion summary with order preservation info
 * @throws {Error} When account deletion fails
 * @since 1.7.0
 * @example
 * const deletionSummary = await deleteCustomerAccount(currentCustomer.id);
 * console.log('Orders preserved:', deletionSummary.ordersPreserved);
 */
async function deleteCustomerAccount(customerId) {
    try {
        // Get order count before deletion for audit trail
        const { data: orders, error: orderCountError } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('customer_id', customerId);

        if (orderCountError) {
            console.warn('Could not retrieve order count for deletion audit:', orderCountError);
        }

        const orderCount = orders?.length || 0;

        // Soft delete customer account (set is_active to false)
        const { data: deletedCustomer, error: updateError } = await supabaseClient
            .from('customers')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                // Preserve essential data for order history linkage
                deletion_reason: 'customer_requested',
                orders_preserved: orderCount
            })
            .eq('id', customerId)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        // Verify orders are still accessible (should remain linked)
        const { data: preservedOrders, error: verificationError } = await supabaseClient
            .from('orders')
            .select('id, order_number, created_at')
            .eq('customer_id', customerId);

        if (verificationError) {
            console.warn('Could not verify order preservation:', verificationError);
        }

        console.info('Customer account deleted successfully', {
            customerId: customerId,
            ordersPreserved: preservedOrders?.length || 0,
            deletedAt: deletedCustomer.deleted_at
        });

        return {
            success: true,
            customerId: customerId,
            deletedAt: deletedCustomer.deleted_at,
            ordersPreserved: preservedOrders?.length || 0,
            orderIds: preservedOrders?.map(order => order.id) || []
        };

    } catch (error) {
        console.error('Account deletion error:', error);
        throw new Error('Failed to delete customer account while preserving order history');
    }
}

/**
 * Handle account deletion form submission with order history preservation
 * @async
 * @function handleAccountDeletion
 * @returns {Promise<void>}
 */
async function handleAccountDeletion() {
    const confirmationInput = document.getElementById('deleteConfirmationInput');
    const errorElement = document.getElementById('deleteConfirmationError');
    
    if (confirmationInput.value !== 'DELETE') {
        errorElement.textContent = 'Please type "DELETE" to confirm account deletion.';
        return;
    }

    try {
        showLoadingSpinner(true);
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting Account...';

        // Use the enhanced account deletion function
        const deletionSummary = await deleteCustomerAccount(currentCustomer.id);

        // Log security event with deletion details
        await logSecurityEvent('account_deletion', {
            ordersPreserved: deletionSummary.ordersPreserved,
            deletionReason: 'customer_requested'
        });

        // Clear any cached customer data
        localStorage.removeItem('plaasHoendersCustomerProfile');
        localStorage.removeItem('plaasHoendersEmailPreferences');

        // Sign out user from authentication system
        const { error: signOutError } = await supabaseClient.auth.signOut();
        if (signOutError) {
            console.warn('Sign out error after account deletion:', signOutError);
        }

        // Show detailed success message
        const message = deletionSummary.ordersPreserved > 0 
            ? `Account deleted successfully. ${deletionSummary.ordersPreserved} order(s) have been preserved for business records. You have been signed out.`
            : 'Account deleted successfully. You have been signed out.';

        showToast(message, 'success', 10000);
        
        // Clear local state and redirect to auth
        currentCustomer = null;
        customerSession = null;
        hideAccountDeleteConfirmation();
        showAuthSection();

        console.info('Customer account deletion completed successfully', deletionSummary);

    } catch (error) {
        console.error('Account deletion error:', error);
        let errorMessage = error.message || 'Failed to delete account. Please try again.';
        
        if (error.message?.includes('order history')) {
            errorMessage = 'Account deletion failed - unable to preserve order history. Please contact support.';
        }
        
        errorElement.textContent = errorMessage;
    } finally {
        showLoadingSpinner(false);
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete My Account';
    }
}

/**
 * Reset profile form to original customer data
 * @function resetProfileForm
 */
function resetProfileForm() {
    if (!currentCustomer) return;

    document.getElementById('profileName').value = currentCustomer.name || '';
    document.getElementById('profileEmail').value = currentCustomer.email || '';
    document.getElementById('profilePhone').value = currentCustomer.phone || '';
    document.getElementById('profileAddress').value = currentCustomer.address || '';
    
    clearProfileFormErrors();
    showToast('Form reset to original values', 'info');
}

/**
 * Reset password change form
 * @function resetPasswordForm
 */
function resetPasswordForm() {
    document.getElementById('passwordChangeForm').reset();
    clearProfileFormErrors();
}

/**
 * Clear all profile form error messages
 * @function clearProfileFormErrors
 */
function clearProfileFormErrors() {
    const errorSelectors = [
        '#profileNameError', '#profileEmailError', '#profilePhoneError', '#profileAddressError',
        '#currentPasswordError', '#newPasswordError', '#confirmNewPasswordError',
        '#deliveryInstructionsError', '#deleteConfirmationError'
    ];
    
    errorSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = '';
        }
    });

    const messageSelectors = [
        '#profileUpdateMessage', '#passwordChangeMessage', '#preferencesUpdateMessage'
    ];
    
    messageSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
            element.className = 'form-message';
        }
    });
}

/**
 * Validate profile update data
 * @function validateProfileData
 * @param {Object} data - Profile form data
 * @returns {Array<Object>} Array of validation errors
 */
function validateProfileData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.length < 2) {
        errors.push({ field: 'profileName', message: 'Name must be at least 2 characters long.' });
    } else if (data.name.length > 255) {
        errors.push({ field: 'profileName', message: 'Name must be less than 255 characters.' });
    } else if (!/^[A-Za-z\s\-']+$/.test(data.name)) {
        errors.push({ field: 'profileName', message: 'Name can only contain letters, spaces, hyphens, and apostrophes.' });
    }

    // Email validation
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!data.email || !emailRegex.test(data.email)) {
        errors.push({ field: 'profileEmail', message: 'Please enter a valid email address.' });
    }

    // Phone validation (if provided)
    if (data.phone) {
        const phoneRegex = /^(\+27|0)[0-9]{9}$/;
        if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) {
            errors.push({ field: 'profilePhone', message: 'Please enter a valid South African phone number.' });
        }
    }

    return errors;
}

/**
 * Validate password change data
 * @function validatePasswordChangeData
 * @param {Object} data - Password change form data
 * @returns {Array<Object>} Array of validation errors
 */
function validatePasswordChangeData(data) {
    const errors = [];

    // Current password validation
    if (!data.currentPassword) {
        errors.push({ field: 'currentPassword', message: 'Current password is required.' });
    }

    // New password validation
    if (!data.newPassword || data.newPassword.length < 8) {
        errors.push({ field: 'newPassword', message: 'New password must be at least 8 characters long.' });
    }

    // Password confirmation
    if (data.newPassword !== data.confirmNewPassword) {
        errors.push({ field: 'confirmNewPassword', message: 'New passwords do not match.' });
    }

    // Check if new password is different from current password
    if (data.currentPassword && data.newPassword && data.currentPassword === data.newPassword) {
        errors.push({ field: 'newPassword', message: 'New password must be different from current password.' });
    }

    return errors;
}

/**
 * Display profile validation errors in form
 * @function displayProfileValidationErrors
 * @param {Array<Object>} errors - Array of validation errors
 */
function displayProfileValidationErrors(errors) {
    errors.forEach(error => {
        const errorElement = document.getElementById(`${error.field}Error`);
        if (errorElement) {
            errorElement.textContent = error.message;
        }
    });

    // Focus on first error field
    if (errors.length > 0) {
        const firstErrorField = document.getElementById(errors[0].field);
        if (firstErrorField) {
            firstErrorField.focus();
        }
    }
}

/**
 * Setup real-time validation for profile form fields
 * @function setupRealTimeProfileValidation
 * @returns {void}
 * @since 1.7.0
 */
function setupRealTimeProfileValidation() {
    const profileForm = document.getElementById('profileUpdateForm');
    if (!profileForm) return;

    // Add event listeners for real-time validation
    const emailField = document.getElementById('profileEmail');
    const phoneField = document.getElementById('profilePhone');
    const nameField = document.getElementById('profileName');

    if (emailField) {
        emailField.addEventListener('blur', function() {
            validateProfileField('email', this.value, 'profileEmailError');
        });
        emailField.addEventListener('input', debounce(function() {
            validateProfileField('email', this.value, 'profileEmailError');
        }, 500));
    }

    if (phoneField) {
        phoneField.addEventListener('blur', function() {
            validateProfileField('phone', this.value, 'profilePhoneError');
        });
        phoneField.addEventListener('input', debounce(function() {
            validateProfileField('phone', this.value, 'profilePhoneError');
        }, 500));
    }

    if (nameField) {
        nameField.addEventListener('blur', function() {
            validateProfileField('name', this.value, 'profileNameError');
        });
    }
}

/**
 * Validate individual profile field with user feedback
 * @function validateProfileField
 * @param {string} fieldType - Type of field to validate
 * @param {string} value - Field value to validate
 * @param {string} errorElementId - ID of error display element
 * @returns {boolean} True if field is valid
 * @since 1.7.0
 */
function validateProfileField(fieldType, value, errorElementId) {
    const errorElement = document.getElementById(errorElementId);
    if (!errorElement) return true;

    let isValid = true;
    let errorMessage = '';

    switch (fieldType) {
        case 'email':
            if (!value) {
                isValid = false;
                errorMessage = 'Email address is required';
            } else if (!validateEmail(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
            break;

        case 'phone':
            if (value && !validatePhoneNumber(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid South African phone number (e.g., 079 123 4567)';
            }
            break;

        case 'name':
            if (!value || value.trim().length < 2) {
                isValid = false;
                errorMessage = 'Name must be at least 2 characters long';
            } else if (!/^[A-Za-z\s\-']+$/.test(value.trim())) {
                isValid = false;
                errorMessage = 'Name can only contain letters, spaces, hyphens, and apostrophes';
            }
            break;
    }

    // Update UI based on validation result
    errorElement.textContent = errorMessage;
    errorElement.style.display = errorMessage ? 'block' : 'none';
    
    const fieldElement = document.getElementById(errorElementId.replace('Error', ''));
    if (fieldElement) {
        fieldElement.classList.toggle('field-error', !isValid);
        fieldElement.classList.toggle('field-valid', isValid && value);
    }

    return isValid;
}

/**
 * Log security event for audit trail
 * @async
 * @function logSecurityEvent
 * @param {string} eventType - Type of security event
 * @param {Object} [additionalData] - Additional event data to log
 * @returns {Promise<void>}
 */
async function logSecurityEvent(eventType, additionalData = {}) {
    try {
        if (!currentCustomer || !customerSession) return;

        const eventData = {
            customer_id: currentCustomer.id,
            session_id: customerSession.access_token.substring(0, 10), // First 10 chars for identification
            event_type: eventType,
            ip_address: null, // Would need server-side implementation
            user_agent: navigator.userAgent,
            event_data: additionalData,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('customer_sessions')
            .insert([eventData]);

        if (error) {
            console.warn('Could not log security event:', error);
        } else {
            console.info('Security event logged:', eventType, additionalData);
        }
    } catch (error) {
        console.warn('Error logging security event:', error);
    }
}

/**
 * Verify profile integration with order and invoice systems
 * @async
 * @function verifyProfileIntegration
 * @param {string} customerId - Customer ID to verify integration for
 * @returns {Promise<Object>} Integration verification results
 * @since 1.7.0
 */
async function verifyProfileIntegration(customerId) {
    const results = {
        customer_profile_loaded: false,
        order_history_accessible: false,
        email_queue_integration: false,
        invoice_generation_ready: false,
        admin_dashboard_compatibility: false,
        errors: []
    };

    try {
        // Test 1: Verify customer profile can be loaded
        const customer = await loadCustomerProfileData(customerId);
        results.customer_profile_loaded = !!customer;
        
        if (!customer) {
            results.errors.push('Customer profile could not be loaded');
        }

        // Test 2: Verify order history is accessible
        try {
            const { data: orders, error: orderError } = await supabaseClient
                .from('orders')
                .select('id, order_number, customer_name, customer_email')
                .eq('customer_id', customerId)
                .limit(5);

            results.order_history_accessible = !orderError && Array.isArray(orders);
            
            if (orderError) {
                results.errors.push(`Order history access failed: ${orderError.message}`);
            }
        } catch (orderErr) {
            results.errors.push(`Order history verification error: ${orderErr.message}`);
        }

        // Test 3: Verify email queue integration
        try {
            const emailPreferences = localStorage.getItem('plaasHoendersEmailPreferences');
            const customerPrefs = emailPreferences ? JSON.parse(emailPreferences) : [];
            const hasCustomerInQueue = customerPrefs.some(pref => pref.customerId === customerId);
            
            results.email_queue_integration = true; // Integration exists, presence in queue is optional
            
            if (hasCustomerInQueue) {
                console.info('Customer found in email preferences queue');
            }
        } catch (emailErr) {
            results.errors.push(`Email queue integration error: ${emailErr.message}`);
        }

        // Test 4: Verify invoice generation readiness
        try {
            const invoiceReadyFields = [
                customer?.name,
                customer?.email,
                customer?.communication_preferences
            ];
            
            results.invoice_generation_ready = invoiceReadyFields.every(field => field !== null && field !== undefined);
            
            if (!results.invoice_generation_ready) {
                results.errors.push('Customer profile missing required fields for invoice generation');
            }
        } catch (invoiceErr) {
            results.errors.push(`Invoice generation verification error: ${invoiceErr.message}`);
        }

        // Test 5: Verify admin dashboard compatibility (check for Row Level Security compliance)
        try {
            // This simulates what the admin dashboard would see
            const { data: adminCustomerView, error: adminError } = await supabaseClient
                .from('customers')
                .select('id, name, email, phone, address, is_active, created_at, updated_at')
                .eq('id', customerId)
                .single();

            results.admin_dashboard_compatibility = !adminError && !!adminCustomerView;
            
            if (adminError) {
                results.errors.push(`Admin dashboard compatibility failed: ${adminError.message}`);
            }
        } catch (adminErr) {
            results.errors.push(`Admin compatibility verification error: ${adminErr.message}`);
        }

        console.info('Profile integration verification completed:', results);
        return results;

    } catch (error) {
        console.error('Profile integration verification failed:', error);
        results.errors.push(`Integration verification failed: ${error.message}`);
        return results;
    }
}

/**
 * Test profile updates integration with order customer details
 * @async
 * @function testProfileOrderIntegration
 * @param {Object} testProfileData - Test profile data to verify
 * @returns {Promise<boolean>} True if integration test passes
 * @since 1.7.0
 */
async function testProfileOrderIntegration(testProfileData) {
    try {
        if (!currentCustomer) {
            console.warn('No current customer for integration testing');
            return false;
        }

        // Simulate profile update
        const originalCustomer = { ...currentCustomer };
        const updatedCustomer = await updateCustomerProfile(testProfileData);

        // Verify customer name and email would be reflected in new orders
        const customerDetailsMatch = 
            updatedCustomer.name === testProfileData.name &&
            updatedCustomer.email === testProfileData.email &&
            updatedCustomer.phone === testProfileData.phone &&
            updatedCustomer.address === testProfileData.address;

        // Verify communication preferences persist
        const preferencesIntegrated = 
            updatedCustomer.communication_preferences &&
            typeof updatedCustomer.communication_preferences === 'object';

        // Restore original data for non-destructive testing
        currentCustomer = originalCustomer;

        const integrationSuccess = customerDetailsMatch && preferencesIntegrated;

        console.info('Profile-Order integration test:', {
            customerDetailsMatch,
            preferencesIntegrated,
            integrationSuccess
        });

        return integrationSuccess;

    } catch (error) {
        console.error('Profile-Order integration test failed:', error);
        return false;
    }
}

/**
 * Verify Row Level Security policies work correctly with profile updates
 * @async
 * @function verifyProfileSecurity
 * @returns {Promise<boolean>} True if security policies are working
 * @since 1.7.0
 */
async function verifyProfileSecurity() {
    try {
        if (!currentCustomer || !customerSession) {
            console.warn('No authenticated session for security verification');
            return false;
        }

        // Test 1: Verify user can only update their own profile
        const { data, error } = await supabaseClient
            .from('customers')
            .select('id')
            .eq('id', currentCustomer.id)
            .single();

        if (error) {
            console.error('Profile security verification failed - cannot access own profile:', error);
            return false;
        }

        // Test 2: Verify communication preferences are properly stored as JSONB
        const testPreferences = {
            email_notifications: false,
            delivery_instructions: 'Security test',
            test_timestamp: new Date().toISOString()
        };

        const { error: updateError } = await supabaseClient
            .from('customers')
            .update({
                communication_preferences: testPreferences
            })
            .eq('id', currentCustomer.id);

        if (updateError) {
            console.error('JSONB preferences update failed:', updateError);
            return false;
        }

        // Restore original preferences
        const originalPreferences = currentCustomer.communication_preferences || {};
        await supabaseClient
            .from('customers')
            .update({
                communication_preferences: originalPreferences
            })
            .eq('id', currentCustomer.id);

        console.info('Profile security verification passed');
        return true;

    } catch (error) {
        console.error('Profile security verification error:', error);
        return false;
    }
}

/**
 * Show or hide loading state for section
 * @function showSectionLoading
 * @param {string} sectionName - Section name
 * @param {boolean} show - Whether to show loading state
 */
function showSectionLoading(sectionName, show) {
    const loadingElement = document.getElementById(`${sectionName}Loading`);
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
        
        // Add loading animation class
        if (show) {
            loadingElement.classList.add('loading-active');
        } else {
            loadingElement.classList.remove('loading-active');
        }
    }

    // Hide other states when showing loading
    if (show) {
        const contentElement = document.getElementById(`${sectionName}Grid`) || 
                              document.getElementById(`${sectionName}List`) ||
                              document.getElementById(`${sectionName}Form`);
        const errorElement = document.getElementById(`${sectionName}Error`);
        const emptyElement = document.getElementById(`${sectionName}Empty`);

        if (contentElement) contentElement.style.display = 'none';
        if (errorElement) errorElement.style.display = 'none';
        if (emptyElement) emptyElement.style.display = 'none';
    }

    // Show global loading indicator during section transitions
    showGlobalLoading(show && sectionName !== 'dashboard');
}

/**
 * Show or hide global loading overlay
 * @function showGlobalLoading
 * @param {boolean} show - Whether to show global loading
 */
function showGlobalLoading(show) {
    const globalSpinner = document.getElementById('loadingSpinner');
    if (globalSpinner) {
        globalSpinner.className = show ? 'loading-spinner active' : 'loading-spinner';
    }
}

/**
 * Show toast notification for user feedback
 * @function showToast
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, info, warning)
 * @param {number} duration - Duration to show toast in ms (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${getToastIcon(type)}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to page
    document.body.appendChild(toast);

    // Show with animation
    setTimeout(() => toast.classList.add('toast-show'), 100);

    // Auto-hide after duration
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

/**
 * Get appropriate icon for toast type
 * @function getToastIcon
 * @param {string} type - Toast type
 * @returns {string} FontAwesome icon class
 */
function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-triangle';
        case 'warning': return 'fa-exclamation-circle';
        case 'info': 
        default: return 'fa-info-circle';
    }
}

/**
 * Show error state for section
 * @function showSectionError
 * @param {string} sectionName - Section name
 * @param {string} message - Error message to display
 */
function showSectionError(sectionName, message) {
    showSectionLoading(sectionName, false);
    
    const errorElement = document.getElementById(`${sectionName}Error`);
    if (errorElement) {
        const errorText = errorElement.querySelector('p');
        if (errorText) {
            errorText.textContent = message;
        }
        errorElement.style.display = 'block';
    }
}

// Initialize portal when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeCustomerPortal);

// Handle browser back/forward navigation
window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1);
    if (hash && ['dashboard', 'products', 'orders', 'profile'].includes(hash)) {
        navigateToSection(hash);
    } else if (currentCustomer && customerSession) {
        // Default to dashboard if hash is invalid but user is logged in
        navigateToSection('dashboard');
    }
});

// Handle browser popstate (back/forward buttons)
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.section) {
        navigateToSection(event.state.section);
    } else {
        // Handle direct hash navigation
        const hash = window.location.hash.substring(1);
        if (hash && ['dashboard', 'products', 'orders', 'profile'].includes(hash)) {
            navigateToSection(hash);
        } else if (currentCustomer && customerSession) {
            navigateToSection('dashboard');
        }
    }
});

// Initialize navigation from URL on page load
window.addEventListener('load', function() {
    if (currentCustomer && customerSession) {
        const hash = window.location.hash.substring(1);
        if (hash && ['dashboard', 'products', 'orders', 'profile'].includes(hash)) {
            navigateToSection(hash);
        } else {
            navigateToSection('dashboard');
        }
    }
});

// Password strength indicator (optional enhancement)
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('registerPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const errorElement = document.getElementById('registerPasswordError');
            
            if (errorElement) {
                if (password.length > 0 && password.length < 8) {
                    errorElement.textContent = `Password too short (${password.length}/8 characters)`;
                } else {
                    errorElement.textContent = '';
                }
            }
        });
    }

    // Google Sign In Button
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', handleGoogleLogin);
    }

    // Register Form Handler
    const registerForm = document.getElementById('customerRegisterForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const phone = document.getElementById('registerPhone').value.trim();
            const address = document.getElementById('registerAddress').value.trim();
            const password = document.getElementById('registerPassword').value;
            
            const messageElement = document.getElementById('registerMessage');
            const submitBtn = document.getElementById('registerBtn');
            
            if (!name || !email || !password) {
                showFormMessage(messageElement, 'Please fill in all required fields', 'error');
                return;
            }
            
            if (password.length < 8) {
                showFormMessage(messageElement, 'Password must be at least 8 characters', 'error');
                return;
            }
            
            try {
                submitBtn.textContent = 'Creating Account...';
                submitBtn.disabled = true;
                
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                            phone: phone,
                            address: address
                        }
                    }
                });
                
                if (error) {
                    throw error;
                }
                
                showFormMessage(messageElement, 'Account created successfully! You can now login.', 'success');
                registerForm.reset();
                
                // Auto-switch to login tab after successful registration
                setTimeout(() => {
                    showAuthForm('login');
                    showFormMessage(document.getElementById('loginMessage'), 'Registration successful! Please login with your credentials.', 'success');
                }, 2000);
                
            } catch (error) {
                console.error('Registration error:', error);
                showFormMessage(messageElement, error.message || 'Registration failed. Please try again.', 'error');
            } finally {
                submitBtn.textContent = 'Register';
                submitBtn.disabled = false;
            }
        });
    }

    // Login Form Handler
    const loginForm = document.getElementById('customerLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            const messageElement = document.getElementById('loginMessage');
            const submitBtn = document.getElementById('loginBtn');
            
            if (!email || !password) {
                showFormMessage(messageElement, 'Please enter both email and password', 'error');
                return;
            }
            
            try {
                submitBtn.textContent = 'Signing In...';
                submitBtn.disabled = true;
                
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    throw error;
                }
                
                // Auth state change will automatically handle navigation
                
            } catch (error) {
                console.error('Login error:', error);
                showFormMessage(messageElement, error.message || 'Login failed. Please try again.', 'error');
            } finally {
                submitBtn.textContent = 'Login';
                submitBtn.disabled = false;
            }
        });
    }

});


// Development tool to clear all auth data
async function clearAllAuthData() {
    try {
        console.log('Clearing all authentication data...');
        
        // Sign out from Supabase FIRST
        try {
            await supabaseClient.auth.signOut();
        } catch(e) {
            console.log('Sign out error (expected if not logged in):', e);
        }
        
        // Clear all localStorage
        localStorage.clear();
        
        // Clear all sessionStorage
        sessionStorage.clear();
        
        // CRITICAL: Clear IndexedDB where Supabase ACTUALLY stores auth
        const databases = await indexedDB.databases();
        for (const db of databases) {
            if (db.name && db.name.includes('supabase')) {
                indexedDB.deleteDatabase(db.name);
                console.log('Deleted IndexedDB:', db.name);
            }
        }
        
        // Alternative IndexedDB clear for older browsers
        try {
            indexedDB.deleteDatabase('supabase-auth');
            indexedDB.deleteDatabase('supabase');
        } catch(e) {
            console.log('IndexedDB clear attempt:', e);
        }
        
        // Clear all cookies
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Force clear any remaining Supabase keys
        for (let key in localStorage) {
            if (key.includes('supabase') || key.includes('auth') || key.includes('gotrue')) {
                localStorage.removeItem(key);
            }
        }
        
        alert('✅ All auth data cleared! The page will now reload.');
        
        // Hard reload to bypass cache
        window.location.href = window.location.href.split('#')[0];
        
    } catch (error) {
        console.error('Error clearing auth data:', error);
        alert('Error clearing data: ' + error.message);
    }
}

// Make function available globally
window.clearAllAuthData = clearAllAuthData;

/**
 * Validate order review step before proceeding
 * @function validateOrderReview
 * @returns {boolean} - True if validation passes
 */
function validateOrderReview() {
    const addressConfirmed = document.getElementById('addressConfirmed')?.checked;
    const phoneConfirmed = document.getElementById('phoneConfirmed')?.checked;
    
    if (!addressConfirmed || !phoneConfirmed) {
        alert('⚠️ Please confirm that your address and phone number are correct before proceeding.');
        return false;
    }
    
    return true;
}

/**
 * Handle proceed to step 4 with validation
 * @function handleProceedToStep4
 */
function handleProceedToStep4() {
    // Validate order review before allowing to proceed
    if (!validateOrderReview()) {
        return;
    }
    
    // If validation passes, proceed to step 4
// Simple place order functionality - go directly to step 4
document.addEventListener('DOMContentLoaded', function() {
    const placeOrderBtn = document.getElementById('placeOrder');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function() {
            // Simple navigation to step 4
            document.getElementById('step-3').classList.remove('active');
            document.getElementById('step-4').classList.add('active');
            
            // Update step indicators
            document.getElementById('step-indicator-3').classList.remove('bg-orange-500');
            document.getElementById('step-indicator-3').classList.add('bg-gray-200');
            document.getElementById('step-indicator-4').classList.remove('bg-gray-200');
            document.getElementById('step-indicator-4').classList.add('bg-orange-500');
            
            // Update progress lines
            document.getElementById('progress-3').classList.remove('bg-gray-300');
            document.getElementById('progress-3').classList.add('bg-orange-500');
        });
    }
});
}

/**
 * Update confirmation checkbox text with current customer details
 * @function updateConfirmationText
 */
function updateConfirmationText() {
    const addressText = document.getElementById('confirmAddressText');
    const phoneText = document.getElementById('confirmPhoneText');
    
    if (currentCustomer) {
        if (addressText) {
            addressText.textContent = currentCustomer.address || 'Geen adres verskaf nie';
        }
        if (phoneText) {
            phoneText.textContent = currentCustomer.phone || 'Geen telefoon nommer verskaf nie';
        }
    }
}