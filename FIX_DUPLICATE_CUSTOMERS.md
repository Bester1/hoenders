# Fix Duplicate Customers - Database Migration

## Problem
The customers table has accumulated duplicate records for the same customers (e.g., Natasja Brand-Mason has 7 records, Mike Large has 4 records, etc.). This happens because there was no unique constraint on the email field.

## Solution
We've implemented both a database migration to clean existing duplicates and application-level prevention to stop new duplicates from being created.

## Step 1: Run Database Migration

**⚠️ IMPORTANT: Back up your database before running this migration!**

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration script: `migrations/001_cleanup_duplicate_customers.sql`

### What the migration does:
1. **Identifies duplicates** by email (case-insensitive)
2. **Keeps the most recent record** for each email (based on updated_at, then created_at)
3. **Updates all related tables** (orders, order_items, invoices) to point to the surviving record
4. **Deletes duplicate records**
5. **Adds unique constraint** on email field (case-insensitive)
6. **Creates supporting index** for the unique constraint

## Step 2: Application Changes (Already Deployed)

The customer portal now includes:
- ✅ Pre-creation email lookup to check for existing customers
- ✅ Graceful handling of unique constraint violations
- ✅ Linking of auth_user_id to existing customer records
- ✅ Comprehensive logging for debugging

## Step 3: Test the Fix

1. Try to register with an existing email address
2. Check browser console (F12) for debug messages
3. Verify no new duplicate records are created

## Expected Results

After migration:
- Each email will have only one customer record
- All order history preserved and linked to correct customer
- New registrations will link to existing records instead of creating duplicates
- Google OAuth will link to existing email-based accounts

## Monitoring

Check for these console messages during registration:
- `🔍 Checking for existing customer by email before creating...`
- `✅ Found existing customer by email, linking auth account...`
- `⚠️ Duplicate email detected, fetching existing customer...`

## Rollback Plan

If issues occur, the unique constraint can be removed:
```sql
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_email_unique;
DROP INDEX IF EXISTS idx_customers_email_lower;
```

## Support

If you encounter any issues with the migration or duplicate prevention, check:
1. Browser console logs for detailed error messages
2. Supabase logs for database constraint violations
3. Run a customer count query to verify duplicates were cleaned up

```sql
-- Verify cleanup worked
SELECT email, COUNT(*) as duplicate_count
FROM public.customers
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;
```