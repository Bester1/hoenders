# Google OAuth Login Fix Instructions

## Problem
When users try to log in via Google OAuth for the first time, they get an error:
```
AuthImplicitGrantRedirectError: Database error saving new user
```

This happens because Supabase creates the user in `auth.users` but there's no corresponding record in the `customers` table, which the customer portal expects.

## Root Cause
1. User signs in via Google OAuth → Supabase creates user in `auth.users`
2. Customer portal code tries to load/create customer record from `customers` table
3. No record exists → Database error → Login fails

## Solution

### Step 1: Apply the Main Fix
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/ukdmlzuxgnjucwidsygj
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix-oauth-login.sql`
4. Click **Run**

This will:
- Create the `customers`, `orders`, and `order_items` tables if they don't exist
- Create a trigger that automatically creates customer records for new users
- Set up proper Row Level Security (RLS) policies

### Step 2: Fix Existing Users (Optional)
1. In the same SQL Editor, copy and paste the contents of `quick-fix-existing-users.sql`
2. Click **Run**

This will create customer records for existing users who don't have them.

## What the Fix Does

### 1. Automatic Customer Record Creation
The trigger `handle_new_user()` runs automatically whenever a new user is created in `auth.users`:
- Extracts name, email, phone, and address from Google OAuth metadata
- Creates a corresponding record in the `customers` table
- Handles conflicts gracefully (won't duplicate if record already exists)

### 2. Proper RLS Policies
- Users can only see/update their own customer profile
- Service role has full access for admin operations
- Anonymous users have limited access as needed

### 3. Complete Table Structure
- `customers` - Main customer profiles
- `orders` - Customer orders
- `order_items` - Individual items within orders

## Testing After Fix

1. **Clear Browser Data**:
   - Open Chrome settings
   - Go to Privacy and security → Clear browsing data
   - Select "Cookies and other site data" and "Cached images and files"
   - Click Clear data

2. **Test New User Registration**:
   - Open an incognito window
   - Go to: https://bester1.github.io/hoenders/customer-portal.html
   - Click "Continue with Google"
   - Complete the Google sign-in flow
   - Should redirect to customer portal successfully

3. **Test Existing User Login**:
   - If you applied the quick fix, existing users should now log in successfully
   - If not, they'll get customer records created on their first successful login

## Alternative Quick Fix (If SQL Access Issues)

If you can't apply the SQL fixes immediately, you can temporarily disable RLS:

```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
```

This is NOT recommended for production, but can be used as a temporary measure.

## Verification

After applying the fix, check that it works:

1. **Check the Trigger**:
```sql
SELECT
    tgname,
    tgrelid::regclass,
    tgfoid::regproc,
    tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

2. **Check Customer Records**:
```sql
SELECT COUNT(*) as customer_count
FROM customers;
```

3. **Test with a New User**:
   - Use a different Google account or clear existing data
   - Complete OAuth flow
   - Verify customer record was created automatically

## Troubleshooting

If issues persist:

1. **Check Console Logs**: Look for specific error messages
2. **Verify Table Creation**: Ensure tables exist with correct structure
3. **Check RLS Policies**: Ensure policies allow proper access
4. **Test with Service Role**: Try operations with service role key

## Support

If you continue to have issues:
1. Check the browser console for specific error messages
2. Verify the SQL was applied successfully in Supabase
3. Ensure Google OAuth is properly configured in Supabase settings