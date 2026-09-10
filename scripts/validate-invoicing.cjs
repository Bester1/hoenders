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
    'security-utils.js', 'error-handler.js', 'notifications.js'];
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

// The pack-weight sanity check must exist, be wired into reconcileRun(), and
// still catch the two lines that got through on 4 Sept 2026.
//
// Devon's FILETTE line was internally consistent (weight x price = total) and
// his page total would not OCR, so every other guard was blind to it. He was
// over-billed R184.37 and the invoice was already sent before a human noticed.
try {
    const src = read('script.js');

    if (!/packWeightAnomaly\s*\(/.test(src.slice(src.indexOf('function reconcileRun('),
                                                src.indexOf('function renderReconciliation(')))) {
        fail('reconcileRun() no longer calls packWeightAnomaly() — a line whose ' +
             'weight does not match its pack count would go out unflagged');
    } else {
        ok('reconcileRun() checks weight against pack count');
    }

    const grab = (marker) => {
        const a = src.indexOf(marker);
        let i = src.indexOf('{', a), depth = 0;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(a, i + 1); }
        }
        throw new Error('unbalanced braces after ' + marker);
    };
    const sandbox = {};
    const load = new Function('sandbox',
        'var ' + grab('const PACK_WEIGHTS').replace(/^const /, '') + ';' +
        'var PACK_WEIGHT_TOLERANCE = ' +
            /PACK_WEIGHT_TOLERANCE\s*=\s*([\d.]+)/.exec(src)[1] + ';' +
        grab('function packWeightAnomaly') + ';' +
        'sandbox.f = packWeightAnomaly; sandbox.w = PACK_WEIGHTS;');
    load(sandbox);

    const cases = [
        // [product, packs, kg, must flag?, what it is]
        ['FILETTE (sonder vel)', 15, 4.00, true,  "Devon's 4 Sept fillets"],
        ['STRIPS',                4, 21.0, true,  "Wanda's x10 strips"],
        ['STRIPS',               11, 5.66, false, "Devon's strips, actually correct"],
        ['BOUDE EN DYE',          6, 5.08, false, 'an ordinary line'],
        ['VLERKIES',             13, 13.04, false, 'an ordinary line'],
        ['BORSSTUKKE MET BEEN EN VEL (4 IN PAK)', 4, 8.95, false, 'heaviest real bors line'],
    ];
    let bad = 0;
    for (const [product, qty, kg, shouldFlag, what] of cases) {
        const flagged = sandbox.f(product, qty, kg) !== null;
        if (flagged !== shouldFlag) {
            bad++;
            fail(`packWeightAnomaly ${flagged ? 'flags' : 'misses'} ${what} ` +
                 `(${product}, ${qty} packs, ${kg}kg) — expected ${shouldFlag ? 'a flag' : 'no flag'}`);
        }
    }
    if (!bad) ok(`packWeightAnomaly holds on ${cases.length} known lines`);

    // Every product that can be priced must have a pack weight, or the check
    // silently does nothing for it.
    const priced = objectLiteralAfter(src, 'const DEFAULT_PRICING =', 'DEFAULT_PRICING');
    const missing = Object.keys(priced).filter(p =>
        sandbox.w[p] === undefined &&
        !Object.keys(sandbox.w).some(k => p.startsWith(k)));
    if (missing.length) {
        fail(`no pack weight for: ${missing.join(', ')} — weight anomalies on ` +
             `these products cannot be detected`);
    } else {
        ok(`every priced product has a pack weight (${Object.keys(priced).length})`);
    }
} catch (e) {
    fail(`could not check the pack-weight guard: ${e.message}`);
}

