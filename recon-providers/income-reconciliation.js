// Recons for Income Reconciliation (income-reconciliation.html).
// Amounts are typed in the three income sections and nothing on the page links them to
// a document, so income documents are listed as "on file" and figures stay "calculated".
// Annual Social Security is rebuilt from the monthly field, not read from the annual field.
(function () {
  const ties = (d, v) => { const f = Math.pow(10, d.decimals); return Math.abs(Math.round((Math.abs(Number(v)) / d.scale) * f) / f - d.raw) < 0.5 / f + 1e-9; };
  function settle(ctx, r) {
    const d = ctx.displayed;
    if (r.value == null || !d || !ties(d, r.value)) return r;
    r.status = d.value === 0 && !(r.inputs || []).some((i) => Number(i.value)) ? 'nodata' : 'calculated';
    return r;
  }
  const NOT_LINKED = 'The amount is typed on this page. Any documents listed are this matter\'s income documents on file, to compare by hand.';
  async function withDocs(ctx, r) {
    const [accepted, docs] = await Promise.all([ctx.metric('accepted-income'), ctx.metric(['documents', { category: 'Tax Returns & Income' }])]);
    const seen = new Set(); const sources = [];
    (accepted.sources || []).concat(docs.sources || []).forEach((s) => { if (!seen.has(s.documentId)) { seen.add(s.documentId); sources.push({ ...s, contribution: 'On file. Not linked to this figure.' }); } });
    r.sources = sources;
    r.summary = { ...(r.summary || {}), 'Accepted in the Income Hub': ctx.money(accepted.value) };
    r.note = [r.note, NOT_LINKED].filter(Boolean).join(' ');
    return settle(ctx, r);
  }

  const read = (ctx) => {
    const w2 = ctx.num('#w2Gross'); const ssMonthly = ctx.num('#ssMonthly'); const other = ctx.num('#otherAnnual');
    const ss = ssMonthly * 12;
    return { w2, ssMonthly, ss, other, total: w2 + ss + other };
  };
  const w2Input = (v) => ({ label: 'W-2 gross income (Box 1)', value: v.w2, origin: 'entered' });
  const ssInput = (v) => ({ label: 'Social Security monthly benefit', value: v.ssMonthly, origin: 'entered' });
  const otherInput = (v) => ({ label: 'Other income, annual', value: v.other, origin: 'entered' });
  const allInputs = (v) => [w2Input(v), ssInput(v), otherInput(v)];

  const w2 = (monthly) => (ctx) => {
    const v = read(ctx);
    const calc = [`W-2 income is the gross typed in Box 1 = ${ctx.money(v.w2)}.`];
    if (monthly) calc.push(`Monthly average = ${ctx.money(v.w2)} / 12 = ${ctx.money(v.w2 / 12)}.`);
    return withDocs(ctx, { title: monthly ? 'W-2 employment, monthly average' : 'W-2 employment, annual', value: monthly ? v.w2 / 12 : v.w2, inputs: [w2Input(v)], calc });
  };
  const ss = (monthly) => (ctx) => {
    const v = read(ctx);
    const calc = [`Annual = ${ctx.money(v.ssMonthly)} monthly benefit x 12 = ${ctx.money(v.ss)}.`];
    if (monthly) calc.push(`Monthly average = ${ctx.money(v.ss)} / 12 = ${ctx.money(v.ss / 12)}.`);
    return withDocs(ctx, { title: monthly ? 'Social Security, monthly average' : 'Social Security, annual', value: monthly ? v.ss / 12 : v.ss, inputs: [ssInput(v)], calc });
  };
  const other = (monthly) => (ctx) => {
    const v = read(ctx);
    const calc = [`Other income is the annual total typed on this page = ${ctx.money(v.other)}.`];
    if (monthly) calc.push(`Monthly average = ${ctx.money(v.other)} / 12 = ${ctx.money(v.other / 12)}.`);
    return withDocs(ctx, { title: monthly ? 'Other income, monthly average' : 'Other income, annual', value: monthly ? v.other / 12 : v.other, inputs: [otherInput(v)], calc });
  };
  const total = (monthly) => (ctx) => {
    const v = read(ctx);
    const calc = [`Total = W-2 ${ctx.money(v.w2)} + Social Security ${ctx.money(v.ss)} + other ${ctx.money(v.other)} = ${ctx.money(v.total)}.`];
    if (monthly) calc.push(`Monthly average = ${ctx.money(v.total)} / 12 = ${ctx.money(v.total / 12)}.`);
    return withDocs(ctx, { title: monthly ? 'Total income, monthly average' : 'Total annual income', value: monthly ? v.total / 12 : v.total, inputs: allInputs(v), calc });
  };

  // The page sets its expense line to a written $0 and says it will be imported later.
  const net = (monthly) => (ctx) => {
    const v = read(ctx);
    const calc = [`Net income = total income ${ctx.money(v.total)} minus the expense line, which this page holds at $0.00 = ${ctx.money(v.total)}.`];
    if (monthly) calc.push(`Monthly average = ${ctx.money(v.total)} / 12 = ${ctx.money(v.total / 12)}.`);
    return withDocs(ctx, { title: monthly ? 'Net income, monthly average' : 'Net income, annual', value: monthly ? v.total / 12 : v.total, inputs: allInputs(v), calc, note: 'No expenses are deducted here, because this page does not import them. Net income therefore equals total income.' });
  };
  async function expenseLine(ctx) {
    const s = await ctx.json('analysis-summary');
    const cats = Object.entries(s.monthlyExpenses || {});
    const monthly = cats.reduce((a, [, v]) => a + Number(v), 0);
    return {
      status: 'nottied', title: 'Expense line',
      note: cats.length ? `This page never imports expenses, but this matter has ${ctx.money(monthly)} a month of mapped expenses, listed below.` : 'This page never imports expenses.',
      columns: [{ key: 'category', label: 'Mapped category' }, { key: 'amount', label: 'Monthly', money: true, align: 'right' }],
      rows: cats.map(([category, amount]) => ({ category, amount })),
      calc: ['This $0.00 is written into the page. It is not calculated from this client\'s expenses.'],
    };
  }

  VeritasRecon.define({
    byId: {
      w2Total: w2(false), tableW2: w2(false),
      ssTotal: ss(false), tableSS: ss(false), ssAnnual: ss(false), tableSSMonthly: ss(true),
      otherTotal: other(false), tableOther: other(false), otherMonthly: other(true), tableOtherMonthly: other(true),
      totalIncome: total(false), tableIncomeTotal: total(false), tableIncomeTotalMonthly: total(true),
      tableNetIncome: net(false), tableNetIncomeMonthly: net(true),
    },
    match: [
      { selector: '.verification-table td', label: /^W-2 Employment · Monthly/, recon: w2(true) },
      { selector: '.verification-table td', label: /^8 AFI Categories/, recon: expenseLine },
    ],
  });
})();
