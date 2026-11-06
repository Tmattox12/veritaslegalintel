// Recons for the older Spousal Maintenance template (spousal-maintenance-template.html).
// The page has no script. Its results are written in as $0 and never change, so each one
// is rebuilt here from the page's own stated formula and its input fields. Once a person
// types inputs, those figures show a difference. The percentages and year bands are the
// page's own, attributed to the citation the page gives, and are not independently checked.
(function () {
  const CITATION = 'A.R.S. § 25-319(F)';
  const REFERENCE_NOTE = `This page attributes this figure to ${CITATION}. It has not been checked against the statute.`;

  function fieldByLabel(re) {
    const row = [...document.querySelectorAll('.input-row')].find((r) => { const l = r.querySelector('label'); return l && re.test(l.textContent); });
    const el = row && row.querySelector('input');
    const n = el ? parseFloat(el.value) : NaN;
    return Number.isFinite(n) ? n : 0;
  }
  function read() {
    const payor = fieldByLabel(/^Payor Annual Gross/); const payee = fieldByLabel(/^Payee Annual Gross/); const years = fieldByLabel(/^Marriage Duration/);
    const sel = document.querySelector('.calc-row select');
    const m = sel && sel.value.match(/(\d+)%/);
    const pct = m ? Number(m[1]) : 0;
    const payorMo = payor / 12; const payeeMo = payee / 12; const gap = payorMo - payeeMo; const monthly = gap * 0.2;
    const months = years * 12 * (pct / 100);
    return { payor, payee, years, pct, band: sel ? sel.value : '', payorMo, payeeMo, gap, monthly, months, total: monthly * months };
  }
  const anyInput = () => [...document.querySelectorAll('.input-row input')].some((i) => i.value !== '');
  const inputsOf = (v) => [
    { label: 'Payor annual gross income', value: v.payor, origin: 'entered' }, { label: 'Payee annual gross income', value: v.payee, origin: 'entered' },
    { label: 'Marriage duration (years)', value: v.years, origin: 'entered' }, { label: `Duration percentage (${v.band || 'not chosen'})`, value: v.pct, origin: 'reference' },
    { label: 'Guideline percentage this page states', value: 20, origin: 'reference' },
  ];
  const NO_SCRIPT = 'This page has no script. The figure on screen is written into the page and does not respond to the inputs.';
  const figure = (ctx, title, value, calc) => {
    const v = read();
    const r = { title, value, inputs: inputsOf(v), calc, note: NO_SCRIPT, format: ctx.displayed && ctx.displayed.kind === 'number' ? 'count' : undefined };
    // The percentages are always present, so "nothing entered" has to be decided from the fields.
    if (!anyInput() && !(ctx.displayed && ctx.displayed.value)) r.status = 'nodata';
    return r;
  };

  const steps = {
    payor: (ctx, v) => `Payor monthly = ${ctx.money(v.payor)} / 12 = ${ctx.money(v.payorMo)}.`,
    payee: (ctx, v) => `Payee monthly = ${ctx.money(v.payee)} / 12 = ${ctx.money(v.payeeMo)}.`,
    gap: (ctx, v) => `Income gap = ${ctx.money(v.payorMo)} - ${ctx.money(v.payeeMo)} = ${ctx.money(v.gap)}.`,
    amount: (ctx, v) => `Guideline amount = ${ctx.money(v.gap)} x 20% = ${ctx.money(v.monthly)}.`,
    months: (ctx, v) => `Duration term = ${v.years} years x 12 x ${v.pct}% = ${v.months.toFixed(1)} months.`,
    total: (ctx, v) => `Total obligation = ${ctx.money(v.monthly)} x ${v.months.toFixed(1)} months = ${ctx.money(v.total)}.`,
  };
  const monthlyCalc = (ctx, v) => [steps.payor(ctx, v), steps.payee(ctx, v), steps.gap(ctx, v), steps.amount(ctx, v)];

  function calcRow(ctx) {
    const row = ctx.el.closest('.calc-row');
    const label = ((row && row.querySelector('.calc-label')) || {}).textContent || '';
    const v = read();
    if (/^Payor monthly/.test(label)) return figure(ctx, 'Payor monthly gross income', v.payorMo, [steps.payor(ctx, v)]);
    if (/^Less: Payee/.test(label)) return figure(ctx, 'Payee monthly gross income', v.payeeMo, [steps.payee(ctx, v)]);
    if (/^Income gap ×/.test(label)) {
      if (ctx.displayed && ctx.displayed.kind === 'percent') return reference(ctx);
      return figure(ctx, 'Income gap x 20%', v.monthly, monthlyCalc(ctx, v));
    }
    if (/^Income gap/.test(label)) return figure(ctx, 'Income gap', v.gap, [steps.payor(ctx, v), steps.payee(ctx, v), steps.gap(ctx, v)]);
    if (/^Marriage duration/.test(label)) return figure(ctx, 'Marriage duration (years)', v.years, ['The years typed in the input above.']);
    if (/^Duration term/.test(label)) return figure(ctx, 'Duration term (months)', v.months, [steps.months(ctx, v)]);
    return null;
  }

  function reference(ctx) {
    return { status: 'reference', note: REFERENCE_NOTE, calc: ['This number is written into this page as part of its description of the guideline.'] };
  }

  // The page gives no formula for the Conservative and Aggressive scenarios.
  function noFormula(ctx, scenario) {
    if (!anyInput()) return { title: `${scenario} scenario`, status: 'nodata', note: NO_SCRIPT, calc: ['Nothing has been entered on this page yet.'] };
    return { title: `${scenario} scenario`, status: 'nottied', note: 'The page gives no formula for this scenario.', calc: ['This number is written directly into this page. It does not come from this client\'s records.'] };
  }
  function scenarioCard(ctx) {
    const card = ctx.el.closest('.scenario-card');
    const name = ((card.querySelector('.scenario-title') || {}).textContent || '').trim();
    if (ctx.el.closest('.scenario-title')) return reference(ctx);
    if (!card.classList.contains('active')) return noFormula(ctx, name);
    const v = read();
    if (/Total obligation:\s*$/.test(ctx.before)) return figure(ctx, 'Guideline total obligation', v.total, [...monthlyCalc(ctx, v), steps.months(ctx, v), steps.total(ctx, v)]);
    return figure(ctx, 'Guideline monthly amount', v.monthly, monthlyCalc(ctx, v));
  }
  function comparison(ctx) {
    const row = ctx.row;
    const name = ((row && row.cells[0]) || {}).textContent || '';
    const td = ctx.el.closest('td');
    if (td === row.cells[0]) return reference(ctx);
    if (!/^Guideline/.test(name.trim())) return noFormula(ctx, name.trim());
    const v = read();
    if (td.cellIndex === 2) return figure(ctx, 'Guideline duration (months)', v.months, [steps.months(ctx, v)]);
    if (td.cellIndex === 4) return figure(ctx, 'Guideline total obligation', v.total, [...monthlyCalc(ctx, v), steps.months(ctx, v), steps.total(ctx, v)]);
    return figure(ctx, 'Guideline monthly amount', v.monthly, monthlyCalc(ctx, v));
  }

  VeritasRecon.define({
    match: [
      { selector: '.calc-title', recon: reference },
      { selector: '.calc-row', recon: calcRow },
      { selector: '.note', recon: reference },
      { selector: '.scenario-card', recon: scenarioCard },
      { selector: 'table.table td', label: /^(Conservative|Guideline|Aggressive)/, recon: comparison },
      { selector: 'table.table td', recon: reference },
    ],
  });
})();
