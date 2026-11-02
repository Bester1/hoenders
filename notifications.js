/**
 * Kennisgewings — telling the customer list that a round is open.
 *
 * This is an operational notice to people who already order every month, not a
 * marketing campaign, and the difference drives the design:
 *
 *   * The footer does NOT offer to stop sending. Opting out of "orders are
 *     open" means missing the round, which is not what someone clicking a
 *     footer link expects to be agreeing to. The opt-out is worded as leaving
 *     the order list, and says plainly what that costs.
 *   * The round's dates are never asserted automatically. DELIVERY_SCHEDULE_2026
 *     is a plan, not a record: orders arrive after its stated cutoff every
 *     single month (16 late in February, 22 in June, 18 in August), and its
 *     26 September delivery contradicts the round actually delivered on
 *     5 September. Dates are pre-filled as a suggestion and the sender confirms
 *     them, because a wrong date here reaches sixty-odd people at once.
 *
 * Sends go through sendEmailViaGoogleScript() in script.js — the same Google
 * Apps Script and Gmail account as the invoices and the order confirmations.
 *
 * The list is built from `orders`, aggregated by email. NOT from `customers`,
 * which reads empty under the anon key.
 */

const NOTICE_FROM_NAME = 'Plaas Hoenders';
const NOTICE_REPLY_TO = 'abester7@gmail.com';
const NOTICE_UNSUBSCRIBE_URL = 'https://bester1.github.io/hoenders/afmeld.html';

// Gmail through Apps Script is not a bulk mailer. Sends are sequential with a
// gap between them; this is deliberate, not a leftover debug value.
const NOTICE_SEND_DELAY_MS = 1200;

// Segment boundaries, in days since the customer's last order.
const SEGMENT_ACTIVE_DAYS = 60;
const SEGMENT_LAPSED_DAYS = 180;

let noticeCustomers = [];      // aggregated, one row per email
let noticeOptOuts = null;      // Set of addresses, or null if unreadable
let noticeOptOutError = null;  // why it could not be read

/**
 * Build the customer list from order history.
 *
 * One row per email address: how many orders, when they last ordered, what they
 * have spent. The name used is the one from their most recent order, since
 * people correct their own spelling over time.
 */
async function loadNoticeCustomers() {
    if (!supabaseClient) throw new Error('No database connection');

    const { data, error } = await supabaseClient
        .from('orders')
        .select('order_id, customer_email, customer_name, customer_phone, order_date, total_amount')
        .order('order_date', { ascending: true })
        .order('created_at', { ascending: true });   // two orders on one day: the later one is "last"

    if (error) throw new Error(`Could not read orders: ${error.message}`);

    const byEmail = new Map();
    let noEmail = 0;

    for (const row of data || []) {
        const email = (row.customer_email || '').trim().toLowerCase();
        if (!email) { noEmail++; continue; }

        const entry = byEmail.get(email) || {
            email, name: '', phone: '', orders: 0, firstOrder: null, lastOrder: null, lastOrderId: null, spend: 0
        };
        entry.orders++;
        entry.spend += Number(row.total_amount) || 0;
        entry.name = row.customer_name || entry.name;   // rows are date-ascending
        entry.phone = row.customer_phone || entry.phone;
        entry.firstOrder = entry.firstOrder || row.order_date;
        entry.lastOrder = row.order_date;
        entry.lastOrderId = row.order_id;
        byEmail.set(email, entry);
    }

    const today = new Date();
    const lastItems = await loadLastOrderItems([...byEmail.values()].map(c => c.lastOrderId));
    noticeCustomers = [...byEmail.values()].map(c => {
        const days = Math.floor((today - new Date(c.lastOrder)) / 86400000);
        return { ...c, daysSinceOrder: days, segment: noticeSegment(days), lastItems: lastItems.get(c.lastOrderId) || [] };
    }).sort((a, b) =>
        // Most frequent first, which is the order to work down when deciding who
        // to tell. Ties break on who ordered most recently, then on spend, so the
        // list is stable rather than in whatever order the rows came back.
        b.orders - a.orders ||
        (a.daysSinceOrder - b.daysSinceOrder) ||
        b.spend - a.spend);

    if (noEmail) {
        console.warn(`${noEmail} order row(s) carry no email address and are not on the list`);
    }
    return { customers: noticeCustomers, skippedNoEmail: noEmail };
}

