# Epic 1: Customer Order Portal

**Epic Goal**: Enable customers to independently place orders, track status, and manage their accounts through a secure web portal that seamlessly integrates with the existing Plaas Hoenders admin dashboard and butchery invoice workflow.

**Integration Requirements**: The customer portal must preserve all existing admin functionality, maintain data consistency across customer and admin operations, and utilize existing infrastructure (Supabase, Google Apps Script, pricing system) without requiring architectural changes.

## Story 1.1: Customer Authentication Foundation

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

## Story 1.2: Customer Portal UI Framework

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

## Story 1.3: Product Catalog Display

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

## Story 1.4: Shopping Cart and Order Placement

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

## Story 1.4B: Multi-Person Order Coordinator (Group Ordering)

As a **registered customer who coordinates community orders**,  
I want **to place orders for multiple people in a single transaction**,  
so that **I can efficiently manage group deliveries while maintaining individual invoice accountability**.

**Acceptance Criteria**:
1. Customer can toggle "Group Order Mode" from standard cart interface
2. Customer can add order items for other people without those people having accounts
3. Each person in the group order has their own section showing: name, items, and subtotal
4. Customer can order for others WITHOUT being required to order for themselves
5. All items are delivered to the coordinator's address regardless of who they're "for"
6. System generates individual invoices for each person in the group order
7. All invoices are emailed to the coordinator's email address for distribution
8. Minimum requirement: must order for at least one person (coordinator or others)
9. Order confirmation shows breakdown by person and total group order value

**Business Rules**:
- Group orders must have at least 1 person with items (coordinator participation optional)
- Maximum 10 people per group order to prevent abuse
- Each person's invoice shows their items only with "Coordinator: [Name]" notation
- Coordinator receives email bundle with all individual invoices attached
- Group orders appear in admin dashboard with "Group Order" indicator and person count

**Integration Verification**:
- IV1: Individual invoices integrate with existing invoice generation system
- IV2: Email system handles multiple invoice attachments to single recipient
- IV3: Admin dashboard displays group orders with expandable person-by-person breakdown
- IV4: Customer order history shows group orders with participant summary

## Story 1.5: Order Confirmation and Email Integration

As a **customer who placed an order**,  
I want **to receive order confirmation via email**,  
so that **I have documentation of my purchase details**.

**Acceptance Criteria - Standard Orders**:

1. Order confirmation email sent immediately after successful order placement
2. Email contains order number, customer details, itemized product list with weights
3. Email includes total amount and estimated delivery information
4. Email template maintains existing Afrikaans format and banking details
5. Email delivery uses existing Google Apps Script integration
6. Failed email delivery is logged but doesn't prevent order creation
7. Customer can request email resend from their order history

**Acceptance Criteria - Group Orders (Multi-Person)**:

8. Group order coordinator receives single confirmation email with summary
9. Email subject indicates group order: "Group Order Confirmation - X People"
10. Coordinator receives separate individual invoices for each person as attachments
11. Email body shows group order breakdown by person with subtotals
12. Each individual invoice clearly shows "Ordered by: [Coordinator Name]"
13. Total group order value is prominently displayed in confirmation email
14. Invoice attachments are named clearly: "Invoice_[PersonName]_[OrderNumber].pdf"

**Integration Verification**:

- IV1: Existing admin email functionality continues to operate normally
- IV2: Email queue handles both customer and admin emails without conflicts
- IV3: Google Apps Script service maintains existing performance levels
- IV4: Multiple PDF attachments don't exceed email size limits (max 25MB total)
- IV5: Individual invoice generation maintains existing admin invoice format

## Story 1.6: Customer Order History and Tracking

As a **customer with previous orders**,  
I want **to view my order history and current order status**,  
so that **I can track deliveries and reorder favorite products**.

**Acceptance Criteria - Standard Orders**:

1. Customer sees complete order history including pre-portal orders (matched by name/email)
2. Orders display with date, items, quantities, total amount, and current status
3. Order status updates reflect admin dashboard status changes in real-time
4. Customer can view detailed breakdown of individual orders
5. Order history is sorted chronologically with most recent first
6. Customer can filter orders by status (pending, confirmed, delivered, etc.)
7. Reorder functionality allows quick repeat purchases with quantity adjustments

