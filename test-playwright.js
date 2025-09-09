import { chromium } from 'playwright';

async function testPlaywright() {
  console.log('Testing Playwright installation...');
  
  try {
    // Launch browser
    const browser = await chromium.launch({
      headless: false // Set to true for headless mode
    });
    
    console.log('✓ Browser launched successfully');
    
    // Create a new page
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('✓ New page created');
    
    // Navigate to a test page
    await page.goto('https://example.com');
    console.log('✓ Navigated to example.com');
    
    // Take a screenshot
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('✓ Screenshot saved as test-screenshot.png');
    
    // Get page title
    const title = await page.title();
    console.log(`✓ Page title: ${title}`);
    
    // Close browser
    await browser.close();
    console.log('✓ Browser closed');
    
    console.log('\n🎉 Playwright is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing Playwright:', error);
  }
}

testPlaywright();