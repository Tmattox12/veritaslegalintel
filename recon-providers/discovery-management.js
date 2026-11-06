// Recons for discovery-management.html. The statement list is live. The stat boxes, the
// activity list, and the checklist table are written into the page as sample numbers, and
// nothing on the page updates them, so they keep the default "not tied" status on purpose.
(function () {
  const statementFigure = async (ctx) => {
    if (!/^transactions/.test(ctx.after)) return null;
    const item = ctx.el.closest('.doc-item');
    const name = item && item.querySelector('.doc-name') ? item.querySelector('.doc-name').textContent : '';
    const items = [...document.querySelectorAll('.category-section .doc-item')].filter((n) => (n.querySelector('.doc-name') || {}).textContent === name);
    const [statements, all] = await Promise.all([ctx.json('bank-statements'), ctx.json('bank-statements/transactions?limit=1000000')]);
    const same = statements.filter((s) => (s.filename || 'Unknown') === name);
    const st = same[items.indexOf(item)] || same[0];
    if (!st) return null;
    const rows = all.filter((t) => t.bank_statement_id === st.id).map((t) => ({ date: t.transaction_date || '', description: t.description || '', flow: t.flow_type || '', amount: Math.abs(Number(t.amount) || 0), documentId: st.document_id }));
    return { title: `Transactions: ${name}`, format: 'count', value: rows.length,
      columns: [{ key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'flow', label: 'Direction' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }],
      rows, documentIds: st.document_id ? [st.document_id] : [], calc: [`Transactions parsed from this statement = ${rows.length}.`] };
  };

  // The mapper on this page has no script behind it: no transactions load into it, so its
  // four figures stay at the zero written in the page.
  const idle = (title) => () => ({ title, status: 'nodata', calc: ['This page does not load the expense mapper, so this figure stays at zero. Use the Expense Hub for live mapping figures.'] });

  VeritasRecon.define({
    byId: {
      afiMapRows: idle('Rows processed'),
      afiMapMapped: idle('Auto/user mapped'),
      afiMapUnmapped: idle('Needs review'),
      afiMapTotal: idle('Total expense amount'),
    },
    match: [{ selector: '.category-section', recon: statementFigure }],
    inert: ['.doc-name'],
  });
})();
