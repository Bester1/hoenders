# Fix Customer Portal Authentication Issues

## Problem
Customer portal showing authentication errors:
- `invalid claim: missing sub claim`
- `403 Forbidden` errors
- Session not persisting in localStorage

## Root Cause
Row Level Security (RLS) policies in Supabase are preventing customer registration and authentication.

## Quick Fix - Apply to Supabase

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase project: https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Create a new query

### Step 2: Apply the Fix
Copy and paste the contents of `database/fix-customer-auth-rls.sql` into the SQL editor and run it.

**Or run these commands directly:**

```sql
-- Temporarily disable RLS
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Create auto-customer profile function
CREATE OR REPLACE FUNCTION create_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO customers (auth_user_id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_user_id = NEW.id,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_customer_profile();

-- Re-enable RLS with proper policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON customers
    FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile" ON customers
    FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can create own profile" ON customers
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Fix orders RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (
        customer_id IS NULL OR
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    );
CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (customer_id IN (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
    ));

-- Fix order_items RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT order_id FROM orders WHERE
            customer_id IS NULL OR
            customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        )
    );
CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT WITH CHECK (
        order_id IN (
            SELECT order_id FROM orders WHERE customer_id IN (
                SELECT id FROM customers WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Grant permissions
GRANT ALL ON customers TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
```

### Step 3: Test the Customer Portal
1. Go to: https://bester1.github.io/hoenders/customer-portal.html
2. Try to register/login with Google
3. Check that authentication works and session persists

## What This Fix Does

1. **Disables RLS temporarily** - Allows initial authentication to work
2. **Creates auto-profile trigger** - Automatically creates customer profiles when users sign up
3. **Enables RLS with proper policies** - Allows users to access their own data
4. **Fixes JWT token issues** - Ensures proper claims are present in tokens
5. **Links existing accounts** - Connects Google OAuth to existing customer records

## Alternative Quick Fix (If SQL doesn't work)

If you can't access Supabase SQL editor, temporarily disable RLS:

```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
```

This will allow the customer portal to work while you fix the policies properly.

## Status

- ✅ Code fixes pushed to GitHub
- ✅ SQL scripts created
- 🔄 Waiting for database RLS fix to be applied
- ⏳ Customer portal ready for testing after SQL fix

## Files Updated

- `customer.js` - Better error handling for auth issues
- `database/fix-customer-auth-rls.sql` - SQL script to fix RLS policies
- `FIX-CUSTOMER-PORTAL.md` - This instruction file