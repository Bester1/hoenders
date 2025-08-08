/**
 * Customer Portal JavaScript
 * Handles customer authentication, registration, and session management
 */

// Supabase Configuration - Same as admin dashboard
const SUPABASE_URL = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
 * Initialize the customer portal on page load
 * @async
 * @function initializeCustomerPortal
 * @returns {Promise<void>}
 */
async function initializeCustomerPortal() {
    try {
        showLoadingSpinner(true);
        
        // Check if user is already authenticated
        const { data: session } = await supabaseClient.auth.getSession();
        
        if (session?.session) {
            customerSession = session.session;
            await loadCustomerProfile();
            showCustomerPortal();
        } else {
            showAuthSection();
        }
        
        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.info('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session) {
                customerSession = session;
                await loadCustomerProfile();
                showCustomerPortal();
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
    try {
        if (!customerSession?.user?.id) {
            throw new Error('No authenticated user session');
        }

        // Get or create customer profile in database
        const { data: customer, error } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('auth_user_id', customerSession.user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        if (!customer) {
            // Create customer profile for new user (e.g., Google OAuth user)
            const newCustomer = {
                auth_user_id: customerSession.user.id,
                name: customerSession.user.user_metadata?.full_name || 
                      customerSession.user.user_metadata?.name || 
                      customerSession.user.email.split('@')[0],
                email: customerSession.user.email,
                phone: customerSession.user.user_metadata?.phone || null,
                address: null,
                communication_preferences: { email_notifications: true },
                last_login: new Date().toISOString()
            };

            const { data: createdCustomer, error: createError } = await supabaseClient
                .from('customers')
                .insert([newCustomer])
                .select()
                .single();

            if (createError) throw createError;
            currentCustomer = createdCustomer;
        } else {
            // Update last login time
            const { error: updateError } = await supabaseClient
                .from('customers')
                .update({ last_login: new Date().toISOString() })
                .eq('id', customer.id);

            if (updateError) console.warn('Could not update last login:', updateError);
            currentCustomer = customer;
        }

        // Update UI with customer name in multiple places
        updateCustomerNameInUI();
        updateAuthUI();

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
            // Create customer profile
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
                console.error('Error creating customer profile:', profileError);
                // Don't throw - auth was successful, profile creation can be retried
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
        showLoadingSpinner(true);
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/customer.html'
            }
        });

        if (error) {
            throw error;
        }

        // OAuth redirect will handle the rest
        
    } catch (error) {
        console.error('Google login error:', error);
        showFormMessage('Google login failed. Please try again or use email/password login.', 'error', 'loginMessage');
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
}

/**
 * Switch between auth forms (login/register)
 * @function showAuthForm
 * @param {string} formType - 'login' or 'register'
 */
function showAuthForm(formType) {
    // Clear any existing messages and errors
    clearFormErrors();

    // Update tab states
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (formType === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

/**
 * Show authentication section (login/register forms)
 * @function showAuthSection
 */
function showAuthSection() {
    // Hide navigation
    const navigation = document.getElementById('customer-navigation');
    if (navigation) {
        navigation.style.display = 'none';
    }

    // Show only auth section
    const sections = document.querySelectorAll('.customer-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.classList.add('active');
    }

    updateAuthUI();
}

/**
 * Show customer portal with navigation
 * @function showCustomerPortal
 */
function showCustomerPortal() {
    // Hide auth section
    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.classList.remove('active');
    }

    // Show navigation
    const navigation = document.getElementById('customer-navigation');
    if (navigation) {
        navigation.style.display = 'block';
    }

    // Navigate to dashboard by default
    navigateToSection('dashboard');
    updateAuthUI();
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

        // Update navigation state
        currentSection = sectionName;
        updateNavigationState();

        // Hide all sections
        const sections = document.querySelectorAll('.customer-section:not(#auth-section)');
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Show target section with smooth transition
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');

            // Load section data if needed
            await loadSectionData(sectionName);
        }

        // Update URL hash for navigation state (optional enhancement)
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, null, `#${sectionName}`);
        }

    } catch (error) {
        console.error('Error navigating to section:', error);
        showSectionError(sectionName, 'Navigation failed. Please try again.');
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
 * Update customer name in all UI locations
 * @function updateCustomerNameInUI
 */
function updateCustomerNameInUI() {
    if (!currentCustomer) return;

    // Update main dashboard welcome
    const customerNameElement = document.getElementById('customerName');
    if (customerNameElement) {
        customerNameElement.textContent = currentCustomer.name;
    }

    // Update navigation customer name
    const navCustomerName = document.getElementById('navCustomerName');
    if (navCustomerName) {
        navCustomerName.textContent = currentCustomer.name;
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
        // TODO: Load products from pricing data
        // For now, show placeholder
        setTimeout(() => {
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.innerHTML = '<p class="placeholder-text">Products will be loaded here</p>';
                productsGrid.style.display = 'block';
            }
            showSectionLoading('products', false);
        }, 1000);

    } catch (error) {
        console.error('Error loading products:', error);
        showSectionError('products', 'Unable to load products. Please try again.');
    }
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

        // TODO: Build profile form with current customer data
        // For now, show placeholder
        setTimeout(() => {
            const profileForm = document.getElementById('profileForm');
            if (profileForm) {
                profileForm.innerHTML = '<p class="placeholder-text">Profile form will be loaded here</p>';
                profileForm.style.display = 'block';
            }
            showSectionLoading('profile', false);
        }, 1000);

    } catch (error) {
        console.error('Error loading profile:', error);
        showSectionError('profile', 'Unable to load profile. Please try again.');
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
    }
});

// Set initial hash if customer is logged in
window.addEventListener('load', function() {
    if (currentCustomer && !window.location.hash) {
        window.location.hash = 'dashboard';
    }
});

// Password strength indicator (optional enhancement)
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('registerPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const errorElement = document.getElementById('registerPasswordError');
            
            if (password.length > 0 && password.length < 8) {
                errorElement.textContent = `Password too short (${password.length}/8 characters)`;
            } else {
                errorElement.textContent = '';
            }
        });
    }
});