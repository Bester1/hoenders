-- The opt-out list for round notices.
--
-- The Kennisgewings tab refuses to send while this table cannot be read: an
-- unreadable opt-out list is not an empty one, and mailing someone who asked to
-- be left off cannot be undone afterwards. See canSendNotices() in
-- notifications.js.

create table if not exists public.notification_optouts (
    email        text primary key,
    opted_out_at timestamptz not null default now(),
    source       text default 'afmeld.html'
);

alter table public.notification_optouts enable row level security;

-- Anyone with their own unsubscribe link may opt out. An unsubscribe that
-- requires a login is not an unsubscribe, and the only thing stored is the
-- address the person already had.
drop policy if exists "anyone may opt out" on public.notification_optouts;
create policy "anyone may opt out"
    on public.notification_optouts for insert
    to anon, authenticated with check (true);

drop policy if exists "anyone may re-opt-out" on public.notification_optouts;
create policy "anyone may re-opt-out"
    on public.notification_optouts for update
    to anon, authenticated using (true) with check (true);

-- The admin dashboard must be able to read it, or it will refuse to send.
drop policy if exists "the list is readable" on public.notification_optouts;
create policy "the list is readable"
    on public.notification_optouts for select
    to anon, authenticated using (true);
