# Plaas Hoenders Brownfield Enhancement PRD

## Intro Project Analysis and Context

### Existing Project Overview

**Analysis Source**: IDE-based fresh analysis + QA review conducted

**Current Project State**: 
Plaas Hoenders is a comprehensive admin dashboard for managing chicken orders, invoicing, and email communications. The system processes butchery PDF invoices using AI/OCR, manages customer orders through imports, generates professional invoices, and handles email communications via Google Apps Script. The application features a Business Intelligence dashboard, pricing management, and dual-layer data persistence (Supabase + localStorage).

### Available Documentation Analysis

**Using existing technical documentation** from comprehensive QA analysis and CLAUDE.md project documentation:

✅ **Available Documentation**:
- [x] Tech Stack Documentation (Vanilla JS, HTML/CSS, Supabase, Google Apps Script)
- [x] Source Tree/Architecture (Modular SPA with section-based navigation)  
- [x] Coding Standards (Clean separation of concerns, modular functions)
- [x] API Documentation (Google Apps Script integration, Supabase schema)
- [x] External API Documentation (PDF.js, Tesseract.js OCR pipeline)
- [ ] UX/UI Guidelines (Professional admin interface but no formal guidelines)
- [x] Technical Debt Documentation (Low technical debt, mostly debug logging cleanup needed)

### Enhancement Scope Definition

**Enhancement Type**:
- [x] New Feature Addition (Customer portal)
- [x] Integration with New Systems (Customer authentication, order tracking)

**Enhancement Description**: 
Adding a customer-facing order portal that allows customers to place orders directly, track order status, view order history, and manage their account preferences. This will integrate with the existing admin dashboard while providing a separate customer interface.

**Impact Assessment**:
- [x] Moderate Impact (some existing code changes for customer data model extensions)

### Goals and Background Context

**Goals**:
• Enable customers to place orders directly without admin intervention
• Provide customers with real-time order tracking and history
• Reduce administrative workload through customer self-service
• Integrate seamlessly with existing butchery workflow and invoice system
• Maintain all existing admin dashboard functionality

**Background Context**: 
Currently, all orders are processed through the admin dashboard via CSV imports or PDF analysis from butchery invoices. Customers have no direct interaction with the system and must place orders through phone calls or messages. This creates administrative bottlenecks and lacks modern e-commerce conveniences that customers expect. The customer portal will complement the existing butchery-to-invoice workflow while enabling direct customer engagement.

### Change Log

| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|---------|
| Initial PRD Creation | 2025-01-08 | 1.0 | Customer portal requirements and epic structure | Quinn (QA) |

## Requirements

### Functional Requirements

**FR1**: The customer portal will integrate with the existing order management system without breaking current PDF import and butchery invoice processing workflows.

**FR2**: Customers can register for accounts using email and password, with account data stored in the existing Supabase database alongside current order data.

**FR3**: Authenticated customers can place orders using the same product catalog and pricing system currently used in the admin dashboard, with ability to specify quantities for each product.

**FR4**: Customer-placed orders will appear in the existing admin dashboard order management interface with clear source identification (customer portal vs PDF import).

**FR5**: Customers can view their complete order history, including orders imported from butchery invoices that match their customer profile.

**FR6**: Customers can track real-time order status updates managed through the existing admin dashboard status controls.

**FR7**: The system will send order confirmation and status update emails using the existing Google Apps Script email integration.

**FR8**: Customers can update their profile information (name, phone, address, communication preferences) which will be used for future orders and invoice generation.

**FR9**: The customer portal will display products with selling prices only (cost prices remain admin-only) and the same packaging information and descriptions currently shown to admins, ensuring consistency with actual butchery offerings.

### Non-Functional Requirements

**NFR1**: The customer portal must maintain the existing admin dashboard performance characteristics and not increase page load times by more than 500ms.

**NFR2**: Customer authentication must be secure with password hashing (bcrypt) and JWT session management, following modern security practices.

**NFR3**: The customer interface must be fully responsive and optimized for mobile devices, as customers likely access it from phones while at farms.

**NFR4**: Customer data must be stored in the existing Supabase database with the same backup and recovery capabilities as current order data.

**NFR5**: The system must handle concurrent customer orders while maintaining data consistency with ongoing admin operations.

### Compatibility Requirements

**CR1**: All existing admin dashboard functionality must remain unchanged and fully operational during and after customer portal implementation.

**CR2**: Current database schema for orders, imports, and invoices must remain compatible with existing workflows.

**CR3**: Existing Google Apps Script email integration must serve both admin and customer communications without configuration changes.