// --- 5. findMappedProduct() resolves the collisions in productMapping -------
//
// The mapping table is walked in INSERTION ORDER and the first substring hit
// wins, so several entries are only correct because of where they sit in the
// object. Nothing about the table's appearance says so, and getting it wrong
// mis-prices a line rather than failing — the silent shape every incident here
// has had. These cases pin the orderings that matter.
//
// Added 2026-09-10 with Nieuwoudt's once-off extras, which introduced two live
// collisions: 'ontbeen' already matched "ontbeende dye", and 'ONTBEENDE DYE'
// is a substring of the kerrie variant.
try {
    const src = read('script.js');
    const grab = (marker) => {
        const a = src.indexOf(marker);
        let i = src.indexOf('{', a), depth = 0;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(a, i + 1); }
        }
        throw new Error('unbalanced braces after ' + marker);
    };
    const sandbox = {};
    new Function('sandbox', 'console',
        'var ' + grab('const productMapping').replace(/^const /, '') + ';' +
        'var ' + grab('const DEFAULT_PRICING').replace(/^const /, '') + ';' +
        'var pricing = DEFAULT_PRICING;' +
        'var unmappedProducts = new Set();' +
        grab('function findMappedProduct') + ';' +
        'sandbox.f = findMappedProduct; sandbox.unmapped = unmappedProducts;'
    )(sandbox, { error() {}, warn() {}, log() {} });

    const cases = [
        // [butchery description, expected product, why this case exists]
        ['boud/dy',                     'BOUDE EN DYE',           "Nieuwoudt's own short form"],
        ['boude en dye',                'BOUDE EN DYE',           'must not be stolen by the bare "boude" alias'],
        ['boude en dye 2 in pak',       'BOUDE EN DYE',           'must not be stolen by "2 in pak" either'],
        ['boude',                       'BOUDE (6 IN PAK)',       'the new boude-only line'],
        ['Boude 6',                     'BOUDE (6 IN PAK)',       'with a pack count'],
        ['boude 6 in pak',              'BOUDE (6 IN PAK)',       'survives the loose-pak shortcut'],
        ['Ontbeende hoender',           'ONTBEENDE HOENDER',      'the original, still correct'],
        ['ontbeen 2',                   'ONTBEENDE HOENDER',      'the short alias, still correct'],
        ['Ontbeende dye',               'ONTBEENDE DYE',          'must beat the "ontbeen" alias'],
        ['ontbeende dye 6',             'ONTBEENDE DYE',          'with a pack count'],
        ['Ontbeende dye in kerrie',     'ONTBEENDE DYE (KERRIE)', 'must beat the plain dye entry'],
        ['kerrie dye 4',                'ONTBEENDE DYE (KERRIE)', "Nieuwoudt's likely short form"],
        ['Dye sosaties in barbeque sous', 'DYE SOSATIES (BBQ)',   'as Ansie wrote it'],
        ['sosaties 4',                  'DYE SOSATIES (BBQ)',     'short form'],
        ['vierke 13',                   'VLERKIES',               'OCR l/i regression, unchanged'],
        ['vye rol 1',                   'GEVULDE HOENDER ROLLE VAKUUM VERPAK', "Tanya's dropped line"],
    ];
    let bad = 0;
    for (const [desc, expected, why] of cases) {
        const got = sandbox.f(desc);
        if (got !== expected) {
            bad++;
            fail(`findMappedProduct("${desc}") -> ${got}, expected ${expected} (${why})`);
        }
    }
    if (!bad) ok(`findMappedProduct resolves ${cases.length} known butchery descriptions`);
    if (sandbox.unmapped.size) {
        fail(`these descriptions have no mapping and would be dropped from an ` +
             `invoice: ${[...sandbox.unmapped].join('; ')}`);
    }
} catch (e) {
    fail(`could not check product resolution: ${e.message}`);
}

// --- 6. Every priced product must be visible on the order form -------------
//
// populateAllProducts() renders the products named in getProductCategories(),
// NOT the price table. A product that is priced but in no category is simply
// never drawn — orderable in the admin, invisible to the customer, and silent
// either way. MAGIES sat like that; so did the four Sept 2026 extras until
// 2026-09-10, after they had already been added to the database.
//
// The same function's description comes from getProductDisplayInfo(), which
// falls back to the raw uppercase pricing key plus "Vars hoender produk van
// die plaas". Ten products were showing that filler, including one half of the
// gevulde-rolle pair while the other half read correctly.
try {
    const src = read('shared-utils.js');
    const sandbox = {};
    new Function('sandbox', 'window', 'navigator',
        src + ';sandbox.pricing = getCustomerPricing();' +
        'sandbox.cats = getProductCategories();' +
        'sandbox.display = getProductDisplayInfo;'
    )(sandbox, {}, { userAgent: '' });

    const categorised = new Map();
    for (const [key, cat] of Object.entries(sandbox.cats)) {
        for (const name of cat.products) {
            categorised.set(name, [...(categorised.get(name) || []), key]);
        }
    }
    const priced = Object.keys(sandbox.pricing);

    const invisible = priced.filter(n => !categorised.has(n));
    if (invisible.length) {
        fail(`priced but in no category, so never rendered on the order form: ` +
             `${invisible.join(', ')}`);
    } else {
        ok(`every priced product appears in a category (${priced.length})`);
    }

    const twice = [...categorised].filter(([n, keys]) => keys.length > 1);
    if (twice.length) {
        fail(`listed in more than one category, so rendered twice: ` +
             twice.map(([n, k]) => `${n} (${k.join(', ')})`).join('; '));
    }

    const ghosts = [...categorised.keys()].filter(n => !sandbox.pricing[n]);
    if (ghosts.length) {
        console.log(`note  in a category but not in the fallback price table, so ` +
                    `they render only when the database supplies them: ${ghosts.join(', ')}`);
    }

    // getEstimatedWeight() silently returns '1.0kg' for anything missing from
    // its weightMap, which is what the customer sees quoted on the order form
    // and in the confirmation. The four Sept 2026 extras all took that default
    // — the sosaties quoting 1.0kg against a ±600g pack — and so did MAGIES.
    // An entry that genuinely IS 1.0kg (NEKKIES, sold in 1kg bags) must still
    // be written down, so the default never stands in for a real figure.
    const weightSrc = read('shared-utils.js');
    const wmap = objectLiteralAfter(weightSrc, 'const weightMap =', 'weightMap in shared-utils.js');
    const noWeight = priced.filter(n => !(n in wmap));
    if (noWeight.length) {
        fail(`no entry in weightMap, so the order form quotes a default 1.0kg: ` +
             `${noWeight.join(', ')}`);
    } else {
        ok(`every priced product has an explicit estimated weight`);
    }

    const filler = priced.filter(n =>
        sandbox.display(n).description === 'Vars hoender produk van die plaas');
    if (filler.length) {
        fail(`no display entry, so these show the raw pricing key and the generic ` +
             `"Vars hoender produk van die plaas": ${filler.join(', ')}`);
    } else {
        ok(`every priced product has a real name and description`);
    }
} catch (e) {
    fail(`could not check order-form visibility: ${e.message}`);
}

