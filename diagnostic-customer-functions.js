// Diagnostic script to check customer.js functions
console.log('🔍 Starting customer.js function diagnostics...');

// Check if customer.js loaded properly
console.log('📋 Checking if customer.js loaded...');
console.log('window object keys:', Object.keys(window).filter(key => key.toLowerCase().includes('customer')));
console.log('populateReviewCustomerInfo type:', typeof window.populateReviewCustomerInfo);
console.log('updateConfirmationText type:', typeof window.updateConfirmationText);

// Try to find the actual function definitions
console.log('🔍 Searching for function definitions...');
if (typeof populateReviewCustomerInfo === 'function') {
    console.log('✅ populateReviewCustomerInfo found!');
    console.log('Function source:', populateReviewCustomerInfo.toString().substring(0, 200) + '...');
} else {
    console.log('❌ populateReviewCustomerInfo NOT found');
}

if (typeof updateConfirmationText === 'function') {
    console.log('✅ updateConfirmationText found!');
    console.log('Function source:', updateConfirmationText.toString().substring(0, 200) + '...');
} else {
    console.log('❌ updateConfirmationText NOT found');
}

// Check for any customer-related variables
console.log('🔍 Checking for customer-related variables...');
const customerVars = Object.keys(window).filter(key => 
    key.toLowerCase().includes('customer') || 
    key.toLowerCase().includes('user') ||
    key.toLowerCase().includes('review')
);
console.log('Customer-related variables:', customerVars);

// Test with mock customer data
const mockCustomer = {
    name: "Test Customer",
    full_name: "Test Customer",
    phone: "+27-79-123-4567",
    address: "123 Test Street, Testville, 1234",
    email: "test@example.com",
    delivery_instructions: "Please leave at front door"
};

console.log('🧪 Testing with mock customer:', mockCustomer);

// Test populateReviewCustomerInfo if it exists
if (typeof populateReviewCustomerInfo === 'function') {
    console.log('🧪 Calling populateReviewCustomerInfo...');
    try {
        populateReviewCustomerInfo(mockCustomer);
        console.log('✅ populateReviewCustomerInfo executed successfully');
    } catch (error) {
        console.error('❌ Error in populateReviewCustomerInfo:', error);
    }
} else {
    console.log('❌ Cannot test populateReviewCustomerInfo - function not found');
}

// Test updateConfirmationText if it exists
if (typeof updateConfirmationText === 'function') {
    console.log('🧪 Calling updateConfirmationText...');
    try {
        updateConfirmationText();
        console.log('✅ updateConfirmationText executed successfully');
    } catch (error) {
        console.error('❌ Error in updateConfirmationText:', error);
    }
} else {
    console.log('❌ Cannot test updateConfirmationText - function not found');
}

// Check for review elements in DOM
console.log('🔍 Checking for review elements in DOM...');
const reviewElements = [
    'reviewCustomerName', 'reviewCustomerPhone', 'reviewCustomerAddress',
    'reviewCustomerEmail', 'reviewCustomerInstructions', 'confirmAddressText', 'confirmPhoneText'
];

reviewElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ Found element ${id}:`, element);
        console.log(`Content: "${element.textContent}"`);
    } else {
        console.log(`❌ Element ${id} NOT found in DOM`);
    }
});

console.log('🔍 Diagnostics completed!');