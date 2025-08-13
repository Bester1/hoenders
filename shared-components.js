// Shared UI Components for Plaas Hoenders
// Used by both admin dashboard and customer portal

// Design System Configuration
const DesignSystem = {
    colors: {
        primary: '#2c5aa0',
        secondary: '#f8f9fa', 
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8',
        text: '#333333',
        textLight: '#6c757d',
        border: '#dee2e6',
        background: '#ffffff',
        backgroundLight: '#f8f9fa'
    },
    
    spacing: {
        xs: '4px',
        sm: '8px', 
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px'
    },
    
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        sizes: {
            small: '14px',
            medium: '16px', 
            large: '18px',
            xlarge: '24px',
            xxlarge: '32px'
        }
    }
};

// Shared Component Library
const SharedComponents = {
    
    // Create consistent buttons
    createButton: function(text, type = 'primary', onclick = null) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `btn btn-${type}`;
        if (onclick) button.onclick = onclick;
        return button;
    },
    
    // Create form inputs
    createInput: function(type = 'text', placeholder = '', required = false) {
        const input = document.createElement('input');
        input.type = type;
        input.className = 'form-input';
        input.placeholder = placeholder;
        input.required = required;
        return input;
    },
    
    // Create form groups
    createFormGroup: function(label, input, helpText = '') {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.className = 'form-label';
        
        group.appendChild(labelEl);
        group.appendChild(input);
        
        if (helpText) {
            const help = document.createElement('small');
            help.textContent = helpText;
            help.className = 'form-help';
            group.appendChild(help);
        }
        
        return group;
    },
    
    // Create cards
    createCard: function(title, content) {
        const card = document.createElement('div');
        card.className = 'card';
        
        const header = document.createElement('div');
        header.className = 'card-header';
        header.textContent = title;
        
        const body = document.createElement('div');
        body.className = 'card-body';
        if (typeof content === 'string') {
            body.textContent = content;
        } else {
            body.appendChild(content);
        }
        
        card.appendChild(header);
        card.appendChild(body);
        return card;
    },
    
    // Create data tables
    createTable: function(headers, data, actions = []) {
        const table = document.createElement('table');
        table.className = 'data-table';
        
        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        if (actions.length > 0) {
            const th = document.createElement('th');
            th.textContent = 'Actions';
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Body
        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });
            
            // Actions
            if (actions.length > 0) {
                const td = document.createElement('td');
                td.className = 'actions';
                actions.forEach(action => {
                    const btn = this.createButton(action.label, 'small', () => action.onclick(row));
                    td.appendChild(btn);
                });
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        return table;
    },
    
    // Create loading spinner
    createSpinner: function(text = 'Loading...') {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.innerHTML = `
            <div class="spinner-icon"></div>
            <span>${text}</span>
        `;
        return spinner;
    },
    
    // Create alerts/notifications  
    createAlert: function(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        return alert;
    }
};

// Shared Form Validation
const FormValidation = {
    email: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    phone: function(phone) {
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },
    
    required: function(value) {
        return value && value.trim().length > 0;
    },
    
    number: function(value) {
        return !isNaN(value) && isFinite(value);
    }
};

// Export for both admin and customer portal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DesignSystem, SharedComponents, FormValidation };
}