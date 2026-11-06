// Recons for Credits and Adjustments (credits.html). Entries are typed on the page and
// saved in matter-scoped storage; totals are rebuilt from those saved entries.
(function () {
  const SECTIONS = { sm: 'Spousal-maintenance overpayments', pd: 'Property-division offsets & equalizers', fee: 'Fee-shifting & supporting evidence', child: 'Child-expense credits (reimbursement)' };
  const read = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('veritas.credits.entries') || '{}') || {}; } catch (e) { saved = {}; }
    return saved;
  };
  const amount = (r) => parseFloat(r.amount) || 0;
  const counted = (r) => r.inTotal !== false;
  const COLUMNS = [{ key: 'section', label: 'Section' }, { key: 'label', label: 'Item' }, { key: 'basis', label: 'Basis' }, { key: 'inTotal', label: 'In total' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const toRows = (key, list) => (list || []).map((r) => ({ section: SECTIONS[key], label: r.label || '', basis: r.basis || '', inTotal: counted(r) ? 'Yes' : 'No', amount: amount(r) }));
  const NOTE = 'Each entry is typed on this page. Nothing here links an entry to a document, so check each one against its support in Document Intake.';

  const sectionRecon = (key) => (ctx) => {
    const list = read()[key] || [];
    const value = list.filter(counted).reduce((t, r) => t + amount(r), 0);
    const left = list.filter((r) => !counted(r));
    return { title: SECTIONS[key], value, columns: COLUMNS, rows: toRows(key, list),
      summary: { Entries: list.length, 'Marked not in total': left.length, 'Section total': ctx.money(value) },
      calc: [`Add every entry marked "In total": ${list.filter(counted).map((r) => ctx.money(amount(r))).join(' + ') || 'none'} = ${ctx.money(value)}.`, 'The page shows this rounded to the whole dollar.'], note: NOTE };
  };

  VeritasRecon.define({
    byId: {
      crSumSM: sectionRecon('sm'), crSumPD: sectionRecon('pd'), crSumFee: sectionRecon('fee'), crSumChild: sectionRecon('child'),
      crGrandTotal: (ctx) => {
        const saved = read();
        const subtotal = (key) => (saved[key] || []).filter(counted).reduce((t, r) => t + amount(r), 0);
        const keys = Object.keys(SECTIONS);
        const value = keys.reduce((t, k) => t + subtotal(k), 0);
        return { title: 'Documented claims', value, columns: COLUMNS, rows: keys.flatMap((k) => toRows(k, saved[k])),
          summary: Object.fromEntries(keys.map((k) => [SECTIONS[k], ctx.money(subtotal(k))])),
          calc: [`Add the four section totals: ${keys.map((k) => ctx.money(subtotal(k))).join(' + ')} = ${ctx.money(value)}.`, 'Entries marked not in total are left out.', 'The page shows this rounded to the whole dollar.'],
          note: `${NOTE} The heading says "documented", but the page does not check for a document.` };
      },
    },
    match: [
      { selector: '.cr-note', recon: () => ({ status: 'text', calc: ['Part of a note describing a typical claim. It does not come from this client\'s records and is not added to any total.'] }) },
    ],
  });
})();
