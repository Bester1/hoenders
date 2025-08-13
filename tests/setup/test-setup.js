// Global Test Setup for Plaas Hoenders Testing Suite
// Common setup and utilities for all test types

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

// Global test configuration
global.console = {
    ...console,
    // Suppress console.log in tests unless explicitly needed
    log: process.env.VERBOSE_TESTS ? console.log : jest.fn(),
    warn: console.warn,
    error: console.error
};

// Setup DOM environment for all tests
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;

// Add missing DOM APIs that JSDOM doesn't provide
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(() => null),
        removeItem: jest.fn(() => null),
        clear: jest.fn(() => null),
        length: 0,
        key: jest.fn(() => null)
    },
    writable: true
});

Object.defineProperty(window, 'sessionStorage', {
    value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(() => null),
        removeItem: jest.fn(() => null),
        clear: jest.fn(() => null),
        length: 0,
        key: jest.fn(() => null)
    },
    writable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
    value: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        memory: {
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
            jsHeapSizeLimit: 4000000
        }
    },
    writable: true
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn(clearTimeout);

// Mock fetch for API testing
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    })
);

// Mock File and FileReader for PDF testing
global.File = class MockFile {
    constructor(bits, name, options = {}) {
        this.bits = bits;
        this.name = name;
        this.type = options.type || '';
        this.size = bits.reduce((acc, bit) => acc + bit.length, 0);
        this.lastModified = Date.now();
    }
};

global.FileReader = class MockFileReader extends EventTarget {
    constructor() {
        super();
        this.readyState = 0;
        this.result = null;
        this.error = null;
    }
    
    readAsDataURL(file) {
        setTimeout(() => {
            this.readyState = 2;
            this.result = 'data:application/pdf;base64,mock-pdf-data';
            this.dispatchEvent(new Event('load'));
        }, 0);
    }
    
    readAsArrayBuffer(file) {
        setTimeout(() => {
            this.readyState = 2;
            this.result = new ArrayBuffer(file.size || 1024);
            this.dispatchEvent(new Event('load'));
        }, 0);
    }
    
    readAsText(file) {
        setTimeout(() => {
            this.readyState = 2;
            this.result = 'mock file content';
            this.dispatchEvent(new Event('load'));
        }, 0);
    }
};

// Mock Blob for file handling tests
global.Blob = class MockBlob {
    constructor(parts = [], options = {}) {
        this.parts = parts;
        this.type = options.type || '';
        this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    }
    
    text() {
        return Promise.resolve(this.parts.join(''));
    }
    
    arrayBuffer() {
        return Promise.resolve(new ArrayBuffer(this.size));
    }
};

// Mock URL for blob URLs
global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
};

// Custom matchers for enhanced testing
expect.extend({
    toBeValidEmail(received) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const pass = emailRegex.test(received);
        
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid email`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid email`,
                pass: false,
            };
        }
    },
    
    toBeValidPhoneNumber(received) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        const pass = phoneRegex.test(received) && received.replace(/\D/g, '').length >= 10;
        
        return {
            message: () => pass 
                ? `expected ${received} not to be a valid phone number`
                : `expected ${received} to be a valid phone number`,
            pass,
        };
    },
    
    toBeWithinRange(received, min, max) {
        const pass = received >= min && received <= max;
        return {
            message: () => pass
                ? `expected ${received} not to be within range ${min} to ${max}`
                : `expected ${received} to be within range ${min} to ${max}`,
            pass,
        };
    },
    
    toBeValidCurrency(received) {
        const currencyRegex = /^R?\d+(\.\d{2})?$/;
        const pass = currencyRegex.test(received.toString());
        
        return {
            message: () => pass
                ? `expected ${received} not to be valid currency format`
                : `expected ${received} to be valid currency format (R123.45)`,
            pass,
        };
    }
});

// Global test utilities
global.TestUtils = {
    // Create mock customer data
    createMockCustomer: (overrides = {}) => ({
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '0821234567',
        address: '123 Test Street, Cape Town',
        ...overrides
    }),
    
    // Create mock order data
    createMockOrder: (overrides = {}) => ({
        id: 'ORD-TEST-001',
        customer: 'Test Customer',
        email: 'test@example.com',
        product: 'HEEL HOENDER',
        quantity: 2,
        weight: 3.6,
        unitPrice: 67.00,
        total: 241.20,
        status: 'pending',
        date: new Date().toISOString(),
        ...overrides
    }),
    
    // Create mock PDF data
    createMockPDF: (pages = 1) => {
        const mockPages = Array.from({ length: pages }, (_, i) => ({
            pageNumber: i + 1,
            text: `SOUTH AFRICA Customer ${i + 1} Kontak: Ansie\nheuning 1 1.00 70.00 70.00`
        }));
        
        return {
            numPages: pages,
            pages: mockPages,
            getPage: jest.fn((pageNum) => 
                Promise.resolve({
                    getTextContent: () => Promise.resolve({
                        items: [{ str: mockPages[pageNum - 1]?.text || '' }]
                    })
                })
            )
        };
    },
    
    // Wait for async operations to complete
    waitFor: (condition, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                if (condition()) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Condition not met within ${timeout}ms`));
                } else {
                    setTimeout(check, 10);
                }
            };
            check();
        });
    },
    
    // Flush all promises
    flushPromises: () => new Promise(resolve => setImmediate(resolve)),
    
    // Mock timer utilities
    advanceTimersByTime: (ms) => {
        jest.advanceTimersByTime(ms);
    },
    
    runOnlyPendingTimers: () => {
        jest.runOnlyPendingTimers();
    }
};

// Mock external libraries commonly used
jest.mock('pdf-lib', () => ({
    PDFDocument: {
        create: jest.fn(() => ({
            addPage: jest.fn(),
            save: jest.fn(() => Promise.resolve(new Uint8Array()))
        })),
        load: jest.fn(() => Promise.resolve({
            getPageCount: jest.fn(() => 1),
            getPage: jest.fn(() => ({}))
        }))
    }
}));

// Setup cleanup after each test
afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset localStorage and sessionStorage
    global.localStorage.clear();
    global.sessionStorage.clear();
    
    // Clear DOM
    document.body.innerHTML = '';
    
    // Reset fetch mock
    global.fetch.mockClear();
    
    // Clear any custom properties added during tests
    delete window.SecurityUtils;
    delete window.ErrorHandler;
    delete window.DOMUtils;
    delete window.SharedComponents;
    delete window.AppConfig;
});

// Setup before all tests
beforeAll(() => {
    // Suppress console warnings for expected test warnings
    const originalWarn = console.warn;
    console.warn = jest.fn((message) => {
        if (message && typeof message === 'string') {
            // Suppress known test warnings
            if (message.includes('Warning: ReactDOM.render is no longer supported')) return;
            if (message.includes('Warning: componentWillMount has been renamed')) return;
        }
        originalWarn(message);
    });
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🧪 Global test setup completed - Plaas Hoenders Test Suite ready');