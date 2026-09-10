/**
 * Bemarking — bulk email to the customer list.
 *
 * Sends through the SAME path as invoices and confirmations
 * (sendEmailViaGoogleScript in script.js -> Google Apps Script -> Gmail), so
 * there is one sender identity and one place where sending can break.
 *
 * The list is built from the `orders` table, aggregated by email address. It is
 * NOT built from `customers`, which reads empty under the anon key.
 *
 * Two rules this file exists to enforce:
 *
 *   1. A send is blocked outright if the opt-out list cannot be read. An
 *      unreadable opt-out list is not an empty one, and mailing someone who
 *      asked to be left alone is not a mistake you can take back. Same shape as
 *      the reconciliation guard in script.js: absence of evidence must not
 *      render as success.
 *   2. Every message carries the sender's identity and a working unsubscribe
 *      link, appended here rather than left to whoever writes the body.
 */

const MARKETING_FROM_NAME = 'Plaas Hoenders';
const MARKETING_REPLY_TO = 'abester7@gmail.com';
const MARKETING_UNSUBSCRIBE_URL = 'https://bester1.github.io/hoenders/afmeld.html';

// Gmail through Apps Script is not a bulk mailer. Sends are sequential with a
// gap between them; this is deliberate, not a leftover debug value.
const MARKETING_SEND_DELAY_MS = 1200;

// Segment boundaries, in days since the customer's last order.
const SEGMENT_ACTIVE_DAYS = 60;
const SEGMENT_LAPSED_DAYS = 180;

let marketingCustomers = [];      // aggregated, one row per email
let marketingOptOuts = null;      // Set of addresses, or null if unreadable
let marketingOptOutError = null;  // why it could not be read

/**
 * Build the customer list from order history.
 *
 * One row per email address: how many orders, when they last ordered, what they
 * have spent. The name used is the one from their most recent order, since
 * people correct their own spelling over time.
 */
async function loadMarketingCustomers() {
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
    marketingCustomers = [...byEmail.values()].map(c => {
        const days = Math.floor((today - new Date(c.lastOrder)) / 86400000);
        return { ...c, daysSinceOrder: days, segment: marketingSegment(days) };
    }).sort((a, b) => b.orders - a.orders);

    if (noEmail) {
        console.warn(`${noEmail} order row(s) carry no email address and are not on the list`);
    }
    return { customers: marketingCustomers, skippedNoEmail: noEmail };
}

function marketingSegment(days) {
    if (days <= SEGMENT_ACTIVE_DAYS) return 'active';
    if (days <= SEGMENT_LAPSED_DAYS) return 'lapsed';
    return 'dormant';
}

const MARKETING_SEGMENT_LABELS = {
    active: 'Aktief',
    lapsed: 'Sluimerend',
    dormant: 'Weg'
};

/**
 * Read the opt-out list.
 *
 * Leaves marketingOptOuts as null on any failure, INCLUDING a missing table.
 * Callers must treat null as "unknown", never as "nobody has opted out" —
 * canSendMarketing() below is the only thing that decides.
 */
async function loadMarketingOptOuts() {
    marketingOptOuts = null;
    marketingOptOutError = null;

    if (!supabaseClient) {
        marketingOptOutError = 'No database connection.';
        return;
    }

    const { data, error } = await supabaseClient
        .from('marketing_optouts')
        .select('email');

    if (error) {
        marketingOptOutError = error.code === '42P01'
            ? 'The marketing_optouts table does not exist yet. Run the SQL in ' +
              'MARKETING_SETUP.md in the Supabase SQL editor, then reload.'
            : `Could not read the opt-out list: ${error.message}`;
        return;
    }

    marketingOptOuts = new Set((data || []).map(r => (r.email || '').trim().toLowerCase()));
}

/**
 * May a bulk send proceed at all?
 *
 * The opt-out list being unreadable is a hard stop, not a warning. There is no
 * safe default: assuming nobody opted out mails the people who asked not to be
 * mailed, and that cannot be undone by fixing it afterwards.
 */
function canSendMarketing() {
    if (marketingOptOuts === null) {
        return { ok: false, reason: marketingOptOutError || 'The opt-out list has not been loaded.' };
    }
    return { ok: true };
}

