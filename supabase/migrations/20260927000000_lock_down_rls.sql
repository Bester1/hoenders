-- Lock down row-level security. 2026-09-27.
--
-- WHY: the public anon key (it has to sit in the website's JS) could read,
-- change and delete every order -- 309 rows with customer name, email, phone
-- and home address -- because each of these tables carried an
-- "ALL / public / using (true)" policy:
--     orders, order_items, imports, settings
-- and products let anon INSERT and UPDATE, so anyone could change prices.
-- Those policies existed because the admin app (index.html / script.js) had
-- no login and did everything as anon. It now signs in with Google first.
--
-- ADMIN is pinned to an auth user id, NOT an email address: this project has
-- mailer_autoconfirm = true, so anyone can register ANY email address with a
-- password and get a session without proving they own it. The old email-based
-- policies on users / marketing_contacts named jobosza@gmail.com, which had no
-- account -- anyone could have registered it and been admin. To add an admin,
-- add their auth.users id here.
--
-- Rollback: 20260927000000_lock_down_rls_ROLLBACK.sql

begin;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth.uid() in (
    'ac60e2ad-9883-4ab9-8cc0-3c98050b5ef2'::uuid   -- abester7@gmail.com
  ), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- The customer portal only needs to know whether ordering is open; settings
-- also holds gmail_config and the email queue, which must not be public.
create or replace function public.get_orders_open()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select orders_open from settings where id = 'main'), false);
$$;
revoke all on function public.get_orders_open() from public;
grant execute on function public.get_orders_open() to anon, authenticated;

-- orders ------------------------------------------------------------------
drop policy if exists "Allow all operations on orders" on orders;
drop policy if exists "Users can view own orders" on orders;
-- "customer_id IS NULL" made every guest order public; there are none any more
-- (the portal always sets customer_id), and ten old ones stay admin-only.
create policy "Users can view own orders" on orders for select
  using (customer_id in (select id from customers where auth_user_id = auth.uid()));
create policy "Admin manages orders" on orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- kept: "Users can create orders" (insert, own customer_id only)

-- order_items -------------------------------------------------------------
drop policy if exists "Enable all operations for order_items" on order_items;
drop policy if exists "Users can view own order items" on order_items;
create policy "Users can view own order items" on order_items for select
  using ((order_id)::text in (
    select o.order_id from orders o
    where o.customer_id in (select id from customers where auth_user_id = auth.uid())));
create policy "Admin manages order items" on order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- kept: "Users can create order items" (insert, own orders only)

-- imports / settings: admin only -----------------------------------------
drop policy if exists "Allow all operations on imports" on imports;
create policy "Admin manages imports" on imports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Allow all operations on settings" on settings;
create policy "Admin manages settings" on settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- products: anyone may read, only admin may write -------------------------
drop policy if exists "Enable insert for anon" on products;
drop policy if exists "Enable update for anon" on products;
-- was: any signed-in CUSTOMER could change prices
drop policy if exists "Enable write access for authenticated users" on products;
create policy "Admin manages products" on products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- kept: "Enable read access for all users"

-- customers: admin needs the full list (invoicing, notices) --------------
create policy "Admin manages customers" on customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- notification_optouts: anyone may opt out, only admin reads the list -----
drop policy if exists "the list is readable" on notification_optouts;
create policy "Admin reads optouts" on notification_optouts for select to authenticated
  using (public.is_admin());
-- kept: "anyone may opt out" (insert)

-- users / marketing_contacts: same admin check, not a spoofable email -----
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('users', 'marketing_contacts')
             and (coalesce(qual, '') like '%jobosza@gmail.com%'
                  or coalesce(with_check, '') like '%jobosza@gmail.com%')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;
create policy "Admin manages users" on users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages marketing contacts" on marketing_contacts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