/**
 * What each customer ordered last time, for {{vorige}} and the "Weer dieselfde?"
 * notice: order_id -> [{ product_name, quantity }]. Every line of the order, the
 * same lines the portal's ?herbestel link reads back into the cart (today all
 * order_items rows are source customer_selection: the customer's own picks).
 */
async function loadLastOrderItems(orderIds) {
    const ids = orderIds.filter(Boolean);
    const byOrder = new Map();
    const PAGE = 1000;   // PostgREST's max rows: more than this comes back cut short, without an error
    for (let i = 0; i < ids.length; i += 100) {      // keep the URL of each request short
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabaseClient
                .from('order_items')
                .select('id, order_id, product_name, quantity')
                .in('order_id', ids.slice(i, i + 100))
                .order('id')
                .range(from, from + PAGE - 1);
            if (error) throw new Error(`Could not read order lines: ${error.message}`);
            for (const row of data || []) {
                if (!(row.quantity > 0)) continue;
                const lines = byOrder.get(row.order_id) || [];
                // Two lines for one product are one product to the customer (the portal adds them up too).
                const same = lines.find(l => l.product_name === row.product_name);
                if (same) same.quantity += row.quantity;
                else lines.push({ product_name: row.product_name, quantity: row.quantity });
                byOrder.set(row.order_id, lines);
            }
            if (!data || data.length < PAGE) break;
        }
    }
    return byOrder;
}

function noticeSegment(days) {
    if (days <= SEGMENT_ACTIVE_DAYS) return 'active';
    if (days <= SEGMENT_LAPSED_DAYS) return 'lapsed';
    return 'dormant';
}

const NOTICE_SEGMENT_LABELS = {
    active: 'Aktief',
    lapsed: 'Sluimerend',
    dormant: 'Weg'
};

/**
 * Read the opt-out list.
 *
 * Leaves noticeOptOuts as null on any failure, INCLUDING a missing table.
 * Callers must treat null as "unknown", never as "nobody has opted out" —
 * canSendNotices() below is the only thing that decides.
 */
async function loadNoticeOptOuts() {
    noticeOptOuts = null;
    noticeOptOutError = null;

    if (!supabaseClient) {
        noticeOptOutError = 'No database connection.';
        return;
    }

    const { data, error } = await supabaseClient
        .from('notification_optouts')
        .select('email');

    if (error) {
        noticeOptOutError = error.code === '42P01'
            ? 'The notification_optouts table does not exist yet. Run the SQL in ' +
              'NOTICE_SETUP.md in the Supabase SQL editor, then reload.'
            : `Could not read the opt-out list: ${error.message}`;
        return;
    }

    noticeOptOuts = new Set((data || []).map(r => (r.email || '').trim().toLowerCase()));
}

/**
 * May a bulk send proceed at all?
 *
 * The opt-out list being unreadable is a hard stop, not a warning. There is no
 * safe default: assuming nobody opted out mails the people who asked not to be
 * mailed, and that cannot be undone by fixing it afterwards.
 */
function canSendNotices() {
    if (noticeOptOuts === null) {
        return { ok: false, reason: noticeOptOutError || 'The opt-out list has not been loaded.' };
    }
    return { ok: true };
}

function isOptedOut(email) {
    return noticeOptOuts !== null && noticeOptOuts.has((email || '').trim().toLowerCase());
}

// The portal fills the cart with the customer's last order when it is opened
// from this link (customer.js, restoreLastOrder).
const HERBESTEL_URL = 'https://bester1.github.io/hoenders/customer-portal.html?herbestel=1';

// The link names the order {{vorige}} listed, so the cart gets exactly that one
// (a customer can have more than one customer record, each with its own orders).
const herbestelLink = (customer) => customer.lastOrderId
    ? `${HERBESTEL_URL}&bestelling=${encodeURIComponent(customer.lastOrderId)}` : HERBESTEL_URL;

const usesLastOrder = (body) => /\{\{\s*vorige\s*\}\}/i.test(String(body || ''));

/**
 * "  • 4 × VLERKIES", one line per product. The admin page doesn't load
 * shared-utils.js, so these are the price-table names (as on the invoices), not
 * the portal's display names; getProductDisplayInfo is used if it is ever loaded.
 */