**Acceptance Criteria - Group Order History**:

8. Group orders are clearly marked with "👥 Group Order" indicator and participant count
9. Group order summary shows total value and number of people
10. Customer can expand group orders to see breakdown by person
11. Reorder from group orders allows customer to recreate the full group structure
12. Group order status applies to entire group (all participants get same delivery status)
13. Individual invoices from group orders are accessible via "Download Invoices" button
14. Group order history shows coordinator role clearly for future reference

**Integration Verification**:

- IV1: Admin order status updates immediately reflect in customer portal
- IV2: Existing order management workflow remains unchanged for admins
- IV3: Customer order filtering doesn't impact admin dashboard order display
- IV4: Group order data structure maintains referential integrity with individual participants

## Story 1.7: Customer Profile Management

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

## Development Implementation Strategy

### **Optimal Development Sequence for Dev Team**

**Phase 1: Core Foundation (Stories 1.1-1.3)**
- Complete customer authentication and portal framework first
- Product catalog integration with existing pricing system
- **Deliverable**: Customers can register, login, and browse products

**Phase 2: Standard Ordering (Story 1.4 - Standard cart only)**
- Implement single-person ordering functionality first  
- Focus on cart mechanics and basic order placement
- **Deliverable**: Customers can place individual orders

**Phase 3: Email Integration (Story 1.5 - Standard orders only)**
- Connect standard orders to existing email system
- Validate invoice generation and email delivery
- **Deliverable**: Standard orders send confirmation emails

**Phase 4: Order History (Story 1.6 - Standard orders only)**
- Build order history for individual orders first
- Customer profile management (Story 1.7)
- **Deliverable**: Complete individual customer experience

**Phase 5: Group Ordering Enhancement (Stories 1.4B, 1.5, 1.6 enhancements)**
- Add multi-person coordinator functionality to proven foundation
- Extend email system for multiple invoice attachments
- Enhance order history for group order display
- **Deliverable**: Full multi-person coordinator capability

### **Key Integration Points**

**Database Schema Extensions Required**:
```sql
-- Extend existing orders table
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'standard'; -- 'standard' | 'group'
ALTER TABLE orders ADD COLUMN coordinator_id INTEGER REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN group_order_id VARCHAR(50); -- Link related group participants

-- New table for group order participants  
CREATE TABLE group_order_participants (
    id SERIAL PRIMARY KEY,
    group_order_id VARCHAR(50) NOT NULL,
    participant_name VARCHAR(100) NOT NULL,
    participant_email VARCHAR(100), -- Optional, coordinator gets invoices
    order_data JSONB NOT NULL, -- Individual order items
    invoice_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Admin Dashboard Integration Points**:
- Order table needs "Group Order" indicator with expandable participant view
- Email queue must handle multiple PDF attachments per email
- Invoice generation system extends to create multiple invoices per order
- Analytics must account for group orders (count participants vs orders)

**Customer Portal UI Components Required**:
- Group order toggle switch in cart interface
- Dynamic "Add Person" functionality with form validation
- Participant management (add/remove/edit participants)
- Group order confirmation display with person-by-person breakdown
- Group order history with expandable participant details

**Email System Extensions**:
- Multiple PDF generation per order
- Email attachment bundling (max 25MB limit handling)
- Group order confirmation template with summary + individual invoice attachments
- Proper attachment naming convention for easy distribution

### **Risk Mitigation & Testing Strategy**

**Backward Compatibility**:
- All existing admin functionality must remain unchanged
- Existing single orders continue to work exactly as before
- Database changes are additive only, no breaking changes

**Performance Considerations**:
- Group orders limited to 10 people maximum to prevent system abuse
- Email attachment size monitoring (individual PDF generation optimization)
- Database indexing on group_order_id for efficient queries

**Quality Assurance Focus Areas**:
1. **Integration Testing**: Admin dashboard continues working with new database schema
2. **Email Testing**: Multiple PDF attachment delivery reliability
3. **User Experience Testing**: Group ordering workflow is intuitive and error-free
4. **Performance Testing**: Large group orders don't impact system performance
5. **Security Testing**: Customer data isolation maintained in group orders

---
