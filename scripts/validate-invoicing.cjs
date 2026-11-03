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
const browserScripts = ['script.js', 'shared-utils.js', 'delivery-schedule.js', 'customer.js',
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
    // Same order as customer-portal.html loads them.
    const src = read('delivery-schedule.js') + ';' + read('shared-utils.js');
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

// --- 8. Closing the portal must actually close it --------------------------
//
// Closing a round used to be cosmetic. checkOrderingStatus() disabled the Place
// Order button at page load, and then checkProceedButton() set
// `placeOrderBtn.disabled = false` the moment the customer ticked the address
// and phone boxes — that handler knew nothing about the ordering status. The
// banner stayed on screen saying "Bestelling is tans gesluit" while the button
// underneath it worked, so a closed round still took orders.
//
// Every path that enables the button now goes through setPlaceOrderEnabled(),
// which refuses while orderingOpen is false.
try {
    const src = read('customer.js');
    const grab = (marker) => {
        const a = src.indexOf(marker);
        if (a < 0) throw new Error(`could not find ${marker}`);
        let i = src.indexOf('{', a), depth = 0;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (!depth) return src.slice(a, i + 1); }
        }
        throw new Error('unbalanced braces after ' + marker);
    };

    const btn = { disabled: false, style: {}, textContent: 'Plaas Bestelling', title: '' };
    const sandbox = {};
    new Function('sandbox', 'document',
        'var orderingOpen = true;' + grab('function setPlaceOrderEnabled') +
        ';sandbox.set = setPlaceOrderEnabled; sandbox.open = v => { orderingOpen = v; };'
    )(sandbox, { getElementById: id => (id === 'placeOrder' ? btn : null) });

    let bad = 0;
    const check = (cond, msg) => { if (!cond) { bad++; fail(msg); } };

    sandbox.open(false);
    sandbox.set(true, 'Plaas Bestelling');
    check(btn.disabled === true,
        'a CLOSED round still enables Place Order when both confirmation boxes ' +
        'are ticked — closing the portal does nothing');

    sandbox.open(true);
    sandbox.set(false, 'Plaas Bestelling');
    check(btn.disabled === true, 'an open round enables Place Order before the boxes are ticked');
    sandbox.set(true, 'Plaas Bestelling');
    check(btn.disabled === false, 'an open round will not enable Place Order at all');

    // Nothing outside setPlaceOrderEnabled() and updateOrderingUI() may enable it.
    const enables = [...src.matchAll(/placeOrder(?:Btn)?\.disabled\s*=\s*false/g)];
    check(enables.length <= 1,
        `${enables.length} places set placeOrder.disabled = false directly; only ` +
        `updateOrderingUI() may, or a closed round can be reopened from anywhere`);

    check(/await checkOrderingStatus\(\);/.test(grab("placeOrder.addEventListener('click'")),
        'the order is submitted without re-reading the ordering status, so a portal ' +
        'left open in a tab can still order into a closed round');

    if (!bad) ok('closing the portal actually prevents ordering');
} catch (e) {
    fail(`could not check the ordering gate: ${e.message}`);
}

