#!/usr/bin/env node
/**
 * Browser Inspector - Check what's available in the browser
 */

import { chromium } from 'playwright';

async function inspectBrowser() {
    console.log('🔍 Browser Inspector - Checking Customer Management Implementation');
    console.log('================================================================\n');

    let browser;
    try {
        // Launch browser
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        
        const page = await context.newPage();
        
        // Navigate to the page
        console.log('🌐 Navigating to http://localhost:8080...');
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
        
        // Wait for page to load
        await page.waitForTimeout(2000);
        
        // Check what's available
        const inspectionResults = await page.evaluate(() => {
            const results = {
                functions: {},
                elements: {},
                config: {},
                errors: []
            };
            
            try {
                // Check customer management functions
                const functionNames = [
                    'safeLoadCustomerData',
                    'loadCustomers',
                    'runCustomerManagementTests',
                    'CustomerManagementTester',
                    'quickTestCustomerManagement',
                    'handleCustomerError',
                    'toggleAllOrdersBulk',
                    'toggleAllOrders',
                    'isCustomerManagementEnabled',
                    'checkCustomerManagementHealth'
                ];
                
                functionNames.forEach(funcName => {
                    results.functions[funcName] = {
                        type: typeof window[funcName],
                        exists: typeof window[funcName] === 'function'
                    };
                });
                
                // Check HTML elements
                const elementIds = [
                    'customers',
                    'customerManagementGrid',
                    'customerFeatureStatus',
                    'customerFeatureMessage',
                    'customerDataStatus',
                    'customerSearchInput',
                    'customerFilterSelect',
                    'customerSearchResults',
                    'customerDetailsCard',
                    'statTotalCustomers',
                    'recentCustomersList',
                    'customerFallbackSection'
                ];
                
                elementIds.forEach(elementId => {
                    const element = document.getElementById(elementId);
                    results.elements[elementId] = {
                        exists: !!element,
                        visible: element ? window.getComputedStyle(element).display !== 'none' : false
                    };
                });
                
                // Check configuration
                results.config.CUSTOMER_MANAGEMENT_CONFIG = window.CUSTOMER_MANAGEMENT_CONFIG || null;
                results.config.isCustomerManagementEnabled = typeof window.isCustomerManagementEnabled === 'function' ? 
                    window.isCustomerManagementEnabled() : 'function not found';
                
                // Check console errors
                const consoleErrors = [];
                const originalConsoleError = console.error;
                console.error = function(...args) {
                    consoleErrors.push(args.join(' '));
                    originalConsoleError.apply(console, args);
                };
                
                // Wait a bit to catch any errors
                setTimeout(() => {
                    console.error = originalConsoleError;
                }, 1000);
                
                results.errors = consoleErrors;
                
            } catch (error) {
                results.errors.push(`Inspection error: ${error.message}`);
            }
            
            return results;
        });
        
        // Print results
        console.log('📊 INSPECTION RESULTS');
        console.log('=====================\n');
        
        console.log('🛠️  Customer Management Functions:');
        Object.entries(inspectionResults.functions).forEach(([name, info]) => {
            const status = info.exists ? '✅' : '❌';
            console.log(`  ${status} ${name}: ${info.type}`);
        });
        
        console.log('\n🎨 HTML Elements:');
        Object.entries(inspectionResults.elements).forEach(([name, info]) => {
            const status = info.exists ? (info.visible ? '✅' : '⚠️') : '❌';
            const visibility = info.exists ? (info.visible ? 'visible' : 'hidden') : 'missing';
            console.log(`  ${status} ${name}: ${visibility}`);
        });
        
        console.log('\n⚙️  Configuration:');
        console.log(`  📋 Feature enabled: ${inspectionResults.config.isCustomerManagementEnabled}`);
        if (inspectionResults.config.CUSTOMER_MANAGEMENT_CONFIG) {
            console.log(`  🔧 Config available: ${Object.keys(inspectionResults.config.CUSTOMER_MANAGEMENT_CONFIG).join(', ')}`);
        } else {
            console.log(`  ❌ Config missing: CUSTOMER_MANAGEMENT_CONFIG not found`);
        }
        
        if (inspectionResults.errors.length > 0) {
            console.log('\n🚨 Console Errors:');
            inspectionResults.errors.forEach(error => {
                console.log(`  ⚠️  ${error}`);
            });
        }
        
        // Check page title and basic info
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                hasCustomerSection: !!document.getElementById('customers'),
                hasCustomerManagement: document.querySelector('[id*="customer"]') !== null,
                totalElements: document.querySelectorAll('[id*="customer"]').length
            };
        });
        
        console.log('\n📄 Page Information:');
        console.log(`  🏷️  Title: ${pageInfo.title}`);
        console.log(`  👥 Customer section exists: ${pageInfo.hasCustomerSection}`);
        console.log(`  🔍 Customer elements found: ${pageInfo.totalElements}`);
        
        // Test if we can find the customer management functions in script.js
        const scriptContent = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src*="script.js"]'));
            return {
                scriptLoaded: scripts.length > 0,
                scriptCount: scripts.length
            };
        });
        
        console.log(`  📜 Script.js loaded: ${scriptContent.scriptLoaded}`);
        console.log(`  📜 Script references: ${scriptContent.scriptCount}`);
        
    } catch (error) {
        console.error('❌ Browser inspection failed:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the inspection
inspectBrowser().catch(error => {
    console.error('❌ Fatal error in browser inspection:', error);
    process.exit(1);
});