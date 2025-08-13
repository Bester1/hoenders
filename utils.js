// Utility functions for Plaas Hoenders Admin Dashboard

// Input sanitization functions
const SecurityUtils = {
    // Sanitize HTML to prevent XSS attacks
    sanitizeHTML: function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    // Sanitize input for safe display
    sanitizeInput: function(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/&(?!(amp|lt|gt|quot|#039);)/g, '&amp;');
    },
    
    // Validate and sanitize numbers
    sanitizeNumber: function(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) || !isFinite(num) ? defaultValue : num;
    },
    
    // Validate and sanitize email
    sanitizeEmail: function(email) {
        if (!email) return '';
        const trimmed = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(trimmed) ? trimmed : '';
    },
    
    // Validate and sanitize file names
    sanitizeFileName: function(fileName) {
        if (!fileName) return '';
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
};

// Error handling utilities
const ErrorHandler = {
    // Show notification to user
    showNotification: function(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
            position: relative;
        `;
        
        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            cursor: pointer;
            font-size: 20px;
            font-weight: bold;
        `;
        closeBtn.onclick = () => notification.remove();
        
        // Add message
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        
        notification.appendChild(closeBtn);
        notification.appendChild(messageEl);
        notificationContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
};

// DOM manipulation utilities (safe alternatives to innerHTML)
const DOMUtils = {
    // Create element with text content
    createElement: function(tag, text = '', className = '') {
        const element = document.createElement(tag);
        if (text) element.textContent = text;
        if (className) element.className = className;
        return element;
    },
    
    // Create table row with cells
    createTableRow: function(data, cellTag = 'td') {
        const row = document.createElement('tr');
        data.forEach(cellData => {
            const cell = document.createElement(cellTag);
            if (typeof cellData === 'object' && cellData.element) {
                // If it's a DOM element, append it
                cell.appendChild(cellData.element);
            } else {
                // Otherwise use text content
                cell.textContent = cellData;
            }
            row.appendChild(cell);
        });
        return row;
    },
    
    // Clear and populate table body safely
    populateTable: function(tableBody, data, columns) {
        // Clear existing content
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }
        
        if (!data || data.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = columns.length;
            cell.className = 'no-data';
            cell.textContent = 'No data available';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        
        // Add data rows
        data.forEach(item => {
            const rowData = columns.map(col => {
                if (typeof col === 'function') {
                    return col(item);
                }
                return item[col] || '';
            });
            tableBody.appendChild(this.createTableRow(rowData));
        });
    }
};

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);