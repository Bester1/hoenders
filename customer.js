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