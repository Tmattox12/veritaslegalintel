// Recons for the Expense Hub (document-hub-expenses.html, mapping in discovery-intake-afi.js).
// The mapping figures are rebuilt here from every parsed transaction, the shared taxonomy
// and the choices saved for this matter, following the rules in discovery-intake-afi.js.
(function () {
  const REASONS = { 'Account movement': 'account_movement', 'Transfers / payments / P2P': 'transfer_or_payment', 'Held for review': 'amount_review', 'Zero amount': 'zero_amount' };
  const unique = (list) => [...new Set(list.filter(Boolean))];
  const abs = (t) => Math.abs(parseFloat(t.amount) || 0);
  const merchantKey = (desc) => (desc || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).slice(0, 3).join(' ').trim();
  const stored = (key) => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } };

  async function loadMapping(ctx) {
    const T = window.AFITaxonomy;
    const [all, statements] = await Promise.all([ctx.json('bank-statements/transactions?limit=1000000'), ctx.json('bank-statements')]);
    const docOf = new Map(statements.map((s) => [s.id, s.document_id]));
    const user = stored(`veritas_afi_mappings_${ctx.matterId}`);
    const confirmed = stored(`veritas_afi_confirmed_${ctx.matterId}`);
    const mappable = all.filter((t) => {
      if (t.flow_type !== 'expense') return false;
      const description = (t.description || '').toLowerCase();
      const code = T.normalize(t.mapped_category || t.suggested_category) || T.classify(t.description);
      const detail = T.classifyDetailed(t.description);
      const guessed = detail && detail.confidence === 'review' && detail.code === code;
      if ((T.treatmentFor(code) === 'none' && !guessed) || /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/.test(description)) return false;
      return abs(t) > 0 && abs(t) <= 100000;
    });
    const rows = mappable.map((t) => {
      const mk = merchantKey(t.description);
      const detail = T.classifyDetailed(t.description);
      const cat = T.normalize(t.mapped_category || t.suggested_category) || (detail && detail.code);
      const override = user[mk];
      const userSet = override !== undefined;
      const flagged = !!(cat && detail && detail.confidence === 'review' && !userSet && !confirmed[mk] && t.mapping_status !== 'confirmed');
      const chosen = typeof override === 'string' ? override : null;
      const eff = chosen || (userSet ? null : cat);
      const line = typeof override === 'number' ? override : eff != null ? T.afiLineFor(eff) : null;
      const treatment = eff ? T.treatmentFor(eff) : null;
      let bucket = 'unmapped';
      if (line != null) bucket = 'line';
      else if (override === null || treatment === 'none') bucket = 'skip';
      else if (treatment === 'discretionary') bucket = 'shopping';
      else if (eff) bucket = 'offform';
      return { t, mk, flagged, bucket, line, code: eff, decided: userSet || !!confirmed[mk], documentId: docOf.get(t.bank_statement_id) };
    });
    const spans = statements.filter((s) => s.statement_start && s.statement_end);
    const distinct = new Set(mappable.map((t) => (t.transaction_date || '').slice(0, 7)).filter(Boolean));
    const startMonths = new Set(spans.map((s) => s.statement_start.slice(0, 7)));
    const months = Math.max(1, startMonths.size || distinct.size);
    return { rows, months, spanCount: spans.length, startMonths: startMonths.size };
  }

  const columns = [{ key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'account', label: 'Account' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const lineItems = (list) => list.map((r) => ({ date: r.t.transaction_date || '', description: r.t.description || '', account: [r.t.bank_name, r.t.account_number_masked].filter(Boolean).join(' '), category: r.t.mapped_category || r.t.suggested_category || '', amount: Math.round(abs(r.t) * 100) / 100, documentId: r.documentId }));
  const docs = (list) => unique(list.map((r) => r.documentId));
  const sum = (list) => list.reduce((a, r) => a + abs(r.t), 0);

  const stat = (title, pickRows, valueOf, steps) => async (ctx) => {
    const m = await loadMapping(ctx);
    const list = pickRows(m);
    return { title, value: valueOf(m, list), format: 'count', columns, rows: lineItems(list), documentIds: docs(list), calc: steps(m, list, ctx) };
  };
  const isMapped = (r) => r.bucket !== 'unmapped';
  const figures = {
    afiMapRows: stat('Mappable transactions', (m) => m.rows, (m, l) => l.length,
      (m, l) => ['Money-out transactions, leaving out transfers, card payments, zero amounts, and amounts over $100,000.', `Count = ${l.length}.`]),
    afiMapMapped: stat('Mapped', (m) => m.rows.filter((r) => isMapped(r) && !r.flagged), (m, l) => l.length,
      (m, l) => [`Transactions with a category or a person's choice, less suggestions nobody has confirmed = ${l.length}.`]),
    afiMapUnmapped: stat('Needs review', (m) => m.rows.filter((r) => !isMapped(r) || r.flagged), (m, l) => l.length,
      (m, l) => [`No category matched: ${l.filter((r) => !isMapped(r)).length}. Suggestions not yet confirmed: ${l.filter((r) => isMapped(r) && r.flagged).length}. Total = ${l.length}.`]),
    afiMapTotal: async (ctx) => {
      const r = await stat('Total expense amount', (m) => m.rows, (m, l) => sum(l), (m, l, c) => [`Sum of ${l.length} mappable transactions = ${c.money(sum(l))}.`])(ctx);
      return { ...r, format: 'money' };
    },
  };

  // ---------- table of totals by AFI line ----------
  async function lineCell(ctx) {
    const tr = ctx.row;
    const td = ctx.el.closest('td');
    if (!tr || !td) return null;
    const m = await loadMapping(ctx);
    const T = window.AFITaxonomy;
    const first = (tr.cells[0].textContent || '').trim();
    const second = (tr.cells[1].textContent || '').trim();
    const lineNo = (first.match(/^Line (\d+)/) || [])[1];
    let list;
    if (lineNo) list = m.rows.filter((r) => r.bucket === 'line' && r.line === Number(lineNo));
    else if (first === 'Review') list = m.rows.filter((r) => r.bucket === 'shopping');
    else list = m.rows.filter((r) => r.bucket === 'offform' && second.startsWith(T.displayLabel(r.code)));
    const total = sum(list);
    const col = [...tr.cells].indexOf(td);
    const base = { title: `${second.replace(/\(no box.*$/, '').trim()}`, columns, rows: lineItems(list), documentIds: docs(list), summary: { Rows: list.length, Total: ctx.money(total) } };
    if (col === 2) return { ...base, value: total, format: 'money', calc: [`Sum of ${list.length} transactions = ${ctx.money(total)}.`] };
    if (col === 4) return { ...base, value: list.length, format: 'count', calc: [`Count of transactions in this line = ${list.length}.`] };
    if (col === 3) {
      const monthly = total / m.months;
      return { ...base, value: monthly, format: 'money',
        summary: { ...base.summary, 'Calendar months with a statement': m.months },
        inputs: [{ label: 'Total', value: ctx.money(total), origin: 'document' }, { label: 'Calendar months with a statement', value: m.months, origin: 'module' }],
        calc: [`Total = ${ctx.money(total)}.`, `Months = ${m.months} calendar months with a statement, from ${m.spanCount} statements. Accounts covering the same month count once.`, `Monthly = ${ctx.money(total)} / ${m.months} = ${ctx.money(monthly)}.`],
      };
    }
    return null;
  }

  // ---------- merchants to review ----------
  async function merchantCell(ctx) {
    const tr = ctx.row;
    const td = ctx.el.closest('td');
    const input = tr && tr.querySelector('input[data-mk]');
    if (!input || !td) return null;
    const mk = input.dataset.mk;
    const m = await loadMapping(ctx);
    const isDecided = !!tr.querySelector('[data-undo]');
    const isFlag = !!tr.querySelector('[data-confirm]');
    const list = m.rows.filter((r) => r.mk === mk && (isDecided ? r.decided : isFlag ? r.flagged : r.bucket === 'unmapped'));
    const col = [...tr.cells].indexOf(td);
    const base = { title: `Merchant: ${mk || '(blank)'}`, columns, rows: lineItems(list), documentIds: docs(list) };
    if (col === 1) return { ...base, value: list.length, format: 'count', calc: [`Transactions whose description starts "${mk}" and that are ${isDecided ? 'already classified' : isFlag ? 'suggested and not confirmed' : 'not mapped'} = ${list.length}.`] };
    if (col === 2) return { ...base, value: sum(list), format: 'money', calc: [`Sum of those ${list.length} transactions = ${ctx.money(sum(list))}.`] };
    return null;
  }

  // ---------- intake reconciliation ----------
  const flow = (name) => () => ({ metric: ['transactions', { flow: name }] });
  const hub = (params) => () => ({ metric: ['hub-expense', params] });
  async function unparsed(ctx) {
    const [all, parsed] = await Promise.all([ctx.metric('statements-hub'), ctx.metric(['statements-hub', { which: 'parsed' }])]);
    const done = new Set(parsed.rows.map((r) => r.documentId));
    const rows = all.rows.filter((r) => !done.has(r.documentId));
    return { title: 'Statement documents not parsed', format: 'count', value: all.value - parsed.value, columns: all.columns, rows, documentIds: unique(rows.map((r) => r.documentId)),
      calc: [`Not parsed = ${all.value} statement documents - ${parsed.value} parsed = ${all.value - parsed.value}.`] };
  }
  async function excludedTotal(ctx) {
    const parts = await Promise.all(Object.values(REASONS).map((reason) => ctx.metric(['hub-expense', { reason, measure: 'count' }])));
    const total = parts.reduce((a, p) => a + p.value, 0);
    const rows = parts.flatMap((p) => p.rows);
    return { title: 'Excluded as not spending', format: 'count', value: total, columns: parts[0].columns, rows, documentIds: unique(rows.map((r) => r.documentId)),
      calc: [`${Object.keys(REASONS).map((k, i) => `${k} ${parts[i].value}`).join(' + ')} = ${total}.`] };
  }
  const NUM = '(\\d[\\d,]*)';
  const STEPS = {
    'Statements parsed': [
      { name: 'Statements parsed', main: true, shown: new RegExp(`${NUM} /`), r: () => ({ metric: ['statements-hub', { which: 'parsed' }] }) },
      { name: 'Statement documents', shown: new RegExp(`/ ${NUM}`), r: () => ({ metric: 'statements-hub' }) },
      { name: 'Not parsed', after: /^not parsed/, shown: new RegExp(`${NUM} not parsed`), r: unparsed },
      { name: 'Documents at intake', after: /^documents/, shown: new RegExp(`${NUM} documents`), r: () => ({ metric: 'documents' }) },
    ],
    Transactions: [
      { name: 'Transactions', main: true, shown: new RegExp(`Transactions\\s*${NUM}`), r: () => ({ metric: 'transactions' }) },
      { name: 'Money in', after: /^in\b/, shown: new RegExp(`${NUM} in\\b`), r: flow('income') },
      { name: 'Transfers', after: /^transfers/, shown: new RegExp(`${NUM} transfers`), r: flow('transfer') },
      { name: 'No direction', after: /^unclassified/, shown: new RegExp(`${NUM} unclassified`), r: flow('unknown') },
    ],
    'Money out': [
      { name: 'Money out', main: true, shown: new RegExp(`Money out\\s*${NUM}`), r: hub({ which: 'all', measure: 'count' }) },
      { name: 'Excluded as not spending', after: /^excluded/, shown: new RegExp(`${NUM} excluded`), r: excludedTotal },
    ],
    'To map': [
      { name: 'Transactions to map', main: true, shown: new RegExp(`To map\\s*${NUM}`), r: hub({ measure: 'count' }) },
      { name: 'Household spending', money: true, shown: /\$(\d[\d,.]*) household/, r: hub({ measure: 'amount' }) },
    ],
  };
  const stepOf = (el) => {
    const s = el.closest('.recon-step');
    return s ? { el: s, list: STEPS[(s.querySelector('.recon-step-label') || {}).textContent || ''] || [] } : null;
  };
  async function stepFigure(ctx) {
    const s = stepOf(ctx.el);
    if (!s) return null;
    const main = ctx.el.closest('.recon-step-value');
    const spec = (/\/$/.test(ctx.before) ? s.list.find((x) => x.name === 'Statement documents') : null)
      || s.list.find((x) => (main ? x.main : x.after && x.after.test(ctx.after)))
      || (ctx.displayed && ctx.displayed.kind === 'money' ? s.list.find((x) => x.money) : null);
    return spec ? spec.r(ctx) : null;
  }
  function cardOf(ctx, title, items, extra) {
    const shownNum = (i) => Number(String(i.shown).replace(/[^0-9.]/g, ''));
    const tie = (i) => { const f = 10 ** (String(i.shown).split('.')[1] || '').length; return Math.abs(Math.round(Math.abs(i.value) * f) / f - shownNum(i)) < 0.5 / f + 1e-9; };
    const present = items.filter((i) => i.shown != null);
    const head = present.find((i) => !tie(i)) || present[0];
    if (head) {
      const n = shownNum(head);
      ctx.text = (head.money ? '$' : '') + head.shown;
      ctx.displayed = { kind: head.money ? 'money' : 'number', value: n, raw: n, scale: 1, decimals: (String(head.shown).split('.')[1] || '').length, negative: false };
    }
    return { title, value: head ? head.value : null, format: head && head.money ? 'money' : 'count',
      columns: [{ key: 'figure', label: 'Figure' }, { key: 'shown', label: 'On screen', align: 'right' }, { key: 'recalc', label: 'Recalculated', align: 'right' }, { key: 'ties', label: 'Ties' }],
      rows: items.map((i) => ({ figure: i.name, shown: i.shown == null ? 'not shown' : `${i.money ? '$' : ''}${i.shown}`, recalc: i.money ? ctx.money(i.value) : Number(i.value).toLocaleString(), ties: i.shown == null ? '' : tie(i) ? 'Yes' : 'No' })),
      ...extra };
  }
  async function stepCard(ctx) {
    const s = stepOf(ctx.el);
    const text = s.el.textContent.replace(/\s+/g, ' ');
    const resolved = await Promise.all(s.list.map(async (x) => {
      const res = await x.r(ctx);
      if (res.metric) { const m = await ctx.metric(res.metric); return { value: m.value, docs: (m.sources || []).map((d) => d.documentId) }; }
      return { value: res.value, docs: res.documentIds || [] };
    }));
    const items = s.list.map((x, i) => { const hit = text.match(x.shown); return { name: x.name, money: x.money, shown: hit ? hit[1] : null, value: resolved[i].value }; });
    return cardOf(ctx, (s.el.querySelector('.recon-step-label') || {}).textContent || 'Step', items, { documentIds: unique(resolved.flatMap((x) => x.docs)),
      calc: ['Each figure is rebuilt from documents and parsed transactions in this matter and compared with what this step shows.'] });
  }
  const excludedReason = (box) => Object.keys(REASONS).find((k) => box.textContent.includes(k));
  async function excluded(ctx) {
    if (ctx.text === '$100,000') return threshold();
    const box = ctx.el.closest('.excluded-item');
    const reason = excludedReason(box);
    if (!reason) return null;
    return { metric: ['hub-expense', { reason: REASONS[reason], measure: ctx.displayed && ctx.displayed.kind === 'money' ? 'amount' : 'count' }] };
  }
  async function excludedCard(ctx) {
    const reason = excludedReason(ctx.el);
    if (!reason) return null;
    const m = await ctx.metric(['hub-expense', { reason: REASONS[reason], measure: 'count' }]);
    const hit = ((ctx.el.querySelector('strong') || {}).textContent || '').match(/(\d[\d,]*)\s*·\s*\$(\d[\d,.]*)/);
    return cardOf(ctx, `Excluded: ${reason}`, [
      { name: 'Rows', shown: hit ? hit[1] : null, value: m.value },
      { name: 'Amount', money: true, shown: hit ? hit[2] : null, value: m.altValues.amount },
    ], { documentIds: unique(m.rows.map((r) => r.documentId)), calc: m.calc });
  }
  function threshold() {
    return { status: 'text', title: 'Parsing-error threshold', calc: ['Veritas holds back any single outflow over this amount as a likely parsing error until someone checks the statement. It is a setting in the app, not a figure from this matter.'] };
  }
  async function checkLine(ctx) {
    if (ctx.text === '$100,000') return threshold();
    if (/^statement/.test(ctx.after)) return unparsed(ctx);
    if (/^transaction/.test(ctx.after)) return { metric: ['transactions', { flow: 'unknown' }] };
    return null;
  }

  VeritasRecon.define({
    byId: figures,
    match: [
      { selector: '.recon-step', recon: stepFigure },
      { selector: '.recon-checks', recon: checkLine },
      { selector: '.excluded-item', recon: excluded },
      { selector: '#afiMapCategoryBody', recon: lineCell },
      { selector: '#afiUnmappedBody', recon: merchantCell },
    ],
    cards: [
      { selector: '.recon-step', recon: stepCard },
      { selector: '.excluded-item', recon: excludedCard },
    ],
    inert: ['.doc-row-name', '#afiUnmappedBody td:first-child', '#afiMapCategoryBody td:nth-child(1)', '#afiMapCategoryBody td:nth-child(2)'],
  });
})();
