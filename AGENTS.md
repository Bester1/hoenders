# Working on this repo

This is the Plaas Hoenders invoicing app: a static site on GitHub Pages at
`bester1.github.io/hoenders`, backed by Supabase project `ukdmlzuxgnjucwidsygj`
(table `products`: `name`, `cost_price`, `selling_price`). No build step. The
files in the repo root are the files the browser loads.

It bills real customers real money once a month. Read this before changing
anything in the invoicing path.

## The one bug this repo keeps having

**A wrong invoice looks exactly like a right one.** Every incident that reached
a customer had the same shape: a line got no price, silently vanished or was
relabelled, and the invoice still rendered as a normal, plausible document with
a normal-looking total. Nobody noticed until a customer queried it, or until
someone added up the butchery statement by hand.

So the rule here is: **a missing price is an error, never a default.** Code that
quietly falls back to a guess is the bug, even when the guess is reasonable.

Known instances, all real:

- `findMappedProduct()` returned `description.toUpperCase()` for anything it did
  not recognise. The invented name is not a pricing key, so the line priced at
  nothing and disappeared. Cost Tanya Bezuidenhout R280.54 (`vye rol`).
  Same root cause for `nekke` and `halwe`.
- A "pak variations" shortcut ran *before* the mapping table and matched any
  description containing a 2 or a 4 plus the substring `pak` — so `braaipak 2`
  became BORSSTUKKE at R1/kg less. Hit Estene Uys, Sonja Symington and Justin
  Vorster on 30 July 2026.
- The mapping table pointed `Bors stukke met been en vel ...` at a bare
  `BORSSTUKKE MET BEEN EN VEL`, which is not a pricing key — only the
  `(2 IN PAK)` and `(4 IN PAK)` variants are. Latent silent-drop, found by the
  validator on 6 Aug 2026.
- John van Eeden's vlerkies were dropped by the PDF extractor rather than the
  mapping. Root cause never established, which is why the butchery's own
  `TOTAL ZAR` is now captured and compared against the parsed lines.

## Existing a check is not the same as running it

`reconcileRun()` was added on 30 July 2026 to catch all of the above. For the
next five weeks it was called in exactly one place — to draw a banner on the
invoices tab — while `sendQueuedEmails()` ignored it completely. Invoices could
still go out entirely unchecked if nobody happened to open that tab, which is
the original failure. Fixed 6 Aug 2026 (`1334036`).

If you add a guard, verify it runs on the path that matters, and add a check
that it stays wired in. `scripts/validate-invoicing.cjs` asserts this one.

## A guard can also stop running because the supplier changed their paper

**4 Sept 2026.** The `TOTAL ZAR` capture above went quiet without failing.
Nieuwoudt changed their invoice template: there is no `TOTAL ZAR` line any
more, only `Subtotal / Total tax / Total` and `Amount due R...`. So
`statedTotal` stayed `null` on every page, the mismatch comparison was written
as `statedTotal !== null && ...`, and the screen reported **"All 13 invoices
reconcile against the butchery"** — which meant "we never checked".

Measured on `ADRIAAN BESTER.pdf` (21 pages, Sept 2026 run) by running this
repo's own parser over the real OCR: **5 invoices short by R951.96 in total,
and 1 page where no total could be read at all.** Every shortfall was a line
whose numbers OCR mangled — `47712` for `477,12`, `2:19` for `2.19`, `115` for
`1.15`, `214` for `2.14` — which failed its own `weight × price = total` check
and was then **absorbed into the next item's description**, so the money left
the invoice without leaving a trace.

Three changes, in the order they matter:

1. `extractStatedTotal()` reads whichever form the page uses (`Amount due`
   first, else the last bare `Total` line — never `Subtotal`, never `Total
   tax`, which is usually `0,00` and would make every page look catastrophic).
2. A page whose total cannot be read is now `unverified: true` and is listed as
   a problem. **Absence of evidence must not render as success** — that is the
   whole bug, twice over now.
3. The order object carries `statedTotal` / `totalMismatch` / `unverified`
   through to the invoice. It did not before, so even when the parser worked
   out a mismatch, the finding was dropped on the floor between the two.