function isOptedOut(email) {
    return marketingOptOuts !== null && marketingOptOuts.has((email || '').trim().toLowerCase());
}

/**
 * Personalise a body and append the footer every message must carry.
 *
 * {{naam}} is replaced with the customer's first name, {{epos}} with their
 * address. The footer is added here rather than typed into the body so it
 * cannot be forgotten or edited away.
 */
function renderMarketingEmail(body, customer) {
    const firstName = (customer.name || '').trim().split(/\s+/)[0] || 'daar';
    const personalised = String(body)
        .replace(/\{\{\s*naam\s*\}\}/gi, firstName)
        .replace(/\{\{\s*epos\s*\}\}/gi, customer.email);

    const unsubscribe = `${MARKETING_UNSUBSCRIBE_URL}?e=${encodeURIComponent(customer.email)}`;

    return `${personalised}

—
${MARKETING_FROM_NAME}
Antwoord op hierdie e-pos, of skakel 079 616 7761.

Jy kry hierdie e-pos omdat jy al by Plaas Hoenders bestel het.
Wil jy nie meer e-posse ontvang nie? Klik hier: ${unsubscribe}`;
}

/**
 * Send one campaign, sequentially.
 *
 * Returns a per-recipient result rather than a count, so a partial send can be
 * seen for what it is. onProgress is called after every address.
 */
async function sendMarketingCampaign(recipients, subject, body, onProgress) {
    const gate = canSendMarketing();
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
                customer.email, subject, renderMarketingEmail(body, customer));
            results.push({ email: customer.email, name: customer.name, ok: sent !== false });
        } catch (e) {
            results.push({ email: customer.email, name: customer.name, ok: false, error: e.message });
        }

        if (typeof onProgress === 'function') {
            onProgress(i + 1, recipients.length, results[results.length - 1]);
        }
        if (i < recipients.length - 1) {
            await new Promise(r => setTimeout(r, MARKETING_SEND_DELAY_MS));
        }
    }
    return results;
}

// Exported for the validator and for tests.
if (typeof globalThis !== 'undefined') {
    globalThis.marketingSegment = marketingSegment;
    globalThis.renderMarketingEmail = renderMarketingEmail;
    globalThis.canSendMarketing = canSendMarketing;
}

/* ------------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------------ */

let marketingFilter = 'all';
const marketingSelected = new Set();

async function initMarketing() {
    const status = document.getElementById('marketingStatus');
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Laai kliëntelys...';
    try {
        await loadMarketingOptOuts();          // before the list, so rows render correctly
        const { customers, skippedNoEmail } = await loadMarketingCustomers();
        renderMarketingList();
        const gate = canSendMarketing();
        status.innerHTML = gate.ok
            ? `<span class="ok">${customers.length} kliënte gelaai` +
              `${marketingOptOuts.size ? `, ${marketingOptOuts.size} afgemeld` : ''}` +
              `${skippedNoEmail ? `, ${skippedNoEmail} bestelling(s) sonder e-pos oorgeslaan` : ''}.</span>`
            : `<span class="warn"><i class="fas fa-exclamation-triangle"></i> ` +
              `Stuur is geblokkeer: ${gate.reason}</span>`;
        updateMarketingSendButton();
    } catch (e) {
        status.innerHTML = `<span class="warn">Kon nie die lys laai nie: ${e.message}</span>`;
    }
}

function marketingVisible() {
    return marketingCustomers.filter(c => {
        if (marketingFilter === 'all') return true;
        if (marketingFilter === 'once') return c.orders === 1;
        return c.segment === marketingFilter;
    });
}

