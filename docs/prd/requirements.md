# Requirements

## Functional Requirements

**FR1**: The customer portal will integrate with the existing order management system without breaking current PDF import and butchery invoice processing workflows.

**FR2**: Customers can register for accounts using email and password, with account data stored in the existing Supabase database alongside current order data.

**FR3**: Authenticated customers can place orders using the same product catalog and pricing system currently used in the admin dashboard, with ability to specify quantities for each product.

**FR4**: Customer-placed orders will appear in the existing admin dashboard order management interface with clear source identification (customer portal vs PDF import).

**FR5**: Customers can view their complete order history, including orders imported from butchery invoices that match their customer profile.

**FR6**: Customers can track real-time order status updates managed through the existing admin dashboard status controls.

**FR7**: The system will send order confirmation and status update emails using the existing Google Apps Script email integration.

**FR8**: Customers can update their profile information (name, phone, address, communication preferences) which will be used for future orders and invoice generation.

**FR9**: The customer portal will display products with selling prices only (cost prices remain admin-only) and the same packaging information and descriptions currently shown to admins, ensuring consistency with actual butchery offerings.

## Non-Functional Requirements

**NFR1**: The customer portal must maintain the existing admin dashboard performance characteristics and not increase page load times by more than 500ms.

**NFR2**: Customer authentication must be secure with password hashing (bcrypt) and JWT session management, following modern security practices.

**NFR3**: The customer interface must be fully responsive and optimized for mobile devices, as customers likely access it from phones while at farms.

**NFR4**: Customer data must be stored in the existing Supabase database with the same backup and recovery capabilities as current order data.

**NFR5**: The system must handle concurrent customer orders while maintaining data consistency with ongoing admin operations.

## Compatibility Requirements

**CR1**: All existing admin dashboard functionality must remain unchanged and fully operational during and after customer portal implementation.

**CR2**: Current database schema for orders, imports, and invoices must remain compatible with existing workflows.

**CR3**: Existing Google Apps Script email integration must serve both admin and customer communications without configuration changes.

**CR4**: Current pricing management and product catalog must seamlessly serve both admin and customer interfaces.