// --- 9. The delivery schedule must be internally sane -----------------------
//
// DELIVERY_SCHEDULE_2026 feeds the dates in a notice that goes to every
// customer at once, so a wrong row is wrong sixty times over. The table was
// silently wrong from May 2026 onward — deliveries on the last Saturday of the
// month when the rounds run on the first, each paired with the NEXT month's
// cutoff, plus an April round that does not exist. Corrected 2026-09-12
// against Ansie's own spreadsheet.
//
// These checks cannot tell whether a date is the one she intends. They catch
// the shapes that are wrong on their face.
try {
    const sandbox = {};
    new Function('sandbox', 'window', 'navigator',
        read('delivery-schedule.js') + ';sandbox.s = DELIVERY_SCHEDULE_2026; sandbox.f = deliveryRoundForDate;'
    )(sandbox, {}, { userAgent: '' });
    const sched = sandbox.s;

    let bad = 0;
    const check = (cond, msg) => { if (!cond) { bad++; fail(msg); } };

    for (const r of sched) {
        // A cutoff on or after its own delivery means orders close after the
        // birds arrive. Most rounds close in the PREVIOUS month, which is what
        // a "15th of the delivery month" rule gets wrong.
        check(r.cutoff < r.delivery,
            `${r.month}: cutoff ${r.cutoff} is not before delivery ${r.delivery}`);
        check(new Date(r.delivery + 'T00:00:00').getDay() === 6,
            `${r.month}: delivery ${r.delivery} is not a Saturday`);
    }
    for (let i = 1; i < sched.length; i++) {
        check(sched[i - 1].delivery < sched[i].delivery,
            `rounds are out of order: ${sched[i - 1].delivery} then ${sched[i].delivery}`);
        check(sched[i - 1].cutoff < sched[i].cutoff,
            `cutoffs are out of order: ${sched[i - 1].cutoff} then ${sched[i].cutoff}`);
    }

    // The round the app currently points at, spelled out so a shift like the
    // one corrected here shows up as a changed number rather than staying
    // invisible inside a date comparison.
    const oct = sched.find(r => r.month === 'October');
    check(oct && oct.delivery === '2026-10-03' && oct.cutoff === '2026-09-15',
        `the October 2026 round no longer reads delivery 2026-10-03 / cutoff ` +
        `2026-09-15 — re-check against Ansie's spreadsheet before changing it`);

    // Which delivery an order belongs to. Orders carry only a date, and the
    // Orders page and the stock check both group by this answer — when it was
    // the calendar month instead, two orders placed on 1 Oct for November
    // pushed the whole 3 Oct delivery off the screen the day before it went.
    const roundOf = d => { const r = sandbox.f(d); return r ? r.delivery : null; };
    [['2026-09-20', '2026-10-03'],   // after the 15 Sep cutoff, inside the grace week
     ['2026-09-26', '2026-10-03'],   // last day of grace
     ['2026-09-27', '2026-11-07'],   // too late for 3 Oct
     ['2026-10-01', '2026-11-07'],   // Justin and Elze, 2026-10-01
     ['2026-08-20', '2026-09-05'],
     ['2025-12-20', null]].forEach(([d, want]) =>
        check(roundOf(d) === want, `an order on ${d} maps to ${roundOf(d)}, expected ${want}`));

    if (!bad) ok(`delivery schedule is consistent (${sched.length} rounds) and orders map to the right delivery`);
} catch (e) {
    fail(`could not check the delivery schedule: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Route + pakslip (PR #12 review). The slip is what the bags are packed from,
// so a bag that merges with a stranger's, loses its address or drops a line
// is a bag packed wrong -- and it looks completely normal on paper.
// ---------------------------------------------------------------------------
try {
    const vm = require('vm');
    const src = read('script.js');
    const from = src.indexOf('// Delivery route + pakslip');
    const to = src.indexOf('// Export orders to Excel for butchery');
    if (from === -1 || to === -1) throw new Error('route block markers not found in script.js');
    const store = {};
    const sb = {
        console,
        localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
        document: { getElementById: id => (id === 'portalMonthFilter' ? { value: 'r:2026-11-07' } : null) },
    };
    vm.createContext(sb);
    vm.runInContext(src.slice(from, to), sb);
    let bad = 0;
    const check = (cond, msg) => { if (!cond) { bad++; fail(msg); } };
    const O = (id, name, address, products) => ({ orderId: id, name, address, products });

    const { stops, dropped } = sb.routeStopsFor([
        O('1', 'Justin', '19 Hawk Road, kraaifontein', [{ product: 'VLERKIES', quantity: 4 }]),
        O('2', 'justin ', '19 Hawk Road,  Kraaifontein', [{ product: 'VLERKIES', quantity: 2 }]),
        O('3', 'Chris', '1 A Street, Bellville', [{ product: 'FILETTE', quantity: 1 }]),
        O('4', 'Chris', '9 B Road, Parow', [{ product: 'STRIPS', quantity: 2 }]),
        O('5', '', '5 C Close, Durbanville', [{ product: 'LEWER', quantity: 1 }]),
        O('6', 'Zero', '7 D Avenue, Bothasig', [{ product: 'HEEL HOENDER', quantity: 0 }, { product: 'STRIPS', quantity: 'x' }]),
    ]);
    const justin = stops.filter(s => s.name.toLowerCase().startsWith('justin'));
    check(justin.length === 1 && justin[0].items[0].quantity === 6,
        'one customer, same house, two orders is not ONE bag with both orders in it');
    const chris = stops.filter(s => s.name === 'Chris');
    check(chris.length === 2 && chris.every(s => s.sameName),
        'two Chrises at two addresses are merged, or not flagged -- one bag would go to the wrong house');
    check(stops.some(s => s.name === 'GEEN NAAM'), 'an order with no name is dropped from the slip silently');
    check(dropped.length === 2 && dropped.every(d => d.startsWith('Zero')),
        'a line with a zero or bad quantity vanishes without being listed (' + dropped.length + ' listed)');

    // A late stop goes last and NUUT; no address sorts last when unarranged.
    const ordered = sb.orderedRouteStops(stops, null);
    const noAddr = sb.orderedRouteStops([...stops, { key: 'x|', name: 'Nowhere', address: '', items: [{ product: 'P', quantity: 1 }] }], null);
    check(noAddr[noAddr.length - 1].name === 'Nowhere', 'a stop with no address does not sort last');
    const keys = ordered.map(s => s.key);
    const late = sb.orderedRouteStops(stops, keys.slice(1));
    check(late[late.length - 1].key === keys[0] && late[late.length - 1].isNew,
        'a customer missing from the saved route is not put at the end marked NUUT');

    // The CSV exports must use the SAME key as the slip, or the paper and the
    // files disagree about who is where.
    store['hoenders.route.r:2026-11-07'] = JSON.stringify([sb.routeStopKey(O('3', 'Chris', '1 A Street, Bellville')), sb.routeStopKey(O('1', 'Justin', '19 Hawk Road, kraaifontein'))]);
    const csvOrder = sb.inRouteOrder([O('1', 'Justin', '19 Hawk Road, kraaifontein', []), O('4', 'Chris', '9 B Road, Parow', []), O('3', 'Chris', '1 A Street, Bellville', [])]);
    check(csvOrder.map(o => o.orderId).join() === '3,1,4', 'the CSV order does not follow the saved route: ' + csvOrder.map(o => o.orderId).join());
    check(/saveRoute\(routeRoundKey/.test(src.slice(src.indexOf('function printPakslip'), src.indexOf('function printPakslip') + 600)),
        'printing does not save the route -- the paper and both CSV exports can disagree');

    // Maps: 23 stops become 1-10, 10-19, 19-23; no piece over Maps' 8-waypoint
    // limit; awkward characters encoded; a stop with no address is skipped.
    const many = Array.from({ length: 23 }, (_, i) => ({ address: i === 4 ? '' : `${i + 1} Main Rd & Co #${i}\nDurbanville` }));
    const legs = sb.routeMapsLegs(many);
    check(legs.map(l => l.from + '-' + l.to).join(',') === '1-11,11-20,20-23',
        'route Maps pieces are not continuous 10-stop pieces: ' + legs.map(l => l.from + '-' + l.to).join(','));
    check(legs.every(l => ((l.url.split('&waypoints=')[1] || '').split('%7C').filter(Boolean).length) <= 8),
        'a Maps piece has more than 8 waypoints -- Maps drops the rest');
    check(legs.every(l => !/[#&]\d/.test(l.url.replace(/&(origin|destination|waypoints|travelmode)=/g, ''))),
        'an address with & or # is not encoded -- it would cut the Maps link short');
    check(sb.routeMapsAddress('7 Oak St\nBellville') === '7 Oak St, Bellville, South Africa', 'the Maps search text is not one line with the country');
    check(sb.routeMapsLegs([{ address: 'x' }]).length === 0, 'one stop makes a Maps route with no destination');

    if (!bad) ok('route + pakslip: one bag per customer and address, nothing dropped silently, files follow the printed route');
} catch (e) {
    fail(`could not check the route + pakslip: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Lêer vir Nieuwoudt (Oct 2026). Her import skips any line whose product name
// is not on her Pryse tab; on the 7 Nov file that was 13 of 21 names. The
// export must write HER spelling, and must say which products she still lacks.
// ---------------------------------------------------------------------------
(async () => {
    const vm = require('vm');
    const src = read('script.js');
    const from = src.indexOf("// The order file for Ansie's plaas-bestel sheet");
    const to = src.indexOf('// Delivery route + pakslip');
    if (from === -1 || to === -1) throw new Error('export block markers not found in script.js');
    // Her product list as her order form served it on 1 Nov 2026 (she renamed
    // several after 20 Oct, and the 7 Nov file lost 29 lines to it).
    const HERS = [
        'Heel hoender', 'Plat hoender (flatty)', 'Opgesnyde hoender', 'Halwe hoender',
        'Borsstukke met been en vel (4 in pak)', 'Borsstukke met been en vel (2 in pak)', 'Vlerkies (8 in pak)',
        'Boude en dye', 'Guns, boud en dy aanmekaar (3 in pak)', 'Filette (sonder vel) (4 in pak)',
        'filette (sonder vel) (2 in pak)', 'Strips', 'Ontbeende hoender',
        'Gevulde hoender rol (groenvye, feta, cheddar, sweet chilli)',
        'Gevulde hoender rol (peppadew, mozzarella, cheddar, pynappel)', 'Hoender patties (4 in pak)',
        'Hoender kaaswors', 'Nekkies', 'Lewer', 'Magies', 'Ingelegde groenvye (375ml)', 'Suiwer heuning (500g)',
        'Boude (6 in pak)', 'Dye Sosaties', 'Ontbeende DYE (6 in pak)', 'Kerrie ontbeende dye (6 in pak)',
        'Lamingtons Choclate (6 in pak)', 'Lamingtons Raspberry (6 in pak)', 'Hertzoggies (6 in pak)'];
    let csvText = '', alerted = '';
    const sb = {
        console: { ...console, warn() {} }, URL: { createObjectURL: () => 'blob:x' }, AbortSignal: { timeout: () => undefined },
        Blob: function (parts) { csvText = parts.join(''); },
        fetch: async () => ({ json: async () => ({ ok: true, products: HERS.map(name => ({ name })) }) }),
        alert: m => { alerted = m; }, addActivity: () => {},
        document: { getElementById: () => null, createElement: () => ({ click() {} }) },
    };
    vm.createContext(sb);
    vm.runInContext(src.slice(from, to), sb);
    sb.inRouteOrder = o => o; sb.roundKeyLabel = () => 'x';
    let bad = 0;
    const check = (cond, msg) => { if (!cond) { bad++; fail(msg); } };

    // Every product on Bes's rate card either lands on her list or is one of the
    // limited-run extras she has never listed.
    const rate = [...src.matchAll(/^\s+'([^']+)': \{ cost:/gm)].map(m => m[1]).concat(["PLAT HOENDER (FLATTY'S)", 'GEVULDE HOENDER ROLLE OPSIE 1']);
    const herKeys = Object.fromEntries(HERS.map(n => [sb.nieuwoudtKey(n), n]));
    const NOT_HERS = [];   // since 1 Nov she lists all of them
    const off = rate.filter(p => !NOT_HERS.includes(p) && !herKeys[sb.nieuwoudtKey(sb.nieuwoudtProductName(p, herKeys))]);
    check(off.length === 0, 'rate-card products that would not import on her side: ' + off.join(', '));
    check(sb.nieuwoudtProductName('BRAAIPAKKE', herKeys) === 'Opgesnyde hoender', 'Braaipakke is not sent as her Opgesnyde hoender');
    check(sb.nieuwoudtProductName('BOUDE (6 IN PAK)', herKeys) === 'Boude (6 in pak)', 'a case-only difference is not sent in her exact spelling');

    // End to end: the file has her names, and the products she lacks are named with pack counts.
    sb.selectedPortalOrders = () => [
        { name: 'Justin', products: [{ product: 'VLERKIES', quantity: 4 }, { product: 'BRAAIPAKKE', quantity: 2 }] },
        { name: 'Bes', products: [{ product: 'HOENDER PIE', quantity: 2 }, { product: 'SUIWER HEUNING', quantity: 0 }] },
    ];
    await sb.exportForNieuwoudt();
    check(/"Justin","Vlerkies \(8 in pak\)",4/.test(csvText) && /"Justin","Opgesnyde hoender",2/.test(csvText),
        'the Nieuwoudt file does not carry her product names: ' + csvText.split('\n').slice(1, 3).join(' | '));
    check(/HOENDER PIE\s+\(2 pakke\)/.test(alerted), 'a product missing from her list is not named, with its packs, after the download');
    check(!/SUIWER/.test(csvText), 'a zero-quantity line went into her import file');

    // Her list unreachable: the file still downloads, and says it was not checked.
    sb.fetch = async () => { throw new Error('offline'); };
    alerted = ''; csvText = '';
    await sb.exportForNieuwoudt();
    check(csvText.includes('Vlerkies (8 in pak)') && /NIE nagegaan/.test(alerted),
        'with her list unreachable the export either fails or claims the names were checked');

    // A second click while her list is still loading must not make a second file,
    // and the button must come back afterwards, also when the export throws.
    const waiting = []; let downloads = 0;
    const btn = { disabled: false, innerHTML: 'Lêer vir Nieuwoudt' };
    sb.document = { getElementById: id => (id === 'nieuwoudtExportBtn' ? btn : null), createElement: () => ({ click() { downloads++; } }) };
    sb.fetch = () => new Promise(r => waiting.push(r));
    const first = sb.exportForNieuwoudt();
    await new Promise(r => setImmediate(r));
    check(btn.disabled && /Lees Ansie/.test(btn.innerHTML), 'the button does not show it is busy while her list loads');
    const second = sb.exportForNieuwoudt();
    await new Promise(r => setImmediate(r));
    waiting.forEach(r => r({ json: async () => ({ ok: true, products: HERS.map(name => ({ name })) }) }));
    await Promise.all([first, second]);
    check(downloads === 1, `a second click while loading made ${downloads} files`);
    check(!btn.disabled && btn.innerHTML === 'Lêer vir Nieuwoudt', 'the button stays busy after the export');
    sb.fetch = async () => ({ json: async () => ({ ok: true, products: HERS.map(name => ({ name })) }) });
    const realBlob = sb.Blob;
    sb.Blob = function () { throw new Error('boom'); };
    await sb.exportForNieuwoudt().catch(() => {});
    sb.Blob = realBlob;
    check(!btn.disabled, 'a failed export leaves the button disabled for good');
    await sb.exportForNieuwoudt();
    check(downloads === 2, 'after a failed export the button no longer exports');

    if (!bad) ok("Lêer vir Nieuwoudt: her product names, missing products named before she imports, one file per click");
})().catch(e => fail(`could not check the Nieuwoudt export: ${e.message}`))
  .then(() => noticeChecks()).catch(e => fail(`could not check the round notices: ${e.message}`))
  .then(() => herbestelPortalChecks()).catch(e => fail(`could not check the portal refill: ${e.message}`))
  .finally(() => {
    // The export check is async, so the summary waits for it.
    console.log('');
    if (failures) {
        console.error(`${failures} check(s) failed.`);
        process.exit(1);
    }
    console.log('All invoicing checks passed.');
});

// --- Round notices: "Weer dieselfde?" ------------------------------------------
//
// A reorder message tells a customer what they ordered last time. The same
// silent-wrong shape as an invoice: an empty or wrong list still reads like a
// normal email, and it reaches forty-odd people at once. So: no lines is an
// error, a send is all or nothing, someone who already ordered this round is
// not "not ordered yet", and a phone number becomes a WhatsApp number or none.
async function noticeChecks() {
    const vm = require('vm');
    let bad = false;
    const check = (cond, msg) => { if (!cond) { bad = true; fail(`notices: ${msg}`); } };
    const sb = { console: { log() {}, warn() {}, error() {} }, document: { getElementById: () => null },
        URLSearchParams, Date, Map, Set, setTimeout, encodeURIComponent, alert() {}, confirm: () => true };
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(read('delivery-schedule.js'), sb);
    vm.runInContext(read('notifications.js'), sb);

    const sonja = { name: 'Sonja Symington', email: 's@example.com', phone: '082 123 4567', lastOrder: '2026-10-21',
        lastOrderId: 'ORD-1', lastItems: [{ product_name: 'VLERKIES', quantity: 3 }] };
    sb.sonja = sonja;
    const body = 'Hallo {{naam}}\n{{vorige}}\n{{herbestel}}';
    const out = sb.personaliseNotice(body, sonja);
    check(/Hallo Sonja\n  • 3 × VLERKIES\n/.test(out), 'the last order is not listed in the message');
    check(out.endsWith('herbestel=1&bestelling=ORD-1'), 'the refill link does not name the order the message lists');
    let threw = false;
    try { sb.personaliseNotice(body, { ...sonja, lastItems: [] }); } catch (e) { threw = true; }
    check(threw, '{{vorige}} for a last order with no lines is filled with nothing instead of refusing');

    // Round matching: window of 6 days avoids ambiguous overlap between 7 Nov and 21 Nov
    check(sb.scheduledRound('2026-11-07')?.delivery === '2026-11-07', 'exact date does not match round');
    check(sb.scheduledRound('2026-11-09')?.delivery === '2026-11-07', 'a van two days late does not match round');
    check(sb.scheduledRound('2026-11-14') === null, '14 Nov (ambiguous/outside 6-day window) was guessed instead of null');
    check(sb.scheduledRound('2026-11-15')?.delivery === '2026-11-21', '15 Nov does not match 21 Nov round');
    check(sb.scheduledRound('2027-03-01') === null, '2027 date matches a 2026 round');

    check(sb.orderedThisRound(sonja, '2026-11-07') === true, 'an order for this round counts as not ordered');
    check(sb.orderedThisRound(sonja, '2026-11-09') === true, 'a van two days late lists everyone who ordered as not ordered');
    check(sb.orderedThisRound(sonja, '2026-11-21') === false, 'an order for the previous round counts as ordered for this one');
    check(sb.orderedThisRound(sonja, '2027-03-01') === null, 'a date matching no round still sorts customers');

    // Date extraction from notice body
    check(sb.extractNoticeDeliveryDate('Aflewering is 7 November 2026.') === '2026-11-07', 'did not extract delivery date from notice');
    check(sb.extractNoticeDeliveryDate('aflewering is 21 November 2026') === '2026-11-21', 'did not extract lowercase delivery date');
    check(sb.extractNoticeDeliveryDate('Geen datum nie') === null, 'extractNoticeDeliveryDate did not return null');

    // Escaping
    check(sb.noticeEsc('<script>alert("x & y\'")</script>') === '&lt;script&gt;alert(&quot;x &amp; y&#39;&quot;)&lt;/script&gt;',
        'noticeEsc does not escape HTML control characters');

    // WhatsApp link formatting and footer compliance
    const wa = sb.noticeWhatsAppLink;
    for (const phone of ['082 123 4567', '+27 82 123 4567', '0027821234567'])
        check((wa('x', { ...sonja, phone }) || '').startsWith('https://wa.me/27821234567?'), `${phone} does not become 27821234567`);
    check(wa('x', { ...sonja, phone: '12345' }) === null && wa('x', { ...sonja, phone: '' }) === null, 'a bad phone number still gets a WhatsApp link');
    const waText = decodeURIComponent(wa('x', sonja));
    check(waText.includes('afmeld.html?e=s%40example.com'), 'the WhatsApp message has no recorded way to leave the list');
    check(waText.includes("Wil jy heeltemal van die bestellys afkom? Dan sal jy ook nie weer hoor wanneer 'n nuwe rondte oop is nie:"),
        'the WhatsApp message does not match the email footer opt-out wording');

    // Selection pruning under todo filter
    vm.runInContext(`
        noticeCustomers = [
            { email: 'ordered@example.com', lastOrder: '2026-10-21', orders: 2, segment: 'active' },
            { email: 'notyet@example.com', lastOrder: '2026-09-01', orders: 1, segment: 'active' }
        ];
        noticeSelected.clear();
        noticeSelected.add('ordered@example.com');
        noticeSelected.add('notyet@example.com');
        noticeFilter = 'all';
        pruneNoticeSelection();
    `, sb);
    check(sb.noticeSelected.has('ordered@example.com') && sb.noticeSelected.has('notyet@example.com'), 'all filter pruned selections');
    vm.runInContext(`
        noticeFilter = 'todo';
        document.getElementById = (id) => (id === 'noticeDelivery' ? { value: '2026-11-07' } : null);
        pruneNoticeSelection();
    `, sb);
    check(!sb.noticeSelected.has('ordered@example.com'), 'todo filter kept customer who already ordered');
    check(sb.noticeSelected.has('notyet@example.com'), 'todo filter pruned customer who has not ordered');

    // Guards: startNoticeSend blocks when delivery matches no round
    vm.runInContext('noticeOptOuts = new Set();', sb);
    let alertMsg = null;
    sb.alert = (msg) => { alertMsg = msg; };
    vm.runInContext(`
        document.getElementById = (id) => ({
            noticeDelivery: { value: '2027-01-01' },
            noticeSubject: { value: 'Onderwerp' },
            noticeBody: { value: 'Hallo {{naam}}\\n{{vorige}}' },
            noticeLog: { textContent: '' }
        })[id] || null;
    `, sb);
    await sb.startNoticeSend();
    check(alertMsg && alertMsg.includes('pas by geen rondte'), 'startNoticeSend did not block when delivery date matches no round');

    // Guards: openNoticeWhatsApp blocks when customer already ordered
    alertMsg = null;
    vm.runInContext(`
        noticeCustomers = [sonja];
        document.getElementById = (id) => ({
            noticeDelivery: { value: '2026-11-07' },
            noticeBody: { value: 'Hallo {{naam}}\\n{{vorige}}' }
        })[id] || null;
    `, sb);
    await sb.openNoticeWhatsApp(sonja.email);
    check(alertMsg && alertMsg.includes('het al vir hierdie rondte bestel'), 'openNoticeWhatsApp did not block when customer already ordered');

    // Guards: openNoticeWhatsApp checks portalAcceptingOrders
    let confirmed = false;
    sb.confirm = () => { confirmed = true; return false; };
    sb.portalAcceptingOrders = async () => ({ open: false, known: true });
    vm.runInContext(`
        document.getElementById = (id) => ({
            noticeDelivery: { value: '2026-11-07' },
            noticeBody: { value: 'Gewone kennisgewing sonder vorige' }
        })[id] || null;
    `, sb);
    await sb.openNoticeWhatsApp(sonja.email);
    check(confirmed, 'openNoticeWhatsApp did not check portalAcceptingOrders when portal is closed');

    // All or nothing: one customer without lines stops the batch before anything is sent.
    let sent = 0;
    sb.sendEmailViaGoogleScript = async () => { sent++; return true; };
    vm.runInContext('noticeOptOuts = new Set();', sb);
    let refused = false;
    try { await sb.sendNoticeBatch([sonja, { ...sonja, email: 'empty@example.com', lastItems: [] }], 'subject', body); }
    catch (e) { refused = true; }
    check(refused && sent === 0, `a batch with one empty last order sent ${sent} email(s) before stopping`);

    // Opt-out list unreadable: no WhatsApp button, and the button's handler refuses.
    vm.runInContext('noticeOptOuts = null;', sb);
    check(!sb.canSendNotices().ok, 'an unreadable opt-out list does not block sending');

    // Real fillReorderNotice output into extractNoticeDeliveryDate and noticeDeliveryChanged behavior
    const noticeEls = {
        noticeCutoff: { value: '2026-11-04' },
        noticeDelivery: { value: '2026-11-07' },
        noticeSubject: { value: '' },
        noticeBody: { value: '' }
    };
    sb.document.getElementById = (id) => noticeEls[id] || null;
    sb.fillReorderNotice();
    check(sb.extractNoticeDeliveryDate(noticeEls.noticeBody.value) === '2026-11-07',
        'real fillReorderNotice output did not yield delivery date in extractNoticeDeliveryDate');

    // Date change with unmodified template rewrites body with new delivery date
    noticeEls.noticeDelivery.value = '2026-11-21';
    sb.noticeDeliveryChanged();
    check(sb.extractNoticeDeliveryDate(noticeEls.noticeBody.value) === '2026-11-21',
        'noticeDeliveryChanged did not automatically rewrite unmodified template on date change');

    // Date change when body has hand-typed changes asks confirmation
    noticeEls.noticeBody.value += '\nHand-typed line from Bes.';
    noticeEls.noticeDelivery.value = '2026-11-28';
    let askedConfirm = false;
    sb.confirm = () => { askedConfirm = true; return false; };
    sb.noticeDeliveryChanged();
    check(askedConfirm, 'noticeDeliveryChanged did not prompt confirmation when body was edited by hand');
    check(noticeEls.noticeBody.value.includes('Hand-typed line from Bes.'),
        'noticeDeliveryChanged threw away hand-typed line when confirmation was declined');

    // Confirm accepted rewrites body
    sb.confirm = () => true;
    sb.noticeDeliveryChanged();
    check(sb.extractNoticeDeliveryDate(noticeEls.noticeBody.value) === '2026-11-28',
        'noticeDeliveryChanged did not rewrite template when confirmation was accepted');
    check(!noticeEls.noticeBody.value.includes('Hand-typed line from Bes.'),
        'noticeDeliveryChanged did not replace custom text with new template on confirmed rewrite');

    // loadNoticeCustomers: paging across 1000 items, order_id tie-break, and skippedNoEmail
    const orderSortCalls = [];
    const rangesCalled = [];
    const totalOrders = 1005;
    const allMockOrders = [];
    for (let i = 1; i <= totalOrders; i++) {
        allMockOrders.push({
            order_id: `ORD-${i}`,
            customer_email: i === 1 ? '' : `cust${i % 20}@example.com`,
            customer_name: `Customer ${i % 20}`,
            customer_phone: '0821234567',
            order_date: '2026-10-21',
            total_amount: 100
        });
    }

    sb.supabaseClient = {
        from(table) {
            if (table === 'orders') {
                return {
                    select() { return this; },
                    order(col, opts) { orderSortCalls.push({ col, opts }); return this; },
                    range(from, to) {
                        rangesCalled.push([from, to]);
                        return Promise.resolve({ data: allMockOrders.slice(from, to + 1), error: null });
                    }
                };
            }
            if (table === 'order_items') {
                return {
                    select() { return this; },
                    in() { return this; },
                    order() { return this; },
                    range() { return Promise.resolve({ data: [], error: null }); }
                };
            }
            return { select() { return this; } };
        }
    };

    const loadRes = await sb.loadNoticeCustomers();
    const hasOrderIdTieBreak = orderSortCalls.some(c => c.col === 'order_id' && c.opts?.ascending === true);
    check(hasOrderIdTieBreak, 'loadNoticeCustomers did not use order_id ascending as final tie-break');
    check(rangesCalled.length === 2, `loadNoticeCustomers did not page orders table (expected 2 pages, got ${rangesCalled.length})`);
    check(loadRes.skippedNoEmail === 1, `loadNoticeCustomers did not track skipped orders without email (got ${loadRes.skippedNoEmail})`);
    check(loadRes.customers.length === 20, `loadNoticeCustomers did not aggregate customers correctly across pages (got ${loadRes.customers.length})`);

    if (!bad) ok('round notices: last order listed or refused, all or nothing, round membership, WhatsApp numbers and opt-out');
}

async function herbestelPortalChecks() {
    const vm = require('vm');
    let bad = false;
    const check = (cond, msg) => { if (!cond) { bad = true; fail(`portal herbestel: ${msg}`); } };

    const location = { hostname: 'localhost', search: '', pathname: '/' };
    let alertMsg = null;
    const sb = {
        console: { log() {}, warn() {}, error() {} },
        location,
        window: { location, history: { replaceState() {} }, addEventListener: () => {} },
        document: {
            getElementById: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ classList: { toggle() {}, add() {} } }),
            addEventListener: () => {}
        },
        localStorage: {
            store: {},
            getItem(k) { return this.store[k] || null; },
            setItem(k, v) { this.store[k] = String(v); },
            removeItem(k) { delete this.store[k]; }
        },
        URLSearchParams, Date, Map, Set, setTimeout, encodeURIComponent,
        alert(msg) { alertMsg = msg; }
    };
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(read('delivery-schedule.js'), sb);
    vm.runInContext(read('shared-utils.js'), sb);
    vm.runInContext(read('customer.js'), sb);

    // Setup mock supabaseClient
    let queriedCustomerIdFilter = null;
    let queriedOrderId = null;
    let mockOrders = [{ order_id: 'ORD-99', order_date: '2026-10-21' }];
    let mockOrderItems = [
        { product_name: 'VLERKIES', quantity: 2 },
        { product_name: 'OU_PRODUK', quantity: 1 }
    ];

    sb.mockSupabase = {
        from(table) {
            if (table === 'orders') {
                return {
                    select() { return this; },
                    in(col, vals) { if (col === 'customer_id') queriedCustomerIdFilter = vals; return this; },
                    eq(col, val) { if (col === 'order_id') queriedOrderId = val; return this; },
                    order() { return this; },
                    limit() { return this; },
                    then(res) { return Promise.resolve({ data: mockOrders, error: null }).then(res); }
                };
            }
            if (table === 'order_items') {
                return {
                    select() { return this; },
                    eq() { return this; },
                    then(res) { return Promise.resolve({ data: mockOrderItems, error: null }).then(res); }
                };
            }
            if (table === 'customers') {
                return {
                    select() { return this; },
                    eq() { return Promise.resolve({ data: [{ id: 'cust-mine' }], error: null }); }
                };
            }
            return { select() { return this; } };
        }
    };

    let stepNotes = [];
    const stepEl = {
        querySelector: () => null,
        prepend: (noteEl) => { stepNotes.push(noteEl); }
    };
    const qtyInputs = {
        'qty-VEILIG': { id: 'qty-VEILIG', value: 1 }
    };
    sb.document.getElementById = (id) => (id === 'step-1' || id === 'step-2' ? stepEl : (qtyInputs[id] || null));
    sb.document.querySelectorAll = (sel) => (sel === '[id^="qty-"]' ? Object.values(qtyInputs) : []);

    vm.runInContext(`
        supabaseClient = mockSupabase;
        currentCustomer = { id: 'cust-1', auth_user_id: 'auth-1' };
        getCustomerPricing = () => ({ VLERKIES: 50 });
        cart = { OU_PRODUK_BESTAAND: { quantity: 1 } };
        updateCartDisplay = () => {};
        updateCartSummary = () => {};
        saveCartToStorage = () => {};
    `, sb);

    // 1. Partial availability: VLERKIES added, OU_PRODUK named as not available, old cart replaced
    sb.localStorage.setItem(sb.HERBESTEL_KEY, JSON.stringify({ order: 'ORD-99', at: Date.now() }));
    await sb.restoreLastOrder();

    const getCart = () => vm.runInContext('cart', sb);
    check(queriedCustomerIdFilter && queriedCustomerIdFilter.includes('cust-1'), 'bestelling query did not filter by customer_id');
    check(queriedOrderId === 'ORD-99', 'bestelling query did not filter by wish order id');
    check(getCart().VLERKIES && getCart().VLERKIES.quantity === 2, 'cart did not receive available product');
    check(!getCart().OU_PRODUK_BESTAAND, 'previous cart was not replaced');
    const note1 = stepNotes[stepNotes.length - 1]?.textContent || '';
    check(note1.includes('Nie meer beskikbaar nie, so nie bygesit nie: OU_PRODUK'), 'missing product not named in note');
    check(note1.includes('Dit het vervang wat reeds in jou mandjie was'), 'note did not mention replacement of cart');

    // 2. Nothing available: old cart left untouched, note warns
    vm.runInContext("cart = { BESTAAND: { quantity: 4 } };", sb);
    mockOrderItems = [{ product_name: 'OU_PRODUK', quantity: 2 }];
    sb.localStorage.setItem(sb.HERBESTEL_KEY, JSON.stringify({ order: 'ORD-99', at: Date.now() }));
    stepNotes = [];
    await sb.restoreLastOrder();

    check(getCart().BESTAAND && getCart().BESTAAND.quantity === 4, 'when nothing is available, previous cart was wiped');
    const note2 = stepNotes[stepNotes.length - 1]?.textContent || '';
    check(note2.includes('Niks van jou bestelling van') && note2.includes('is nou beskikbaar nie'), 'nothing available did not show correct warning note');

    // 3. Fallback to alert() when step elements do not exist
    sb.document.getElementById = (id) => (qtyInputs[id] || null);
    alertMsg = null;
    sb.showHerbestelNote('Waarskuwing toets', 'warn');
    check(alertMsg === 'Waarskuwing toets', 'showHerbestelNote did not fall back to alert() when steps missing');

    // 4. Try/catch protection: if setQuantity throws, cart is restored to previousCart and inputs redrawn
    qtyInputs['qty-VEILIG'].value = 1;
    vm.runInContext("cart = { VEILIG: { quantity: 1 } }; setQuantity = () => { throw new Error('onverwagte fout'); };", sb);
    mockOrderItems = [{ product_name: 'VLERKIES', quantity: 1 }];
    sb.localStorage.setItem(sb.HERBESTEL_KEY, JSON.stringify({ order: 'ORD-99', at: Date.now() }));
    alertMsg = null;
    await sb.restoreLastOrder();
    check(getCart().VEILIG && getCart().VEILIG.quantity === 1, 'when refill threw, previous cart was not restored');
    check(qtyInputs['qty-VEILIG'].value === 1, 'when refill threw, quantity inputs were not redrawn to match previous cart');
    check(alertMsg && alertMsg.includes('Ons kon nie jou vorige bestelling herstel nie'), 'when refill threw, warning note/alert was not shown');

    if (!bad) ok('portal refill: missing products named, nothing available leaves cart, cart replacement, customer isolation and error resilience');
}
