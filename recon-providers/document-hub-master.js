// Recons for the Master Document Hub (document-hub-master.html). Each count is rebuilt
// from the matter's document list using the card rules written in that page.
(function () {
  const RULES = {
    'bank-statements': { title: 'Bank Statements', test: (d) => d.category === 'Financial Statements' && d.document_type !== 'Brokerage / Investment Statement', rule: 'Filed under "Financial Statements" and not a brokerage statement' },
    tax: { title: 'Tax Returns', test: (d) => d.category === 'Tax Returns & Income', rule: 'Filed under "Tax Returns & Income"' },
    income: { title: 'Income Hub', test: (d) => d.category === 'Tax Returns & Income', rule: 'Filed under "Tax Returns & Income"' },
    business: { title: 'Business Documents', test: (d) => d.category === 'Property & Assets', rule: 'Filed under "Property & Assets"' },
    'real-estate': { title: 'Real Estate & Property', test: (d) => d.category === 'Property & Assets', rule: 'Filed under "Property & Assets"' },
    liabilities: { title: 'Liabilities & Debts', test: (d) => d.category === 'Property & Assets', rule: 'Filed under "Property & Assets"' },
    investments: { title: 'Assets & Investments', test: (d) => d.category === 'Financial Statements' && d.document_type === 'Brokerage / Investment Statement', rule: 'A brokerage statement filed under "Financial Statements"' },
    legal: { title: 'Insurance & Legal', test: (d) => d.category === 'Court & Legal Documents', rule: 'Filed under "Court & Legal Documents"' },
    retirement: { title: 'Retirement Plans', test: (d) => d.category === 'Property & Assets', rule: 'Filed under "Property & Assets"' },
    other: { title: 'Other Documents', test: (d) => !d.category || d.category === 'Other' || d.category === 'AFI & Disclosures', rule: 'No category, "Other", or "AFI & Disclosures"' },
  };
  const columns = [{ key: 'filename', label: 'Document' }, { key: 'category', label: 'Category' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Read status' }, { key: 'review', label: 'Needs review' }];
  const line = (d) => ({ filename: d.filename, category: d.category || '', type: d.document_type || '', status: d.extraction_status || '', review: d.ocr_needed ? 'Yes' : 'No', documentId: d.id });
  const docs = async (ctx) => (await ctx.json('documents')).filter((d) => !d.deleted_at);
  const counted = (title, list, calc) => ({ title, format: 'count', value: list.length, columns, rows: list.map(line), documentIds: list.map((d) => d.id), calc });

  VeritasRecon.define({
    byId: {
      totalDocs: async (ctx) => counted('Total documents', await docs(ctx), ['All documents in this matter, leaving out deleted ones.']),
      totalItems: async (ctx) => {
        const list = (await docs(ctx)).filter((d) => d.extraction_status === 'parsed' || d.extraction_status === 'manual');
        return counted('Processed', list, [`Documents whose read status is "parsed" or "manual" = ${list.length}.`]);
      },
      avgMapping: async (ctx) => {
        const list = (await docs(ctx)).filter((d) => d.ocr_needed);
        return counted('Needs review', list, [`Documents flagged as needing OCR or manual review = ${list.length}.`]);
      },
      totalCategories: async (ctx) => {
        const all = await docs(ctx);
        const rows = Object.values(RULES).map((r) => ({ card: r.title, rule: r.rule, count: all.filter(r.test).length }));
        const populated = rows.filter((r) => r.count > 0).length;
        const placed = new Set(all.filter((d) => Object.values(RULES).some((r) => r.test(d))).map((d) => d.id));
        return { title: 'Categories populated', format: 'count', value: populated,
          columns: [{ key: 'card', label: 'Card' }, { key: 'rule', label: 'Rule' }, { key: 'count', label: 'Documents', align: 'right' }], rows,
          documentIds: all.map((d) => d.id),
          calc: [`Cards with at least one document = ${populated} of ${rows.length}.`],
          summary: { 'Documents on no card': all.length - placed.size },
          note: 'Counts cards, not distinct categories: several cards share one category, so one document can light up more than one card.' };
      },
    },
    match: [{ selector: '.hub-card-count', recon: async (ctx) => {
      const rule = RULES[ctx.el.closest('.hub-card-count').id.replace(/^count-/, '')];
      if (!rule) return null;
      const list = (await docs(ctx)).filter(rule.test);
      return counted(rule.title, list, [`${rule.rule}.`, `Count = ${list.length}.`]);
    } }],
    cards: [{
      selector: '.hub-card',
      recon: async (ctx) => {
        const count = ctx.el.querySelector('.hub-card-count');
        const key = count ? count.id.replace(/^count-/, '') : '';
        const rule = RULES[key];
        if (!rule) return { status: 'text', calc: ['This card has no count.'] };
        const n = Number((count.textContent.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, ''));
        ctx.text = count.textContent.trim();
        ctx.displayed = { kind: 'number', value: n, raw: n, scale: 1, decimals: 0, negative: false };
        const list = (await docs(ctx)).filter(rule.test);
        return counted(rule.title, list, [`${rule.rule}.`, `Count = ${list.length}.`]);
      },
    }],
    inert: ['.upload-name', '.upload-meta'],
  });
})();
