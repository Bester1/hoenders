import { chromium } from 'playwright';

async function testCustomerDataIssue() {
  console.log('🔍 Testing customer data display issue on page 3...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    console.log('🌐 Loading customer portal...');
    await page.goto('https://bester1.github.io/hoenders/customer-portal.html', {
      waitUntil: 'domcontentloaded'
    });
    
    await page.waitForTimeout(5000); // Wait longer for any redirects
    
    console.log('\n🔍 Checking for the empty customer details issue...');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    
    // Check what's actually visible on the page
    const visibleContent = await page.evaluate(() => {
      // Look for the specific customer details section
      const customerDetailsSection = document.querySelector('#step-3');
      const displayElements = document.querySelectorAll('#step-3 .display-section, #step-3 [class*="display"]');
      const nameDisplay = document.querySelector('#step-3 [id*="name"][class*="display"]');
      const phoneDisplay = document.querySelector('#step-3 [id*="phone"][class*="display"]');
      const addressDisplay = document.querySelector('#step-3 [id*="address"][class*="display"]');
      const emailDisplay = document.querySelector('#step-3 [id*="email"][class*="display"]');
      
      return {
        step3Exists: customerDetailsSection !== null,
        step3Visible: customerDetailsSection ? window.getComputedStyle(customerDetailsSection).display !== 'none' : false,
        displayElements: displayElements.length,
        nameDisplay: nameDisplay ? {
          id: nameDisplay.id,
          className: nameDisplay.className,
          textContent: nameDisplay.textContent.trim()
        } : null,
        phoneDisplay: phoneDisplay ? {
          id: phoneDisplay.id,
          className: phoneDisplay.className,
          textContent: phoneDisplay.textContent.trim()
        } : null,
        addressDisplay: addressDisplay ? {
          id: addressDisplay.id,
          className: addressDisplay.className,
          textContent: addressDisplay.textContent.trim()
        } : null,
        emailDisplay: emailDisplay ? {
          id: emailDisplay.id,
          className: emailDisplay.className,
          textContent: emailDisplay.textContent.trim()
        } : null
      };
    });
    
    console.log('Customer details display elements:');
    console.log(`  Step 3 exists: ${visibleContent.step3Exists}`);
    console.log(`  Step 3 visible: ${visibleContent.step3Visible}`);
    console.log(`  Display elements found: ${visibleContent.displayElements}`);
    
    if (visibleContent.nameDisplay) {
      console.log(`  Name display: ${visibleContent.nameDisplay.id} - "${visibleContent.nameDisplay.textContent}"`);
    }
    if (visibleContent.phoneDisplay) {
      console.log(`  Phone display: ${visibleContent.phoneDisplay.id} - "${visibleContent.phoneDisplay.textContent}"`);
    }
    if (visibleContent.addressDisplay) {
      console.log(`  Address display: ${visibleContent.addressDisplay.id} - "${visibleContent.addressDisplay.textContent}"`);
    }
    if (visibleContent.emailDisplay) {
      console.log(`  Email display: ${visibleContent.emailDisplay.id} - "${visibleContent.emailDisplay.textContent}"`);
    }
    
    // Look for the specific empty fields you mentioned
    const emptyFields = await page.evaluate(() => {
      const results = [];
      
      // Look for elements containing the exact text you mentioned
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(element => {
        const text = element.textContent.trim();
        if (text.includes('Naam') && text.includes('-') ||
            text.includes('Telefoon') && text.includes('-') ||
            text.includes('Aflewerings Adres') && text.includes('-') ||
            text.includes('Email') && text.includes('-')) {
          results.push({
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: text.substring(0, 200),
            parentContainer: element.closest('[class*="customer"], [id*="customer"], [class*="details"]')?.className || 'none'
          });
        }
      });
      
      return results;
    });
    
    console.log('\nElements with empty field indicators (-):');
    emptyFields.forEach((element, index) => {
      console.log(`  ${index + 1}. ${element.tagName}#${element.id} (${element.className})`);
      console.log(`     Text: "${element.textContent}"`);
      console.log(`     Container: ${element.parentContainer}`);
    });
    
    // Check for JavaScript errors that might prevent data loading
    console.log('\n🔍 Checking for JavaScript errors...');
    
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });
    
    // Wait a bit to capture any errors
    await page.waitForTimeout(3000);
    
    if (errors.length > 0) {
      console.log('JavaScript errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('No JavaScript errors detected');
    }
    
    // Check if customer data is supposed to be loaded
    console.log('\n🔍 Checking for customer data loading mechanisms...');
    
    const dataLoading = await page.evaluate(() => {
      return {
        hasLocalStorage: !!window.localStorage,
        hasSessionStorage: !!window.sessionStorage,
        localStorageKeys: window.localStorage ? Object.keys(window.localStorage) : [],
        sessionStorageKeys: window.sessionStorage ? Object.keys(window.sessionStorage) : [],
        
        // Check for customer data in storage
        customerData: window.localStorage ? window.localStorage.getItem('customerData') : null,
        userSession: window.localStorage ? window.localStorage.getItem('userSession') : null,
        
        // Check for global variables that might hold customer data
        globalVars: Object.keys(window).filter(key => 
          key.toLowerCase().includes('customer') || 
          key.toLowerCase().includes('user') ||
          key.toLowerCase().includes('session')
        )
      };
    });
    
    console.log('Data loading status:');
    console.log(`  Local storage available: ${dataLoading.hasLocalStorage}`);
    console.log(`  Session storage available: ${dataLoading.hasSessionStorage}`);
    console.log(`  Local storage keys: ${dataLoading.localStorageKeys.join(', ')}`);
    console.log(`  Session storage keys: ${dataLoading.sessionStorageKeys.join(', ')}`);
    console.log(`  Customer data in storage: ${dataLoading.customerData ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  User session in storage: ${dataLoading.userSession ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  Global customer variables: ${dataLoading.globalVars.join(', ')}`);
    
    // Take screenshot of the current state
    await page.screenshot({ path: 'customer-portal-current-state.png', fullPage: true });
    console.log('\n📸 Current state screenshot saved');
    
    // Check for specific customer detail containers
    console.log('\n🔍 Looking for customer detail containers...');
    
    const detailContainers = await page.evaluate(() => {
      const containers = [];
      
      // Look for containers that might hold customer details
      const possibleContainers = document.querySelectorAll('#step-3 [class*="detail"], #step-3 [id*="detail"], #step-3 .customer-info, #step-3 [class*="info"]');
      
      possibleContainers.forEach(container => {
        const children = container.querySelectorAll('*');
        const hasCustomerFields = Array.from(children).some(child => {
          const text = child.textContent.toLowerCase();
          return text.includes('naam') || text.includes('telefoon') || text.includes('email') || text.includes('adres');
        });
        
        if (hasCustomerFields) {
          containers.push({
            tagName: container.tagName,
            id: container.id,
            className: container.className,
            innerHTML: container.innerHTML.substring(0, 500)
          });
        }
      });
      
      return containers;
    });
    
    console.log(`Found ${detailContainers.length} potential customer detail containers:`);
    detailContainers.forEach((container, index) => {
      console.log(`  ${index + 1}. ${container.tagName}#${container.id} (${container.className})`);
      console.log(`     Content: ${container.innerHTML.replace(/\s+/g, ' ').substring(0, 100)}...`);
    });
    
    // Final analysis
    console.log('\n📋 FINAL ANALYSIS:');
    
    if (emptyFields.length > 0) {
      console.log('✅ CONFIRMED: Empty customer fields are displaying as expected');
      console.log('The "-" symbols you see are placeholder indicators for empty fields');
      
      if (dataLoading.customerData === null && dataLoading.userSession === null) {
        console.log('\n🔍 ROOT CAUSE: No customer data is loaded');
        console.log('The portal is displaying empty fields because no customer data is available');
        console.log('This could be due to:');
        console.log('  1. User not logged in properly');
        console.log('  2. Customer data not being fetched from backend');
        console.log('  3. Data loading function failing');
        console.log('  4. Session/local storage not being set correctly');
      }
    } else {
      console.log('❓ Could not find the specific empty fields you mentioned');
      console.log('The portal state might be different than expected');
    }
    
  } catch (error) {
    console.error('❌ Analysis error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Analysis complete');
  }
}

testCustomerDataIssue();