**CR4**: Current pricing management and product catalog must seamlessly serve both admin and customer interfaces.

## User Interface Enhancement Goals

### Integration with Existing UI

The customer portal will maintain visual consistency with the existing admin dashboard while creating a distinct customer-focused experience. The portal will reuse the existing CSS framework and design patterns:

- **Color Scheme**: Adapt the current gradient sidebar design (#667eea to #764ba2) for customer navigation
- **Typography**: Use the same font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)  
- **Component Library**: Leverage existing button styles (.btn-primary, .btn-secondary), form inputs, and card layouts
- **Icons**: Continue using FontAwesome icons for consistency
- **Responsive Grid**: Use the same CSS Grid and Flexbox patterns for mobile optimization

### Modified/New Screens and Views

**New Customer Portal Screens**:
1. **Customer Login/Registration** - Simple email/password form using existing form styling
2. **Customer Dashboard** - Order summary cards similar to admin dashboard stats
3. **Product Catalog** - Grid layout showcasing products with images, descriptions, and pricing
4. **Order Placement** - Shopping cart interface with quantity selectors and order summary
5. **Order History** - Table format similar to admin orders table but customer-filtered
6. **Order Tracking** - Individual order details with status timeline
7. **Customer Profile** - Account settings and contact information management

**Modified Admin Screens**:
- **Orders Table**: Add "Source" column to distinguish customer vs PDF import orders
- **Customer Management**: Enhance to show customer portal accounts alongside imported customers

### UI Consistency Requirements

**Visual Consistency**:
- Customer portal uses same card-based layout as admin dashboard
- Consistent button hierarchy and interaction patterns
- Same loading states and success/error messaging
- Unified color palette with customer-appropriate accent colors

**Interaction Consistency**:
- Form validation follows same patterns as admin forms
- Navigation structure mirrors admin sidebar approach
- Modal dialogs and confirmations use existing styling
- Mobile responsive breakpoints match admin dashboard

**Branding Consistency**:
- Same "🐔 Plaas Hoenders" branding and logo
- Professional agricultural theme maintained
- Customer-friendly language while keeping brand voice

## Technical Constraints and Integration Requirements

### Existing Technology Stack

**Languages**: JavaScript (ES6+), HTML5, CSS3  
**Frameworks**: Vanilla JavaScript SPA, FontAwesome 6.0, PDF.js 3.11.174, Tesseract.js 4.1.1  
**Database**: Supabase (PostgreSQL) with localStorage fallback  
**Infrastructure**: GitHub Pages static hosting, Google Apps Script for email service  
**External Dependencies**: Supabase client library, OCR processing libraries, Google Apps Script HTTP integration

### Integration Approach

**Database Integration Strategy**: 
- Extend existing Supabase schema with `customers` table
- Add `source` field to existing `orders` table ('customer_portal' | 'pdf_import' | 'csv_import')
- Maintain existing dual-layer persistence (Supabase primary, localStorage fallback)
- Customer authentication data stored in new `customer_auth` table with JWT session management

**API Integration Strategy**:
- Leverage existing Supabase client for customer CRUD operations
- Extend existing Google Apps Script email service for customer notifications
- Add customer-specific API endpoints using existing Supabase RPC functions
- Maintain existing PDF processing pipeline unchanged

**Frontend Integration Strategy**:
- Add new customer portal routes using existing section-based navigation pattern
- Create separate customer.html entry point while reusing styles.css and core utilities
- Implement customer session management using existing localStorage patterns
- Share product catalog and pricing data between admin and customer interfaces

**Testing Integration Strategy**:
- Customer portal testing follows same manual verification approach as admin dashboard
- Integration testing ensures customer orders appear correctly in admin interface
- Cross-browser testing maintains existing supported browser matrix

### Code Organization and Standards

**File Structure Approach**:
```
/
├── index.html (existing admin dashboard)
├── customer.html (new customer portal entry)
├── styles.css (shared styling - extended)
├── script.js (admin functionality - unchanged core)
├── customer.js (new customer portal logic)
└── shared-utils.js (extracted common functions)
```

**Naming Conventions**: 
- Customer functions prefixed with `customer` (e.g., `customerLogin()`, `customerPlaceOrder()`)
- Maintain existing camelCase convention throughout
- CSS classes follow existing pattern with `.customer-` prefix for portal-specific styles

**Coding Standards**:
- Continue existing vanilla JavaScript approach (no framework introduction)
- Maintain current error handling patterns with try/catch blocks
- Follow existing async/await pattern for database operations
- Preserve existing modular function organization

