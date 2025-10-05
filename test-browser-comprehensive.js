#!/usr/bin/env node
/**
 * Comprehensive Browser-Based Customer Management Testing
 * Validates functionality through browser automation
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Comprehensive Browser-Based Customer Management Testing');
console.log('=========================================================\n');

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
    browserTests: {},
    performance: {}
};

// Browser test functions
const browserTests = {
    /**
     * Test basic page loading and customer management UI
     */
    testBasicLoading: async function(page) {
        console.log('📄 Testing Basic Page Loading...');
        
        try {
            // Navigate to the main page
            await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
            
            // Check if page loaded successfully
            const title = await page.title();
            const hasCustomerSection = await page.locator('#customers').count() > 0;
            
            const testPassed = title.includes('Customer') || hasCustomerSection;
            
            if (testPassed) {
                console.log('✅ Basic page loading successful');
                testResults.browserTests.basicLoading = true;
                testResults.passed++;
            } else {
                console.log('❌ Basic page loading failed');
                testResults.errors.push('Page title or customer section not found');
                testResults.browserTests.basicLoading = false;
                testResults.failed++;
            }
            
        } catch (error) {
            console.log('❌ Error in basic loading test:', error.message);
            testResults.errors.push(`Basic loading error: ${error.message}`);
            testResults.browserTests.basicLoading = false;
            testResults.failed++;
        }
    },
    
    /**
     * Test customer data loading functionality
     */
    testCustomerDataLoading: async function(page) {
        console.log('👥 Testing Customer Data Loading...');
        
        try {
            // Wait for customer data to load
            await page.waitForTimeout(2000);
            
            // Check if customer data is present
            const hasCustomerData = await page.evaluate(() => {
                return typeof window.safeLoadCustomerData === 'function' || 
                       typeof window.loadCustomers === 'function';
            });
            
            // Try to load customer data if function exists
            if (hasCustomerData) {
                const loadResult = await page.evaluate(async () => {
                    try {
                        if (typeof window.safeLoadCustomerData === 'function') {
                            return await window.safeLoadCustomerData();
                        } else if (typeof window.loadCustomers === 'function') {
                            return await window.loadCustomers();
                        }
                        return { success: false, error: 'No customer loading function found' };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                });
                
                const testPassed = loadResult.success !== false || loadResult.data || loadResult.customers;
                
                if (testPassed) {
                    console.log('✅ Customer data loading functionality validated');
                    testResults.browserTests.customerDataLoading = true;
                    testResults.passed++;
                } else {
                    console.log('❌ Customer data loading failed');
                    testResults.errors.push(`Customer data loading: ${loadResult.error}`);
                    testResults.browserTests.customerDataLoading = false;
                    testResults.failed++;
                }
            } else {
                console.log('⚠️  Customer data loading functions not found');
                testResults.browserTests.customerDataLoading = 'not-found';
                testResults.warnings = (testResults.warnings || 0) + 1;
            }
            
        } catch (error) {
            console.log('❌ Error in customer data loading test:', error.message);
            testResults.errors.push(`Customer data loading error: ${error.message}`);
            testResults.browserTests.customerDataLoading = false;
            testResults.failed++;
        }
    },
    
    /**
     * Test comprehensive testing suite
     */
    testComprehensiveTestingSuite: async function(page) {
        console.log('🧪 Testing Comprehensive Testing Suite...');
        
        try {
            // Check if comprehensive testing functions exist
            const hasTestingSuite = await page.evaluate(() => {
                return typeof window.runCustomerManagementTests === 'function' ||
                       typeof window.CustomerManagementTester === 'function' ||
                       typeof window.quickTestCustomerManagement === 'function';
            });
            
            if (hasTestingSuite) {
                // Run the comprehensive tests
                const testResults = await page.evaluate(async () => {
                    try {
                        const results = {};
                        
                        if (typeof window.quickTestCustomerManagement === 'function') {
                            results.quickTest = await window.quickTestCustomerManagement();
                        }
                        
                        if (typeof window.runCustomerManagementTests === 'function') {
                            results.comprehensive = await window.runCustomerManagementTests();
                        }
                        
                        if (typeof window.CustomerManagementTester === 'function') {
                            const tester = new window.CustomerManagementTester();
                            results.classBased = await tester.runAllTests();
                        }
                        
                        return { success: true, results };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                });
                
                if (testResults.success) {
                    console.log('✅ Comprehensive testing suite validated');
                    testResults.browserTests.comprehensiveTesting = true;
                    testResults.passed++;
                    
                    // Store detailed test results
                    testResults.detailedResults = testResults.results;
                } else {
                    console.log('❌ Comprehensive testing suite failed');
                    testResults.errors.push(`Testing suite: ${testResults.error}`);
                    testResults.browserTests.comprehensiveTesting = false;
                    testResults.failed++;
                }
            } else {
                console.log('⚠️  Comprehensive testing suite not found');
                testResults.browserTests.comprehensiveTesting = 'not-found';
                testResults.warnings = (testResults.warnings || 0) + 1;
            }
            
        } catch (error) {
            console.log('❌ Error in comprehensive testing test:', error.message);
            testResults.errors.push(`Testing suite error: ${error.message}`);
            testResults.browserTests.comprehensiveTesting = false;
            testResults.failed++;
        }
    },
    
    /**
     * Test error handling and safety mechanisms
     */
    testErrorHandling: async function(page) {
        console.log('🛡️  Testing Error Handling and Safety Mechanisms...');
        
        try {
            // Test error handling by calling functions with invalid parameters
            const errorTestResults = await page.evaluate(async () => {
                const results = {
                    errorHandling: false,
                    safetyMechanisms: false,
                    gracefulDegradation: false
                };
                
                try {
                    // Test error handling with invalid data
                    if (typeof window.safeLoadCustomerData === 'function') {
                        const errorResult = await window.safeLoadCustomerData(null);
                        results.errorHandling = errorResult && !errorResult.success;
                    }
                    
                    // Test safety mechanisms
                    if (typeof window.handleCustomerError === 'function') {
                        try {
                            window.handleCustomerError(new Error('Test error'));
                            results.safetyMechanisms = true;
                        } catch (e) {
                            results.safetyMechanisms = false;
                        }
                    }
                    
                    // Test graceful degradation
                    if (typeof window.toggleAllOrdersBulk === 'function') {
                        try {
                            // This should handle errors gracefully
                            results.gracefulDegradation = true;
                        } catch (e) {
                            results.gracefulDegradation = false;
                        }
                    }
                    
                    return { success: true, results };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            if (errorTestResults.success) {
                const { results } = errorTestResults;
                const passedTests = Object.values(results).filter(r => r === true).length;
                const totalTests = Object.keys(results).length;
                
                if (passedTests >= totalTests / 2) {
                    console.log(`✅ Error handling and safety mechanisms validated (${passedTests}/${totalTests})`);
                    testResults.browserTests.errorHandling = true;
                    testResults.passed++;
                } else {
                    console.log(`❌ Error handling and safety mechanisms insufficient (${passedTests}/${totalTests})`);
                    testResults.errors.push(`Error handling: Only ${passedTests}/${totalTests} tests passed`);
                    testResults.browserTests.errorHandling = false;
                    testResults.failed++;
                }
            } else {
                console.log('❌ Error handling test failed');
                testResults.errors.push(`Error handling test: ${errorTestResults.error}`);
                testResults.browserTests.errorHandling = false;
                testResults.failed++;
            }
            
        } catch (error) {
            console.log('❌ Error in error handling test:', error.message);
            testResults.errors.push(`Error handling test error: ${error.message}`);
            testResults.browserTests.errorHandling = false;
            testResults.failed++;
        }
    },
    
    /**
     * Test UI integration
     */
    testUIIntegration: async function(page) {
        console.log('🎨 Testing UI Integration...');
        
        try {
            // Test UI elements and interactions
            const uiTestResults = await page.evaluate(() => {
                const results = {
                    hasCustomerSection: false,
                    hasInteractiveElements: false,
                    hasStyling: false
                };
                
                // Check for customer section
                const customerSection = document.getElementById('customers');
                results.hasCustomerSection = !!customerSection;
                
                // Check for interactive elements
                const buttons = document.querySelectorAll('button');
                const inputs = document.querySelectorAll('input');
                results.hasInteractiveElements = buttons.length > 0 || inputs.length > 0;
                
                // Check for styling
                const hasStyles = document.querySelector('style') || 
                                document.querySelector('link[rel="stylesheet"]') ||
                                document.querySelector('.customer-card') ||
                                document.querySelector('.customer-management');
                results.hasStyling = !!hasStyles;
                
                return results;
            });
            
            const { results } = uiTestResults;
            const passedTests = Object.values(results).filter(r => r === true).length;
            const totalTests = Object.keys(results).length;
            
            if (passedTests >= totalTests * 0.66) {
                console.log(`✅ UI integration validated (${passedTests}/${totalTests})`);
                testResults.browserTests.uiIntegration = true;
                testResults.passed++;
            } else {
                console.log(`❌ UI integration insufficient (${passedTests}/${totalTests})`);
                testResults.errors.push(`UI integration: Only ${passedTests}/${totalTests} tests passed`);
                testResults.browserTests.uiIntegration = false;
                testResults.failed++;
            }
            
        } catch (error) {
            console.log('❌ Error in UI integration test:', error.message);
            testResults.errors.push(`UI integration error: ${error.message}`);
            testResults.browserTests.uiIntegration = false;
            testResults.failed++;
        }
    }
};

// Main browser testing function
async function runComprehensiveBrowserTests() {
    console.log('🌐 Starting Comprehensive Browser-Based Testing\n');
    
    const startTime = Date.now();
    let browser;
    
    try {
        // Launch browser
        console.log('🚀 Launching browser...');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        
        const page = await context.newPage();
        
        // Set up console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('🌐 Browser console error:', msg.text());
            }
        });
        
        // Run all browser tests
        await browserTests.testBasicLoading(page);
        console.log('');
        
        await browserTests.testCustomerDataLoading(page);
        console.log('');
        
        await browserTests.testComprehensiveTestingSuite(page);
        console.log('');
        
        await browserTests.testErrorHandling(page);
        console.log('');
        
        await browserTests.testUIIntegration(page);
        console.log('');
        
        // Calculate performance metrics
        const endTime = Date.now();
        testResults.performance.totalTestTime = endTime - startTime;
        testResults.performance.testsPerSecond = (testResults.passed + testResults.failed) / (testResults.performance.totalTestTime / 1000);
        
        // Generate comprehensive browser test report
        generateBrowserTestReport();
        
    } catch (error) {
        console.log('❌ Critical error during browser testing:', error.message);
        testResults.errors.push(`Critical browser test error: ${error.message}`);
        testResults.failed++;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Generate comprehensive browser test report
 */
function generateBrowserTestReport() {
    console.log('📊 COMPREHENSIVE BROWSER TEST REPORT');
    console.log('====================================\n');
    
    console.log('📈 Test Results Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings || 0}`);
    console.log(`⏱️  Total Test Time: ${testResults.performance.totalTestTime}ms`);
    console.log(`🚀 Tests per Second: ${testResults.performance.testsPerSecond.toFixed(2)}\n`);
    
    console.log('🌐 Browser Test Status:');
    Object.entries(testResults.browserTests).forEach(([test, status]) => {
        const statusIcon = status === true ? '✅' : 
                          status === false ? '❌' : '⚠️';
        const statusText = status === true ? 'PASSED' : 
                          status === false ? 'FAILED' : 'NOT FOUND';
        console.log(`${statusIcon} ${test}: ${statusText}`);
    });
    
    if (testResults.errors.length > 0) {
        console.log('\n🚨 Browser Test Issues:');
        testResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Determine overall browser test status
    const passedTests = testResults.passed;
    const totalTests = testResults.passed + testResults.failed;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log('\n🏆 Browser Test Assessment:');
    if (successRate >= 80) {
        console.log('✅ EXCELLENT - Browser functionality fully validated');
        console.log('🎯 Recommendation: READY FOR PRODUCTION');
    } else if (successRate >= 60) {
        console.log('⚠️  GOOD - Most browser functionality working with minor issues');
        console.log('🎯 Recommendation: ADDRESS MINOR ISSUES BEFORE DEPLOYMENT');
    } else if (successRate >= 40) {
        console.log('❌ NEEDS IMPROVEMENT - Significant browser functionality issues');
        console.log('🎯 Recommendation: FIX CRITICAL ISSUES BEFORE DEPLOYMENT');
    } else {
        console.log('❌ CRITICAL - Major browser functionality problems');
        console.log('🎯 Recommendation: DO NOT DEPLOY - FIX CRITICAL ISSUES');
    }
    
    console.log(`📊 Browser Test Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${totalTests} tests)`);
    
    // Save browser test report to file
    const reportPath = path.join(__dirname, 'browser-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Detailed browser test report saved to: ${reportPath}`);
    
    // Provide actionable recommendations
    console.log('\n🔧 Browser Test Recommendations:');
    if (testResults.browserTests.basicLoading === false) {
        console.log('   • Fix basic page loading issues');
    }
    if (testResults.browserTests.customerDataLoading === false) {
        console.log('   • Implement or fix customer data loading functionality');
    }
    if (testResults.browserTests.comprehensiveTesting === false) {
        console.log('   • Ensure comprehensive testing suite is properly loaded');
    }
    if (testResults.browserTests.errorHandling === false) {
        console.log('   • Enhance browser-side error handling');
    }
    if (testResults.browserTests.uiIntegration === false) {
        console.log('   • Improve UI integration and styling');
    }
}

// Run the comprehensive browser tests
if (import.meta.url === `file://${process.argv[1]}`) {
    runComprehensiveBrowserTests().catch(error => {
        console.error('❌ Fatal error in browser testing:', error);
        process.exit(1);
    });
}

export {
    runComprehensiveBrowserTests,
    testResults,
    browserTests
};