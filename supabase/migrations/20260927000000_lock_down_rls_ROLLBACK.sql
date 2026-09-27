-- Rollback for 20260927000000_lock_down_rls.sql: restores the policies exactly
-- as they were on 2026-09-27, INCLUDING the open ones. Only run this if the
-- admin app cannot sign in and invoicing is blocked -- it republishes every
-- order's customer name, email, phone and address to anyone with the anon key.

begin;

drop policy if exists "Admin manages orders" on orders;
drop policy if exists "Users can view own orders" on orders;
create policy "Allow all operations on orders" on orders for all using (true);
create policy "Users can view own orders" on orders for select
  using ((customer_id is null) or (customer_id in (select id from customers where auth_user_id = auth.uid())));

drop policy if exists "Admin manages order items" on order_items;
drop policy if exists "Users can view own order items" on order_items;
create policy "Enable all operations for order_items" on order_items for all using (true) with check (true);
create policy "Users can view own order items" on order_items for select
  using ((order_id)::text in (select orders.order_id from orders
    where (orders.customer_id is null) or (orders.customer_id in (select customers.id from customers where customers.auth_user_id = auth.uid()))));

drop policy if exists "Admin manages imports" on imports;
create policy "Allow all operations on imports" on imports for all using (true);

drop policy if exists "Admin manages settings" on settings;
create policy "Allow all operations on settings" on settings for all using (true);

drop policy if exists "Admin manages products" on products;
create policy "Enable insert for anon" on products for insert to anon with check (true);
create policy "Enable update for anon" on products for update to anon using (true) with check (true);
create policy "Enable write access for authenticated users" on products for all using (auth.role() = 'authenticated');

drop policy if exists "Admin manages customers" on customers;

drop policy if exists "Admin reads optouts" on notification_optouts;
create policy "the list is readable" on notification_optouts for select to anon, authenticated using (true);

drop policy if exists "Admin manages users" on users;
drop policy if exists "Admin manages marketing contacts" on marketing_contacts;
create policy "Admin can read all users" on users for select to authenticated
  using (lower(auth.jwt() ->> 'email') = any (array['abester7@gmail.com', 'jobosza@gmail.com']));
create policy "Admin can update all users" on users for update to authenticated
  using (lower(auth.jwt() ->> 'email') = any (array['abester7@gmail.com', 'jobosza@gmail.com']));
create policy "Admin can manage marketing_contacts" on marketing_contacts for all to authenticated
  using (lower(auth.jwt() ->> 'email') = any (array['abester7@gmail.com', 'jobosza@gmail.com']));

drop function if exists public.get_orders_open();
drop function if exists public.is_admin();

commit;