**Documentation Standards**:
- Inline comments for customer-specific functions following existing style
- Update CLAUDE.md with customer portal workflow documentation
- API documentation for new customer endpoints

### Deployment and Operations

**Build Process Integration**: 
- No build process changes required (static files deployment)
- GitHub Pages continues to serve both admin and customer portals
- Same deployment workflow: commit → push → GitHub Pages rebuild

**Deployment Strategy**:
- Phased deployment: customer.html deployed but not publicly linked initially
- Admin dashboard remains primary interface during customer portal development
- Feature flags in localStorage for gradual customer portal rollout

**Monitoring and Logging**:
- Extend existing console logging for customer portal activities
- Customer authentication events logged to browser console
- Order placement tracking using existing analytics patterns

**Configuration Management**:
- Customer portal shares existing Supabase and Google Apps Script configuration
- Environment-specific settings managed through existing constants pattern
- Customer session timeout and security settings configurable via constants

### Risk Assessment and Mitigation

**Technical Risks**:
- Session management complexity could impact performance
- Customer concurrent access might stress existing Supabase limits
- Mobile performance on rural networks with slower connections

**Integration Risks**:
- Customer orders could conflict with simultaneous admin operations
- Email system might be overwhelmed with customer notifications
- Shared product pricing could create consistency issues

**Deployment Risks**:
- Customer portal bugs could affect admin dashboard through shared components
- Database schema changes might impact existing admin functionality
- GitHub Pages deployment timing could cause temporary customer portal unavailability

**Mitigation Strategies**:
- Implement customer portal with isolated JavaScript file to prevent admin impact
- Use database transactions for customer order placement to ensure consistency
- Implement rate limiting on customer actions to prevent system overload
- Comprehensive testing of admin functionality after each customer portal change
- Rollback plan: remove customer.html link while keeping admin dashboard operational

## Epic and Story Structure

### Epic Approach

**Epic Structure Decision**: Single comprehensive epic with rationale

For this customer portal enhancement, I recommend a **single epic approach** because:

1. **Cohesive Feature**: All customer portal components are tightly integrated and interdependent
2. **Shared Infrastructure**: Customer authentication, data models, and UI components work together as one system
3. **Risk Management**: Single epic allows for coordinated rollback if issues arise
4. **Brownfield Integration**: All stories must work together to maintain existing system integrity

This structure ensures the customer portal is delivered as a complete, functional unit while maintaining your existing admin dashboard functionality.

## Epic 1: Customer Order Portal

**Epic Goal**: Enable customers to independently place orders, track status, and manage their accounts through a secure web portal that seamlessly integrates with the existing Plaas Hoenders admin dashboard and butchery invoice workflow.

**Integration Requirements**: The customer portal must preserve all existing admin functionality, maintain data consistency across customer and admin operations, and utilize existing infrastructure (Supabase, Google Apps Script, pricing system) without requiring architectural changes.

### Story 1.1: Customer Authentication Foundation

As a **potential customer**,  
I want **to register and login with email/password**,  
so that **I can access a personalized ordering experience**.

**Acceptance Criteria**:
1. Customer can register with email, password, name, phone, and address
2. Password is securely hashed using bcrypt before database storage
3. Customer can login with email/password and receive JWT session token
4. Customer session persists across browser sessions via localStorage
5. Customer can logout and session is properly cleared
6. Registration validates email format and password strength
7. Login handles invalid credentials gracefully with user-friendly messages

**Integration Verification**:
- IV1: Admin dashboard login and functionality remains completely unchanged
- IV2: Existing Supabase database operations continue without interference
- IV3: Customer authentication tables are isolated and don't impact existing order/import tables

### Story 1.2: Customer Portal UI Framework

As a **registered customer**,  
I want **a responsive portal interface with navigation**,  
so that **I can easily access ordering and account features on any device**.

**Acceptance Criteria**:
1. Customer portal loads with mobile-responsive design matching admin dashboard styling
2. Navigation menu provides access to Dashboard, Products, Orders, and Profile sections
3. Customer sees personalized welcome message with their name
4. Portal maintains visual consistency with existing Plaas Hoenders branding
5. Loading states and error messages follow existing admin dashboard patterns
6. Customer can navigate between sections without page refresh
7. Logout button is prominently accessible from all portal sections

**Integration Verification**:
- IV1: Admin dashboard styling and functionality remains unaffected by shared CSS
- IV2: Existing admin navigation and section switching continues to work properly
- IV3: Mobile responsiveness doesn't impact existing admin mobile layout

### Story 1.3: Product Catalog Display

