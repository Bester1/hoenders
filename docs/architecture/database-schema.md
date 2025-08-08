# Database Schema

```sql
-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customer authentication and profile table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    communication_preferences JSONB DEFAULT '{"email_notifications": true}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for customer table
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_auth_user ON customers(auth_user_id);
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;

-- Extend existing orders table with customer portal fields
-- Note: This assumes your existing orders table exists and adds new columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'csv_import' 
    CHECK (source IN ('customer_portal', 'pdf_import', 'csv_import'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'processing', 'delivered', 'cancelled'));

-- Add indexes for extended orders table
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Order items table for granular product tracking
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg DECIMAL(8,2) NOT NULL CHECK (weight_kg > 0),
    unit_price_per_kg DECIMAL(10,2) NOT NULL CHECK (unit_price_per_kg > 0),
    line_total DECIMAL(10,2) NOT NULL CHECK (line_total >= 0),
    source VARCHAR(20) DEFAULT 'customer_selection'
        CHECK (source IN ('customer_selection', 'pdf_extraction', 'admin_entry')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to orders table (adjust based on your existing orders table structure)
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) 
        REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Indexes for order items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_name);
CREATE INDEX idx_order_items_source ON order_items(source);

-- Customer sessions for security tracking
CREATE TABLE customer_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(255) NOT NULL, -- Hash of JWT for revocation
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for customer sessions
CREATE INDEX idx_customer_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX idx_customer_sessions_active ON customer_sessions(is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_customer_sessions_token ON customer_sessions(session_token_hash);

-- Email queue extension for customer notifications
-- Extends your existing email queue with customer-specific fields
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT 'admin_notification'
    CHECK (email_type IN ('admin_notification', 'customer_confirmation', 'status_update', 'password_reset'));

-- Add index for customer emails
CREATE INDEX IF NOT EXISTS idx_email_queue_customer ON email_queue(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);

-- Row Level Security (RLS) policies for data protection
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;

-- Customer can only see their own data
CREATE POLICY "Customers can view own profile" ON customers
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Customers can update own profile" ON customers
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Customer can only see their own orders
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM customers WHERE auth_user_id = auth.uid()
        )
    );

-- Customer can create orders for themselves
CREATE POLICY "Customers can create own orders" ON orders
    FOR INSERT WITH CHECK (
        customer_id IN (
            SELECT id FROM customers WHERE auth_user_id = auth.uid()
        )
    );

-- Customer can view their order items
CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT order_id FROM orders WHERE customer_id IN (
                SELECT id FROM customers WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Admin policies (assuming admin role exists)
CREATE POLICY "Admins can manage all customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Custom function to match historical orders to customers
CREATE OR REPLACE FUNCTION match_customer_orders(
    p_customer_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT
)
RETURNS INTEGER AS $$
DECLARE
    matched_count INTEGER;
BEGIN
    -- Update existing orders that match customer name or email
    UPDATE orders 
    SET customer_id = p_customer_id,
        updated_at = NOW()
    WHERE customer_id IS NULL 
      AND (
          LOWER(customer_name) = LOWER(p_customer_name) 
          OR LOWER(customer_email) = LOWER(p_customer_email)
      );
    
    GET DIAGNOSTICS matched_count = ROW_COUNT;
    RETURN matched_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance optimization: Materialized view for customer analytics
CREATE MATERIALIZED VIEW customer_order_summary AS
SELECT 
    c.id as customer_id,
    c.name,
    c.email,
    COUNT(o.order_id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.order_date) as last_order_date,
    MIN(o.order_date) as first_order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.email;

-- Refresh the materialized view periodically
CREATE INDEX idx_customer_summary_customer ON customer_order_summary(customer_id);
CREATE INDEX idx_customer_summary_spent ON customer_order_summary(total_spent DESC);
```
