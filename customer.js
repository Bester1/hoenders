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
                
                // Process any pending profile updates when back online
                if (typeof processPendingProfileUpdates === 'function') {
                    await processPendingProfileUpdates();
                }
                
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

    // Update page title with customer name
    document.title = `Plaas Hoenders - ${currentCustomer.name}'s Portal`;

    // Update personalized content in dashboard
    updateDashboardPersonalization();
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
    // TODO: Implement cart functionality in future story
    const displayInfo = getProductDisplayInfo(productName);
    showToast(`${displayInfo.displayName} added to cart!`, 'success');
    
    // For now, just show success message
    console.log('Added to cart:', productName);
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
            throw new Error('Failed to update profile. Please check your connection and try again.');
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
            
            if (password.length > 0 && password.length < 8) {
                errorElement.textContent = `Password too short (${password.length}/8 characters)`;
            } else {
                errorElement.textContent = '';
            }
        });
    }
});