Also: `droppedItems` now records lines discarded for having no rate-card price,
with their rand value, because "unmapped" and "the customer was under-billed"
are the same event and only the first was being reported. And the import
summary no longer generates `errorsFound` with `Math.random()` over a hardcoded
`pagesProcessed: 25`.

`vierke` → `VLERKIES` aliased (OCR l/i confusion). The same run produced
`abors 6`: Nieuwoudt writes **`4Bors`**, and OCR mangles it to `A4bors` or,
once the digit is lost, `abors`. Bes confirmed on 4 Sept 2026 that these are
the 4-pak, so `abors` / `a4bors` map there. `2bors` exists in the same runs and
is mapped separately, so the alias is never a bare `bors`.

**A stray digit in a line is not a claim about the product.** The `isBors`
shortcut tested `desc.includes('4')` and `desc.includes('2')` against the whole
description — which includes the quantity. So `4Bors 2`, two packs of four,
resolved to the 2-pak at the 2-pak's price. Only a digit attached to the
product word counts now. This block had already been narrowed once for exactly
this reason (`braaipak 2` billing as breast portions); the narrowing did not go
far enough.

## Re-importing the same PDF adds, it does not replace

Everything lives in **browser localStorage** (`plaasHoendersImports`,
`plaasHoendersInvoices`, `plaasHoendersEmailQueue`, `plaasHoendersAnalysisHistory`).
Nothing deduplicates, and every id is `Date.now()`-based, so a second import of
the same file produces a second, unrelated-looking set of invoices while the
first set survives and can still be emailed. That matters most immediately
after a parser fix, which is exactly when a file gets re-imported. The import
now detects a matching `sourceFile` and makes you confirm.

Because it is localStorage: it is per-browser and per-profile, it is not backed
up anywhere, and clearing site data destroys every invoice and the email queue.

## Two price tables, and they drift

The fallback used until Supabase answers exists **twice**:

- `DEFAULT_PRICING` in `script.js` (admin)
- `defaultPricing` inside `getCustomerPricing()` in `shared-utils.js` (customer)

They drifted R1-2/kg apart on seven products before 5 Aug 2026, so the customer
saw one price and the invoice used another. Change one, change both — the
validator now fails if they disagree. (`customer.js` reads prices from the
database and holds no literal table.)

Margins are computed from `cost_price`, and **nothing in the app ever sees a
supplier invoice**, so cost drift is invisible. Heuning read R60 while Nieuwoudt
charged R65 — the app reported a 16.7% margin on a line actually earning 7.7%.
Re-check costs against the Nieuwoudt PDFs after any supplier increase.

## Supplier PDFs have no text layer

The "FAKTURE" from `orders@nieuwoudtbraaikuikens.co.za` are scans.
`extract_text()` returns nothing. Render with `pdftoppm -r 300` and OCR with
tesseract. Then verify every line `kg × rate = amount`, and that the lines sum
to the stated total, before believing any of it.

## Running checks

```bash
node scripts/validate-invoicing.cjs
```

Checks that browser scripts parse, that the two price tables agree, that every
`productMapping` target resolves to a real price, that the previously-broken
butchery names stay mapped, and that the send path still reconciles.

**Do not use `node --check` on the browser scripts.** `package.json` sets
`"type": "module"`, so Node parses them as ESM and reports errors the browser
will never see — `script.js` has a duplicate top-level `toggleAllOrders`, which
is perfectly legal in a classic `<script>`. The validator parses them the way
they are actually loaded.

## Deployment

Pages serves `main` directly (`build_type: legacy`). Pushing to `main` deploys.

`.github/workflows/validate.yml` **does not deploy** — it only validates. Its
predecessor (`deploy.yml`, "Secure Deploy to GitHub Pages") tried to deploy a
second time via `actions/deploy-pages`, which cannot succeed while Pages is in
branch mode. It failed on every push from at least 30 July 2026 and was never
noticed, because a workflow that is always red teaches you to ignore red. It
also assumed secrets-injected config: there are no repository secrets, and the
Supabase anon key is deliberately public here, since this is a static site
relying on row-level security.

If you ever do want workflow-based deploys, Pages has to be switched to
`workflow` build type first, and the branch-based builder stops being the thing
that ships.
