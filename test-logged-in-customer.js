import { chromium } from 'playwright';

async function testLoggedInCustomer() {
  console.log('🔍 Testing customer portal with logged-in user...');
  
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
      waitUntil: 'networkidle'
    });
    
    await page.waitForTimeout(3000);
    
    console.log('\n🔍 Checking current authentication state...');
    
    // Check if we're seeing the logged-in view
    const isLoggedIn = await page.evaluate(() => {
      const authSection = document.querySelector('#auth-section');
      const dashboardSection = document.querySelector('#dashboard-section');
      const customerInfo = document.querySelector('#customerInfo');
      
      return {
        authVisible: authSection ? window.getComputedStyle(authSection).display !== 'none' : false,
        dashboardVisible: dashboardSection ? window.getComputedStyle(dashboardSection).display !== 'none' : false,
        hasCustomerInfo: customerInfo !== null,
        currentStep: document.querySelector('.step-content.active')?.closest('[id*="step-"]')?.id || 'unknown'
      };
    });
    
    console.log('Authentication state:');
    console.log(`  Auth section visible: ${isLoggedIn.authVisible}`);
    console.log(`  Dashboard visible: ${isLoggedIn.dashboardVisible}`);
    console.log(`  Has customer info: ${isLoggedIn.hasCustomerInfo}`);
    console.log(`  Current step: ${isLoggedIn.currentStep}`);
    
    // If we're seeing the logged-in view, check Step 3 specifically
    if (isLoggedIn.currentStep === 'step-3' || isLoggedIn.dashboardVisible) {
      console.log('\n✅ User appears to be logged in, checking Step 3 details...');
      
      // Focus on Step 3 content
      const step3Content = await page.$eval('#step-3', element => {
        const nameElement = element.querySelector('#customerName, #editCustomerName');
        const phoneElement = element.querySelector('#customerPhone, #editCustomerPhone');
        const emailElement = element.querySelector('#customerEmail, #editCustomerEmail');
        const addressElement = element.querySelector('#customerAddress, [id*="address"]');
        
        return {
          name: {
            element: nameElement ? nameElement.tagName + '#' + nameElement.id : 'not found',
            value: nameElement ? nameElement.textContent || nameElement.value : 'empty',
            placeholder: nameElement ? nameElement.placeholder : 'none'
          },
          phone: {
            element: phoneElement ? phoneElement.tagName + '#' + phoneElement.id : 'not found',
            value: phoneElement ? phoneElement.textContent || phoneElement.value : 'empty',
            placeholder: phoneElement ? phoneElement.placeholder : 'none'
          },
          email: {
            element: emailElement ? emailElement.tagName + '#' + emailElement.id : 'not found',
            value: emailElement ? emailElement.textContent || emailElement.value : 'empty',
            placeholder: emailElement ? emailElement.placeholder : 'none'
          },
          address: {
            element: addressElement ? addressElement.tagName + '#' + addressElement.id : 'not found',
            value: addressElement ? addressElement.textContent || addressElement.value : 'empty',
            placeholder: addressElement ? addressElement.placeholder : 'none'
          }
        };
      }).catch(() => ({}));
      
      console.log('Step 3 customer details:');
      Object.entries(step3Content).forEach(([field, data]) => {
        console.log(`  ${field.toUpperCase()}:`);
        console.log(`    Element: ${data.element}`);
        console.log(`    Value: "${data.value}"`);
        console.log(`    Placeholder: "${data.placeholder}"`);
      });
      
      // Check the specific display section that shows customer details
      const displaySection = await page.evaluate(() => {
        const displayElements = document.querySelectorAll('#step-3 [class*="display"], #step-3 [id*="display"]');
        const spans = document.querySelectorAll('#step-3 span');
        const divs = document.querySelectorAll('#step-3 div');
        
        const customerDetails = [];
        
        // Look for elements that might contain customer data
        [...displayElements, ...spans, ...divs].forEach(element => {
          const text = element.textContent.trim();
          if (text && (text.includes('Naam') || text.includes('Telefoon') || text.includes('Email') || text.includes('Aflewerings'))) {
            customerDetails.push({
              tag: element.tagName,
              id: element.id,
              className: element.className,
              text: text.substring(0, 100)
            });
          }
        });
        
        return customerDetails;
      });
      
      console.log('\nCustomer detail display elements found:');
      displaySection.forEach((element, index) => {
        console.log(`  ${index + 1}. ${element.tag}#${element.id} (${element.className})`);
        console.log(`     Text: "${element.text}"`);
      });
      
      // Check if there's a specific customer details display container
      const customerDisplay = await page.evaluate(() => {
        const containers = document.querySelectorAll('#step-3 [class*="customer"], #step-3 [id*="customer"]');
        const results = [];
        
        containers.forEach(container => {
          const children = container.querySelectorAll('*');
          children.forEach(child => {
            const text = child.textContent.trim();
            if (text && text.length > 0 && text.length < 200) {
              results.push({
                parentClass: container.className,
                tag: child.tagName,
                text: text,
                hasDash: text.includes('-')
              });
            }
          });
        });
        
        return results;
      });
      
      console.log('\nCustomer display elements with dashes (empty fields):');
      const emptyFields = customerDisplay.filter(el => el.hasDash);
      emptyFields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.tag} in ${field.parentClass}: "${field.text}"`);
      });
      
      // Check for JavaScript data loading
      console.log('\n🔍 Checking for data loading issues...');
      
      const dataIssues = await page.evaluate(() => {
        const issues = [];
        
        // Check if customer data elements exist but are empty
        const customerDataElements = {
          'customerName': document.querySelector('#customerName'),
          'customerPhone': document.querySelector('#customerPhone'), 
          'customerEmail': document.querySelector('#customerEmail'),
          'customerAddress': document.querySelector('#customerAddress')
        };
        
        Object.entries(customerDataElements).forEach(([key, element]) => {
          if (element) {
            const content = element.textContent.trim();
            if (content === '' || content === '-') {
              issues.push(`${key} is empty or shows dash`);
            }
          } else {
            issues.push(`${key} element not found`);
          }
        });
        
        return issues;
      });
      
      if (dataIssues.length > 0) {
        console.log('Data loading issues found:');
        dataIssues.forEach(issue => console.log(`  - ${issue}`));
      }
      
      // Check console for errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      if (consoleErrors.length > 0) {
        console.log('\n❌ Console errors found:');
        consoleErrors.forEach(error => console.log(`  - ${error}`));
      }
      
    } else {
      console.log('\n⚠️  User does not appear to be logged in or not on Step 3');
      console.log('The issue might be that you need to complete authentication first');
      
      // Show what's currently visible
      const currentContent = await page.evaluate(() => {
        const activeStep = document.querySelector('.step-content.active');
        return activeStep ? {
          step: activeStep.closest('[id*="step-"]')?.id || 'unknown',
          content: activeStep.textContent.trim().substring(0, 200)
        } : null;
      });
      
      console.log('Currently visible step:', currentContent);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'customer-portal-final-state.png', fullPage: true });
    console.log('\n📸 Final state screenshot saved');
    
    console.log('\n📋 ANALYSIS SUMMARY:');
    console.log('Based on the current state, here are the possible issues:');
    console.log('1. Customer data may not be properly loaded from the backend');
    console.log('2. JavaScript might be failing to populate the display fields');
    console.log('3. The data binding between form fields and display elements might be broken');
    console.log('4. There could be a timing issue where data loads after the display renders');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Test complete');
  }
}

testLoggedInCustomer();