function setMarketingFilter(f) {
    marketingFilter = f;
    document.querySelectorAll('#marketingFilters .filter-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    renderMarketingList();
}

function renderMarketingList() {
    const tbody = document.getElementById('marketingTableBody');
    const rows = marketingVisible();

    tbody.innerHTML = rows.map(c => {
        const out = isOptedOut(c.email);
        const checked = marketingSelected.has(c.email) && !out ? 'checked' : '';
        return `
        <tr class="${out ? 'opted-out' : ''}">
            <td><input type="checkbox" ${checked} ${out ? 'disabled' : ''}
                       onchange="toggleMarketingRecipient('${c.email}', this.checked)"></td>
            <td>${c.name || '—'}</td>
            <td>${c.email}</td>
            <td style="text-align:right">${c.orders}</td>
            <td>${c.lastOrder}</td>
            <td style="text-align:right">R${c.spend.toFixed(2)}</td>
            <td>${out ? '<span class="warn">Afgemeld</span>'
                      : MARKETING_SEGMENT_LABELS[c.segment]}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7">Geen kliënte in hierdie groep nie.</td></tr>';

    document.getElementById('marketingVisibleCount').textContent = rows.length;
    updateMarketingSendButton();
}

function toggleMarketingRecipient(email, on) {
    if (on) marketingSelected.add(email); else marketingSelected.delete(email);
    updateMarketingSendButton();
}

function selectAllMarketing(on) {
    for (const c of marketingVisible()) {
        if (isOptedOut(c.email)) continue;       // never selectable
        if (on) marketingSelected.add(c.email); else marketingSelected.delete(c.email);
    }
    renderMarketingList();
}

function marketingRecipients() {
    return marketingCustomers.filter(c => marketingSelected.has(c.email) && !isOptedOut(c.email));
}

function updateMarketingSendButton() {
    const n = marketingRecipients().length;
    const gate = canSendMarketing();
    const btn = document.getElementById('marketingSendBtn');
    if (!btn) return;
    btn.disabled = n === 0 || !gate.ok;
    btn.innerHTML = `<i class="fas fa-paper-plane"></i> Stuur aan ${n} kliënt${n === 1 ? '' : 'e'}`;
    document.getElementById('marketingSelectedCount').textContent = n;
}

function previewMarketingEmail() {
    const body = document.getElementById('marketingBody').value;
    const subject = document.getElementById('marketingSubject').value;
    const sample = marketingRecipients()[0] || marketingCustomers[0];
    if (!sample) { alert('Geen kliënte gelaai nie.'); return; }
    document.getElementById('marketingPreview').style.display = 'block';
    document.getElementById('marketingPreviewBody').textContent =
        `Aan: ${sample.name} <${sample.email}>\nOnderwerp: ${subject}\n\n` +
        renderMarketingEmail(body, sample);
}

/** Send one copy to the account that will be doing the sending. */
async function sendMarketingTest() {
    const gate = canSendMarketing();
    if (!gate.ok) { alert(`Stuur is geblokkeer: ${gate.reason}`); return; }
    const subject = document.getElementById('marketingSubject').value;
    const body = document.getElementById('marketingBody').value;
    if (!subject.trim() || !body.trim()) { alert('Vul die onderwerp en die boodskap in.'); return; }

    const me = { name: 'Adriaan', email: MARKETING_REPLY_TO };
    const log = document.getElementById('marketingLog');
    log.textContent = `Stuur toets na ${me.email}...`;
    const ok = await sendEmailViaGoogleScript(me.email, `[TOETS] ${subject}`,
        renderMarketingEmail(body, me));
    log.textContent = ok !== false
        ? `Toets gestuur na ${me.email}. Gaan kyk hoe dit lyk voor jy die lys stuur.`
        : `Toets het gefaal. Moenie die lys stuur voor dit werk nie.`;
}

async function startMarketingCampaign() {
    const recipients = marketingRecipients();
    const subject = document.getElementById('marketingSubject').value;
    const body = document.getElementById('marketingBody').value;
    const log = document.getElementById('marketingLog');

    const proceed = confirm(
        `Stuur "${subject}"\n\naan ${recipients.length} kliënt(e)?\n\n` +
        `Dit gaan deur jou Gmail, een vir een, ongeveer ` +
        `${Math.ceil(recipients.length * MARKETING_SEND_DELAY_MS / 1000 / 60)} minuut(e). ` +
        `Dit kan nie teruggetrek word nie.`);
    if (!proceed) return;

    const btn = document.getElementById('marketingSendBtn');
    btn.disabled = true;
    log.textContent = '';

    try {
        const results = await sendMarketingCampaign(recipients, subject, body,
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
        addActivity(`Bemarkings-e-pos "${subject}" — ${results.length - failed.length} gestuur, ${failed.length} gefaal`);
    } catch (e) {
        log.textContent += `\nGESTOP: ${e.message}\n`;
    } finally {
        updateMarketingSendButton();
    }
}
