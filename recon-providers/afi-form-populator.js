// Recons for the AFI Form Populator (afi-form-populator.html). Formula from updateCalculations() on the page.
(function () {
  const LINES = [[1, 'Health Insurance Premium', 'healthInsurance'], [2, 'Childcare/Dependent Care', 'childcare'], [3, 'Medical/Dental (Out-of-Pocket)', 'medicalDental'], [4, 'Education/Books/Supplies', 'education'],
    [5, 'Housing (Mortgage/Rent/Utilities)', 'housing'], [6, 'Utilities (Phone/Internet/Cable)', 'utilities'], [7, 'Transportation (Car/Gas/Insurance)', 'transportation'], [8, 'Food/Groceries', 'food']];
  const COLUMNS = [{ key: 'line', label: 'AFI line' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const stored = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
  const expenseLines = (ctx) => LINES.map(([n, line]) => ({ line: `${n}. ${line}`, amount: ctx.num(`#line${n}`) }));
  const expenses = (ctx) => expenseLines(ctx).reduce((t, r) => t + r.amount, 0);
  // No line items to show while every line is empty.
  const lineRows = (ctx) => (expenses(ctx) ? expenseLines(ctx) : []);
  const income = (ctx) => ({ w2: ctx.num('#incomeW2'), ss: ctx.num('#incomeSS'), other: ctx.num('#incomeOther') });
  const incomeTotal = (ctx) => { const i = income(ctx); return i.w2 + i.ss + i.other; };
  const PERIOD = 'The page treats the eight lines as annual amounts. Confirm each line was entered or imported as a full-year figure.';
  const STALE = 'The page only refreshes this when Verify is pressed or Other Income is typed in, so a difference can mean the field changed since then.';
  const incomeInputs = (ctx) => { const i = income(ctx); return [{ label: 'W-2 employment income (annual)', value: i.w2, origin: 'entered' }, { label: 'Social Security (annual)', value: i.ss, origin: 'entered' }, { label: 'Other income (annual)', value: i.other, origin: 'entered' }]; };

  const annualExpenses = (ctx) => {
    const value = expenses(ctx);
    return { title: 'Total annual expenses', value, columns: COLUMNS, rows: lineRows(ctx), calc: [`Add AFI lines 1 through 8 = ${ctx.money(value)}.`], note: `${PERIOD} ${STALE}` };
  };
  const monthlyExpenses = (ctx) => {
    const total = expenses(ctx);
    return { title: 'Monthly expenses (average)', value: total / 12, columns: COLUMNS, rows: lineRows(ctx), summary: { 'Annual total': ctx.money(total), 'Monthly average': ctx.money(total / 12) },
      calc: [`Annual total = lines 1 through 8 = ${ctx.money(total)}.`, `Monthly average = ${ctx.money(total)} / 12 months = ${ctx.money(total / 12)}.`], note: `${PERIOD} ${STALE}` };
  };
  const annualIncome = (ctx) => {
    const i = income(ctx);
    const value = i.w2 + i.ss + i.other;
    return { title: 'Total annual income', value, inputs: incomeInputs(ctx), calc: [`W-2 ${ctx.money(i.w2)} + Social Security ${ctx.money(i.ss)} + other ${ctx.money(i.other)} = ${ctx.money(value)}.`], note: STALE };
  };
  const net = (ctx, months) => {
    const inc = incomeTotal(ctx);
    const exp = expenses(ctx);
    const annual = inc - exp;
    return { title: months === 12 ? 'Monthly net income' : 'Net annual income', value: annual / months, inputs: incomeInputs(ctx), columns: COLUMNS, rows: lineRows(ctx),
      summary: { 'Total annual income': ctx.money(inc), 'Total annual expenses': ctx.money(exp), 'Net annual income': ctx.money(annual) },
      calc: [`Net annual income = ${ctx.money(inc)} - ${ctx.money(exp)} = ${ctx.money(annual)}.`, ...(months === 12 ? [`Monthly net = ${ctx.money(annual)} / 12 months = ${ctx.money(annual / 12)}.`] : [])], note: `${PERIOD} ${STALE}` };
  };

  // An imported line can be rebuilt from what was imported. If nothing was imported, it is a typed value.
  const lineRecon = (n, line, category) => (ctx) => {
    const all = stored('hub_expenses');
    const items = (Array.isArray(all) ? all : []).filter((x) => (x.category || x.categoryName) === category);
    if (!items.length) return null;
    const value = items.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
    const documentIds = [...new Set(items.map((x) => x.documentId || x.document_id).filter(Boolean))];
    return { title: `AFI line ${n}: ${line}`, value, columns: [{ key: 'description', label: 'Item' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }],
      rows: items.map((x) => ({ description: x.description || x.name || x.merchant || '', amount: parseFloat(x.amount) || 0, documentId: x.documentId || x.document_id })), documentIds,
      calc: [`Add the ${items.length} Document Hub expense item${items.length === 1 ? '' : 's'} in "${category}" = ${ctx.money(value)}.`], note: 'If the field was edited after import, this shows a difference.' };
  };
  const importedIncome = (title, key) => (ctx) => {
    const saved = stored('income_reconciliation_data');
    if (!saved || saved[key] == null) return null;
    const value = Number(saved[key]) || 0;
    return { title, value, inputs: [{ label: 'Saved on Income Reconciliation', value, origin: 'module' }], calc: [`Saved on the Income Reconciliation page = ${ctx.money(value)}.`], note: 'If the field was edited after import, this shows a difference.' };
  };

  const byId = {
    summaryExpenses: annualExpenses, monthlyTotal: monthlyExpenses, monthlyCalc: monthlyExpenses,
    incomeTotalAnnual: annualIncome, summaryIncome: annualIncome,
    monthlyIncome: (ctx) => {
      const inc = incomeTotal(ctx);
      return { title: 'Monthly income (average)', value: inc / 12, inputs: incomeInputs(ctx), calc: [`Total annual income ${ctx.money(inc)} / 12 months = ${ctx.money(inc / 12)}.`], note: STALE };
    },
    summaryNet: (ctx) => net(ctx, 1), summaryMonthlyNet: (ctx) => net(ctx, 12),
    incomeW2: importedIncome('W-2 employment income', 'w2Gross'), incomeSS: importedIncome('Social Security', 'ssAnnual'),
  };
  LINES.forEach(([n, line, category]) => { byId[`line${n}`] = lineRecon(n, line, category); });

  VeritasRecon.define({
    byId,
    match: [{ selector: '.monthly-calc, .summary-note', recon: () => ({ status: 'text', calc: ['Twelve months in a year. This is the divisor used to turn an annual amount into a monthly one.'] }) }],
  });
})();
