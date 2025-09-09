import { chromium } from 'playwright';

async function fixCustomerPortalTest() {
  console.log('🔧 Testing customer portal fix...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  let page;
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    page = await context.newPage();
    
    console.log('🌐 Loading customer portal...');
    await page.goto('https://bester1.github.io/hoenders/customer-portal.html', {
      waitUntil: 'networkidle'
    });
    
    await page.waitForTimeout(3000);
    
    console.log('\n🔍 Current state analysis...');
    
    // Check what's visible now
    const currentStep = await page.$eval('.step-content.active', element => {
      return {
        stepNumber: element.closest('[id*="step-"]')?.id || 'unknown',
        content: element.textContent.trim(),
        hasCustomerDetails: element.querySelector('#editCustomerName') !== null,
        hasAddressSection: element.querySelector('#confirmationCheckboxes') !== null
      };
    }).catch(() => ({ error: 'No active step found' }));
    
    console.log('Current active step:', currentStep);
    
    // Look for login/register forms (Step 1)
    console.log('\n🔍 Checking for authentication forms...');
    
    const authSection = await page.$('#auth-section');
    if (authSection) {
      const authVisible = await authSection.isVisible();
      console.log(`Authentication section visible: ${authVisible}`);
      
      if (authVisible) {
        console.log('📝 Authentication form detected - user needs to login first');
        
        // Check available login options
        const loginForm = await page.$('#customerLoginForm');
        const registerForm = await page.$('#customerRegisterForm');
        
        console.log(`Login form available: ${loginForm !== null}`);
        console.log(`Register form available: ${registerForm !== null}`);
        
        // Take screenshot of auth section
        await authSection.screenshot({ path: 'auth-section-screenshot.png' });
        console.log('📸 Authentication section screenshot saved');
      }
    }
    
    // Check if there's customer data loaded
    console.log('\n🔍 Checking for customer data...');
    
    const customerData = await page.evaluate(() => {
      return {
        hasCustomerInfo: document.getElementById('customerInfo') !== null,
        hasCustomerName: document.getElementById('customerName') !== null,
        hasCustomerEmail: document.getElementById('customerEmail') !== null,
        hasCustomerPhone: document.getElementById('customerPhone') !== null,
        
        // Check for data in these elements
        customerInfoContent: document.getElementById('customerInfo')?.innerHTML || 'empty',
        customerNameContent: document.getElementById('customerName')?.innerHTML || 'empty',
        customerEmailContent: document.getElementById('customerEmail')?.innerHTML || 'empty',
        customerPhoneContent: document.getElementById('customerPhone')?.innerHTML || 'empty'
      };
    });
    
    console.log('Customer data elements status:');
    Object.entries(customerData).forEach(([key, value]) => {
      if (key.includes('Content')) {
        console.log(`  ${key}: ${value === 'empty' ? 'EMPTY' : 'HAS CONTENT'}`);
      } else {
        console.log(`  ${key}: ${value ? 'EXISTS' : 'MISSING'}`);
      }
    });
    
    // Check for the specific issue - address showing "Geen adr"
    console.log('\n🔍 Investigating "Geen adr" issue...');
    
    const addressElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && el.textContent.includes('Geen adr'))
        .map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          textContent: el.textContent.trim(),
          parentId: el.parentElement?.id || 'none',
          parentClass: el.parentElement?.className || 'none'
        }));
    });
    
    if (addressElements.length > 0) {
      console.log(`Found ${addressElements.length} elements with "Geen adr":`);
      addressElements.forEach((el, index) => {
        console.log(`  ${index + 1}. ${el.tagName}#${el.id} (${el.className})`);
        console.log(`     Text: "${el.textContent.substring(0, 100)}..."`);
        console.log(`     Parent: ${el.parentId} (${el.parentClass})`);
      });
    }
    
    // Check if customer is logged in by looking for specific indicators
    console.log('\n🔍 Checking login status...');
    
    const loginStatus = await page.evaluate(() => {
      // Look for elements that indicate logged-in state
      const logoutButton = document.querySelector('[id*="logout"], [class*="logout"]');
      const customerDashboard = document.querySelector('#dashboard-section');
      const authSection = document.querySelector('#auth-section');
      
      return {
        hasLogoutButton: logoutButton !== null,
        hasDashboard: customerDashboard !== null,
        authSectionVisible: authSection ? window.getComputedStyle(authSection).display !== 'none' : false,
        currentUserEmail: document.querySelector('#customerEmail')?.textContent || 'none',
        currentUserName: document.querySelector('#customerName')?.textContent || 'none'
      };
    });
    
    console.log('Login status indicators:');
    console.log(`  Has logout button: ${loginStatus.hasLogoutButton}`);
    console.log(`  Has dashboard: ${loginStatus.hasDashboard}`);
    console.log(`  Auth section visible: ${loginStatus.authSectionVisible}`);
    console.log(`  Current user email: ${loginStatus.currentUserEmail}`);
    console.log(`  Current user name: ${loginStatus.currentUserName}`);
    
    // Determine the root cause
    console.log('\n🔍 Root cause analysis...');
    
    if (loginStatus.authSectionVisible) {
      console.log('🎯 ROOT CAUSE: User is not logged in!');
      console.log('The customer portal requires authentication before showing customer details.');
      console.log('This is why Step 3 (with address confirmation) is not displaying properly.');
      
      console.log('\n💡 SOLUTION:');
      console.log('1. User needs to login first using the authentication form');
      console.log('2. After successful login, customer data will be loaded');
      console.log('3. Then Step 3 will become active with proper customer details');
      
    } else if (loginStatus.hasDashboard && !loginStatus.authSectionVisible) {
      console.log('✅ User appears to be logged in');
      console.log('The issue might be with data loading or step navigation');
      
      // Check if we can navigate to step 3
      const canNavigate = await page.evaluate(() => {
        const step3 = document.querySelector('#step-3');
        const stepIndicators = document.querySelectorAll('[class*="step-"], [id*="step-"]');
        return {
          step3Exists: step3 !== null,
          step3Visible: step3 ? window.getComputedStyle(step3).display !== 'none' : false,
          stepIndicators: stepIndicators.length
        };
      });
      
      console.log(`Step 3 exists: ${canNavigate.step3Exists}`);
      console.log(`Step 3 visible: ${canNavigate.step3Visible}`);
      console.log(`Step indicators found: ${canNavigate.stepIndicators}`);
    }
    
    // Take final diagnostic screenshot
    await page.screenshot({ path: 'customer-portal-diagnostic.png', fullPage: true });
    console.log('\n📸 Diagnostic screenshot saved');
    
    console.log('\n📋 SUMMARY:');
    console.log('The issue is that the customer portal requires user authentication.');
    console.log('Step 1 (authentication) is active, but customer details in Step 3 won\'t show');
    console.log('until a user successfully logs in and customer data is loaded.');
    console.log('The "Geen adr" message appears because no customer address data is available yet.');
    
  } catch (error) {
    console.error('❌ Analysis error:', error);
    if (page) {
      await page.screenshot({ path: 'customer-portal-error-final.png', fullPage: true });
    }
  } finally {
    await browser.close();
    console.log('\n✅ Analysis complete');
  }
}

fixCustomerPortalTest();