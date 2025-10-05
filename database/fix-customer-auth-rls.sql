-- Quick Fix for Customer Portal Authentication Issues
-- Apply this SQL directly in your Supabase SQL Editor to fix RLS policies

-- Step 1: Temporarily disable RLS to fix authentication
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Step 2: Create trigger to auto-create customer profiles
CREATE OR REPLACE FUNCTION create_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-create customer profile when user signs up
    INSERT INTO customers (auth_user_id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email)
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_user_id = NEW.id,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create customer profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_customer_profile();

-- Step 3: Enable RLS with proper policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON customers
    FOR SELECT USING (auth.uid() = auth_user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON customers
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can create own profile" ON customers
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Step 4: Fix orders table RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own orders
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (
        customer_id IS NULL OR  -- Allow viewing orders that haven't been linked yet
        customer_id IN (
            SELECT id FROM customers WHERE auth_user_id = auth.uid()
        )
    );

-- Allow users to create orders
CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (customer_id IN (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
    ));

-- Step 5: Fix order_items RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own order items
CREATE POLICY "Users can view own order items" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT order_id FROM orders WHERE
            customer_id IS NULL OR
            customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        )
    );

-- Allow users to create order items
CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT WITH CHECK (
        order_id IN (
            SELECT order_id FROM orders WHERE customer_id IN (
                SELECT id FROM customers WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Step 6: Create public view for admin customer lookup
CREATE OR REPLACE VIEW public_customer_list AS
SELECT
    id,
    name,
    email,
    phone,
    created_at,
    is_active
FROM customers
WHERE is_active = true;

-- Grant access to public view
GRANT SELECT ON public_customer_list TO anon;
GRANT SELECT ON public_customer_list TO authenticated;

-- Step 7: Grant necessary permissions
GRANT ALL ON customers TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;

-- Step 8: Update existing customers that don't have auth_user_id set
UPDATE customers
SET auth_user_id = (
    SELECT id FROM auth.users
    WHERE auth.users.email = customers.email
    LIMIT 1
)
WHERE auth_user_id IS NULL;

COMMIT;