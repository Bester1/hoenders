// Final security test - testing the actual SecurityUtils implementation
// Mock browser environment
global.window = {};
global.document = {
    createElement: function(tag) {
        return {
            textContent: '',
            innerHTML: ''
        };
    }
};
global.crypto = {
    getRandomValues: function(array) {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};
global.btoa = function(str) {
    return Buffer.from(str).toString('base64');
};

// Load the actual security utilities
import { readFileSync } from 'fs';
const securityCode = readFileSync('security-utils.js', 'utf8');
eval(securityCode);

console.log('🔒 Final Security Utils Test Suite');
console.log('====================================');

// Test 1: Email validation and sanitization
console.log('\n📧 Email Validation Tests:');
const emailTests = [
    { email: 'valid@email.com', expected: true },
    { email: 'user.name@domain.co.za', expected: true },
    { email: 'invalid-email', expected: false },
    { email: 'test@', expected: false },
    { email: '@domain.com', expected: false },
    { email: 'user@domain', expected: false },
    { email: 'user@example.com<script>', expected: false }
];

let emailPassed = 0;
emailTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizeEmail(test.email);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) emailPassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Email: "${test.email}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized) {
        console.log(`  Sanitized: "${result.sanitized}"`);
    }
});

// Test 2: Phone validation and sanitization
console.log('\n📞 Phone Validation Tests:');
const phoneTests = [
    { phone: '0123456789', expected: true },
    { phone: '123456789', expected: true },
    { phone: '+27123456789', expected: true },
    { phone: 'invalid-phone', expected: false },
    { phone: '123', expected: false },
    { phone: '123-456-7890', expected: false } // Not SA format
];

let phonePassed = 0;
phoneTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizePhone(test.phone);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) phonePassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Phone: "${test.phone}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized) {
        console.log(`  Sanitized: "${result.sanitized}"`);
    }
});

// Test 3: Name validation and sanitization
console.log('\n👤 Name Validation Tests:');
const nameTests = [
    { name: 'John Doe', expected: true },
    { name: 'Mary-Jane O\'Connor', expected: true },
    { name: 'J', expected: false }, // Too short
    { name: '<script>alert("xss")</script>', expected: false },
    { name: 'John123', expected: false }, // Contains numbers
    { name: 'Valid Name', expected: true }
];

let namePassed = 0;
nameTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizeName(test.name);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) namePassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Name: "${test.name}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized) {
        console.log(`  Sanitized: "${result.sanitized}"`);
    }
    if (result.error) {
        console.log(`  Error: ${result.error}`);
    }
});

// Test 4: Address validation and sanitization
console.log('\n🏠 Address Validation Tests:');
const addressTests = [
    { address: '123 Main Street', expected: true },
    { address: '123 Main St, Apt 4B', expected: true },
    { address: '<script>alert("xss")</script>', expected: false },
    { address: 'javascript:alert("xss")', expected: false },
    { address: 'Valid Address 123', expected: true }
];

let addressPassed = 0;
addressTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizeAddress(test.address);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) addressPassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Address: "${test.address}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized) {
        console.log(`  Sanitized: "${result.sanitized}"`);
    }
});

// Test 5: Quantity validation and sanitization
console.log('\n📦 Quantity Validation Tests:');
const quantityTests = [
    { quantity: '5', expected: true },
    { quantity: '0', expected: true },
    { quantity: '1000', expected: true },
    { quantity: '1001', expected: false }, // Too large
    { quantity: '-1', expected: false },
    { quantity: 'abc', expected: false },
    { quantity: '5.5', expected: false }
];

let quantityPassed = 0;
quantityTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizeQuantity(test.quantity);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) quantityPassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Quantity: "${test.quantity}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized !== undefined) {
        console.log(`  Sanitized: ${result.sanitized}`);
    }
});

// Test 6: Price validation and sanitization
console.log('\n💰 Price Validation Tests:');
const priceTests = [
    { price: '10.50', expected: true },
    { price: '100', expected: true },
    { price: '0', expected: true },
    { price: '10000', expected: true },
    { price: '10001', expected: false }, // Too large
    { price: '-10', expected: false },
    { price: 'abc', expected: false }
];

let pricePassed = 0;
priceTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateAndSanitizePrice(test.price);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) pricePassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Price: "${test.price}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.sanitized !== undefined) {
        console.log(`  Sanitized: ${result.sanitized}`);
    }
});

// Test 7: Form validation
console.log('\n📝 Form Validation Tests:');
const formTests = [
    {
        name: 'Valid Customer Form',
        data: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '0123456789',
            address: '123 Main St'
        },
        rules: {
            name: { type: 'name', required: true },
            email: { type: 'email', required: true },
            phone: { type: 'phone', required: false },
            address: { type: 'address', required: false }
        },
        expected: true
    },
    {
        name: 'Invalid Form (XSS in name)',
        data: {
            name: '<script>alert("xss")</script>',
            email: 'john@example.com',
            phone: '0123456789',
            address: '123 Main St'
        },
        rules: {
            name: { type: 'name', required: true },
            email: { type: 'email', required: true },
            phone: { type: 'phone', required: false },
            address: { type: 'address', required: false }
        },
        expected: false
    }
];

let formPassed = 0;
formTests.forEach((test, index) => {
    const result = window.SecurityUtils.validateForm(test.data, test.rules);
    const isValid = result.valid;
    const passed = isValid === test.expected;
    if (passed) formPassed++;
    
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test: ${test.name}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Actual: ${isValid}`);
    if (result.errors && Object.keys(result.errors).length > 0) {
        console.log(`  Errors:`, result.errors);
    }
});

// Summary
const totalTests = emailTests.length + phoneTests.length + nameTests.length + 
                  addressTests.length + quantityTests.length + priceTests.length + formTests.length;
const passedTests = emailPassed + phonePassed + namePassed + addressPassed + quantityPassed + pricePassed + formPassed;

console.log('\n' + '='.repeat(60));
console.log('🎉 FINAL SECURITY TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
    console.log('\n✅ ALL SECURITY TESTS PASSED!');
    console.log('🛡️ Your security implementation is working correctly!');
    console.log('🔒 Your application is protected against common vulnerabilities!');
    console.log('\n🚀 Ready for secure production deployment!');
} else {
    console.log('\n⚠️  SOME SECURITY TESTS FAILED!');
    console.log('🔧 Please review the failing tests above!');
}

// Exit with appropriate code
process.exit(passedTests === totalTests ? 0 : 1);