/**
 * delivery-schedule.js — loaded by index.html (admin) and customer-portal.html
 * before any script that reads the schedule. Declared with var so it is a
 * plain global and can never clash with another file's declarations.
 */

// 2026 Delivery and Cut-off Schedule
// Nieuwoudt's own 2026 delivery schedule, taken from the spreadsheet Ansie
// sends out ("ADRIAAN  AFLEWERINGS 2026.xlsx", 12 Sept 2026). Read off that
// file, not from anyone's recollection.
//
// The table this replaces was wrong from May onward. It had every delivery on
// the LAST Saturday of the month when the rounds actually run on the FIRST,
// and it paired each month with the cutoff that belongs to the month after —
// so a September notice would have told customers the birds arrive on the
// 26th when the real date was 3 October. It also carried an April round that
// does not exist: the schedule jumps 28 March to 2 May.
//
// Every delivery is a Saturday. Cutoffs are Tuesdays except June (a Thursday)
// and the last round (a Sunday), which is how Ansie has them.
//
// `tentative` marks a date she has not fixed yet — the last round is written
// "21 of 28 November" on her sheet. Do not resolve it by guessing; ask her.
var DELIVERY_SCHEDULE_2026 = [
    { month: 'January',   delivery: '2026-01-31', cutoff: '2026-01-13' },
    { month: 'February',  delivery: '2026-02-28', cutoff: '2026-02-10' },
    { month: 'March',     delivery: '2026-03-28', cutoff: '2026-03-10' },
    // No April round — 28 March goes straight to 2 May.
    { month: 'May',       delivery: '2026-05-02', cutoff: '2026-04-14' },
    { month: 'June',      delivery: '2026-06-06', cutoff: '2026-05-12' },
    { month: 'July',      delivery: '2026-07-04', cutoff: '2026-06-11' },
    { month: 'August',    delivery: '2026-08-01', cutoff: '2026-07-14' },
    { month: 'September', delivery: '2026-09-05', cutoff: '2026-08-11' },
    { month: 'October',   delivery: '2026-10-03', cutoff: '2026-09-15' },
    { month: 'November',  delivery: '2026-11-07', cutoff: '2026-10-13' },
    { month: 'November (2)', delivery: '2026-11-21', cutoff: '2026-11-08',
      tentative: true, note: 'Ansie se blad sê "21 of 28 November" — bevestig by haar' }
];

// How long after a round's cutoff Bes still takes orders for it. He gives
// grace to about a week before the van goes (orders land after the stated
// cutoff every month), so an order belongs to the first delivery that is at
// least this many days after it was placed. One rule for every screen that
// asks "which delivery is this order for?".
var DELIVERY_GRACE_DAYS = 7;

/**
 * The delivery an order placed on `dateStr` (YYYY-MM-DD or ISO) belongs to,
 * or null when it is outside the schedule (before 2026, or after the last
 * round). Orders carry only their date, never a round, so this is derived.
 */
function deliveryRoundForDate(dateStr) {
    if (!dateStr) return null;
    var day = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    for (var i = 0; i < DELIVERY_SCHEDULE_2026.length; i++) {
        var r = DELIVERY_SCHEDULE_2026[i];
        var last = new Date(r.delivery + 'T00:00:00');
        last.setDate(last.getDate() - DELIVERY_GRACE_DAYS);
        var lastDay = last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') +
            '-' + String(last.getDate()).padStart(2, '0');
        if (day <= lastDay) {
            // Before the first round's window is last year's business.
            if (i === 0 && day < '2026-01-01') return null;
            return r;
        }
    }
    return null;
}
