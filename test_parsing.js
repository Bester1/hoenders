const cleanNumeric = (str) => {
    if (!str) return '0';
    let s = str.toString().trim();
    s = s.replace(/R/g, '').replace(/ZAR/g, '');
    s = s.replace(/[Ss]/g, '5').replace(/[Il|]/g, '1').replace(/[Oo]/g, '0');
    s = s.replace(/(\d)\s+(\d{2})(\D|$)/, '$1.$2$3');
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
            if (Math.abs((weight * price) - total) < 3.0) {
                tripletIndices.push({ weight, price, total, totalIdx: j });
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

// Test cases from actual OCR data (the ones flagged as suspicious)
const tests = [
    { expected: 4, line: "boud/dy 12 8.29 71.00 588.59 FILLETS 10 8.02 88.50 709.77 heel 1 1.94 59.00 114.46 Kaaswors 1 0.63 165.00 103.95" },
    { expected: 3, line: "boud/dy 6 3.62 71.00 257.02 FILLETS 2 1.93 88.50 170.81 heel 1 1.90 59.00 112.10 Ontbeen 1 0.94 103.00 96.82" },
    { expected: 3, line: "boud/dy 6 1.42 71.00 100.82 FILLETS 2 1.42 88.50 125.67 Patties 2 0.69 74.00 51.06" },
    { expected: 3, line: "boud/dy 4 2.85 71.00 202.35 braaipak 1 1.92 65.00 124.80 Patties 2 0.45 74.00 33.30" },
];

tests.forEach((t, i) => {
    const result = parseLine(t.line);
    const totalFound = result.reduce((s, it) => s + it.total, 0);
    const ok = result.length === t.expected ? 'OK' : 'FAIL';
    console.log(`[${ok}] Test ${i + 1}: Found ${result.length}/${t.expected} items, Total R${totalFound.toFixed(2)}`);
    result.forEach(it => console.log(`       ${it.description}: ${it.weight}kg @ R${it.price} = R${it.total}`));
});
