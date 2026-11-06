// Recons for Extracted Data Export (data-export.html). Rebuilds each bucket from the
// matter's document list using the sorting rules of GET /matters/:id/data.
(function () {
  const bucketOf = (doc) => {
    const c = (doc.category || 'other').toLowerCase();
    if (c.includes('tax')) return 'taxes';
    if (c.includes('income') || c.includes('w2') || c.includes('1099') || c.includes('paystub')) return 'income';
    if (c.includes('expense')) return 'expenses';
    if (c.includes('property') || c.includes('real estate') || c.includes('home')) return 'property';
    if (c.includes('investment') || c.includes('brokerage') || c.includes('stock')) return 'investments';
    return 'other';
  };
  const RULE = {
    taxes: 'category contains "tax"',
    income: 'category contains "income", "w2", "1099" or "paystub", and not "tax"',
    expenses: 'category contains "expense"',
    property: 'category contains "property", "real estate" or "home"',
    investments: 'category contains "investment", "brokerage" or "stock"',
    other: 'every document not sorted above',
  };
  const LABELS = { Taxes: 'taxes', Income: 'income', Expenses: 'expenses', Property: 'property', 'Property & Assets': 'property', Investments: 'investments', Other: 'other' };
  const columns = [{ key: 'filename', label: 'Document' }, { key: 'category', label: 'Category' }, { key: 'bucket', label: 'Export bucket' }, { key: 'type', label: 'Type' }];
  const line = (d) => ({ filename: d.filename, category: d.category || '', bucket: bucketOf(d), type: d.document_type || '', documentId: d.id });

  const recon = async (ctx, label) => {
    const docs = (await ctx.json('documents')).filter((d) => !d.deleted_at);
    if (label === 'Documents') {
      return { title: 'Documents', format: 'count', value: docs.length, columns, rows: docs.map(line), documentIds: docs.map((d) => d.id),
        calc: ['Sum of the six export buckets: every document in this matter, leaving out deleted ones.', `Count = ${docs.length}.`] };
    }
    const key = LABELS[label];
    if (!key) return null;
    const list = docs.filter((d) => bucketOf(d) === key);
    return { title: `${label} documents`, format: 'count', value: list.length, columns, rows: list.map(line), documentIds: list.map((d) => d.id),
      calc: [`Export bucket "${key}": ${RULE[key]}.`, `Count = ${list.length}.`],
      note: 'Buckets are sorted by category wording. A category that contains "tax" goes to Taxes even if it also says income.' };
  };

  VeritasRecon.define({
    match: [
      { selector: '.stat-card', recon: (ctx) => recon(ctx, (ctx.el.closest('.stat-card').querySelector('.stat-label') || {}).textContent) },
      { selector: '.category-count', recon: (ctx) => recon(ctx, (ctx.el.closest('.category-header').querySelector('.category-title') || {}).textContent) },
    ],
    cards: [{
      selector: '.category-content',
      buttonLabel: 'View recon',
      recon: async (ctx) => {
        const title = (ctx.el.parentElement.querySelector('.category-title') || {}).textContent;
        const key = LABELS[title];
        const docs = (await ctx.json('documents')).filter((d) => !d.deleted_at && bucketOf(d) === key);
        const more = ctx.el.textContent.match(/and (\d[\d,]*) more/);
        const listed = ctx.el.querySelectorAll('.document-item .document-name').length;
        const shown = more ? Number(more[1].replace(/,/g, '')) : listed;
        ctx.text = more ? `and ${more[1]} more` : `${listed} listed`;
        ctx.displayed = { kind: 'number', value: shown, raw: shown, scale: 1, decimals: 0, negative: false };
        return { title: more ? `${title}: documents beyond the first 10` : `${title}: documents listed`, format: 'count', value: more ? docs.length - 10 : docs.length, columns, rows: docs.map(line), documentIds: docs.map((d) => d.id),
          calc: more ? [`${docs.length} documents in this bucket, 10 listed on the card, so ${docs.length - 10} more.`] : [`${docs.length} documents in this bucket, all listed on the card.`] };
      },
    }],
    inert: ['.document-name', '.document-meta', '#matterInfo'],
  });
})();
