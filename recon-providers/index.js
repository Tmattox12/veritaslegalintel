// Recons for the Dashboard (index.html).
(function () {
  const billing = (ctx) => ctx.json('billing/summary');
  const trustRows = (b) => ({
    columns: [{ key: 'date', label: 'Date' }, { key: 'kind', label: 'Type' }, { key: 'memo', label: 'Memo' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }],
    rows: b.trust.ledger.map((t) => ({ date: t.txn_date, kind: t.kind, memo: t.memo || t.description || '', amount: t.amount })),
  });
  const wipRecon = async (ctx) => {
    const b = await billing(ctx);
    const open = b.entries.filter((e) => e.status === 'draft' || e.status === 'approved');
    const total = open.reduce((a, e) => a + e.amount, 0);
    return {
      title: 'Unbilled work', value: total,
      columns: [{ key: 'date', label: 'Work date' }, { key: 'status', label: 'Status' }, { key: 'hours', label: 'Hours', align: 'right' }, { key: 'rate', label: 'Rate', money: true, align: 'right' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }],
      rows: open.map((e) => ({ date: e.work_date, status: e.status, hours: e.hours, rate: e.rate, amount: e.amount })),
      summary: { 'Draft entries': ctx.money(b.wip.draft), 'Approved entries': ctx.money(b.wip.approved) },
      calc: ['Each entry = hours x rate.', `Unbilled work = draft ${ctx.money(b.wip.draft)} + approved ${ctx.money(b.wip.approved)} = ${ctx.money(total)}.`],
      note: 'Time entries come from activity captured in Veritas and are drafts until an attorney approves them.',
    };
  };

  VeritasRecon.define({
    byId: {
      kDocs: () => ({ metric: 'documents' }),
      kStmts: () => ({ metric: 'statements' }),
      kIncome: () => ({ metric: 'accepted-income' }),
      kTrust: async (ctx) => {
        const b = await billing(ctx);
        const signed = (t) => (t.kind === 'deposit' ? 1 : -1) * Number(t.amount);
        const deposits = b.trust.ledger.filter((t) => t.kind === 'deposit').reduce((a, t) => a + Number(t.amount), 0);
        const out = b.trust.ledger.filter((t) => t.kind !== 'deposit').reduce((a, t) => a + Number(t.amount), 0);
        return { title: 'Trust balance', value: b.trust.ledger.reduce((a, t) => a + signed(t), 0), ...trustRows(b), summary: { 'Ledger entries': b.trust.ledger.length, Deposits: ctx.money(deposits), 'Applied and refunded': ctx.money(out) },
          calc: [`Deposits ${ctx.money(deposits)} minus amounts applied and refunded ${ctx.money(out)} = ${ctx.money(deposits - out)}.`], note: 'Comes from the trust ledger entered on the Billing page.' };
      },
    },
    match: [
      { selector: '#kDocsSub', recon: () => ({ metric: 'documents-unclassified' }) },
      { selector: '#kStmtsSub', label: /./, recon: (ctx) => (/^month/i.test(ctx.after) ? { metric: 'coverage-months' } : { metric: 'transactions' }) },
      { selector: '#kIncomeSub', recon: async (ctx) => ({ metric: 'accepted-income', title: 'Documents accepted', value: (await ctx.metric('accepted-income')).rows.length, format: 'count' }) },
      { selector: '#kTrustSub', recon: wipRecon },
      { selector: '.mod-status', recon: async (ctx) => {
        const card = ctx.el.closest('.mod-card');
        const name = card ? (card.querySelector('h4') || {}).textContent : '';
        if (name === 'Document Intake') return /^document/i.test(ctx.after) ? { metric: 'documents' } : { metric: 'transactions' };
        if (name === 'Document Hubs') return { metric: 'documents-unclassified' };
        if (name === 'Income Hub') return ctx.displayed && ctx.displayed.kind === 'money' ? { metric: 'accepted-income' } : { title: 'Documents accepted', metric: 'accepted-income', value: (await ctx.metric('accepted-income')).rows.length, format: 'count' };
        if (name === 'Expense Hub') return { metric: ['hub-expense', { measure: 'count' }] };
        if (name === 'Billing & Trust') {
          if (ctx.displayed && ctx.displayed.kind === 'money') return wipRecon(ctx);
          const b = await billing(ctx);
          return { title: 'Minutes not yet drafted', value: b.uncapturedMinutes, format: 'count', calc: ['Active time captured in Veritas that has not yet been built into a draft time entry.', `Total = ${b.uncapturedMinutes} minutes.`] };
        }
        return null;
      } },
    ],
  });
})();
