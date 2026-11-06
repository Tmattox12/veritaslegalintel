// Recons for the Reset Data page (reset-data.html). Read-only: these only read the
// browser storage the page counts, and never call any of the page's reset actions.
(function () {
  const HUBS = [
    ['hub_expenses', 'Expenses'], ['hub_income', 'Income'], ['hub_assets', 'Assets'], ['hub_liabilities', 'Liabilities'], ['hub_investments', 'Investments'],
    ['hub_retirement', 'Retirement'], ['hub_realestate', 'Real Estate'], ['hub_business', 'Business'], ['hub_tax', 'Tax'], ['hub_legal', 'Legal'],
  ];
  const stored = (key) => {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  };
  const count = (key) => { const v = stored(key); return v ? v.length : 0; };

  const COLUMNS = [{ key: 'name', label: 'Browser list' }, { key: 'count', label: 'Entries', align: 'right' }];
  const hubRows = () => HUBS.map(([k, name]) => ({ name, count: count(k) })).filter((r) => r.count);
  const SCOPE = 'This counts lists saved in this browser for the active client. It does not count documents on the server.';
  const serverNote = async (ctx) => {
    const m = await ctx.metric('documents');
    return { 'Documents on the server for this client': m.value };
  };

  async function docs(ctx) {
    const rows = hubRows();
    const v = rows.reduce((a, r) => a + r.count, 0);
    return { title: 'Total documents (this browser)', format: 'count', value: v, columns: COLUMNS, rows, note: SCOPE, summary: await serverNote(ctx),
      calc: [`Sum of the entries in ${rows.length} browser list${rows.length === 1 ? '' : 's'} = ${v}.`] };
  }

  async function items(ctx) {
    const rows = hubRows();
    const extra = [['unmapped_expense_items', 'Unmapped expense items'], ['reconciliation_imports', 'Reconciliation imports']]
      .map(([k, name]) => ({ name, count: count(k) })).filter((r) => r.count);
    const all = rows.concat(extra);
    const v = all.reduce((a, r) => a + r.count, 0);
    return { title: 'Total items extracted (this browser)', format: 'count', value: v, columns: COLUMNS, rows: all, note: SCOPE, summary: await serverNote(ctx),
      calc: [`Sum of the entries in ${all.length} browser list${all.length === 1 ? '' : 's'} = ${v}.`, 'Each saved document entry is also counted here as one item.'] };
  }

  // "n/10" isn't picked up as a figure by itself, so it gets a button on its card.
  function categories(ctx) {
    const shown = (document.getElementById('categoriesCount') || {}).textContent || '';
    const v = HUBS.filter(([k]) => stored(k)).length;
    ctx.text = shown;
    ctx.displayed = { kind: 'number', value: parseInt(shown, 10) || 0, raw: parseInt(shown, 10) || 0, scale: 1, decimals: 0 };
    return { title: 'Categories with data (this browser)', format: 'count', value: v, columns: COLUMNS, rows: hubRows(), note: SCOPE,
      calc: [`Browser lists found out of ${HUBS.length} = ${v}.`] };
  }

  VeritasRecon.define({
    byId: { totalDocsCount: docs, totalItemsCount: items },
    cards: [{ selector: '#dataSummary .data-item:nth-child(3)', recon: categories }],
  });
})();
