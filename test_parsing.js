// Mirrors cleanNumeric + the triplet loop in script.js parseInvoicePage().
// Keep in step with it; scripts/validate-invoicing.cjs does not cover this.
const cleanNumeric = (str) => {
    if (!str) return '0';
    let s = str.toString().trim();
    s = s.replace(/R/g, '').replace(/ZAR/g, '');
    s = s.replace(/[Ss]/g, '5').replace(/[Il|]/g, '1').replace(/[Oo]/g, '0');
    s = s.replace(/(\d)\s+(\d{2})(\D|$)/, '$1.$2$3');
    s = s.replace(/[:;]/g, '.');
    s = s.replace(/,/g, '.');
    s = s.replace(/[^\d.]/g, '');
    const parts = s.split('.');
    if (parts.length > 2) s = parts[0] + '.' + parts[1];
    return s || '0';
};

function parseLine(line) {
    const rawParts = line.split(/\s+/);
    const parts = [];
    rawParts.forEach(p => {
        const dots = (p.match(/\./g) || []).length;
        if (dots >= 2) {
            const sub = p.split('.');
            for (let k = 0; k < sub.length; k += 2) {
                if (sub[k + 1]) parts.push(sub[k] + "." + sub[k + 1]);
                else parts.push(sub[k]);
            }
        } else {
            parts.push(p);
        }
    });

    const tripletIndices = [];
    for (let j = 2; j < parts.length; j++) {
        const rawTotal = parts[j];
        const rawPrice = parts[j - 1];
        const rawWeight = parts[j - 2];

        // If a part is purely consisting of letters (more than 1), it's a word, not a broken number.
        // E.g. "heel" -> don't parse it as "1" (from 'l'->1). 
        if (/^[A-Za-z]{2,}$/.test(rawTotal) || /^[A-Za-z]{2,}$/.test(rawPrice) || /^[A-Za-z]{2,}$/.test(rawWeight)) {
            continue;
        }

        const total = parseFloat(cleanNumeric(rawTotal));
        const price = parseFloat(cleanNumeric(rawPrice));
        const weight = parseFloat(cleanNumeric(rawWeight));

        if (!isNaN(total) && !isNaN(price) && !isNaN(weight) && price > 0 && weight > 0) {
            let useWeight = weight, useTotal = total, repaired = null;
            let matches = Math.abs((weight * price) - total) < 3.0;
            if (!matches) {
                if (Math.abs((weight * price) - (total / 100)) < 0.02) {
                    useTotal = total / 100; matches = true; repaired = 'total';
                } else if (Math.abs(((weight / 100) * price) - total) < 0.02) {
                    useWeight = weight / 100; matches = true; repaired = 'weight';
                }
            }
            if (matches) {
                tripletIndices.push({ weight: useWeight, price, total: useTotal, repaired, totalIdx: j });
                j += 2;
            }
        }
    }

    const items = [];
    let lastIdx = -1;
    tripletIndices.forEach((triplet, i) => {
        const startIdx = lastIdx + 1;
        const endIdx = triplet.totalIdx - 2;
        const descriptionParts = parts.slice(startIdx, endIdx);
        let fullDescription = descriptionParts.join(' ').trim();
        items.push({ description: fullDescription, weight: triplet.weight, price: triplet.price, total: triplet.total });
        lastIdx = triplet.totalIdx;
    });
    return items;
}

// Test cases from actual OCR data (the ones flagged as suspicious).
// `total` is the butchery's own stated total for the page, which is the only
// number that can prove no line was silently dropped.
const tests = [
    { expected: 4, line: "boud/dy 12 8.29 71.00 588.59 FILLETS 10 8.02 88.50 709.77 heel 1 1.94 59.00 114.46 Kaaswors 1 0.63 165.00 103.95" },
    // Was `expected: 3`. The line plainly contains four items and the parser
    // has always found four; the fixture was wrong, not the code.
    { expected: 4, line: "boud/dy 6 3.62 71.00 257.02 FILLETS 2 1.93 88.50 170.81 heel 1 1.90 59.00 112.10 Ontbeen 1 0.94 103.00 96.82" },
    { expected: 3, line: "boud/dy 6 1.42 71.00 100.82 FILLETS 2 1.42 88.50 125.67 Patties 2 0.69 74.00 51.06" },
    { expected: 3, line: "boud/dy 4 2.85 71.00 202.35 braaipak 1 1.92 65.00 124.80 Patties 2 0.45 74.00 33.30" },

    // --- Real OCR damage from ADRIAAN BESTER.pdf, Sept 2026 -----------------
    // Each of these silently lost a line before the repair pass existed. The
    // stated totals are Nieuwoudt's own.
    // INV-17191: "477,12" OCR'd as "47712" (total lost its decimal point).
    { expected: 5, total: 1673.53, line: "A4bors 6 6.75 64,00 432,00 A4bors 3 6.62 64,00 423,68 boud/dy 8 6.72 71,00 47712 heel 1 2.47 59,00 145,73 heuning 3 3 65,00 195,00" },
    // INV-17178: "1.15" OCR'd as "115" (weight lost its decimal point).
    { expected: 5, total: 796.78, line: "boud/dy 4 3.43 71,00 243,53 FILLETS 2 2.17 88,50 192,05 Patties 2 115 105,00 120,75 Strips 2 0.93 89,50 83,24 vlerke 2 1.99 79,00 157,21" },
    // INV-17177: "2.14" OCR'd as "214".
    { expected: 2, total: 270.02, line: "FILLETS 1 1.31 88,50 115,94 plat 1 214 72,00 154,08" },
    // INV-17188: "2.19" OCR'd as "2:19" (colon for decimal point).
    { expected: 5, total: 875.64, line: "boud/dy 3 2.57 71,00 182,47 FILLETS 3 3.36 88,50 297,36 heel 1 2.32 59,00 136,88 Strips 2 0.96 89,50 85,92 vlerke 2 2:19 79,00 173,01" },
];

let failures = 0;
tests.forEach((t, i) => {
    const result = parseLine(t.line);
    const totalFound = result.reduce((s, it) => s + it.total, 0);
    const countOk = result.length === t.expected;
    const totalOk = t.total === undefined || Math.abs(totalFound - t.total) < 0.02;
    const ok = countOk && totalOk;
    if (!ok) failures++;
    console.log(`[${ok ? 'OK' : 'FAIL'}] Test ${i + 1}: Found ${result.length}/${t.expected} items, ` +
        `Total R${totalFound.toFixed(2)}` + (t.total !== undefined ? ` (butchery says R${t.total.toFixed(2)})` : ''));
    if (!ok) result.forEach(it => console.log(`       ${it.description}: ${it.weight}kg @ R${it.price} = R${it.total}`));
});

console.log(failures ? `\n${failures} test(s) FAILED` : '\nAll parsing tests passed.');
if (failures) process.exit(1);