As a **authenticated customer**,  
I want **to browse available products with descriptions and pricing**,  
so that **I can make informed ordering decisions**.

**Acceptance Criteria**:
1. Customer sees all products from existing pricing catalog with selling prices only
2. Products display with names, descriptions, packaging information, and per-kg pricing
3. Product images or icons are shown for visual identification
4. Products are organized in logical categories (whole chickens, cuts, specialty items)
5. Mobile-friendly product grid layout with touch-friendly interaction
6. Product availability status is clearly indicated
7. Packaging details (vacuum packed, quantity per pack) are prominently displayed

**Integration Verification**:
- IV1: Product data pulls from existing pricing object without modification
- IV2: Admin pricing management continues to update customer portal automatically
- IV3: Cost prices remain hidden from customer interface while visible in admin

### Story 1.4: Shopping Cart and Order Placement

As a **customer browsing products**,  
I want **to add items with quantities to a cart and place orders**,  
so that **I can purchase multiple products in a single transaction**.

**Acceptance Criteria**:
1. Customer can add products to cart with quantity selection (1, 2, 3+ items)
2. Cart shows running total with individual item calculations (quantity × weight × price/kg)
3. Customer can modify quantities or remove items from cart before ordering
4. Order placement requires confirmation of customer details (delivery address, phone)
5. Successful order generates unique order ID and confirmation message
6. Order data is stored using existing database structure with source="customer_portal"
7. Cart is cleared after successful order placement

**Integration Verification**:
- IV1: Customer orders appear in existing admin dashboard orders table
- IV2: Order numbering system maintains existing sequence without conflicts
- IV3: Customer orders integrate with existing email queue system

### Story 1.5: Order Confirmation and Email Integration

As a **customer who placed an order**,  
I want **to receive order confirmation via email**,  
so that **I have documentation of my purchase details**.

**Acceptance Criteria**:
1. Order confirmation email sent immediately after successful order placement
2. Email contains order number, customer details, itemized product list with weights
3. Email includes total amount and estimated delivery information
4. Email template maintains existing Afrikaans format and banking details
5. Email delivery uses existing Google Apps Script integration
6. Failed email delivery is logged but doesn't prevent order creation
7. Customer can request email resend from their order history

**Integration Verification**:
- IV1: Existing admin email functionality continues to operate normally
- IV2: Email queue handles both customer and admin emails without conflicts
- IV3: Google Apps Script service maintains existing performance levels

### Story 1.6: Customer Order History and Tracking

As a **customer with previous orders**,  
I want **to view my order history and current order status**,  
so that **I can track deliveries and reorder favorite products**.

**Acceptance Criteria**:
1. Customer sees complete order history including pre-portal orders (matched by name/email)
2. Orders display with date, items, quantities, total amount, and current status
3. Order status updates reflect admin dashboard status changes in real-time
4. Customer can view detailed breakdown of individual orders
5. Order history is sorted chronologically with most recent first
6. Customer can filter orders by status (pending, confirmed, delivered, etc.)
7. Reorder functionality allows quick repeat purchases with quantity adjustments

**Integration Verification**:
- IV1: Admin order status updates immediately reflect in customer portal
- IV2: Existing order management workflow remains unchanged for admins
- IV3: Customer order filtering doesn't impact admin dashboard order display

### Story 1.7: Customer Profile Management

As a **registered customer**,  
I want **to update my contact information and preferences**,  
so that **my orders are delivered correctly and communications are current**.

**Acceptance Criteria**:
1. Customer can update name, phone, email, and delivery address
2. Password change functionality with current password verification
3. Communication preferences (email notifications, SMS if available)
4. Profile changes are reflected in future orders and invoices
5. Account deletion option with confirmation (preserves order history)
6. Form validation ensures required fields and proper formats
7. Changes are saved immediately with success confirmation

**Integration Verification**:
- IV1: Customer profile updates appear in admin customer management views
- IV2: Invoice generation uses updated customer information for future orders
- IV3: Email address changes don't break existing order history linkage

---

## PRD Summary

This Brownfield Enhancement PRD defines a comprehensive customer order portal that extends the existing Plaas Hoenders admin dashboard with customer-facing capabilities. The solution maintains the sophisticated butchery invoice processing workflow while adding modern e-commerce conveniences for customers.

**Key Success Factors**:
- Seamless integration with existing admin dashboard
- Preservation of all current functionality
- Mobile-optimized customer experience
- Secure authentication and data management
- Leveraging existing infrastructure investments

**Implementation Approach**: Seven sequential user stories building from authentication foundation through complete customer portal functionality, with comprehensive integration verification ensuring existing system integrity throughout development.