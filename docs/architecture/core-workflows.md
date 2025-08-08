# Core Workflows

## Customer Registration and Login Workflow

```mermaid
sequenceDiagram
    participant C as Customer
    participant CP as Customer Portal
    participant SA as Supabase Auth
    participant DB as Supabase DB
    participant LS as localStorage

    Note over C,LS: Customer Registration Flow
    C->>CP: Enter registration details
    CP->>CP: Validate form data
    CP->>SA: POST /signup with email/password
    SA->>SA: Hash password, create user
    SA->>DB: Store customer auth record
    SA-->>CP: Return user ID + confirmation
    CP->>DB: POST /customers with profile data
    DB-->>CP: Confirm customer profile created
    CP->>LS: Cache customer session
    CP-->>C: Registration successful

    Note over C,LS: Customer Login Flow
    C->>CP: Enter login credentials
    CP->>SA: POST /token with email/password
    SA->>SA: Validate credentials
    SA-->>CP: Return JWT token + user data
    CP->>DB: GET /customers/{id} for profile
    DB-->>CP: Return customer profile
    CP->>LS: Store JWT + session data
    CP-->>C: Redirect to dashboard
```

## Customer Order Placement Workflow

```mermaid
sequenceDiagram
    participant C as Customer
    participant CP as Customer Portal
    participant DB as Supabase DB
    participant AD as Admin Dashboard
    participant ES as Email Service
    participant GS as Google Script

    Note over C,GS: Order Placement Flow
    C->>CP: Browse products, add to cart
    CP->>CP: Calculate totals with pricing
    C->>CP: Confirm order placement
    CP->>DB: POST /orders with customer data
    DB->>DB: Create order with source='customer_portal'
    DB-->>CP: Return order ID and confirmation
    
    Note over CP,GS: Real-time Admin Integration
    DB->>AD: Real-time notification of new order
    AD->>AD: Display customer order in orders table
    
    Note over CP,GS: Email Confirmation Flow
    CP->>ES: Queue order confirmation email
    ES->>GS: POST /exec with email data
    GS->>GS: Send email using existing template
    GS-->>ES: Email delivery confirmation
    ES-->>CP: Confirm email sent
    CP-->>C: Order placed successfully
```

## Admin Order Processing Workflow (Extended)

```mermaid
sequenceDiagram
    participant A as Admin
    participant AD as Admin Dashboard
    participant DB as Supabase DB
    participant CP as Customer Portal
    participant ES as Email Service

    Note over A,ES: Admin Reviews Customer Orders
    A->>AD: View orders table
    AD->>DB: GET /orders with filters
    DB-->>AD: Return orders (customer + PDF sources)
    AD->>AD: Display orders with source indicators
    
    Note over A,ES: Admin Updates Order Status
    A->>AD: Update order status to 'confirmed'
    AD->>DB: PUT /orders/{id} with new status
    DB->>DB: Update order record
    DB-->>AD: Confirm status updated
    
    Note over AD,ES: Real-time Customer Notification
    DB->>CP: Real-time status update
    CP->>CP: Update customer order history
    AD->>ES: Queue status update email
    ES->>ES: Send customer notification
    ES-->>AD: Confirm notification sent
```

## Error Handling and Offline Capability Workflow

```mermaid
sequenceDiagram
    participant CP as Customer Portal
    participant DB as Supabase DB
    participant LS as localStorage
    participant ES as Email Service

    Note over CP,ES: Network Failure Scenario
    CP->>DB: Attempt order placement
    DB-->>CP: Network timeout/error
    CP->>LS: Store order data locally
    CP->>CP: Display offline notification
    CP-->>CP: Retry connection periodically
    
    Note over CP,ES: Connection Restored
    CP->>DB: Retry pending operations
    DB-->>CP: Order creation successful
    CP->>LS: Clear local cache
    CP->>ES: Process email queue
    ES-->>CP: Email sent successfully
    CP->>CP: Update UI with success state
```