function lastOrderLines(customer) {
    return (customer.lastItems || []).map(it => {
        const name = typeof getProductDisplayInfo === 'function'
            ? getProductDisplayInfo(it.product_name).displayName : it.product_name;
        return `  • ${it.quantity} × ${name}`;
    }).join('\n');
}

/**
 * {{naam}} -> first name, {{epos}} -> address, {{vorige}} -> their last order,
 * {{herbestel}} -> the link that puts that order back in their cart.
 * A {{vorige}} for someone whose last order has no lines is an error, never a
 * blank: "Laas het jy bestel:" followed by nothing reads as a broken email.
 */
function personaliseNotice(body, customer) {
    const firstName = (customer.name || '').trim().split(/\s+/)[0] || 'daar';
    if (usesLastOrder(body) && !(customer.lastItems || []).length) {
        throw new Error(`${customer.email}: hul laaste bestelling het geen produkte nie, so {{vorige}} kan nie ingevul word nie.`);
    }
    return String(body)
        .replace(/\{\{\s*naam\s*\}\}/gi, firstName)
        .replace(/\{\{\s*epos\s*\}\}/gi, customer.email)
        .replace(/\{\{\s*vorige\s*\}\}/gi, () => lastOrderLines(customer))
        .replace(/\{\{\s*herbestel\s*\}\}/gi, herbestelLink(customer));
}

/**
 * Personalise a body and append the footer every message must carry.
 *
 * {{naam}} is replaced with the customer's first name, {{epos}} with their
 * address. The footer is added here rather than typed into the body so it
 * cannot be forgotten or edited away.
 */
function renderNoticeEmail(body, customer) {
    const personalised = personaliseNotice(body, customer);

    const unsubscribe = `${NOTICE_UNSUBSCRIBE_URL}?e=${encodeURIComponent(customer.email)}`;

    return `${personalised}

—
${NOTICE_FROM_NAME}
Antwoord gerus op hierdie e-pos, of skakel 079 616 7761.

Jy kry hierdie e-pos omdat jy op die Plaas Hoenders bestellys is.
Wil jy heeltemal van die bestellys afkom? Dan sal jy ook nie weer hoor
wanneer 'n nuwe rondte oop is nie: ${unsubscribe}`;
}

/**
 * Send one campaign, sequentially.
 *
 * Returns a per-recipient result rather than a count, so a partial send can be
 * seen for what it is. onProgress is called after every address.
 */
async function sendNoticeBatch(recipients, subject, body, onProgress) {
    const gate = canSendNotices();
    if (!gate.ok) throw new Error(gate.reason);

    if (!subject || !subject.trim()) throw new Error('The email has no subject.');
    if (!body || !body.trim()) throw new Error('The email has no body.');
    if (!recipients.length) throw new Error('No recipients selected.');

    // All or nothing: a send that stops halfway because one customer has no
    // previous order has already mailed the first half.
    if (usesLastOrder(body)) {
        const empty = recipients.filter(c => !(c.lastItems || []).length);
        if (empty.length) {
            throw new Error(`${empty.length} gekose kliënt(e) se laaste bestelling het geen produkte nie: ` +
                `${empty.map(c => c.email).join(', ')}. Haal hulle uit die keuse.`);
        }
    }

    // Re-check every recipient at send time. The list on screen may have been
    // built before someone unsubscribed.
    const blocked = recipients.filter(c => isOptedOut(c.email));
    if (blocked.length) {
        throw new Error(`${blocked.length} selected recipient(s) have opted out: ` +
            `${blocked.map(c => c.email).join(', ')}. Reload the list.`);
    }

    const results = [];
    for (let i = 0; i < recipients.length; i++) {
        const customer = recipients[i];
        try {
            const sent = await sendEmailViaGoogleScript(
                customer.email, subject, renderNoticeEmail(body, customer));
            results.push({ email: customer.email, name: customer.name, ok: sent !== false });
        } catch (e) {
            results.push({ email: customer.email, name: customer.name, ok: false, error: e.message });
        }

        if (typeof onProgress === 'function') {
            onProgress(i + 1, recipients.length, results[results.length - 1]);
        }
        if (i < recipients.length - 1) {
            await new Promise(r => setTimeout(r, NOTICE_SEND_DELAY_MS));
        }
    }
    return results;
}

