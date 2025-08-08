# Coding Standards

## Core Standards

- **Languages & Runtimes:** JavaScript ES6+ (2023), HTML5, CSS3 - maintain existing vanilla JavaScript approach
- **Style & Linting:** Follow existing code patterns in script.js - camelCase functions, descriptive variable names, consistent indentation
- **Test Organization:** Manual testing following existing admin dashboard patterns - test all functionality in both admin and customer interfaces

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Functions | camelCase with descriptive action | `customerLogin()`, `validateOrderData()` |
| Variables | camelCase with clear meaning | `customerOrderHistory`, `emailQueueStatus` |
| Constants | UPPER_SNAKE_CASE | `SUPABASE_URL`, `MAX_ORDER_ITEMS` |
| CSS Classes | kebab-case with component prefix | `.customer-portal`, `.admin-dashboard` |
| Files | kebab-case descriptive names | `customer.js`, `shared-utils.js` |

## Critical Rules

- **Never use console.log in production code**: Use `console.error()`, `console.warn()`, or `console.info()` with structured context for debugging
- **All database operations must include error handling**: Wrap Supabase calls in try/catch with localStorage fallback pattern from existing code
- **Customer data isolation is mandatory**: Never expose cost prices to customer interface, never show other customers' data
- **Maintain existing admin functionality**: Customer portal changes must not break any existing admin dashboard features
- **Use existing UI patterns**: Reuse CSS classes, button styles, and form patterns from current admin dashboard
- **localStorage backup required**: All customer data operations must have localStorage fallback like existing admin code
- **JWT session validation**: Always validate customer authentication before sensitive operations
- **Email queue integration**: Use existing email patterns, extend don't replace Google Apps Script integration
- **JSDoc documentation required**: All public functions, public interfaces, and exported modules MUST have comprehensive JSDoc comments

## JSDoc Documentation Standards

**MANDATORY for all public functions and interfaces**:

```javascript
/**
 * Authenticates customer login credentials and creates session
 * @async
 * @function customerLogin
 * @param {string} email - Customer email address (must be valid format)
 * @param {string} password - Customer password (minimum 8 characters)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>} Authentication result with session data or error message
 * @throws {AuthenticationError} When credentials are invalid or service unavailable
 * @example
 * const result = await customerLogin('jean@example.com', 'password123');
 * if (result.success) {
 *   console.log('Login successful:', result.data.customer);
 * }
 */
async function customerLogin(email, password) {
    // Implementation here
}

/**
 * Places a new customer order with validation and admin integration
 * @async
 * @function placeCustomerOrder
 * @param {Object} orderData - Order information
 * @param {string} orderData.customerId - UUID of authenticated customer
 * @param {Array<Object>} orderData.items - Array of order items
 * @param {string} orderData.items[].productName - Product name from pricing catalog
 * @param {number} orderData.items[].quantity - Quantity ordered (positive integer)
 * @param {number} orderData.items[].weightKg - Item weight in kilograms
 * @param {string} orderData.deliveryAddress - Customer delivery address
 * @returns {Promise<{orderId: string, total: number, estimatedDelivery: string}>} Created order details
 * @throws {ValidationError} When order data is invalid
 * @throws {DatabaseError} When order creation fails
 * @since 1.0.0
 * @example
 * const order = await placeCustomerOrder({
 *   customerId: 'uuid-here',
 *   items: [{productName: 'HEEL HOENDER', quantity: 2, weightKg: 3.6}],
 *   deliveryAddress: 'Farm Road 123'
 * });
 */
async function placeCustomerOrder(orderData) {
    // Implementation here
}

/**
 * Customer data model interface
 * @typedef {Object} Customer
 * @property {string} id - Unique customer identifier (UUID)
 * @property {string} name - Customer full name
 * @property {string} email - Customer email address (unique)
 * @property {string} phone - South African phone number format
 * @property {string} address - Delivery address
 * @property {Object} communicationPreferences - Email/SMS preferences
 * @property {boolean} communicationPreferences.emailNotifications - Enable email notifications
 * @property {boolean} isActive - Account status (active/disabled)
 * @property {Date} createdAt - Account creation timestamp
 * @property {Date|null} lastLogin - Last portal access time
 */
```

**JSDoc Requirements for All Developer Agents**:
- **@param** with types and descriptions for all parameters
- **@returns** with type and description of return value
- **@throws** for all possible exceptions
- **@async** for all async functions
- **@example** for complex functions showing typical usage
- **@since** version when function was added
- **@deprecated** with alternative when functions become obsolete
- **@typedef** for all data structures and interfaces used across components
