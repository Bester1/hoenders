/**
 * Secure DOM Manipulation Utilities
 * Replaces unsafe innerHTML usage with secure alternatives
 * Prevents XSS attacks through proper sanitization
 */

(function() {
    'use strict';

    /**
     * Secure DOM manipulation utilities
     */
    const SecureDOM = {
        /**
         * Safely set text content (prevents XSS)
         */
        setText(element, text) {
            if (!element) return false;

            // Clear existing content
            element.textContent = '';

            // Set sanitized text
            element.textContent = String(text || '');
            return true;
        },

        /**
         * Safely set HTML content with sanitization
         */
        setHTML(element, htmlContent, options = {}) {
            if (!element) return false;

            const defaultOptions = {
                allowedTags: ['b', 'strong', 'i', 'em', 'span', 'div', 'p', 'br'],
                allowedAttributes: ['class', 'id', 'data-*'],
                stripEventHandlers: true,
                maxLength: 10000
            };

            const opts = { ...defaultOptions, ...options };

            // Sanitize the HTML content
            const sanitizedHTML = this._sanitizeHTML(htmlContent, opts);

            // Clear existing content
            element.innerHTML = '';

            // Set sanitized HTML
            element.innerHTML = sanitizedHTML;
            return true;
        },

        /**
         * Create element safely with text content
         */
        createElement(tagName, textContent = '', className = '', attributes = {}) {
            const element = document.createElement(tagName);

            // Set text content safely
            if (textContent) {
                element.textContent = String(textContent);
            }

            // Set class name safely
            if (className) {
                element.className = String(className);
            }

            // Set attributes safely
            for (const [key, value] of Object.entries(attributes)) {
                if (this._isAllowedAttribute(key)) {
                    element.setAttribute(key, String(value));
                }
            }

            return element;
        },

        /**
         * Safely append child elements
         */
        appendChild(parent, child) {
            if (!parent || !child) return false;

            parent.appendChild(child);
            return true;
        },

        /**
         * Safely remove all children
         */
        clearChildren(element) {
            if (!element) return false;

            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
            return true;
        },

        /**
         * Safely create and append multiple elements
         */
        appendElements(parent, elementsData) {
            if (!parent || !Array.isArray(elementsData)) return false;

            const fragment = document.createDocumentFragment();

            elementsData.forEach(data => {
                const element = this.createElement(
                    data.tag || 'div',
                    data.text || '',
                    data.class || '',
                    data.attributes || {}
                );

                // Add children if specified
                if (data.children && Array.isArray(data.children)) {
                    this.appendElements(element, data.children);
                }

                fragment.appendChild(element);
            });

            parent.appendChild(fragment);
            return true;
        },

        /**
         * Safely update table content
         */
        updateTable(tableBody, rowsData, columnCount = 1) {
            if (!tableBody) return false;

            // Clear existing content
            this.clearChildren(tableBody);

            if (!rowsData || rowsData.length === 0) {
                // Add "no data" row
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = columnCount;
                cell.className = 'no-data';
                cell.textContent = 'No data available';
                row.appendChild(cell);
                tableBody.appendChild(row);
                return true;
            }

            // Add data rows
            rowsData.forEach(rowData => {
                const row = document.createElement('tr');

                rowData.forEach((cellData, index) => {
                    const cell = document.createElement('td');

                    if (typeof cellData === 'object' && cellData.html) {
                        // HTML content with sanitization
                        this.setHTML(cell, cellData.html, cellData.options || {});
                    } else {
                        // Plain text content
                        this.setText(cell, cellData);
                    }

                    row.appendChild(cell);
                });

                tableBody.appendChild(row);
            });

            return true;
        },

        /**
         * Safely create form elements
         */
        createFormElement(type, name, value = '', attributes = {}) {
            const element = document.createElement(type === 'textarea' ? 'textarea' : 'input');

            if (type !== 'textarea') {
                element.type = type;
            }

            if (name) element.name = name;
            if (value) element.value = String(value);

            // Set additional attributes safely
            for (const [key, val] of Object.entries(attributes)) {
                if (this._isAllowedAttribute(key)) {
                    element.setAttribute(key, String(val));
                }
            }

            return element;
        },

        /**
         * Create secure buttons with event handlers
         */
        createButton(text, clickHandler, className = '', attributes = {}) {
            const button = document.createElement('button');
            button.textContent = String(text);
            button.type = 'button';

            if (className) button.className = className;

            // Set attributes safely
            for (const [key, value] of Object.entries(attributes)) {
                if (this._isAllowedAttribute(key)) {
                    button.setAttribute(key, String(value));
                }
            }

            // Add event listener safely
            if (typeof clickHandler === 'function') {
                button.addEventListener('click', clickHandler);
            }

            return button;
        },

        /**
         * Private: Sanitize HTML content
         */
        _sanitizeHTML(htmlContent, options) {
            if (typeof htmlContent !== 'string') {
                return '';
            }

            // Truncate if too long
            if (htmlContent.length > options.maxLength) {
                htmlContent = htmlContent.substring(0, options.maxLength) + '...';
            }

            // Create temporary element for parsing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;

            // Remove script tags and event handlers
            this._removeUnsafeElements(tempDiv, options);

            return tempDiv.innerHTML;
        },

        /**
         * Private: Remove unsafe elements and attributes
         */
        _removeUnsafeElements(element, options) {
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            const nodesToRemove = [];

            while (walker.nextNode()) {
                const node = walker.currentNode;

                // Check if tag is allowed
                if (!options.allowedTags.includes(node.tagName.toLowerCase())) {
                    nodesToRemove.push(node);
                    continue;
                }

                // Remove unsafe attributes
                const attributesToRemove = [];
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];

                    // Remove event handlers
                    if (options.stripEventHandlers && attr.name.startsWith('on')) {
                        attributesToRemove.push(attr.name);
                        continue;
                    }

                    // Check allowed attributes
                    if (!this._isAllowedAttribute(attr.name)) {
                        attributesToRemove.push(attr.name);
                    }
                }

                attributesToRemove.forEach(attrName => {
                    node.removeAttribute(attrName);
                });
            }

            // Remove unsafe nodes
            nodesToRemove.forEach(node => {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
        },

        /**
         * Private: Check if attribute is allowed
         */
        _isAllowedAttribute(attributeName) {
            const allowedAttributes = [
                'class', 'id', 'title', 'alt', 'src', 'href', 'target',
                'colspan', 'rowspan', 'type', 'name', 'value', 'placeholder',
                'disabled', 'readonly', 'checked', 'selected'
            ];

            // Allow data-* attributes
            if (attributeName.startsWith('data-')) {
                return true;
            }

            return allowedAttributes.includes(attributeName.toLowerCase());
        }
    };

    /**
     * Security error handler
     */
    function showSecurityError(message, details = '') {
        console.error('🚨 Security Error:', message, details);

        // Create secure error notification
        const errorDiv = SecureDOM.createElement('div', '', 'security-error');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; left: 20px;
            background: #ff4444; color: white; padding: 20px;
            border-radius: 8px; z-index: 10000; max-width: 500px;
            margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-family: Arial, sans-serif;
        `;

        // Add error content safely
        const contentDiv = SecureDOM.createElement('div');

        const headerDiv = SecureDOM.createElement('div', '', 'error-header');
        headerDiv.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; font-weight: bold;';

        const iconSpan = SecureDOM.createElement('span', '🚨', 'error-icon');
        iconSpan.style.cssText = 'font-size: 24px; margin-right: 10px;';

        const titleSpan = SecureDOM.createElement('span', 'Security Alert');

        SecureDOM.appendChild(headerDiv, iconSpan);
        SecureDOM.appendChild(headerDiv, titleSpan);

        const messageDiv = SecureDOM.createElement('div', message, 'error-message');
        messageDiv.style.cssText = 'margin-bottom: 10px; line-height: 1.4;';

        const instructionDiv = SecureDOM.createElement('div',
            'This error was automatically detected to protect your data. Please refresh the page or contact support if the problem persists.',
            'error-instruction'
        );
        instructionDiv.style.cssText = 'font-size: 14px; opacity: 0.9; line-height: 1.3;';

        // Add close button
        const closeBtn = SecureDOM.createButton('×', () => {
            if (errorDiv.parentElement) {
                errorDiv.parentElement.removeChild(errorDiv);
            }
        }, 'close-btn');
        closeBtn.style.cssText = `
            position: absolute; top: 10px; right: 15px;
            background: none; border: none; color: white;
            font-size: 24px; cursor: pointer; padding: 0;
            width: 30px; height: 30px; display: flex;
            align-items: center; justify-content: center;
        `;

        // Assemble error notification
        SecureDOM.appendChild(contentDiv, headerDiv);
        SecureDOM.appendChild(contentDiv, messageDiv);
        SecureDOM.appendChild(contentDiv, instructionDiv);
        SecureDOM.appendChild(errorDiv, contentDiv);
        SecureDOM.appendChild(errorDiv, closeBtn);

        // Add to page
        SecureDOM.appendChild(document.body, errorDiv);

        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.parentElement.removeChild(errorDiv);
            }
        }, 15000);
    }

    // Make utilities globally available
    window.SecureDOM = SecureDOM;
    window.showSecurityError = showSecurityError;

    // Export for Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SecureDOM, showSecurityError };
    }

})();