// --- 7. The round notice cannot bypass its own guards ----------------------
//
// A campaign goes to every customer at once and cannot be recalled, so the two
// things that must never regress are checked here rather than trusted:
//
//   * sending is BLOCKED while the opt-out list is unknown. A missing or
//     unreadable table must not read as "nobody has opted out" — the same
//     absence-of-evidence bug that made 13 unchecked invoices report as
//     reconciled in Sept 2026.
//   * every message carries the sender's identity, why the person is getting
//     it, and a working per-recipient unsubscribe link — appended by
//     renderNoticeEmail(), not typed into the compose box where it can be
//     deleted.
try {
    const sandbox = {};
    new Function('sandbox', 'console', 'document',
        read('notifications.js') +
        ';sandbox.render = renderNoticeEmail;' +
        'sandbox.can = canSendNotices;' +
        'sandbox.isOut = isOptedOut;' +
        'sandbox.seg = noticeSegment;' +
        'sandbox.setOut = v => { noticeOptOuts = v; };' +
        'sandbox.setErr = v => { noticeOptOutError = v; };'
    )(sandbox, { warn() {}, error() {}, log() {} }, {});

    let bad = 0;
    const check = (cond, msg) => { if (!cond) { bad++; fail(msg); } };

    sandbox.setOut(null);
    sandbox.setErr('the table does not exist');
    check(sandbox.can().ok === false,
        'a campaign may be sent while the opt-out list is unreadable');

    sandbox.setOut(new Set());
    check(sandbox.can().ok === true,
        'a campaign is blocked even though the opt-out list loaded and is empty');

    sandbox.setOut(new Set(['foo@bar.com']));
    check(sandbox.isOut('  FOO@BAR.COM  ') === true,
        'opt-out matching is case- or whitespace-sensitive, so an opted-out ' +
        'address could still be mailed');

    const body = sandbox.render('Hallo {{naam}}.', { name: 'Rienke Potgieter', email: 'r@x.co.za' });
    check(/Hallo Rienke\./.test(body), '{{naam}} is not replaced with the first name');
    check(body.includes('afmeld.html?e=r%40x.co.za'),
        'no per-recipient unsubscribe link in the message footer');
    check(/omdat jy op die Plaas Hoenders bestellys is/.test(body),
        'the message does not say why the person is receiving it');
    check(/nie weer hoor\s*\n?\s*wanneer .n nuwe rondte oop is nie/.test(body),
        'the opt-out does not say that leaving the list means missing the round — ' +
        'this is an operational notice, not a marketing campaign');
    check(/afmeld\.html\?e=/.test(sandbox.render('', { name: 'X', email: 'x@y.z' })),
        'the footer can be lost when the body is empty');

    check(sandbox.seg(10) === 'active' && sandbox.seg(100) === 'lapsed' &&
          sandbox.seg(400) === 'dormant', 'customer segmentation boundaries have moved');

    if (!bad) ok('notice send guards hold (opt-out gate, footer, segments)');
} catch (e) {
    fail(`could not check the notice guards: ${e.message}`);
}

console.log('');
if (failures) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
}
console.log('All invoicing checks passed.');
