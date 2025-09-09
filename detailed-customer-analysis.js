import { chromium } from 'playwright';

async function detailedCustomerAnalysis() {
  console.log('🔍 Detailed analysis of customer portal issue...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
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
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    console.log('\n🔍 Analyzing the 4-step process...');
    
    // Check each step visibility
    const steps = await page.$$eval('.step-content', stepElements => {
      return stepElements.map((step, index) => ({
        index: index + 1,
        className: step.className,
        isActive: step.classList.contains('active'),
        isVisible: window.getComputedStyle(step).display !== 'none',
        innerHTML: step.innerHTML.substring(0, 200),
        textContent: step.textContent.trim().substring(0, 100)
      }));
    });
    
    console.log('Step analysis:');
    steps.forEach(step => {
      console.log(`  Step ${step.index}: ${step.isActive ? 'ACTIVE' : 'INACTIVE'} - ${step.isVisible ? 'VISIBLE' : 'HIDDEN'}`);
      console.log(`    Content: "${step.textContent}"`);
    });
    
    // Check which step is currently active
    const activeStep = steps.find(step => step.isActive);
    console.log(`\n✅ Currently active: Step ${activeStep?.index || 'NONE'}`);
    
    // Look specifically at Step 3 (where address confirmation should be)
    console.log('\n🔍 Deep dive into Step 3...');
    
    const step3Content = await page.$eval('#step-3', element => {
      return {
        innerHTML: element.innerHTML,
        textContent: element.textContent.trim(),
        isVisible: window.getComputedStyle(element).display !== 'none',
        childElements: Array.from(element.querySelectorAll('*')).map(child => ({
          tagName: child.tagName,
          id: child.id,
          className: child.className,
          textContent: child.textContent.trim().substring(0, 50)
        }))
      };
    }).catch(() => null);
    
    if (step3Content) {
      console.log('Step 3 content structure:');
      console.log(`  Visible: ${step3Content.isVisible}`);
      console.log(`  Text preview: "${step3Content.textContent.substring(0, 200)}"`);
      console.log(`  Child elements: ${step3Content.childElements.length}`);
      
      step3Content.childElements.slice(0, 10).forEach(child => {
        console.log(`    - ${child.tagName}#${child.id} (${child.className}): "${child.textContent}"`);
      });
    }
    
    // Check for the specific address confirmation section
    console.log('\n🔍 Looking for address confirmation section...');
    
    const addressSection = await page.$eval('#confirmationCheckboxes', element => {
      return {
        isVisible: window.getComputedStyle(element).display !== 'none',
        innerHTML: element.innerHTML,
        checkboxes: Array.from(element.querySelectorAll('input[type="checkbox"]')).map(cb => ({
          id: cb.id,
          checked: cb.checked,
          name: cb.name,
          parentText: cb.parentElement?.textContent?.trim() || ''
        }))
      };
    }).catch(() => null);
    
    if (addressSection) {
      console.log('Address confirmation section:');
      console.log(`  Visible: ${addressSection.isVisible}`);
      console.log(`  Checkboxes found: ${addressSection.checkboxes.length}`);
      addressSection.checkboxes.forEach(cb => {
        console.log(`    - ${cb.id}: ${cb.checked ? 'CHECKED' : 'UNCHECKED'}`);
        console.log(`      Text: "${cb.parentText.substring(0, 100)}"`);
      });
    }
    
    // Check for client details form in step 3
    console.log('\n🔍 Looking for client details form in Step 3...');
    
    const clientForm = await page.$eval('#step-3', element => {
      const inputs = element.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
      return Array.from(inputs).map(input => ({
        id: input.id,
        type: input.type,
        placeholder: input.placeholder,
        value: input.value,
        isVisible: window.getComputedStyle(input).display !== 'none',
        parentSection: input.closest('[class*="customer"], [id*="customer"]')?.id || 'none'
      }));
    }).catch(() => []);
    
    console.log(`Client detail inputs in Step 3: ${clientForm.length}`);
    clientForm.forEach(input => {
      console.log(`  - ${input.id} (${input.type}): "${input.value}" - Visible: ${input.isVisible}`);
    });
    
    // Check JavaScript console for errors
    console.log('\n🔍 Checking for JavaScript errors...');
    
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(`ERROR: ${msg.text()}`);
      }
    });
    
    // Reload to capture any errors
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    if (consoleLogs.length > 0) {
      console.log('JavaScript errors found:');
      consoleLogs.forEach(log => console.log(`  ${log}`));
    } else {
      console.log('No JavaScript errors detected');
    }
    
    // Check if customer data is loaded
    console.log('\n🔍 Checking customer data loading...');
    
    const customerData = await page.evaluate(() => {
      return {
        customerInfo: document.getElementById('customerInfo')?.innerHTML || 'not found',
        customerName: document.getElementById('customerName')?.innerHTML || 'not found',
        customerEmail: document.getElementById('customerEmail')?.innerHTML || 'not found',
        customerPhone: document.getElementById('customerPhone')?.innerHTML || 'not found'
      };
    });
    
    console.log('Customer data elements:');
    Object.entries(customerData).forEach(([key, value]) => {
      console.log(`  ${key}: ${value === 'not found' ? 'NOT FOUND' : `"${value.substring(0, 50)}..."`}`);
    });
    
    // Take detailed screenshots
    await page.screenshot({ path: 'step3-detailed.png', fullPage: true });
    console.log('\n📸 Detailed screenshot saved');
    
    // Try to manually trigger step 3 if it's not active
    if (!activeStep || activeStep.index !== 3) {
      console.log('\n🔄 Attempting to activate Step 3...');
      
      // Look for navigation buttons
      const navButtons = await page.$$eval('button', buttons => 
        buttons.map(btn => ({
          text: btn.textContent.trim(),
          id: btn.id,
          className: btn.className,
          onclick: btn.onclick?.toString() || 'none'
        })).filter(btn => 
          btn.text.toLowerCase().includes('volgende') || 
          btn.text.toLowerCase().includes('next') ||
          btn.text.toLowerCase().includes('step') ||
          btn.id.includes('step')
        )
      );
      
      console.log('Navigation buttons found:');
      navButtons.forEach(btn => {
        console.log(`  - "${btn.text}" (${btn.id}): ${btn.className}`);
      });
    }
    
    console.log('\n📋 FINAL ANALYSIS:');
    console.log('The issue appears to be that Step 3 is not active/displaying properly.');
    console.log('Address confirmation shows "Geen adr..." which suggests incomplete data.');
    console.log('Client details form exists but may not be visible in the current step.');
    
  } catch (error) {
    console.error('❌ Analysis error:', error);
  } finally {
    await browser.close();
  }
}

detailedCustomerAnalysis();