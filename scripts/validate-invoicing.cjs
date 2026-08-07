#!/usr/bin/env node
/**
 * Pre-merge checks for the things that have actually gone wrong here.
 *
 * Every bug that reached a customer on this repo was silent: the invoice looked
 * completely normal and the total was simply wrong. None of them would have
 * been caught by a linter, so this checks the three specific shapes instead.
 *
 * Run: node scripts/validate-invoicing.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let failures = 0;
const fail = msg => { failures++; console.error(`FAIL  ${msg}`); };
const ok = msg => console.log(`ok    ${msg}`);

/** Slice out an object literal starting at `marker`, by matching braces. */
function objectLiteralAfter(src, marker, label) {
    const start = src.indexOf(marker);
    if (start < 0) throw new Error(`could not find ${label} (marker: ${marker})`);
    const open = src.indexOf('{', start);
    let depth = 0, inStr = null, esc = false;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (inStr) { if (c === inStr) inStr = null; continue; }
        // Comments must be skipped, not scanned. These tables are heavily
        // commented with the incidents behind them, and an apostrophe in prose
        // ("the butchery's short form") would otherwise open a string and
        // swallow the rest of the literal.
        if (c === '/' && src[i + 1] === '/') {
            i = src.indexOf('\n', i); if (i < 0) break; continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            i = src.indexOf('*/', i); if (i < 0) break; i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) {
            // eslint-disable-next-line no-new-func
            return new Function(`return ${src.slice(open, i + 1)};`)();
        }
    }
    throw new Error(`unterminated object literal for ${label}`);
}

// --- 1. Every file the browser loads must parse -----------------------------
//
// package.json sets "type": "module", so `node --check` parses these as ESM and
// reports errors the browser will never see (duplicate top-level function
// declarations are legal in a classic <script>). Parse them the way they are
// actually loaded.
const browserScripts = ['script.js', 'shared-utils.js', 'customer.js',
    'security-utils.js', 'error-handler.js'];
for (const file of browserScripts) {
    try {
        // eslint-disable-next-line no-new-func
        new Function(read(file));
        ok(`${file} parses as a classic script`);
    } catch (e) {
        fail(`${file} does not parse: ${e.message}`);
    }
}

// --- 2. The two fallback price tables must agree ----------------------------
//
// script.js (admin) and shared-utils.js (customer-facing) each carry their own
// copy, used until Supabase answers. They drifted R1-2/kg apart on seven
// products before 2026-08-05, so the customer saw one price and the invoice
// used another.
try {
    const admin = objectLiteralAfter(read('script.js'),
        'const DEFAULT_PRICING =', 'DEFAULT_PRICING in script.js');
    const customer = objectLiteralAfter(read('shared-utils.js'),
        'const defaultPricing =', 'defaultPricing in shared-utils.js');

    const names = new Set([...Object.keys(admin), ...Object.keys(customer)]);
    const drift = [];
    for (const name of names) {
        const a = admin[name], c = customer[name];
        if (!a) { drift.push(`${name}: missing from script.js`); continue; }
        if (!c) { drift.push(`${name}: missing from shared-utils.js`); continue; }
        if (a.selling !== c.selling) {
            drift.push(`${name}: selling R${a.selling} (admin) vs R${c.selling} (customer)`);
        }
        if (a.cost !== c.cost) {
            drift.push(`${name}: cost R${a.cost} (admin) vs R${c.cost} (customer)`);
        }
    }
    if (drift.length) {
        fail(`fallback price tables disagree on ${drift.length} field(s):`);
        drift.forEach(d => console.error(`        ${d}`));
    } else {
        ok(`fallback price tables agree across ${names.size} products`);
    }
} catch (e) {
    fail(`could not compare price tables: ${e.message}`);
}

// --- 3. Every mapping target must be a real pricing key ---------------------
//
// This is the bug that hit Tanya, Justin, Sonja and Estene. findMappedProduct()
// returns a product name; if that name is not a key in the pricing table the
// line gets no price and vanishes from the invoice, which still looks normal.
// A typo in a mapping value is enough to cause it.
try {
    const src = read('script.js');
    const mapping = objectLiteralAfter(src, 'const productMapping =', 'productMapping');
    const pricing = objectLiteralAfter(src, 'const DEFAULT_PRICING =', 'DEFAULT_PRICING');

    const bad = [...new Set(Object.values(mapping))].filter(v => !(v in pricing));
    if (bad.length) {
        fail(`${bad.length} productMapping target(s) are not pricing keys — ` +
             `these lines would be dropped from invoices:`);
        bad.forEach(b => console.error(`        ${b}`));
    } else {
        ok(`all ${Object.keys(mapping).length} productMapping entries resolve to a price`);
    }

    // The butchery's own short forms must stay mapped. Each of these cost a
    // real customer money once.
    const regressions = ['nekke', 'halwe', 'vye rol', 'braaipak'];
    const missing = regressions.filter(k => !(k in mapping));
    if (missing.length) {
        fail(`mapping regression — previously-fixed names are gone: ${missing.join(', ')}`);
    } else {
        ok(`known-bad butchery names still mapped (${regressions.join(', ')})`);
    }
} catch (e) {
    fail(`could not check product mapping: ${e.message}`);
}

// --- 4. Reconciliation must stay wired into the send path -------------------
//
// reconcileRun() existed for five weeks while sendQueuedEmails() ignored it,
// so the July 2026 run went out unchecked. The function existing is not the
// same as the function running.
try {
    const src = read('script.js');
    const send = objectLiteralAfter.name && src.slice(
        src.indexOf('async function sendQueuedEmails('),
        src.indexOf('function updateEmailQueueDisplay('));
    if (!/reconcileRun\s*\(/.test(send)) {
        fail('sendQueuedEmails() no longer calls reconcileRun() — invoices can ' +
             'go out without being checked against the butchery');
    } else {
        ok('sendQueuedEmails() reconciles before sending');
    }
} catch (e) {
    fail(`could not check the send path: ${e.message}`);
}

console.log('');
if (failures) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
}
console.log('All invoicing checks passed.');
