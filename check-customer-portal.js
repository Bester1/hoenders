import { chromium } from 'playwright';

async function checkCustomerPortal() {
  console.log('🔍 Checking customer portal at GitHub Pages...');
  
  const browser = await chromium.launch({
    headless: false, // Show browser for visual inspection
    slowMo: 1000    // Slow down actions for better visibility
  });
  
  let page;
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    page = await context.newPage();
    
    // Navigate to the GitHub Pages customer portal
    console.log('🌐 Navigating to customer portal...');
    await page.goto('https://bester1.github.io/hoenders/customer-portal.html', {
      waitUntil: 'networkidle'
    });
    
    console.log('✅ Page loaded');
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'customer-portal-initial.png', fullPage: true });
    console.log('📸 Initial screenshot saved');
    
    // Check for the 3 sections
    console.log('\n🔍 Analyzing page structure...');
    
    // Get all sections
    const sections = await page.$$eval('section, .section, div[class*="section"]', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        innerHTML: el.innerHTML.substring(0, 200) // First 200 chars
      }))
    );
    
    console.log(`Found ${sections.length} potential sections:`);
    sections.forEach((section, index) => {
      console.log(`  ${index + 1}. ${section.tagName} - Class: "${section.className}" - ID: "${section.id}"`);
      console.log(`     Content preview: ${section.innerHTML.replace(/\s+/g, ' ').trim()}`);
    });
    
    // Look for address confirmation section
    console.log('\n🔍 Looking for address confirmation...');
    
    // Search for the specific text you mentioned
    const addressElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && el.textContent.includes('Ek bevestig dat my aflewerings adres korrek is'))
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          textContent: el.textContent.trim(),
          parentInfo: el.parentElement ? {
            tagName: el.parentElement.tagName,
            className: el.parentElement.className
          } : null
        }));
    });
    
    if (addressElements.length > 0) {
      console.log(`✅ Found address confirmation text in ${addressElements.length} elements:`);
      addressElements.forEach((el, index) => {
        console.log(`  ${index + 1}. ${el.tagName} (class: "${el.className}", id: "${el.id}")`);
        console.log(`     Text: "${el.textContent.substring(0, 100)}..."`);
        if (el.parentInfo) {
          console.log(`     Parent: ${el.parentInfo.tagName} (class: "${el.parentInfo.className}")`);
        }
      });
    } else {
      console.log('❌ Address confirmation text not found');
    }
    
    // Look for client details form
    console.log('\n🔍 Looking for client details form...');
    
    // Search for form elements
    const forms = await page.$$eval('form', forms => 
      forms.map(form => ({
        action: form.action,
        method: form.method,
        className: form.className,
        id: form.id,
        innerHTML: form.innerHTML.substring(0, 300)
      }))
    );
    
    console.log(`Found ${forms.length} forms:`);
    forms.forEach((form, index) => {
      console.log(`  ${index + 1}. Form - Action: "${form.action}" - Method: "${form.method}"`);
      console.log(`     Class: "${form.className}" - ID: "${form.id}"`);
      console.log(`     Content: ${form.innerHTML.replace(/\s+/g, ' ').trim()}`);
    });
    
    // Look for input fields specifically
    const inputs = await page.$$eval('input', inputs => 
      inputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        value: input.value,
        className: input.className
      }))
    );
    
    console.log(`\nFound ${inputs.length} input fields:`);
    inputs.forEach((input, index) => {
      console.log(`  ${index + 1}. Input - Type: "${input.type}" - Name: "${input.name}" - ID: "${input.id}"`);
      console.log(`     Placeholder: "${input.placeholder}" - Value: "${input.value}"`);
    });
    
    // Look for specific client-related fields
    const clientFields = inputs.filter(input => 
      input.name && (input.name.toLowerCase().includes('client') || 
                     input.name.toLowerCase().includes('customer') ||
                     input.name.toLowerCase().includes('name') ||
                     input.name.toLowerCase().includes('email'))
    );
    
    console.log(`\n🎯 Client-related fields found: ${clientFields.length}`);
    clientFields.forEach(field => {
      console.log(`   - ${field.name} (${field.type}): "${field.value}"`);
    });
    
    // Check if there's a 3-page/step process
    console.log('\n🔍 Looking for multi-step/process indicators...');
    
    // Look for step indicators
    const steps = await page.$$eval('[class*="step"], [id*="step"], .progress, .wizard', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        textContent: el.textContent.trim()
      }))
    );
    
    console.log(`Found ${steps.length} step/process elements:`);
    steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.tagName} - "${step.className}" - "${step.textContent.substring(0, 50)}"`);
    });
    
    // Take final screenshot
    await page.screenshot({ path: 'customer-portal-analysis.png', fullPage: true });
    console.log('\n📸 Analysis screenshot saved');
    
    console.log('\n📝 Summary:');
    console.log('- Address confirmation text found:', addressElements.length > 0 ? 'YES' : 'NO');
    console.log('- Client detail forms found:', forms.length);
    console.log('- Client-related input fields:', clientFields.length);
    console.log('- Multi-step indicators found:', steps.length);
    
    if (addressElements.length > 0 && clientFields.length === 0) {
      console.log('\n⚠️  ISSUE DETECTED: Address confirmation shows but client details form is missing!');
      console.log('This suggests the 3-section form is not displaying properly.');
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    if (page) {
      await page.screenshot({ path: 'customer-portal-error.png', fullPage: true });
    }
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

checkCustomerPortal();