# 🔍 Customer Data Debug Guide

## Problem Summary
The confirmation section in Step 3 is showing placeholder text instead of actual customer data from the database.

## Key Functions to Monitor
1. **[`loadCustomerProfile()`](customer.js:188)** - Loads customer data from database/localStorage
2. **[`populateOrderReview()`](customer.js:1516)** - Called when entering Step 3
3. **[`populateCustomerSummaryDisplay()`](customer.js:1558)** - Populates customer details display
4. **[`updateConfirmationText()`](customer.js:5100)** - Updates confirmation checkbox text

## Debugging Steps

### Step 1: Check Current State
1. Open browser console (F12 → Console tab)
2. Navigate to: http://localhost:8000/debug-customer-data.html
3. Click "Check LocalStorage" to see stored customer data
4. Click "Test Complete Flow" to run automated tests

### Step 2: Manual Testing
1. **Check if [`currentCustomer`](customer.js:15) exists:**
   ```javascript
   console.log('currentCustomer:', currentCustomer);
   console.log('Type:', typeof currentCustomer);
   ```

2. **Check localStorage:**
   ```javascript
   console.log('localStorage customer:', localStorage.getItem('currentCustomer'));
   ```

3. **Test individual functions:**
   ```javascript
   populateOrderReview();
   populateCustomerSummaryDisplay();
   updateConfirmationText();
   ```

### Step 3: Monitor Console Output
Watch for these debug messages:
- `📂 loadCustomerProfile() called` - Customer profile loading started
- `✅ Customer profile loaded successfully:` - Profile loaded with data
- `🎯 populateOrderReview() called` - Step 3 initialization started
- `🎨 populateCustomerSummaryDisplay() called` - Display function called
- `✅ Customer summary display updated` - Display completed

### Step 4: Common Issues & Solutions

#### Issue 1: No Customer Data in [`currentCustomer`](customer.js:15)
**Symptoms:** Console shows `currentCustomer: undefined` or `null`
**Solution:** 
- Check if customer is logged in
- Verify [`loadCustomerProfile()`](customer.js:188) completed successfully
- Check for auth errors in console

#### Issue 2: Data Exists but Not Displayed
**Symptoms:** [`currentCustomer`](customer.js:15) has data but display shows placeholders
**Solution:**
- Check if DOM elements exist with correct IDs
- Verify [`populateCustomerSummaryDisplay()`](customer.js:1558) is being called
- Check for JavaScript errors in console

#### Issue 3: Timing Issues
**Symptoms:** Functions called before data is loaded
**Solution:**
- Ensure [`populateOrderReview()`](customer.js:1516) waits for [`loadCustomerProfile()`](customer.js:188) to complete
- Check if [`currentCustomer`](customer.js:15) is populated before calling display functions

### Step 5: Verify Data Flow
Expected sequence:
1. Customer logs in → [`loadCustomerProfile()`](customer.js:188) called
2. Profile loaded → [`currentCustomer`](customer.js:15) populated
3. Navigate to Step 3 → [`populateOrderReview()`](customer.js:1516) called
4. [`populateCustomerSummaryDisplay()`](customer.js:1558) updates display
5. [`updateConfirmationText()`](customer.js:5100) updates checkbox text

## Quick Fix Commands
If customer data is missing, try these in console:
```javascript
// Simulate customer login
const mockCustomer = {
    id: 'test-customer-123',
    full_name: 'Test Customer',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Test St, Test City, TC 12345, USA',
    shipping_address: '123 Test St, Test City, TC 12345, USA'
};

// Store in localStorage
localStorage.setItem('currentCustomer', JSON.stringify(mockCustomer));

// Set global currentCustomer
window.currentCustomer = mockCustomer;

// Test the display functions
populateOrderReview();
```

## Testing URLs
- **Debug Tool:** http://localhost:8000/debug-customer-data.html
- **Test Confirmation:** http://localhost:8000/test-confirmation.html
- **Customer Portal:** http://localhost:8000/customer-portal.html

## What to Look For
✅ **Success indicators:**
- Console shows customer data in [`populateOrderReview()`](customer.js:1516)
- Display shows real customer names/addresses instead of "John Doe"
- Confirmation checkboxes show actual customer address/phone

❌ **Problem indicators:**
- Console shows `currentCustomer: undefined` or `null`
- Display shows placeholder text like "John Doe"
- Functions not being called (no debug messages)

## Next Steps
Based on debug output:
1. If no customer data → Check login/auth process
2. If data exists but not displayed → Check DOM elements and function calls
3. If timing issues → Add proper async/await handling
4. If database errors → Check Supabase connection and table structure