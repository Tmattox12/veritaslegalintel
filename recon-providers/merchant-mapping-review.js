// Recons for Merchant Mapping Review (merchant-mapping-review.html). Each merchant's count
// and total are rebuilt from the parsed transactions, using the grouping rules of
// server/routes/merchant-mapping.js, not from the merchant totals that route returns.
(function () {
  const RECLASSIFY = ['disc_shopping', 'disc_entertainment', 'disc_subscription_other'];
  const abs = (t) => Math.abs(Number(t.amount) || 0);
  const columns = [{ key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'account', label: 'Account' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];

  async function load(ctx) {
    const [all, statements] = await Promise.all([ctx.json('bank-statements/transactions?limit=1000000'), ctx.json('bank-statements')]);
    const docOf = new Map(statements.map((s) => [s.id, s.document_id]));
    const row = (t, category) => ({ date: t.transaction_date || '', description: t.description || '', account: [t.bank_name, t.account_number_masked].filter(Boolean).join(' '), category, amount: Math.round(abs(t) * 100) / 100, documentId: docOf.get(t.bank_statement_id) });
    const group = (list, field) => {
      const g = new Map();
      list.forEach((t) => {
        const key = `${t.description}\u0000${t[field]}`;
        const e = g.get(key) || { description: t.description, category: t[field], rows: [], total: 0 };
        e.rows.push(row(t, t[field]));
        e.total += abs(t);
        g.set(key, e);
      });
      return [...g.values()];
    };
    const expense = all.filter((t) => t.flow_type === 'expense');
    return {
      review: group(expense.filter((t) => t.mapped_category == null && t.suggested_category != null), 'suggested_category'),
      reclassify: group(expense.filter((t) => RECLASSIFY.includes(t.mapped_category)), 'mapped_category').filter((g) => g.rows.length > 2),
    };
  }

  // A merchant can appear under two categories, so the card's category text decides.
  function groupFor(groups, card) {
    const name = (card.querySelector('.merchant-name') || {}).textContent || '';
    const list = groups.filter((g) => g.description === name);
    if (list.length < 2) return list[0];
    const shown = (card.querySelector('.detail-value') || {}).textContent || '';
    const labels = typeof AFI_CATEGORIES !== 'undefined' ? AFI_CATEGORIES : {};
    return list.find((g) => (labels[g.category] || g.category) === shown) || list[0];
  }

  async function merchantFigure(ctx) {
    const card = ctx.el.closest('.merchant-card');
    const tab = ctx.el.closest('.tab-content');
    if (!card || !tab) return null;
    const isReview = tab.id === 'review';
    const data = await load(ctx);
    const g = groupFor(isReview ? data.review : data.reclassify, card);
    if (!g) return { title: 'Merchant', value: 0, format: 'count', calc: ['No parsed transactions match this merchant under the rules for this list.'] };
    const docs = [...new Set(g.rows.map((r) => r.documentId).filter(Boolean))];
    const dates = g.rows.map((r) => r.date).filter(Boolean).sort();
    const rule = isReview ? 'Money-out transactions with a suggested category and no confirmed category' : `Money-out transactions mapped to a broad category (${RECLASSIFY.join(', ')}), where the merchant has more than two`;
    const base = { title: g.description, columns, rows: g.rows, documentIds: docs, summary: { Category: g.category, 'Date range': dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : '' } };
    if (ctx.displayed && ctx.displayed.kind === 'money') return { ...base, value: g.total, format: 'money', calc: [`${rule}.`, `Sum of ${g.rows.length} transactions = ${ctx.money(g.total)}.`] };
    return { ...base, value: g.rows.length, format: 'count', calc: [`${rule}.`, `Count = ${g.rows.length}.`] };
  }

  // The tab badges sit inside buttons, so each section title carries the recon.
  const badgeCard = (key, label, badgeId) => async (ctx) => {
    const groups = (await load(ctx))[key];
    const badge = document.getElementById(badgeId);
    const n = Number((badge.textContent.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, ''));
    ctx.text = badge.textContent.trim();
    ctx.displayed = { kind: 'number', value: n, raw: n, scale: 1, decimals: 0, negative: false };
    const rows = groups.map((g) => ({ description: g.description, category: g.category, count: g.rows.length, amount: Math.round(g.total * 100) / 100 }));
    return { title: label, format: 'count', value: groups.length,
      columns: [{ key: 'description', label: 'Merchant' }, { key: 'category', label: 'Category' }, { key: 'count', label: 'Transactions', align: 'right' }, { key: 'amount', label: 'Total', money: true, align: 'right' }],
      rows, documentIds: [...new Set(groups.flatMap((g) => g.rows.map((r) => r.documentId)).filter(Boolean))],
      calc: [`Merchant and category pairs that meet the rule for this list = ${groups.length}.`],
      note: 'Merchants skipped on this page are hidden for this visit only, so they still count here.' };
  };

  VeritasRecon.define({
    match: [{ selector: '.merchant-stats', recon: merchantFigure }],
    cards: [
      { selector: '#review > .section-title', buttonLabel: 'View count recon', recon: badgeCard('review', 'Merchants needing review', 'review-count') },
      { selector: '#reclassify > .section-title', buttonLabel: 'View count recon', recon: badgeCard('reclassify', 'Merchants needing reclassification', 'reclassify-count') },
    ],
    inert: ['.merchant-name', '.detail-value'],
  });
})();
