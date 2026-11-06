// Recons for the Child Support Calculator (child-support-calculator.html).
// Formula from calculateSupport() on the page, rebuilt here from the entry fields.
(function () {
  const RATES = { 1: 20, 2: 25, 3: 30, 4: 35 };
  function rebuild(ctx) {
    const a = ctx.num('#parentAIncome');
    const b = ctx.num('#parentBIncome');
    const combined = a + b;
    const children = parseInt(document.getElementById('numChildren').value, 10) || 1;
    const rate = RATES[Math.min(children, 4)] || 20;
    const base = combined * rate / 100;
    const aDay = ctx.num('#parentADaycare'); const aHealth = ctx.num('#parentAHealth');
    const bDay = ctx.num('#parentBDaycare'); const bHealth = ctx.num('#parentBHealth');
    const adds = aDay + aHealth + bDay + bHealth;
    const aPct = combined ? a / combined : 0;
    const bPct = combined ? b / combined : 0;
    const aShare = (base + adds) * aPct;
    const bShare = (base + adds) * bPct;
    const payorA = a > b;
    return { a, b, combined, children, rate, base, aDay, aHealth, bDay, bHealth, adds, aPct, bPct, aShare, bShare, payorA, payorName: payorA ? 'Parent A' : 'Parent B', payorAmount: payorA ? aShare : bShare, payorPct: payorA ? aPct : bPct };
  }
  const inputs = (r) => [
    { label: 'Parent A gross monthly income', value: r.a, origin: 'entered' }, { label: 'Parent B gross monthly income', value: r.b, origin: 'entered' },
    { label: 'Parent A daycare', value: r.aDay, origin: 'entered' }, { label: 'Parent A health insurance', value: r.aHealth, origin: 'entered' },
    { label: 'Parent B daycare', value: r.bDay, origin: 'entered' }, { label: 'Parent B health insurance', value: r.bHealth, origin: 'entered' },
    { label: 'Number of children', value: r.children, origin: 'entered' }, { label: 'Guideline rate for that number of children (%)', value: r.rate, origin: 'default' },
  ];
  const steps = (ctx, r) => {
    const m = ctx.money;
    return [`Combined income = ${m(r.a)} + ${m(r.b)} = ${m(r.combined)}.`, `Base support = ${m(r.combined)} x ${r.rate}% for ${r.children} child${r.children === 1 ? '' : 'ren'} = ${m(r.base)}.`,
      `Childcare and health insurance = ${m(r.aDay)} + ${m(r.aHealth)} + ${m(r.bDay)} + ${m(r.bHealth)} = ${m(r.adds)}.`,
      `Parent A share = (${m(r.base)} + ${m(r.adds)}) x ${(r.aPct * 100).toFixed(1)}% = ${m(r.aShare)}.`, `Parent B share = (${m(r.base)} + ${m(r.adds)}) x ${(r.bPct * 100).toFixed(1)}% = ${m(r.bShare)}.`,
      `${r.payorName} is the payor (${r.payorA ? 'higher income' : 'the page picks Parent B unless Parent A earns more'}).`];
  };
  const NOTE = 'The rate comes from a generic table written into this page. The state selected, the custody choice, and parenting time do not change this result. Payments a parent already makes directly are not credited.';
  const STALE = 'If a field was changed after Calculate Support was pressed, this shows a difference until it is pressed again.';
  const ran = () => { const p = document.getElementById('resultsPanel'); return p && p.style.display !== 'none'; };
  // Until Calculate Support is pressed the result fields hold starting text, not a result.
  const result = (title, build) => (ctx) => {
    if (!ran()) return { title, status: 'nodata', calc: ['Calculate Support has not been run, so this is the starting text on the page.'] };
    const r = rebuild(ctx);
    const out = build(r, ctx);
    return { title, inputs: inputs(r), summary: { Payor: r.payorName, 'Payor monthly support': ctx.money(r.payorAmount) }, note: `${NOTE} ${STALE}`, ...out, calc: [...steps(ctx, r), ...(out.calc || [])] };
  };
  const parent = (name, get) => (ctx) => {
    const value = get(rebuild(ctx));
    return { title: `${name} gross income`, value, inputs: [{ label: `${name} gross monthly income`, value, origin: 'entered' }], calc: [`Typed in the ${name} gross monthly income field = ${ctx.money(value)}.`], note: 'Typed on this page; not linked to a document. Income on file in this matter is on the Income Engine.' };
  };
  const combined = (ctx) => { const r = rebuild(ctx); return { title: 'Combined income', value: r.combined, inputs: inputs(r).slice(0, 2), calc: [`${ctx.money(r.a)} + ${ctx.money(r.b)} = ${ctx.money(r.combined)}.`] }; };
  const time = (name, id) => result(`${name} parenting time`, (r, ctx) => {
    const typed = ctx.txt(`#${id}`);
    const value = typed === '' ? 50 : Number(typed);
    return { value, calc: [`Parenting time = ${typed === '' ? 'nothing typed, so the page shows its default of 50' : `typed value of ${typed}`}%. It is shown here but is not used in the calculation.`] };
  });

  VeritasRecon.define({
    byId: {
      parentAIncomeKPI: parent('Parent A', (r) => r.a), parentBIncomeKPI: parent('Parent B', (r) => r.b), combinedIncomeKPI: combined,
      supportAmountKPI: result('Monthly support', (r) => ({ value: r.payorAmount })),
      supportAmount: result('Monthly support obligation', (r) => ({ value: r.payorAmount })),
      annualSupport: result('Annual support obligation', (r, ctx) => ({ value: r.payorAmount * 12, calc: [`Annual = ${ctx.money(r.payorAmount)} x 12 = ${ctx.money(r.payorAmount * 12)}.`] })),
      payorPercent: result('Payor income share', (r, ctx) => ({ value: r.payorPct * 100, calc: [`${r.payorName} share of combined income = ${ctx.money(r.payorA ? r.a : r.b)} / ${ctx.money(r.combined)} = ${(r.payorPct * 100).toFixed(1)}%.`] })),
      partyAIncome: result('Parent A gross income', (r) => ({ value: r.a })), partyBIncome: result('Parent B gross income', (r) => ({ value: r.b })),
      partyAPercent: result('Parent A share of combined income', (r) => ({ value: r.aPct * 100 })), partyBPercent: result('Parent B share of combined income', (r) => ({ value: r.bPct * 100 })),
      partyADeductions: result('Parent A daycare and insurance', (r, ctx) => ({ value: r.aDay + r.aHealth, calc: [`Parent A daycare ${ctx.money(r.aDay)} + insurance ${ctx.money(r.aHealth)} = ${ctx.money(r.aDay + r.aHealth)}.`] })),
      partyBDeductions: result('Parent B daycare and insurance', (r, ctx) => ({ value: r.bDay + r.bHealth, calc: [`Parent B daycare ${ctx.money(r.bDay)} + insurance ${ctx.money(r.bHealth)} = ${ctx.money(r.bDay + r.bHealth)}.`] })),
      partyATime: time('Parent A', 'parentATimePercent'), partyBTime: time('Parent B', 'parentBTimePercent'),
      partyASupport: result('Parent A calculated support', (r) => ({ value: r.aShare })), partyBSupport: result('Parent B calculated support', (r) => ({ value: r.bShare })),
    },
    match: [
      // The worked example is sample data, so it falls through and stays not tied.
      { selector: '#guidelineInfo, .guideline-text', recon: (ctx) => (/(guideline|earns)\s*$/i.test(ctx.before) ? null : { status: 'text', calc: ['General wording about guidelines, written on this page. This page cites no statute for it and it is not a figure from this client\'s records.'], note: 'Confirm against the state\'s published guidelines before relying on it.' }) },
    ],
  });
})();
