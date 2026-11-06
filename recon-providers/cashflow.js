// Recons for Cash Flow (cashflow.html). Inputs are typed monthly amounts; the formula is the one in cashflow.js.
(function () {
  const FIELDS = [['Income', 'Net employment income', 1], ['Other', 'Other cash income', 1], ['Support', 'Support received', 1], ['Expenses', 'Ordinary expenses', -1], ['Paid', 'Support and direct costs paid', -1]];
  // The page ignores negative entries, so this does too.
  const field = (ctx, id) => Math.max(0, ctx.num(`#${id}`));
  const remaining = (ctx, party) => FIELDS.reduce((total, [key, , sign]) => total + sign * field(ctx, `${party}${key}`), 0);
  const COLUMNS = [{ key: 'line', label: 'Line' }, { key: 'effect', label: 'Effect' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const rows = (ctx, party) => FIELDS.map(([key, line, sign]) => ({ line, effect: sign > 0 ? 'Added' : 'Subtracted', amount: field(ctx, `${party}${key}`) }));
  const inputs = (ctx, party, name) => FIELDS.map(([key, line]) => ({ label: `${name}: ${line}`, value: field(ctx, `${party}${key}`), origin: 'entered' }));
  const NO_DOCS = 'These amounts are typed on this page. Files picked in the upload box stay in this browser and are not linked to the amounts.';

  const partyRecon = (party, name) => (ctx) => {
    const m = ctx.money;
    const f = (key) => field(ctx, `${party}${key}`);
    const inflow = f('Income') + f('Other') + f('Support');
    const outflow = f('Expenses') + f('Paid');
    const value = inflow - outflow;
    return {
      title: `${name} remaining monthly cash`, value, columns: COLUMNS, rows: inflow || outflow ? rows(ctx, party) : [], inputs: inputs(ctx, party, name),
      summary: { 'Money in': m(inflow), 'Money out': m(outflow), Remaining: m(value) },
      calc: [`Money in = ${m(f('Income'))} + ${m(f('Other'))} + ${m(f('Support'))} = ${m(inflow)}.`, `Money out = ${m(f('Expenses'))} + ${m(f('Paid'))} = ${m(outflow)}.`, `Remaining = ${m(inflow)} - ${m(outflow)} = ${m(value)}.`],
      note: NO_DOCS,
    };
  };

  const differenceRecon = (ctx) => {
    const m = ctx.money;
    const a = remaining(ctx, 'a');
    const b = remaining(ctx, 'b');
    return {
      title: 'Difference in remaining cash', value: Math.abs(a - b), inputs: [...inputs(ctx, 'a', 'Party A'), ...inputs(ctx, 'b', 'Party B')],
      summary: { 'Party A remaining': m(a), 'Party B remaining': m(b), Difference: m(Math.abs(a - b)) },
      calc: [`Party A remaining = ${m(a)}. Party B remaining = ${m(b)}.`, `Difference = absolute value of ${m(a)} - ${m(b)} = ${m(Math.abs(a - b))}.`],
      note: NO_DOCS,
    };
  };

  VeritasRecon.define({
    byId: {
      aRemaining: partyRecon('a', 'Party A'), summaryA: partyRecon('a', 'Party A'),
      bRemaining: partyRecon('b', 'Party B'), summaryB: partyRecon('b', 'Party B'),
      summaryDifference: differenceRecon, cashflowNarrative: differenceRecon,
      cashflowFileSummary: (ctx) => {
        const files = [...(document.getElementById('cashflowFiles').files || [])];
        return { title: 'Documents selected', value: files.length, format: 'count', columns: [{ key: 'name', label: 'File' }], rows: files.map((f) => ({ name: f.name })),
          calc: [`Files picked in the upload box = ${files.length}.`], note: 'These files stay in this browser. They are a work list and are not linked to any amount.' };
      },
    },
  });
})();