// Exported for the validator and for tests.
if (typeof globalThis !== 'undefined') {
    globalThis.noticeSegment = noticeSegment;
    globalThis.renderNoticeEmail = renderNoticeEmail;
    globalThis.personaliseNotice = personaliseNotice;
    globalThis.orderedThisRound = orderedThisRound;
    globalThis.scheduledRound = scheduledRound;
    globalThis.sendNoticeBatch = sendNoticeBatch;
    globalThis.loadLastOrderItems = loadLastOrderItems;
    globalThis.noticeWhatsAppLink = noticeWhatsAppLink;
    globalThis.canSendNotices = canSendNotices;
}

/* ------------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------------ */

let noticeFilter = 'all';
const noticeSelected = new Set();

async function initNotices() {
    const status = document.getElementById('noticeStatus');
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Laai kliëntelys...';
    try {
        await loadNoticeOptOuts();          // before the list, so rows render correctly
        const { customers, skippedNoEmail } = await loadNoticeCustomers();
        renderNoticeList();
        prefillRoundDates();
        const gate = canSendNotices();
        status.innerHTML = gate.ok
            ? `<span class="ok">${customers.length} kliënte gelaai` +
              `${noticeOptOuts.size ? `, ${noticeOptOuts.size} afgemeld` : ''}` +
              `${skippedNoEmail ? `, ${skippedNoEmail} bestelling(s) sonder e-pos oorgeslaan` : ''}.</span>`
            : `<span class="warn"><i class="fas fa-exclamation-triangle"></i> ` +
              `Stuur is geblokkeer: ${gate.reason}</span>`;
        updateNoticeSendButton();
    } catch (e) {
        status.innerHTML = `<span class="warn">Kon nie die lys laai nie: ${e.message}</span>`;
    }
}

/**
 * The scheduled round a typed delivery date stands for: the one closest to it,
 * within ROUND_MATCH_DAYS (vans run a few days early or late). null when the
 * date is nowhere near the schedule.
 */
const ROUND_MATCH_DAYS = 10;
function scheduledRound(deliveryISO) {
    if (!deliveryISO || typeof DELIVERY_SCHEDULE_2026 === 'undefined') return null;
    const want = new Date(deliveryISO + 'T00:00:00');
    let best = null, bestGap = Infinity;
    for (const r of DELIVERY_SCHEDULE_2026) {
        const gap = Math.abs(new Date(r.delivery + 'T00:00:00') - want) / 86400000;
        if (gap < bestGap) { best = r; bestGap = gap; }
    }
    return bestGap <= ROUND_MATCH_DAYS ? best : null;
}

/**
 * Has this customer already ordered for the round delivering on `deliveryISO`?
 * Their last order belongs to that round by the same rule every other screen
 * uses (deliveryRoundForDate, with Bes's week of grace). null when the date
 * matches no scheduled round: then nobody can be sorted, and the "not ordered
 * yet" list shows no one rather than everyone.
 */
function orderedThisRound(customer, deliveryISO) {
    const round = scheduledRound(deliveryISO);
    if (!round) return null;
    const theirs = customer.lastOrder ? deliveryRoundForDate(customer.lastOrder) : null;
    return !!theirs && theirs.delivery === round.delivery;
}

function noticeDeliveryDate() {
    const typed = document.getElementById('noticeDelivery')?.value;
    return typed || suggestRoundDates()?.delivery || null;
}

function noticeVisible() {
    const delivery = noticeFilter === 'todo' ? noticeDeliveryDate() : null;
    return noticeCustomers.filter(c => {
        if (noticeFilter === 'all') return true;
        if (noticeFilter === 'once') return c.orders === 1;
        // Not ordered yet this round, but ordered in the last six months: the
        // people a reminder is for. Older than that is a different message.
        if (noticeFilter === 'todo') return c.segment !== 'dormant' && orderedThisRound(c, delivery) === false;
        return c.segment === noticeFilter;
    });
}

