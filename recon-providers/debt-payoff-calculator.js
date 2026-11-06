// Recons for the Debt Payoff Calculator (debt-payoff-calculator.html).
// Debts are typed on the page and held only while it is open. Each figure is recomputed
// from the debt list and the payment fields.
(function () {
  const OWNER = { party1: 'Party A', party2: 'Party B', joint: 'Joint' };
  const list = () => (typeof debts !== 'undefined' && Array.isArray(debts) ? debts : []);
  const COLUMNS = [{ key: 'name', label: 'Debt' }, { key: 'owner', label: 'Assigned to' }, { key: 'rate', label: 'Rate %', align: 'right' }, { key: 'amount', label: 'Balance', money: true, align: 'right' }];
  const toRows = (l) => l.map((d) => ({ name: d.name, owner: OWNER[d.owner] || d.owner, rate: d.rate, amount: d.balance }));
  const TYPED = 'Each balance and rate was typed on this page. No source document is linked to it.';

  const raw = (ctx, sel) => parseFloat(ctx.txt(sel));
  // The summary cards add the two fields and fall back to $1,000 if either one is blank.
  function combined(ctx) {
    const a = raw(ctx, '#party1Payment'), b = raw(ctx, '#party2Payment');
    const sumAB = a + b;
    const blank = !sumAB;
    return { value: blank ? 1000 : sumAB, blank };
  }
  const totalOf = (l) => l.reduce((s, d) => s + d.balance, 0);
  const monthsOf = (ctx, l) => {
    const pay = combined(ctx).value;
    return pay > 0 ? Math.ceil(totalOf(l) / (pay * 0.5)) : 0;
  };
  const payInputs = (ctx) => {
    if (!list().length) return [];
    const c = combined(ctx);
    return [{ label: 'Combined monthly payment', value: c.value, origin: c.blank ? 'default' : 'entered' }];
  };

  const kpi = {
    total: (ctx) => {
      const l = list(), v = totalOf(l);
      return { title: 'Total shared debt', value: v, columns: COLUMNS, rows: toRows(l), calc: [`Sum of ${l.length} balance${l.length === 1 ? '' : 's'} = ${ctx.money(v)}.`, TYPED] };
    },
    avg: (ctx) => {
      const l = list();
      const s = l.reduce((a, d) => a + d.rate, 0);
      const v = l.length ? s / l.length : 0;
      return { title: 'Average interest rate', value: v, columns: COLUMNS, rows: toRows(l),
        calc: [`Average = ${s.toFixed(2)} (sum of the rates) / ${l.length} debt${l.length === 1 ? '' : 's'} = ${v.toFixed(2)}%.`, 'This is a simple average. It is not weighted by balance.'] };
    },
    months: (ctx) => {
      const l = list(), c = combined(ctx), v = monthsOf(ctx, l);
      return { title: 'Months to payoff', format: 'count', value: v, columns: COLUMNS, rows: toRows(l), inputs: payInputs(ctx),
        note: 'This is a rough page estimate. It counts half of the combined payment and ignores interest. If the card has not refreshed since a payment field changed, it will not tie.',
        calc: [`Combined payment = ${ctx.money(c.value)}${c.blank ? ' (the page\'s $1,000 default, used when either payment field is blank)' : ''}.`, `Months = ${ctx.money(totalOf(l))} / (${ctx.money(c.value)} x 0.5), rounded up = ${v}.`] };
    },
    interest: (ctx) => {
      const l = list(), c = combined(ctx), months = monthsOf(ctx, l);
      const lines = l.map((d) => {
        const r = d.rate / 100 / 12;
        let bal = d.balance, interest = 0;
        if (r > 0) {
          for (let i = 0; i < months; i++) {
            interest += bal * r;
            bal -= c.value / l.length * 0.7;
            if (bal <= 0) break;
          }
        }
        return { name: d.name, owner: OWNER[d.owner] || d.owner, rate: d.rate, balance: d.balance, amount: interest };
      });
      const v = lines.reduce((s, x) => s + x.amount, 0);
      return { title: 'Potential interest', value: v,
        columns: [{ key: 'name', label: 'Debt' }, { key: 'rate', label: 'Rate %', align: 'right' }, { key: 'balance', label: 'Balance', money: true, align: 'right' }, { key: 'amount', label: 'Interest', money: true, align: 'right' }],
        rows: lines, inputs: payInputs(ctx),
        note: 'This is a rough page estimate. The 70% principal assumption is written into the page and does not come from any loan terms.',
        calc: [`Each month, interest = balance x rate / 12, for up to ${months} months.`, `Each month the balance falls by ${ctx.money(c.value)} / ${l.length} debts x 70%, until it reaches zero.`, `Total of the Interest column = ${ctx.money(v)}.`] };
    },
  };

  // Debt rows: typed figures.
  function debtCell(ctx) {
    const td = ctx.el.closest('td');
    if (!td || !ctx.row) return null;
    const d = list()[ctx.row.sectionRowIndex];
    if (td.cellIndex === 0 || !d) return { status: 'text', calc: ['This number is part of the debt name typed on this page.'] };
    const isRate = td.cellIndex === 2;
    return { title: `${d.name}: ${isRate ? 'rate' : 'balance'}`, status: 'entered', value: isRate ? d.rate : d.balance,
      inputs: [{ label: isRate ? 'Interest rate %' : 'Current balance', value: isRate ? d.rate : d.balance, origin: 'entered' }],
      calc: ['This value was typed on this page. Veritas did not calculate it.'] };
  }

  // Scenario cards. The scenario's name states how all debt is split.
  const SCENARIOS = [{ name: 'Equal 50/50 Split', shares: { party1: 0.5, party2: 0.5 } }, { name: 'Income Proportional (60/40)', shares: { party1: 0.6, party2: 0.4 } }];
  function scenarioCell(ctx) {
    const card = ctx.el.closest('.scenario-card');
    if (!card) return null;
    const sc = SCENARIOS[[...document.querySelectorAll('.scenario-card')].indexOf(card)];
    const item = ctx.el.closest('.scenario-item');
    const label = item ? (item.querySelector('.scenario-label') || {}).textContent || '' : '';
    if (!sc || !label) return null;
    const who = /^Party A/.test(label) ? 'party1' : 'party2';
    const name = OWNER[who];
    const l = list(), total = totalOf(l), share = total * sc.shares[who];
    const pct = Math.round(sc.shares[who] * 100);
    const partial = l.some((d) => d.owner !== 'joint');
    const warn = partial ? 'A debt assigned to one party gets only that party\'s percent on this page; the other party\'s percent of it is dropped, so the two party figures do not add up to total debt.' : '';
    const assumed = sc.shares.party1 !== 0.5 ? ' The 60/40 ratio is written into the page; it does not come from either party\'s income.' : '';
    const shareCalc = `${name} debt = total ${ctx.money(total)} x ${pct}% = ${ctx.money(share)}.`;
    if (/Debt$/.test(label)) {
      return { title: `${sc.name}: ${label}`, value: share, columns: COLUMNS, rows: toRows(l), note: warn + assumed, calc: [shareCalc, TYPED] };
    }
    const pay = parseFloat(ctx.txt(who === 'party1' ? '#party1Payment' : '#party2Payment')) || 500;
    const months = pay > 0 ? Math.ceil(share / pay) : 0;
    const isYears = /^years?/i.test(ctx.after) || /^years?/i.test(ctx.el.nextSibling ? ctx.el.nextSibling.textContent.trim() : '');
    const inputs = [{ label: `${name} monthly payment`, value: pay, origin: raw(ctx, who === 'party1' ? '#party1Payment' : '#party2Payment') ? 'entered' : 'default' }];
    if (isYears) {
      return { title: `${sc.name}: ${label} in years`, format: 'count', value: months / 12, inputs, note: warn + assumed,
        calc: [shareCalc, `Months = ${ctx.money(share)} / ${ctx.money(pay)}, rounded up = ${months}. Interest is ignored.`, `Years = ${months} / 12 = ${(months / 12).toFixed(1)}.`] };
    }
    return { title: `${sc.name}: ${label}`, format: 'count', value: months, inputs, note: warn + assumed,
      calc: [shareCalc, `Months = ${ctx.money(share)} / ${ctx.money(pay)}, rounded up = ${months}. Interest is ignored.`] };
  }

  VeritasRecon.define({
    byId: {
      totalDebtKPI: kpi.total,
      totalInterestKPI: kpi.interest,
      avgRateKPI: kpi.avg,
      payoffMonthsKPI: kpi.months,
      debtTable: debtCell,
      scenariosContainer: scenarioCell,
    },
  });
})();
