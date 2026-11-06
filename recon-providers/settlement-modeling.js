// Recons for Settlement Modeling scenarios (settlement-modeling.html).
// Scenario terms are typed on the page and held only while it is open.
//
// The page labels Party A's support as "Receives" and Party B's as "Pays". These recons
// follow those labels: support received is added and support paid is subtracted.
(function () {
  const list = () => (typeof scenarios !== 'undefined' && Array.isArray(scenarios) ? scenarios : []);
  const n = (v) => Number(v) || 0;
  const COLUMNS = [{ key: 'term', label: 'Term' }, { key: 'sign', label: 'Effect' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];

  const partyATotal = (s) => n(s.partyAAssets) + n(s.partyAChildSupport) + n(s.partyASpousalSupport) - n(s.partyADebt);
  const partyBTotal = (s) => n(s.partyBAssets) - n(s.partyBChildSupport) - n(s.partyBSpousalSupport) - n(s.partyBDebt);

  const rowsA = (s) => [
    { term: 'Assets received', sign: 'Add', amount: n(s.partyAAssets) }, { term: 'Child support received', sign: 'Add', amount: n(s.partyAChildSupport) },
    { term: 'Spousal support received', sign: 'Add', amount: n(s.partyASpousalSupport) }, { term: 'Debts assigned', sign: 'Subtract', amount: n(s.partyADebt) },
  ];
  const rowsB = (s) => [
    { term: 'Assets received', sign: 'Add', amount: n(s.partyBAssets) }, { term: 'Child support paid', sign: 'Subtract', amount: n(s.partyBChildSupport) },
    { term: 'Spousal support paid', sign: 'Subtract', amount: n(s.partyBSpousalSupport) }, { term: 'Debts assigned', sign: 'Subtract', amount: n(s.partyBDebt) },
  ];
  const TYPED = 'Each term was typed on this page. No source document is linked to it.';
  const signWarning = (s) => (n(s.partyBChildSupport) || n(s.partyBSpousalSupport)
    ? 'The page adds Party B\'s support to Party B\'s total even though the page labels it as paid, so the page figure is higher than this one.' : '');

  function netTotal(ctx) {
    const box = ctx.el.closest('.scenario-box');
    const s = list()[[...document.querySelectorAll('.scenario-box')].indexOf(box)];
    if (!s) return null;
    const block = ctx.el.closest('.scenario-item').parentElement;
    const isA = /PARTY A/.test((block.querySelector('strong') || {}).textContent || '');
    const rows = isA ? rowsA(s) : rowsB(s);
    const v = isA ? partyATotal(s) : partyBTotal(s);
    return { title: `${s.name}: Party ${isA ? 'A' : 'B'} net total`, value: v, columns: COLUMNS, rows, note: isA ? '' : signWarning(s),
      calc: [rows.map((r) => `${r.sign === 'Add' ? '+' : '-'} ${r.term} ${ctx.money(r.amount)}`).join(' '), `Net total = ${ctx.money(v)}.`, TYPED] };
  }

  const METRICS = {
    'Party A Total Value': { value: partyATotal, rows: rowsA, how: 'Assets + child support + spousal support - debts, for Party A' },
    'Party B Total Value': { value: partyBTotal, rows: rowsB, how: 'Assets - child support paid - spousal support paid - debts, for Party B', warn: signWarning },
    'Total Assets Divided': { value: (s) => n(s.partyAAssets) + n(s.partyBAssets), rows: (s) => [{ term: 'Party A assets', sign: 'Add', amount: n(s.partyAAssets) }, { term: 'Party B assets', sign: 'Add', amount: n(s.partyBAssets) }], how: 'Party A assets + Party B assets' },
    'Total Support Obligations': { value: (s) => n(s.partyAChildSupport) + n(s.partyBChildSupport) + n(s.partyASpousalSupport) + n(s.partyBSpousalSupport),
      rows: (s) => [{ term: 'Party A child support', sign: 'Add', amount: n(s.partyAChildSupport) }, { term: 'Party B child support', sign: 'Add', amount: n(s.partyBChildSupport) }, { term: 'Party A spousal support', sign: 'Add', amount: n(s.partyASpousalSupport) }, { term: 'Party B spousal support', sign: 'Add', amount: n(s.partyBSpousalSupport) }],
      how: 'All child support and spousal support for both parties' },
    'Total Debt Assigned': { value: (s) => n(s.partyADebt) + n(s.partyBDebt), rows: (s) => [{ term: 'Party A debts', sign: 'Add', amount: n(s.partyADebt) }, { term: 'Party B debts', sign: 'Add', amount: n(s.partyBDebt) }], how: 'Party A debts + Party B debts' },
  };

  function comparisonCell(ctx) {
    const td = ctx.el.closest('td');
    if (!td || !ctx.row) return null;
    const label = ctx.row.cells[0].textContent.trim();
    const m = METRICS[label];
    if (!m) return null;
    const all = list();
    const shown = Math.min(3, all.length);
    if (td.cellIndex >= 1 && td.cellIndex <= shown) {
      const s = all[td.cellIndex - 1];
      const v = m.value(s);
      return { title: `${s.name}: ${label}`, value: v, columns: COLUMNS, rows: m.rows(s), note: m.warn ? m.warn(s) : '', calc: [`${m.how} = ${ctx.money(v)}.`, TYPED] };
    }
    if (all.length >= 2 && td.cellIndex === shown + 1) {
      const a = m.value(all[0]), b = m.value(all[1]);
      return { title: `${label}: difference`, value: Math.abs(a - b),
        columns: [{ key: 'name', label: 'Scenario' }, { key: 'amount', label: label, money: true, align: 'right' }], rows: [{ name: all[0].name, amount: a }, { name: all[1].name, amount: b }],
        note: (m.warn ? [m.warn(all[0]), m.warn(all[1])].find(Boolean) : '') || '',
        calc: [`Difference = |${ctx.money(a)} - ${ctx.money(b)}| = ${ctx.money(Math.abs(a - b))}. It compares only the first two scenarios.`] };
    }
    return null;
  }

  VeritasRecon.define({
    match: [
      { selector: '.scenario-item.total .scenario-value', recon: netTotal },
      { selector: '.scenario-header', recon: () => ({ status: 'entered', calc: ['This number is part of the scenario name typed on this page.'] }) },
      { selector: '#comparisonBody td', recon: comparisonCell },
    ],
  });
})();
