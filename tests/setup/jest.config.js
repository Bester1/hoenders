// Jest Configuration for Plaas Hoenders Testing Suite
// Comprehensive testing setup with security, performance, and E2E testing

export default {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Test file patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/tests/**/*.spec.js'
    ],
    
    // Setup files
    setupFilesAfterEnv: [
        '<rootDir>/tests/setup/test-setup.js'
    ],
    
    // Module paths
    roots: ['<rootDir>/tests', '<rootDir>/'],
    
    // Transform files
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Module file extensions
    moduleFileExtensions: ['js', 'json'],
    
    // Coverage configuration
    collectCoverage: true,
    collectCoverageFrom: [
        'script.js',
        'utils.js',
        'shared-components.js',
        'customer.js',
        '!tests/**',
        '!node_modules/**',
        '!coverage/**'
    ],
    
    coverageDirectory: '<rootDir>/coverage',
    
    coverageReporters: [
        'text',
        'text-summary',
        'html',
        'lcov'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 80,
            statements: 80
        },
        // Higher thresholds for security-critical files
        './utils.js': {
            branches: 90,
            functions: 95,
            lines: 95,
            statements: 95
        }
    },
    
    // Test timeout (30 seconds for E2E tests)
    testTimeout: 30000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
    
    // Global test variables
    globals: {
        'process.env.NODE_ENV': 'test'
    },
    
    // Module name mapping for mocking
    moduleNameMapper: {
        // Mock static assets
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        
        // Mock external libraries
        '^@supabase/supabase-js$': '<rootDir>/tests/mocks/supabase-mock.js',
        '^puppeteer$': '<rootDir>/tests/mocks/puppeteer-mock.js'
    },
    
    // Test suites organization
    projects: [
        {
            displayName: 'Security Tests',
            testMatch: ['<rootDir>/tests/security/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/security-setup.js']
        },
        {
            displayName: 'Performance Tests',
            testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/performance-setup.js']
        },
        {
            displayName: 'E2E Tests',
            testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e-setup.js'],
            testTimeout: 60000 // Longer timeout for E2E
        },
        {
            displayName: 'Integration Tests',
            testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.js']
        },
        {
            displayName: 'Stress Tests',
            testMatch: ['<rootDir>/tests/stress/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/stress-setup.js'],
            testTimeout: 120000 // Very long timeout for stress tests
        }
    ],
    
    // Reporters
    reporters: [
        'default',
        ['jest-html-reporters', {
            publicPath: '<rootDir>/test-reports',
            filename: 'test-report.html',
            expand: true,
            hideIcon: false,
            pageTitle: 'Plaas Hoenders Test Report'
        }],
        ['jest-junit', {
            outputDirectory: '<rootDir>/test-reports',
            outputName: 'junit.xml'
        }]
    ],
    
    // Performance monitoring
    maxWorkers: '50%', // Use half of available CPU cores
    
    // Test result processing
    testResultsProcessor: '<rootDir>/tests/setup/test-results-processor.js'
};