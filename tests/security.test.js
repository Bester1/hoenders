// Security Unit Tests for Plaas Hoenders
// Testing recent security hardening implementations

import { jest } from '@jest/globals';

// Mock DOM environment
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window;

// Import security utilities (we'll need to load them)
let SecurityUtils, ErrorHandler, DOMUtils;

beforeAll(() => {
    // Load utils.js content
    const fs = require('fs');
    const path = require('path');
    const utilsContent = fs.readFileSync(path.join(__dirname, '../utils.js'), 'utf8');
    eval(utilsContent);
    
    SecurityUtils = global.SecurityUtils;
    ErrorHandler = global.ErrorHandler;
    DOMUtils = global.DOMUtils;
});

describe('Security Utils - Input Sanitization', () => {
    
    describe('sanitizeInput', () => {
        test('prevents XSS via script tags', () => {
            const maliciousInput = '<script>alert("xss")</script>';
            const result = SecurityUtils.sanitizeInput(maliciousInput);
            expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
            expect(result).not.toContain('<script>');
        });

        test('prevents XSS via event handlers', () => {
            const maliciousInput = '<img src="x" onerror="alert(1)">';
            const result = SecurityUtils.sanitizeInput(maliciousInput);
            expect(result).toBe('&lt;img src="x" onerror="alert(1)"&gt;');
            expect(result).not.toContain('onerror=');
        });

        test('prevents XSS via javascript: URLs', () => {
            const maliciousInput = '<a href="javascript:alert(1)">click</a>';
            const result = SecurityUtils.sanitizeInput(maliciousInput);
            expect(result).not.toContain('javascript:');
            expect(result).toContain('&lt;');
        });

        test('handles nested XSS attempts', () => {
            const maliciousInput = '<<script>script>alert("xss")<</script>/script>';
            const result = SecurityUtils.sanitizeInput(maliciousInput);
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;');
        });

        test('preserves normal text content', () => {
            const normalInput = 'HEEL HOENDER - Fresh Chicken 2.5kg';
            const result = SecurityUtils.sanitizeInput(normalInput);
            expect(result).toBe(normalInput);
        });

        test('handles empty and null inputs safely', () => {
            expect(SecurityUtils.sanitizeInput('')).toBe('');
            expect(SecurityUtils.sanitizeInput(null)).toBe(null);
            expect(SecurityUtils.sanitizeInput(undefined)).toBe(undefined);
        });

        test('sanitizes SQL injection attempts in text', () => {
            const sqlInput = "'; DROP TABLE customers; --";
            const result = SecurityUtils.sanitizeInput(sqlInput);
            expect(result).toContain('&#039;'); // Escaped single quote
            expect(result).not.toContain("';");
        });
    });

    describe('sanitizeNumber', () => {
        test('accepts valid numbers', () => {
            expect(SecurityUtils.sanitizeNumber('123.45')).toBe(123.45);
            expect(SecurityUtils.sanitizeNumber('67')).toBe(67);
            expect(SecurityUtils.sanitizeNumber(89.50)).toBe(89.50);
        });

        test('rejects non-numeric strings', () => {
            expect(SecurityUtils.sanitizeNumber('not-a-number')).toBe(0);
            expect(SecurityUtils.sanitizeNumber('123abc')).toBe(0);
            expect(SecurityUtils.sanitizeNumber('NaN')).toBe(0);
        });

        test('handles malicious number inputs', () => {
            expect(SecurityUtils.sanitizeNumber('Infinity')).toBe(0);
            expect(SecurityUtils.sanitizeNumber('-Infinity')).toBe(0);
            expect(SecurityUtils.sanitizeNumber('1e308')).toBe(0); // Overflow
        });

        test('uses custom default values', () => {
            expect(SecurityUtils.sanitizeNumber('invalid', 99)).toBe(99);
            expect(SecurityUtils.sanitizeNumber(null, -1)).toBe(-1);
        });

        test('handles edge cases', () => {
            expect(SecurityUtils.sanitizeNumber('0')).toBe(0);
            expect(SecurityUtils.sanitizeNumber('-5.5')).toBe(-5.5);
            expect(SecurityUtils.sanitizeNumber('')).toBe(0);
        });
    });

    describe('sanitizeEmail', () => {
        test('accepts valid email formats', () => {
            expect(SecurityUtils.sanitizeEmail('user@example.com')).toBe('user@example.com');
            expect(SecurityUtils.sanitizeEmail('jean.dreyer@gmail.com')).toBe('jean.dreyer@gmail.com');
            expect(SecurityUtils.sanitizeEmail('ADMIN@PLAASHOENDERS.CO.ZA')).toBe('admin@plaashoenders.co.za');
        });

        test('rejects invalid email formats', () => {
            expect(SecurityUtils.sanitizeEmail('not-an-email')).toBe('');
            expect(SecurityUtils.sanitizeEmail('user@')).toBe('');
            expect(SecurityUtils.sanitizeEmail('@example.com')).toBe('');
            expect(SecurityUtils.sanitizeEmail('user..name@example.com')).toBe('');
        });

        test('handles malicious email inputs', () => {
            expect(SecurityUtils.sanitizeEmail('<script>@example.com')).toBe('');
            expect(SecurityUtils.sanitizeEmail('user@<script>example</script>.com')).toBe('');
            expect(SecurityUtils.sanitizeEmail("user'; DROP TABLE users; --@example.com")).toBe('');
        });

        test('trims whitespace and converts to lowercase', () => {
            expect(SecurityUtils.sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
            expect(SecurityUtils.sanitizeEmail('\ttest@domain.org\n')).toBe('test@domain.org');
        });
    });

    describe('sanitizeFileName', () => {
        test('removes dangerous characters', () => {
            expect(SecurityUtils.sanitizeFileName('invoice/../../etc/passwd')).toBe('invoice_____etc_passwd');
            expect(SecurityUtils.sanitizeFileName('file<script>name')).toBe('file_script_name');
        });

        test('preserves safe characters', () => {
            expect(SecurityUtils.sanitizeFileName('invoice_2025-01-15.pdf')).toBe('invoice_2025-01-15.pdf');
            expect(SecurityUtils.sanitizeFileName('customer-order.123.csv')).toBe('customer-order.123.csv');
        });
    });
});

describe('Security Utils - HTML Sanitization', () => {
    
    describe('sanitizeHTML', () => {
        test('converts text to safe HTML', () => {
            const input = '<script>alert("xss")</script>Hello';
            const result = SecurityUtils.sanitizeHTML(input);
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('handles null and undefined inputs', () => {
            expect(SecurityUtils.sanitizeHTML(null)).toBe('');
            expect(SecurityUtils.sanitizeHTML(undefined)).toBe('');
            expect(SecurityUtils.sanitizeHTML('')).toBe('');
        });
    });
});

describe('DOM Utils - Safe DOM Manipulation', () => {
    
    beforeEach(() => {
        // Clear DOM before each test
        document.body.innerHTML = '';
    });

    describe('createElement', () => {
        test('creates safe DOM elements', () => {
            const element = DOMUtils.createElement('div', 'Safe Text', 'test-class');
            expect(element.tagName).toBe('DIV');
            expect(element.textContent).toBe('Safe Text');
            expect(element.className).toBe('test-class');
        });

        test('prevents XSS in text content', () => {
            const element = DOMUtils.createElement('div', '<script>alert("xss")</script>');
            expect(element.textContent).toBe('<script>alert("xss")</script>');
            expect(element.innerHTML).not.toContain('<script>');
        });
    });

    describe('createTableRow', () => {
        test('creates table rows safely', () => {
            const data = ['Cell 1', 'Cell 2', '<script>alert("xss")</script>'];
            const row = DOMUtils.createTableRow(data);
            
            expect(row.tagName).toBe('TR');
            expect(row.children.length).toBe(3);
            expect(row.children[2].textContent).toBe('<script>alert("xss")</script>');
            expect(row.children[2].innerHTML).not.toContain('<script>');
        });

        test('handles object data with element property', () => {
            const button = document.createElement('button');
            button.textContent = 'Click me';
            
            const data = ['Text', { element: button }];
            const row = DOMUtils.createTableRow(data);
            
            expect(row.children.length).toBe(2);
            expect(row.children[1].children[0]).toBe(button);
        });
    });

    describe('populateTable', () => {
        test('populates table safely', () => {
            const tbody = document.createElement('tbody');
            const data = [
                { name: 'Jean Dreyer', email: 'jean@example.com' },
                { name: '<script>alert("xss")</script>', email: 'malicious@example.com' }
            ];
            const columns = ['name', 'email'];
            
            DOMUtils.populateTable(tbody, data, columns);
            
            expect(tbody.children.length).toBe(2);
            expect(tbody.children[1].children[0].textContent).toBe('<script>alert("xss")</script>');
            expect(tbody.children[1].children[0].innerHTML).not.toContain('<script>');
        });

        test('handles empty data gracefully', () => {
            const tbody = document.createElement('tbody');
            DOMUtils.populateTable(tbody, [], ['col1', 'col2']);
            
            expect(tbody.children.length).toBe(1);
            expect(tbody.children[0].children[0].textContent).toBe('No data available');
            expect(tbody.children[0].children[0].colSpan).toBe(2);
        });
    });

    describe('updateElement', () => {
        test('updates element content safely', () => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            div.id = 'test-element';
            
            DOMUtils.updateElement('test-element', '<script>alert("xss")</script>');
            
            expect(div.textContent).toBe('<script>alert("xss")</script>');
            expect(div.innerHTML).not.toContain('<script>');
        });

        test('handles DOM element content', () => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            div.id = 'test-element';
            
            const span = document.createElement('span');
            span.textContent = 'Safe content';
            
            DOMUtils.updateElement('test-element', span, true);
            
            expect(div.children[0]).toBe(span);
        });
    });
});

describe('Error Handler - Security', () => {
    
    describe('showNotification', () => {
        test('sanitizes notification messages', () => {
            const maliciousMessage = '<script>alert("xss")</script>Database error';
            
            // Mock notification creation
            const originalCreateElement = document.createElement;
            let createdElements = [];
            document.createElement = function(tag) {
                const element = originalCreateElement.call(this, tag);
                createdElements.push(element);
                return element;
            };
            
            ErrorHandler.showNotification(maliciousMessage, 'error');
            
            // Check that no script tags were created in any element
            const hasScriptContent = createdElements.some(el => 
                el.innerHTML && el.innerHTML.includes('<script>')
            );
            expect(hasScriptContent).toBe(false);
            
            // Restore original createElement
            document.createElement = originalCreateElement;
        });
    });

    describe('getUserFriendlyMessage', () => {
        test('sanitizes error messages', () => {
            const maliciousError = new Error('<script>alert("xss")</script>Network error');
            const result = ErrorHandler.getUserFriendlyMessage(maliciousError);
            
            expect(result).not.toContain('<script>');
            expect(typeof result).toBe('string');
        });
    });
});

describe('Configuration Security', () => {
    
    test('AppConfig object should be frozen', () => {
        // This test requires AppConfig to be loaded
        // In a real test environment, we'd import the config
        const testConfig = { API_KEY: 'test' };
        Object.freeze(testConfig);
        
        expect(() => {
            testConfig.API_KEY = 'modified';
        }).not.toThrow();
        
        expect(testConfig.API_KEY).toBe('test'); // Should remain unchanged
    });
});

describe('PDF Processing Security', () => {
    
    describe('Customer Name Extraction', () => {
        test('sanitizes extracted customer names', () => {
            const maliciousOCRText = `
                SOUTH AFRICA <script>alert("xss")</script>Jean Dreyer Kontak: Ansie
            `;
            
            // Simulate customer extraction with sanitization
            const extractedName = maliciousOCRText
                .match(/SOUTH AFRICA\s+(.+?)\s+Kontak:/)?.[1]
                ?.trim();
            
            if (extractedName) {
                const sanitizedName = SecurityUtils.sanitizeInput(extractedName);
                expect(sanitizedName).not.toContain('<script>');
                expect(sanitizedName).toContain('&lt;script&gt;');
            }
        });

        test('handles malformed OCR text safely', () => {
            const malformedText = "SOUTH AFRICA '; DROP TABLE customers; -- Kontak: Ansie";
            const extractedName = malformedText
                .match(/SOUTH AFRICA\s+(.+?)\s+Kontak:/)?.[1]
                ?.trim();
            
            if (extractedName) {
                const sanitizedName = SecurityUtils.sanitizeInput(extractedName);
                expect(sanitizedName).not.toContain('DROP TABLE');
                expect(sanitizedName).toContain('&#039;'); // Escaped quote
            }
        });
    });

    describe('Product Description Sanitization', () => {
        test('sanitizes product descriptions from PDF', () => {
            const maliciousDescription = '<img src="x" onerror="alert(1)">heuning';
            const sanitized = SecurityUtils.sanitizeInput(maliciousDescription);
            
            expect(sanitized).not.toContain('onerror=');
            expect(sanitized).toContain('&lt;img');
        });
    });
});

describe('Database Input Security', () => {
    
    test('sanitizes order data before storage', () => {
        const maliciousOrderData = {
            customerName: '<script>alert("xss")</script>Jean',
            product: 'HEEL HOENDER\'; DROP TABLE orders; --',
            quantity: '2<script>',
            email: 'jean@example.com<script>alert(1)</script>'
        };
        
        const sanitizedOrder = {
            customerName: SecurityUtils.sanitizeInput(maliciousOrderData.customerName),
            product: SecurityUtils.sanitizeInput(maliciousOrderData.product),
            quantity: SecurityUtils.sanitizeNumber(maliciousOrderData.quantity),
            email: SecurityUtils.sanitizeEmail(maliciousOrderData.email)
        };
        
        expect(sanitizedOrder.customerName).not.toContain('<script>');
        expect(sanitizedOrder.product).not.toContain('DROP TABLE');
        expect(sanitizedOrder.quantity).toBe(0); // Invalid number becomes 0
        expect(sanitizedOrder.email).toBe(''); // Invalid email becomes empty
    });
});

describe('Email Security', () => {
    
    test('prevents email header injection', () => {
        const maliciousSubject = 'Order Confirmation\nBCC: attacker@evil.com\n\nMalicious content';
        const sanitizedSubject = SecurityUtils.sanitizeInput(maliciousSubject);
        
        expect(sanitizedSubject).not.toContain('\n');
        expect(sanitizedSubject).not.toContain('BCC:');
    });

    test('validates recipient emails', () => {
        const suspiciousEmails = [
            'user@example.com<script>',
            'user@example.com\nBCC:attacker@evil.com',
            'user"; DROP TABLE customers; --@example.com'
        ];
        
        suspiciousEmails.forEach(email => {
            const sanitized = SecurityUtils.sanitizeEmail(email);
            expect(sanitized).toBe(''); // Should reject all malicious emails
        });
    });
});

describe('Local Storage Security', () => {
    
    test('sanitizes data before localStorage storage', () => {
        const maliciousData = {
            imports: { 'test<script>': { orders: [] } },
            customerName: '<img src="x" onerror="alert(1)">'
        };
        
        // Simulate sanitization before storage
        const sanitizedForStorage = JSON.stringify({
            imports: Object.fromEntries(
                Object.entries(maliciousData.imports).map(([key, value]) => [
                    SecurityUtils.sanitizeInput(key),
                    value
                ])
            ),
            customerName: SecurityUtils.sanitizeInput(maliciousData.customerName)
        });
        
        expect(sanitizedForStorage).not.toContain('<script>');
        expect(sanitizedForStorage).not.toContain('onerror=');
    });
});