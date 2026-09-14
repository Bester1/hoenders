# Plaas Hoenders Admin Dashboard

> **Read [AGENTS.md](AGENTS.md) first — it is the authoritative guide for this
> repo.** It covers the bug this codebase keeps having, the two price tables and
> how they drift, why re-importing a PDF adds rather than replaces, and how Pages
> actually deploys.
>
> This file was a 1,025-line log of July–August **2025** sessions — "BREAKTHROUGH
> SESSION ANALYSIS", "FINAL SESSION SUMMARY", a file structure listing five files
> in a repo root that now holds about 120. It was 394 days and 120 commits behind
> the code and was quietly contradicting AGENTS.md. Rewritten 2026-09-14; the old
> version is in git history if you want it.

## What this is

A static admin dashboard that turns the butchery's monthly PDF into customer
invoices. **It bills real customers real money once a month.** No build step —
the files in the repo root are the files the browser loads.

- **Hosting**: GitHub Pages at `bester1.github.io/hoenders`, serving `main`
  directly. Pushing to `main` deploys.
- **Database**: Supabase project `ukdmlzuxgnjucwidsygj`. The anon key is
  deliberately public; this is a static site relying on row-level security.
- **Email**: Google Apps Script (`GoogleAppsScript.gs`), no OAuth or API keys.
  See `GOOGLE_APPS_SCRIPT_SETUP.md`. `GMAIL_SETUP.md` is the deprecated
  predecessor — ignore it.
- **Frontend**: vanilla HTML/CSS/JS. `index.html` + `script.js` are the admin
  dashboard; `customer-portal.html` + `customer.js` are the customer side.

## Checks

```bash
node scripts/validate-invoicing.cjs   # the one that matters
npm run validate                      # lint + jest + npm audit
```

`scripts/validate-invoicing.cjs` is the check that protects the invoicing path:
it verifies the browser scripts parse, the two price tables agree, every
`productMapping` target resolves to a real price, the previously-broken butchery
names stay mapped, and the send path still reconciles.

**Never use `node --check` on the browser scripts.** `package.json` sets
`"type": "module"`, so Node parses them as ESM and reports errors the browser
will never see. AGENTS.md explains why.

`.github/workflows/validate.yml` validates only — **it does not deploy.**

## Why this file is short

The detail lives in AGENTS.md, next to the traps it explains. Two long documents
describing the same system is how they end up disagreeing, which is exactly what
happened here. Add durable, hard-won facts to AGENTS.md; leave session narrative
in commit messages.