function setNoticeFilter(f) {
    noticeFilter = f;
    document.querySelectorAll('#noticeFilters .filter-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    renderNoticeList();
}

/**
 * Under "not ordered yet", drop ticked customers it hides: ticking "everyone"
 * and then switching to it must not keep the people who did order.
 */
function pruneNoticeSelection() {
    if (noticeFilter !== 'todo') return;   // the other filters keep ticks across them, as before
    const visible = new Set(noticeVisible().map(c => c.email));
    for (const email of [...noticeSelected]) if (!visible.has(email)) noticeSelected.delete(email);
}

/** The delivery date changed: who has "not ordered yet" changed with it. */
function noticeDeliveryChanged() {
    renderNoticeList();
}

// Names and addresses are typed by customers: never put them in the page as HTML.
const noticeEsc = (v) => String(v ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function renderNoticeList() {
    const tbody = document.getElementById('noticeTableBody');
    pruneNoticeSelection();
    const rows = noticeVisible();
    const unmatched = noticeFilter === 'todo' && !scheduledRound(noticeDeliveryDate());

    tbody.innerHTML = unmatched
        ? `<tr><td colspan="8">Die afleweringsdatum pas by geen rondte in die skedule nie, so ons kan nie sê wie al bestel het nie.</td></tr>`
        : rows.map(c => {
        const out = isOptedOut(c.email);
        const checked = noticeSelected.has(c.email) && !out ? 'checked' : '';
        const email = noticeEsc(c.email);
        const wa = !out && canSendNotices().ok && waNumber(c.phone)
            ? `<button class="btn-secondary btn-small" title="Stuur die boodskap op WhatsApp"
                       data-email="${email}" onclick="openNoticeWhatsApp(this.dataset.email)"><i class="fab fa-whatsapp"></i></button>` : '';
        return `
        <tr class="${out ? 'opted-out' : ''}">
            <td><input type="checkbox" ${checked} ${out ? 'disabled' : ''}
                       data-email="${email}" onchange="toggleNoticeRecipient(this.dataset.email, this.checked)"></td>
            <td>${noticeEsc(c.name) || '—'}</td>
            <td>${email}</td>
            <td style="text-align:right">${c.orders}</td>
            <td>${noticeEsc(c.lastOrder)}</td>
            <td style="text-align:right">R${c.spend.toFixed(2)}</td>
            <td>${out ? '<span class="warn">Afgemeld</span>'
                      : NOTICE_SEGMENT_LABELS[c.segment]}</td>
            <td>${wa}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="8">Geen kliënte in hierdie groep nie.</td></tr>';

    document.getElementById('noticeVisibleCount').textContent = unmatched ? 0 : rows.length;
    updateNoticeSendButton();
}

/* ------------------------------------------------------------------------ *
 * WhatsApp, one customer at a time
 *
 * Bes's customers live on WhatsApp more than in their inbox. Each row's button
 * opens WhatsApp on his phone or computer with the same personalised message,
 * and he presses send himself: nothing goes out from here. It carries the same
 * afmeld link as the email footer, so a customer who leaves is off both.
 * ------------------------------------------------------------------------ */

/** 082 123 4567 / +27 82 123 4567 -> 27821234567, or null. */
function waNumber(phone) {
    let d = String(phone || '').replace(/[^\d]/g, '');
    if (d.startsWith('0027')) d = d.slice(2);
    if (/^0\d{9}$/.test(d)) d = '27' + d.slice(1);
    return /^27\d{9}$/.test(d) ? d : null;
}

function noticeWhatsAppLink(body, customer) {
    const number = waNumber(customer.phone);
    if (!number) return null;
    // The same afmeld page as the email footer: it writes to notification_optouts,
    // which isOptedOut() checks, so leaving by WhatsApp sticks too.
    const text = `${personaliseNotice(body, customer)}

Wil jy nie meer van ons hoor nie? Tik hier: ${NOTICE_UNSUBSCRIBE_URL}?e=${encodeURIComponent(customer.email)}`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function openNoticeWhatsApp(email) {
    const customer = noticeCustomers.find(c => c.email === email);
    const body = document.getElementById('noticeBody').value;
    if (!customer) return;
    if (!body.trim()) { alert('Skryf eers die boodskap (of klik "Weer dieselfde?").'); return; }
    // Same gate as the email: an unreadable opt-out list is not an empty one.
    const gate = canSendNotices();
    if (!gate.ok) { alert(`Stuur is geblokkeer: ${gate.reason}`); return; }
    if (isOptedOut(customer.email)) { alert('Hierdie kliënt het afgemeld.'); return; }
    try {
        window.open(noticeWhatsAppLink(body, customer), '_blank', 'noopener');
        addActivity(`WhatsApp oopgemaak vir ${customer.name || customer.email}`);
    } catch (e) {
        alert(e.message);
    }
}

function toggleNoticeRecipient(email, on) {
    if (on) noticeSelected.add(email); else noticeSelected.delete(email);
    updateNoticeSendButton();
}

function selectAllNotice(on) {
    if (on && noticeFilter === 'todo' && !scheduledRound(noticeDeliveryDate())) return;
    for (const c of noticeVisible()) {
        if (isOptedOut(c.email)) continue;       // never selectable
        if (on) noticeSelected.add(c.email); else noticeSelected.delete(c.email);
    }
    renderNoticeList();
}

function noticeRecipients() {
    return noticeCustomers.filter(c => noticeSelected.has(c.email) && !isOptedOut(c.email));
}

function updateNoticeSendButton() {
    const n = noticeRecipients().length;
    const gate = canSendNotices();
    const btn = document.getElementById('noticeSendBtn');
    if (!btn) return;
    btn.disabled = n === 0 || !gate.ok;
    btn.innerHTML = `<i class="fas fa-paper-plane"></i> Stuur aan ${n} kliënt${n === 1 ? '' : 'e'}`;
    document.getElementById('noticeSelectedCount').textContent = n;
}

function previewNoticeEmail() {
    const body = document.getElementById('noticeBody').value;
    const subject = document.getElementById('noticeSubject').value;
    const sample = noticeRecipients()[0] || noticeCustomers[0];
    if (!sample) { alert('Geen kliënte gelaai nie.'); return; }
    document.getElementById('noticePreview').style.display = 'block';
    try {
        document.getElementById('noticePreviewBody').textContent =
            `Aan: ${sample.name} <${sample.email}>\nOnderwerp: ${subject}\n\n` +
            renderNoticeEmail(body, sample);
    } catch (e) {
        document.getElementById('noticePreviewBody').textContent = e.message;
    }
}

/** Send one copy to the account that will be doing the sending. */
async function sendNoticeTest() {
    const gate = canSendNotices();
    if (!gate.ok) { alert(`Stuur is geblokkeer: ${gate.reason}`); return; }
    const subject = document.getElementById('noticeSubject').value;
    const body = document.getElementById('noticeBody').value;
    if (!subject.trim() || !body.trim()) { alert('Vul die onderwerp en die boodskap in.'); return; }

    // With {{vorige}} the test is written as the first selected customer (their
    // name and last order) but goes to Bes, so he sees exactly what they'll get.
    const sample = usesLastOrder(body) ? (noticeRecipients()[0] || null) : null;
    if (usesLastOrder(body) && !sample) { alert('Kies eers ten minste een kliënt: die toets wys hul vorige bestelling.'); return; }
    const me = sample ? { ...sample, email: NOTICE_REPLY_TO } : { name: 'Adriaan', email: NOTICE_REPLY_TO };
    const log = document.getElementById('noticeLog');
    log.textContent = `Stuur toets na ${me.email}${sample ? ` (soos ${sample.name} dit sal kry)` : ''}...`;
    let text;
    try { text = renderNoticeEmail(body, me); } catch (e) { log.textContent = e.message; return; }
    const ok = await sendEmailViaGoogleScript(me.email, `[TOETS] ${subject}`, text);
    log.textContent = ok !== false
        ? `Toets gestuur na ${me.email}. Gaan kyk hoe dit lyk voor jy die lys stuur.`
        : `Toets het gefaal. Moenie die lys stuur voor dit werk nie.`;
}

async function startNoticeSend() {
    const recipients = noticeRecipients();
    const subject = document.getElementById('noticeSubject').value;
    const body = document.getElementById('noticeBody').value;
    const log = document.getElementById('noticeLog');

    // "Wil jy weer dieselfde bestel?" to someone who already ordered this round
    // reads as if their order went missing.
    if (usesLastOrder(body)) {
        const already = recipients.filter(c => orderedThisRound(c, noticeDeliveryDate()) === true);
        if (already.length) {
            alert(`${already.length} gekose kliënt(e) het al vir hierdie rondte bestel: ` +
                `${already.map(c => c.name || c.email).join(', ')}. Haal hulle uit die keuse.`);
            return;
        }
    }

    // Announcing an open list while the portal is closed produces a wave of
    // replies that arrive after the emails have gone out.
    const portal = await portalAcceptingOrders();
    let portalWarning = '';
    if (!portal.known) {
        portalWarning = `\n\nLET WEL: kon nie vasstel of die portaal oop is nie ` +
            `(${portal.reason}). Gaan kyk self voor jy stuur.`;
    } else if (!portal.open) {
        portalWarning = `\n\nWAARSKUWING: die portaal is TOE. Kliënte wat op die ` +
            `skakel klik sal nie kan bestel nie.`;
    }

    const proceed = confirm(
        `Stuur "${subject}"\n\naan ${recipients.length} kliënt(e)?\n\n` +
        `Dit gaan deur jou Gmail, een vir een, ongeveer ` +
        `${Math.ceil(recipients.length * NOTICE_SEND_DELAY_MS / 1000 / 60)} minuut(e). ` +
        `Dit kan nie teruggetrek word nie.` + portalWarning);
    if (!proceed) return;

    const btn = document.getElementById('noticeSendBtn');
    btn.disabled = true;
    log.textContent = '';

    try {
        const results = await sendNoticeBatch(recipients, subject, body,
            (done, total, last) => {
                log.textContent += `${done}/${total}  ${last.ok ? 'OK  ' : 'FOUT'}  ` +
                    `${last.email}${last.error ? '  — ' + last.error : ''}\n`;
                log.scrollTop = log.scrollHeight;
            });

        const failed = results.filter(r => !r.ok);
        log.textContent += `\nKlaar. ${results.length - failed.length} gestuur, ${failed.length} gefaal.\n`;
        if (failed.length) {
            log.textContent += `Gefaal: ${failed.map(f => f.email).join(', ')}\n`;
        }
        addActivity(`Kennisgewingss-e-pos "${subject}" — ${results.length - failed.length} gestuur, ${failed.length} gefaal`);
    } catch (e) {
        log.textContent += `\nGESTOP: ${e.message}\n`;
    } finally {
        updateNoticeSendButton();
    }
}

/* ------------------------------------------------------------------------ *
 * The "orders are open" notice
 * ------------------------------------------------------------------------ */

/**
 * Suggest this round's dates from the schedule.
 *
 * Returns them clearly labelled as a SUGGESTION. DELIVERY_SCHEDULE_2026 is a
 * plan and the rounds do not actually run to it, so nothing here may be sent
 * without a human confirming the two dates.
 */
function suggestRoundDates() {
    if (typeof DELIVERY_SCHEDULE_2026 === 'undefined') return null;
    const today = new Date().toISOString().split('T')[0];
    const next = DELIVERY_SCHEDULE_2026.find(r => r.delivery >= today);
    if (!next) return null;

    // Take the cutoff from the schedule. It is the authoritative source now
    // that the table matches Ansie's own spreadsheet, and it is genuinely a
    // 15th for the October round — but of SEPTEMBER, not October. A rule of
    // "the 15th of the delivery month" produces a deadline AFTER the delivery
    // for every round that closes in the previous month, which is most of them.
    const cutoff = next.cutoff;

    // The date orders actually stop being accepted — a week before delivery,
    // which is the grace Bes gives in practice. Shown to the sender only. It is
    // deliberately NOT in the customer email: an advertised grace period is just
    // a later deadline, and then that one needs a grace period too.
    const grace = new Date(next.delivery + 'T00:00:00');
    grace.setDate(grace.getDate() - 7);

    return {
        month: next.month,
        cutoff,
        delivery: next.delivery,
        tentative: next.tentative === true,
        graceUntil: grace.toISOString().split('T')[0],
        scheduleCutoff: next.cutoff
    };
}

function formatAfrikaansDate(iso) {
    const months = ['Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie',
        'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** The default body. The dates come from the two inputs, never from the schedule. */
function buildRoundNoticeBody(cutoffISO, deliveryISO) {
    return `Hallo {{naam}},

Die bestellys vir die volgende rondte is nou oop.

Bestel voor ${formatAfrikaansDate(cutoffISO)}.
Aflewering is ${formatAfrikaansDate(deliveryISO)}.

Bestel hier: https://bester1.github.io/hoenders/customer-portal.html

Onthou die pryse is per kg, so die finale bedrag word bereken sodra alles
geweeg is. Jy kry 'n faktuur met die presiese gewigte voor aflewering.

Laat weet gerus as jy iets spesifieks soek.`;
}

/**
 * "Weer dieselfde?": the round notice with the customer's last order in it and
 * a link that puts that order back in their cart. Meant for the "Nog nie
 * bestel nie" group, a few days before the cutoff.
 */
function buildReorderNoticeBody(cutoffISO, deliveryISO) {
    return `Hallo {{naam}},

Die bestellys vir die volgende rondte is oop. Bestel voor ${formatAfrikaansDate(cutoffISO)};
aflewering is ${formatAfrikaansDate(deliveryISO)}.

Laas het jy bestel:
{{vorige}}

Wil jy weer dieselfde hê? Hierdie skakel sit jou vorige bestelling reg in jou
mandjie, en jy kan nog enigiets verander voor jy bestel:
{{herbestel}}

Onthou die pryse is per kg, so die finale bedrag word bereken sodra alles
geweeg is.`;
}

function fillReorderNotice() {
    const cutoff = document.getElementById('noticeCutoff').value;
    const delivery = document.getElementById('noticeDelivery').value;
    if (!cutoff || !delivery) {
        alert('Vul eers die sluitingsdatum en die afleweringsdatum in.');
        return;
    }
    if (delivery < cutoff) {
        alert('Die afleweringsdatum is voor die sluitingsdatum. Kyk weer.');
        return;
    }
    document.getElementById('noticeSubject').value = '🐔 Plaas Hoenders — wil jy weer dieselfde bestel?';
    document.getElementById('noticeBody').value = buildReorderNoticeBody(cutoff, delivery);
}

function fillRoundNotice() {
    const cutoff = document.getElementById('noticeCutoff').value;
    const delivery = document.getElementById('noticeDelivery').value;
    if (!cutoff || !delivery) {
        alert('Vul eers die sluitingsdatum en die afleweringsdatum in.');
        return;
    }
    if (delivery < cutoff) {
        alert('Die afleweringsdatum is voor die sluitingsdatum. Kyk weer.');
        return;
    }
    document.getElementById('noticeSubject').value =
        `🐔 Plaas Hoenders — bestellings oop tot ${formatAfrikaansDate(cutoff)}`;
    document.getElementById('noticeBody').value = buildRoundNoticeBody(cutoff, delivery);
}

/**
 * Is the portal actually accepting orders?
 *
 * Telling sixty people the list is open while the portal is closed produces
 * sixty confused replies, and they arrive after the emails have gone.
 */
async function portalAcceptingOrders() {
    if (!supabaseClient) return { known: false, reason: 'no database connection' };
    const { data, error } = await supabaseClient
        .from('settings').select('orders_open').eq('id', 'main').single();
    if (error) return { known: false, reason: error.message };
    return { known: true, open: data.orders_open === true };
}

/**
 * Pre-fill the two date fields, and say where the numbers came from.
 *
 * The schedule is a plan the rounds do not actually follow, so the source is
 * printed next to the inputs rather than left to be assumed correct. A date
 * typed over by hand is the intended outcome, not a fallback.
 */
function prefillRoundDates() {
    const suggestion = suggestRoundDates();
    const note = document.getElementById('noticeDateSource');
    if (!suggestion) {
        if (note) note.textContent = 'Geen datum in die skedule nie — vul dit self in.';
        return;
    }
    const cutoff = document.getElementById('noticeCutoff');
    const delivery = document.getElementById('noticeDelivery');
    if (cutoff && !cutoff.value) cutoff.value = suggestion.cutoff;
    if (delivery && !delivery.value) delivery.value = suggestion.delivery;
    if (note) {
        note.innerHTML =
            `Uit Ansie se eie 2026-skedule (${suggestion.month}).` +
            (suggestion.tentative
                ? ` <strong>Sy het hierdie datum nog nie vasgemaak nie</strong> — ` +
                  `haar blad sê "21 of 28 November". Bevestig by haar voor jy stuur.`
                : ``) + `<br>` +
            `Jy vat gewoonlik bestellings tot ongeveer ` +
            `<strong>${formatAfrikaansDate(suggestion.graceUntil)}</strong> ` +
            `(’n week voor aflewering). Dit staan nie in die e-pos nie — ` +
            `’n aangekondigde uitstel is net ’n later sperdatum.`;
    }
}
