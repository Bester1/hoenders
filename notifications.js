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
        .select('customer_email, customer_name, order_date, total_amount')
        .order('order_date', { ascending: true });

    if (error) throw new Error(`Could not read orders: ${error.message}`);

    const byEmail = new Map();
    let noEmail = 0;

    for (const row of data || []) {
        const email = (row.customer_email || '').trim().toLowerCase();
        if (!email) { noEmail++; continue; }

        const entry = byEmail.get(email) || {
            email, name: '', orders: 0, firstOrder: null, lastOrder: null, spend: 0
        };
        entry.orders++;
        entry.spend += Number(row.total_amount) || 0;
        entry.name = row.customer_name || entry.name;   // rows are date-ascending
        entry.firstOrder = entry.firstOrder || row.order_date;
        entry.lastOrder = row.order_date;
        byEmail.set(email, entry);
    }

    const today = new Date();
    noticeCustomers = [...byEmail.values()].map(c => {
        const days = Math.floor((today - new Date(c.lastOrder)) / 86400000);
        return { ...c, daysSinceOrder: days, segment: noticeSegment(days) };
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

/**
 * Personalise a body and append the footer every message must carry.
 *
 * {{naam}} is replaced with the customer's first name, {{epos}} with their
 * address. The footer is added here rather than typed into the body so it
 * cannot be forgotten or edited away.
 */
function renderNoticeEmail(body, customer) {
    const firstName = (customer.name || '').trim().split(/\s+/)[0] || 'daar';
    const personalised = String(body)
        .replace(/\{\{\s*naam\s*\}\}/gi, firstName)
        .replace(/\{\{\s*epos\s*\}\}/gi, customer.email);

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

function noticeVisible() {
    return noticeCustomers.filter(c => {
        if (noticeFilter === 'all') return true;
        if (noticeFilter === 'once') return c.orders === 1;
        return c.segment === noticeFilter;
    });
}

function setNoticeFilter(f) {
    noticeFilter = f;
    document.querySelectorAll('#noticeFilters .filter-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    renderNoticeList();
}

function renderNoticeList() {
    const tbody = document.getElementById('noticeTableBody');
    const rows = noticeVisible();

    tbody.innerHTML = rows.map(c => {
        const out = isOptedOut(c.email);
        const checked = noticeSelected.has(c.email) && !out ? 'checked' : '';
        return `
        <tr class="${out ? 'opted-out' : ''}">
            <td><input type="checkbox" ${checked} ${out ? 'disabled' : ''}
                       onchange="toggleNoticeRecipient('${c.email}', this.checked)"></td>
            <td>${c.name || '—'}</td>
            <td>${c.email}</td>
            <td style="text-align:right">${c.orders}</td>
            <td>${c.lastOrder}</td>
            <td style="text-align:right">R${c.spend.toFixed(2)}</td>
            <td>${out ? '<span class="warn">Afgemeld</span>'
                      : NOTICE_SEGMENT_LABELS[c.segment]}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7">Geen kliënte in hierdie groep nie.</td></tr>';

    document.getElementById('noticeVisibleCount').textContent = rows.length;
    updateNoticeSendButton();
}

function toggleNoticeRecipient(email, on) {
    if (on) noticeSelected.add(email); else noticeSelected.delete(email);
    updateNoticeSendButton();
}

function selectAllNotice(on) {
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
    document.getElementById('noticePreviewBody').textContent =
        `Aan: ${sample.name} <${sample.email}>\nOnderwerp: ${subject}\n\n` +
        renderNoticeEmail(body, sample);
}

/** Send one copy to the account that will be doing the sending. */
async function sendNoticeTest() {
    const gate = canSendNotices();
    if (!gate.ok) { alert(`Stuur is geblokkeer: ${gate.reason}`); return; }
    const subject = document.getElementById('noticeSubject').value;
    const body = document.getElementById('noticeBody').value;
    if (!subject.trim() || !body.trim()) { alert('Vul die onderwerp en die boodskap in.'); return; }

    const me = { name: 'Adriaan', email: NOTICE_REPLY_TO };
    const log = document.getElementById('noticeLog');
    log.textContent = `Stuur toets na ${me.email}...`;
    const ok = await sendEmailViaGoogleScript(me.email, `[TOETS] ${subject}`,
        renderNoticeEmail(body, me));
    log.textContent = ok !== false
        ? `Toets gestuur na ${me.email}. Gaan kyk hoe dit lyk voor jy die lys stuur.`
        : `Toets het gefaal. Moenie die lys stuur voor dit werk nie.`;
}

async function startNoticeSend() {
    const recipients = noticeRecipients();
    const subject = document.getElementById('noticeSubject').value;
    const body = document.getElementById('noticeBody').value;
    const log = document.getElementById('noticeLog');

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

    // The stated deadline is the 15th of the delivery month, which is what the
    // customers are told. DELIVERY_SCHEDULE_2026's own cutoff column is not used
    // for this: it varies month to month and no round has ever been closed on it.
    const cutoff = `${next.delivery.slice(0, 7)}-15`;

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
            `Sperdatum is die 15de, soos die kliënte dit gesê word. ` +
            `Aflewering voorgestel uit die ${suggestion.month}-skedule — ` +
            `<strong>gaan dit na</strong>, die rondtes volg nie die skedule presies nie ` +
            `(die vorige rondte is die 5de afgelewer, nie die 26ste soos daar nie).<br>` +
            `Jy vat gewoonlik bestellings tot ongeveer ` +
            `<strong>${formatAfrikaansDate(suggestion.graceUntil)}</strong> ` +
            `(’n week voor aflewering). Dit staan nie in die e-pos nie — ` +
            `’n aangekondigde uitstel is net ’n later sperdatum.`;
    }
}
