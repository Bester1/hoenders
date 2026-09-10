# Bemarking — one-time setup

The Bemarking tab will not send anything until the opt-out table exists. That is
deliberate: an unreadable opt-out list is not an empty one, and mailing someone
who asked to be left alone cannot be undone afterwards.

## Create the table

Supabase dashboard → **SQL Editor** → **New query** → paste and run:

```sql
create table if not exists public.marketing_optouts (
    email        text primary key,
    opted_out_at timestamptz not null default now(),
    source       text default 'afmeld.html'
);

alter table public.marketing_optouts enable row level security;

-- Anyone with the link may opt themselves out. There is nothing to read here
-- that identifies anyone beyond the address they typed in themselves, and an
-- unsubscribe that requires a login is not an unsubscribe.
create policy "anyone may opt out"
    on public.marketing_optouts for insert
    to anon, authenticated
    with check (true);

create policy "anyone may re-opt-out"
    on public.marketing_optouts for update
    to anon, authenticated
    using (true) with check (true);

create policy "the list is readable"
    on public.marketing_optouts for select
    to anon, authenticated
    using (true);
```

Then reload the admin dashboard. The Bemarking tab should say
`… kliënte gelaai` instead of blocking.

## Check it worked

Open `afmeld.html?e=test@example.com`, click through, then in the SQL editor:

```sql
select * from public.marketing_optouts;
```

Delete the test row when you are done:

```sql
delete from public.marketing_optouts where email = 'test@example.com';
```

## How sending works

- The list is built from the `orders` table, one row per email address, with
  order count, last order date and total spend. `customers` is not used — it
  reads empty under the anon key.
- Sending goes through `sendEmailViaGoogleScript()`, the same Google Apps Script
  and the same Gmail account as the invoices and the order confirmations.
- Messages go **one at a time**, with a 1.2 second gap. Sixty-odd recipients
  takes a bit over a minute. Gmail is not a bulk mailer and will throttle or
  suspend an account that behaves like one.
- Every message gets the sender's name, a phone number, a line saying why the
  person is receiving it, and a personal unsubscribe link. That footer is added
  in `renderMarketingEmail()` and cannot be edited away from the compose box.
- Opted-out addresses stay visible in the list, greyed out and unselectable, so
  it is obvious they are excluded on purpose rather than missing.
- Recipients are re-checked against the opt-out list at send time, not only when
  the list was drawn.

## Before the first real send

Use **Stuur toets na myself** and read the result in your own inbox. A campaign
cannot be recalled.
