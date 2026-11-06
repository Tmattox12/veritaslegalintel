// Recons for the Income Hub (document-hub-income.html, logic in income-hub.js).
// Counts and totals are rebuilt from the recon metrics and raw lists, not from the
// /income-hub response the page draws from, so a disagreement between the two shows.
(function () {
  const INCOME_CATEGORY = 'Tax Returns & Income';
  const REASONS = { 'Credit-card credits': 'card_credit', 'Account movement': 'account_movement', 'Transfers / refunds / P2P': 'transfer_or_refund' };
  const NOT_INCOME_TYPES = new Set(['childsupport', 'refund', 'taxrefund', 'transfer', 'gift', 'duplicate']);
  const TYPE_LABELS = { wages: 'Wages / salary', bonus: 'Bonus / commission', rsu: 'RSU / stock proceeds', self: 'Self-employment / business', rental: 'Rental income', invest: 'Interest / dividends', benefits: 'Social Security / disability / unemployment', maint: 'Spousal maintenance received', other: 'Other income' };

  const count = (title, rows, columns, extra) => ({ title, format: 'count', value: rows.length, rows, columns, documentIds: [...new Set(rows.map((r) => r.documentId).filter(Boolean))], ...extra });
  const unique = (list) => [...new Set(list.filter(Boolean))];
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // ---------- documents and statements ----------
  async function otherDocs(ctx) {
    const m = await ctx.metric('documents');
    const rows = m.rows.filter((d) => !['', 'Unclassified', 'Other', INCOME_CATEGORY, 'Financial Statements'].includes(d.category || ''));
    const income = m.rows.filter((d) => d.category === INCOME_CATEGORY).length;
    const stmts = m.rows.filter((d) => d.category === 'Financial Statements').length;
    const uncl = m.rows.filter((d) => !d.category || d.category === 'Unclassified' || d.category === 'Other').length;
    return count('Other documents at intake', rows, m.columns, {
      calc: [`Other = ${m.value} documents - ${income} income - ${stmts} statements - ${uncl} unclassified = ${m.value - income - stmts - uncl}.`],
      summary: { Documents: m.value, Income: income, Statements: stmts, Unclassified: uncl },
    });
  }
  async function unparsed(ctx) {
    const [all, parsed] = await Promise.all([ctx.metric('statements-hub'), ctx.metric(['statements-hub', { which: 'parsed' }])]);
    const done = new Set(parsed.rows.map((r) => r.documentId));
    const rows = all.rows.filter((r) => !done.has(r.documentId));
    return count('Statement documents not parsed', rows, all.columns, {
      calc: [`Not parsed = ${all.value} statement documents - ${parsed.value} parsed = ${all.value - parsed.value}.`],
      summary: { 'Statement documents': all.value, Parsed: parsed.value },
    });
  }
  async function excludedCount(ctx) {
    const parts = await Promise.all(Object.values(REASONS).map((reason) => ctx.metric(['hub-income', { reason, measure: 'count' }])));
    const total = parts.reduce((a, p) => a + p.value, 0);
    const rows = parts.flatMap((p) => p.rows);
    return { title: 'Inflows excluded', format: 'count', value: total, rows, columns: parts[0].columns, documentIds: unique(rows.map((r) => r.documentId)),
      calc: [`${Object.keys(REASONS).map((k, i) => `${k} ${parts[i].value}`).join(' + ')} = ${total}.`] };
  }

  // Every figure in the four reconciliation steps. `after` picks the figure beside its
  // word; `shown` reads the figure's text when it is listed on the step's card.
  const NUM = '(\\d[\\d,]*)';
  const flow = (flowName) => () => ({ metric: ['transactions', { flow: flowName }] });
  const STEPS = {
    'At intake': [
      { name: 'Documents at intake', main: true, shown: new RegExp(`${NUM} docs`), r: () => ({ metric: 'documents' }) },
      { name: 'Income documents', after: /^income/, shown: new RegExp(`${NUM} income`), r: () => ({ metric: ['documents', { category: INCOME_CATEGORY }] }) },
      { name: 'Statement documents', after: /^statements/, shown: new RegExp(`${NUM} statements`), r: () => ({ metric: 'statements-hub' }) },
      { name: 'Other documents', after: /^other/, shown: new RegExp(`${NUM} other`), r: otherDocs },
      { name: 'Unclassified documents', after: /^unclassified/, shown: new RegExp(`${NUM} unclassified`), r: () => ({ metric: 'documents-unclassified' }) },
    ],
    'Statements parsed': [
      { name: 'Statements parsed', main: true, shown: new RegExp(`${NUM} /`), r: () => ({ metric: ['statements-hub', { which: 'parsed' }] }) },
      { name: 'Statement documents', shown: new RegExp(`/ ${NUM}`), r: () => ({ metric: 'statements-hub' }) },
      { name: 'Transactions parsed', after: /^transactions/, shown: new RegExp(`${NUM} transactions`), r: () => ({ metric: 'transactions' }) },
      { name: 'Not parsed', after: /^not parsed/, shown: new RegExp(`${NUM} not parsed`), r: unparsed },
    ],
    'Routed by direction': [
      { name: 'Money in', main: true, shown: new RegExp(`${NUM} in\\b`), r: flow('income') },
      { name: 'Money out', after: /^out/, shown: new RegExp(`${NUM} out`), r: flow('expense') },
      { name: 'Transfers', after: /^transfers/, shown: new RegExp(`${NUM} transfers`), r: flow('transfer') },
      { name: 'No direction', after: /^unclassified/, shown: new RegExp(`${NUM} unclassified`), r: flow('unknown') },
    ],
    'Income candidates': [
      { name: 'Deposit candidates', main: true, shown: new RegExp(`Income candidates\\s*${NUM}`), r: () => ({ metric: ['hub-income', { measure: 'count' }] }) },
      { name: 'Deposits total', money: true, after: /^in deposits/, shown: /\$(\d[\d,.]*) in deposits/, r: () => ({ metric: ['hub-income', { measure: 'amount' }] }) },
      { name: 'Inflows excluded', after: /^inflows/, shown: new RegExp(`${NUM} inflows`), r: excludedCount },
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

  // Lists every figure on a card, including ones written too tightly to be clickable.
  // The comparison runs against the text in the card; the first figure that does not tie
  // becomes the card's headline, so a mismatch is never hidden by its neighbours.
  function setShown(ctx, item) {
    const raw = String(item.shown);
    const decimals = (raw.split('.')[1] || '').replace(/\D/g, '').length;
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    ctx.text = (item.money ? '$' : '') + raw;
    ctx.displayed = { kind: item.money ? 'money' : 'number', value: n, raw: n, scale: 1, decimals, negative: false };
  }
  function cardOf(ctx, title, items, extra) {
    const shownNum = (i) => Number(String(i.shown).replace(/[^0-9.]/g, ''));
    const tie = (i) => { const f = 10 ** (String(i.shown).split('.')[1] || '').length; return i.shown != null && Math.abs(Math.round(Math.abs(i.value) * f) / f - shownNum(i)) < 0.5 / f + 1e-9; };
    const present = items.filter((i) => i.shown != null);
    const head = present.find((i) => !tie(i)) || present[0];
    if (head) setShown(ctx, head);
    const fmt = (i, v) => (i.money ? ctx.money(v) : Number(v).toLocaleString());
    return { title, value: head ? head.value : null, format: head && head.money ? 'money' : 'count',
      columns: [{ key: 'figure', label: 'Figure' }, { key: 'shown', label: 'On screen', align: 'right' }, { key: 'recalc', label: 'Recalculated', align: 'right' }, { key: 'ties', label: 'Ties' }],
      rows: items.map((i) => ({ figure: i.name, shown: i.shown == null ? 'not shown' : `${i.money ? '$' : ''}${i.shown}`, recalc: fmt(i, i.value), ties: i.shown == null ? '' : tie(i) ? 'Yes' : 'No' })),
      ...extra };
  }
  async function resolveSpec(ctx, spec) {
    const res = await spec.r(ctx);
    if (res.metric) { const m = await ctx.metric(res.metric); return { value: m.value, docs: (m.sources || []).map((x) => x.documentId) }; }
    return { value: res.value, docs: res.documentIds || [] };
  }
  async function stepCard(ctx) {
    const s = stepOf(ctx.el);
    const text = s.el.textContent.replace(/\s+/g, ' ');
    const resolved = await Promise.all(s.list.map((x) => resolveSpec(ctx, x)));
    const items = s.list.map((x, i) => { const hit = text.match(x.shown); return { name: x.name, money: x.money, shown: hit ? hit[1] : null, value: resolved[i].value }; });
    return cardOf(ctx, (s.el.querySelector('.recon-step-label') || {}).textContent || 'Step', items, {
      documentIds: unique(resolved.flatMap((x) => x.docs)),
      calc: ['Each figure is rebuilt from documents and parsed transactions in this matter and compared with what this step shows. Open a figure beside its word for its own line items.'],
    });
  }

  // ---------- accepted income ----------
  const partyKey = (el) => (el.closest('.stat-box') || {}).querySelector && (el.closest('.stat-box').querySelector('[data-party="b"]') ? 'party_b' : 'party_a');
  async function accepted(ctx) {
    const party = partyKey(ctx.el);
    const who = party === 'party_a' ? ctx.names.a : ctx.names.b;
    return { metric: ['accepted-income', { party }], title: `Accepted income: ${who}` };
  }
  async function acceptedMonthly(ctx) {
    const party = partyKey(ctx.el);
    const who = party === 'party_a' ? ctx.names.a : ctx.names.b;
    const m = await ctx.metric(['accepted-income', { party }]);
    if (ctx.displayed && ctx.displayed.kind === 'money') {
      return { metric: ['accepted-income', { party }], title: `Accepted income per month: ${who}`, value: m.value / 12, format: 'money',
        calc: [`Sum of accepted annual amounts = ${ctx.money(m.value)}.`, `Monthly = ${ctx.money(m.value)} / 12 = ${ctx.money(m.value / 12)}.`] };
    }
    return { metric: ['accepted-income', { party }], title: `Accepted sources: ${who}`, value: m.rows.length, format: 'count',
      calc: [`Count of accepted documents with an annual amount above zero = ${m.rows.length}.`] };
  }

  // ---------- income documents ----------
  async function evidence(ctx) { return (await ctx.json('documents/income-evidence')).evidence || []; }
  const evColumns = [{ key: 'filename', label: 'Document' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Review status' }];
  async function pending(ctx) {
    const rows = (await evidence(ctx)).filter((e) => !e.reviewStatus || e.reviewStatus === 'pending')
      .map((e) => ({ filename: e.filename, type: e.documentType || '', status: e.reviewStatus || 'pending', documentId: e.documentId }));
    return count('Income documents pending review', rows, evColumns, { calc: [`Documents filed under "${INCOME_CATEGORY}" with no accepted or rejected review = ${rows.length}.`] });
  }
  const rowEvidence = async (ctx) => {
    const name = ((ctx.el.closest('tr') || ctx.el).querySelector('.doc-file') || {}).textContent || (ctx.el.closest('tr').cells[0] || {}).textContent || '';
    return (await evidence(ctx)).find((e) => name.trim().startsWith(e.filename));
  };
  async function docDetail(ctx) {
    const e = await rowEvidence(ctx);
    if (!e) return null;
    const field = /Gross\s*$/.test(ctx.before) ? ['grossPay', 'Gross pay'] : /Net\s*$/.test(ctx.before) ? ['netPay', 'Net pay'] : /Payment\s*$/.test(ctx.before) ? ['paymentAmount', 'Payment'] : null;
    if (!field) return null;
    return { title: `${field[1]}: ${e.filename}`, value: e[field[0]], format: 'money', documentIds: [e.documentId],
      inputs: [{ label: field[1], value: ctx.money(e[field[0]]), origin: 'document' }],
      calc: [`${field[1]} read from this document by the income extractor: ${ctx.money(e[field[0]])}.`, 'This is a figure on the document, not a calculation. Check it against the original.'] };
  }
  async function reviewerAmount(ctx) {
    const e = await rowEvidence(ctx);
    if (!e) return null;
    return { title: `Annual amount: ${e.filename}`, status: 'entered', value: e.annualAmount, documentIds: [e.documentId],
      summary: { 'Review status': e.reviewStatus || 'pending', Party: e.party === 'party_a' ? ctx.names.a : e.party === 'party_b' ? ctx.names.b : 'Unassigned' },
      calc: ['A reviewer typed this annual amount while reviewing the document. Veritas does not calculate it.'], note: 'Only accepted amounts reach the Income Engine.' };
  }

  // ---------- bank deposits by payer ----------
  const payerRows = () => [...document.querySelectorAll('#depositSources tr[data-source]')];
  const pick = (row, name) => { const n = row.querySelector(`[data-map="${name}"]`); return n ? n.value : ''; };
  async function latestDeposit(ctx) {
    const all = await ctx.metric(['hub-income', { measure: 'count' }]);
    return all.rows.reduce((d, r) => (r.date > d ? r.date : d), '');
  }
  const monthsBetween = (first, last) => {
    if (!first || !last) return 1;
    const [y1, m1] = first.split('-').map(Number);
    const [y2, m2] = last.split('-').map(Number);
    return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
  };
  // Annual amount for one payer, using the basis selected on its row.
  async function payerAnnual(ctx, row) {
    const name = row.dataset.source;
    const basis = pick(row, 'basis') || 'monthly';
    const m = await ctx.metric(['hub-source', { name, measure: 'amount' }]);
    const total = m.rows.reduce((a, r) => a + Number(r.amount), 0);
    const dates = m.rows.map((r) => r.date).filter(Boolean).sort();
    const months = new Set(dates.map((d) => d.slice(0, 7))).size;
    const docs = unique(m.rows.map((r) => r.documentId));
    let annual; let steps;
    if (basis === 'custom') {
      annual = Number(pick(row, 'custom')) || 0;
      steps = ['A person typed this annual amount for the payer.'];
    } else if (basis === 'span') {
      const span = monthsBetween(dates[0], dates[dates.length - 1]);
      annual = (round2(total) / span) * 12;
      steps = [`${m.rows.length} deposits totaling ${ctx.money(total)}.`, `Span ${dates[0]} to ${dates[dates.length - 1]} = ${span} months.`, `Annual = ${ctx.money(total)} / ${span} x 12 = ${ctx.money(annual)}.`];
    } else if (basis === 'last12') {
      const end = await latestDeposit(ctx);
      const start = new Date(`${end}T00:00:00Z`);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      const from = start.toISOString().slice(0, 10);
      const use = m.rows.filter((r) => r.date > from && r.date <= end);
      annual = use.reduce((a, r) => a + Number(r.amount), 0);
      steps = [`Latest deposit from any payer = ${end}.`, `Deposits from this payer after ${from} through ${end}: ${use.length}.`, `Annual = sum of those deposits = ${ctx.money(annual)}.`];
    } else {
      const monthly = round2(total / Math.max(1, months));
      annual = monthly * 12;
      steps = [`${m.rows.length} deposits totaling ${ctx.money(total)} in ${months} months that had a deposit.`, `Monthly average = ${ctx.money(total)} / ${months} = ${ctx.money(monthly)}.`, `Annual = ${ctx.money(monthly)} x 12 = ${ctx.money(annual)}.`];
    }
    return { name, basis, annual, steps, rows: m.rows, columns: m.columns, docs, type: pick(row, 'type'), party: pick(row, 'party'), confirmed: !row.querySelector('.status-pill.pending') };
  }
  async function payerInput(ctx) {
    const row = ctx.el.closest('tr[data-source]');
    if (!row) return null;
    const p = await payerAnnual(ctx, row);
    const base = { title: `Annual amount: ${p.name}`, value: p.annual, rows: p.rows, columns: p.columns, documentIds: p.docs, format: 'money',
      summary: { 'Annual basis': p.basis }, calc: p.steps.concat('The field shows this rounded to the dollar. Bank deposits are net of withholding.') };
    return p.basis === 'custom' ? { ...base, status: 'entered' } : base;
  }
  async function allPayers(ctx) { return Promise.all(payerRows().map((r) => payerAnnual(ctx, r))); }
  const payerColumns = [{ key: 'payer', label: 'Payer' }, { key: 'type', label: 'Income type' }, { key: 'party', label: 'Person' }, { key: 'basis', label: 'Basis' }, { key: 'annual', label: 'Annual', money: true, align: 'right' }];
  const payerLine = (ctx, p) => ({ payer: p.name, type: p.type, party: p.party === 'party_a' ? ctx.names.a : p.party === 'party_b' ? ctx.names.b : p.party === 'joint' ? 'Joint' : 'None', basis: p.basis, annual: round2(p.annual) });

  async function mapSummaryCell(ctx) {
    const row = ctx.row;
    if (!row || !ctx.el.closest('table')) return null;
    const label = (row.cells[0].textContent || '').trim();
    const col = [...row.cells].indexOf(ctx.el.closest('td'));
    if (col < 1) return null;
    const payers = (await allPayers(ctx)).filter((p) => !NOT_INCOME_TYPES.has(p.type) && p.party);
    const isTotal = /^Total income/.test(label);
    const isMonth = /^Per month/.test(label);
    const code = Object.keys(TYPE_LABELS).find((k) => TYPE_LABELS[k] === label);
    if (!isTotal && !isMonth && !code) return null;
    const use = isTotal || isMonth ? payers : payers.filter((p) => p.type === code);
    const shareA = (p) => (p.party === 'joint' ? p.annual / 2 : p.party === 'party_a' ? p.annual : 0);
    const shareB = (p) => (p.party === 'joint' ? p.annual / 2 : p.party === 'party_b' ? p.annual : 0);
    const share = col === 1 ? shareA : col === 2 ? shareB : (p) => shareA(p) + shareB(p);
    const sum = use.reduce((a, p) => a + share(p), 0);
    const who = col === 1 ? ctx.names.a : col === 2 ? ctx.names.b : 'both people';
    const shown = use.filter((p) => share(p) > 0);
    return { title: `${label} (${who})`, value: isMonth ? sum / 12 : sum, format: 'money', columns: payerColumns, rows: shown.map((p) => payerLine(ctx, p)), documentIds: unique(shown.flatMap((p) => p.docs)),
      calc: [`Annual amounts of the payers listed, for ${who}; a joint payer counts half to each person.`, `Total = ${ctx.money(sum)}.`, ...(isMonth ? [`Per month = ${ctx.money(sum)} / 12 = ${ctx.money(sum / 12)}.`] : [])] };
  }
  async function flagFigure(ctx) {
    const payers = await allPayers(ctx);
    const flag = ctx.el.closest('.map-flag');
    if (!flag) return null;
    if (/not counted/.test(flag.textContent)) {
      const use = payers.filter((p) => !NOT_INCOME_TYPES.has(p.type) && !p.party);
      const sum = use.reduce((a, p) => a + p.annual, 0);
      return { title: 'Income with no person assigned', value: sum, format: 'money', columns: payerColumns, rows: use.map((p) => payerLine(ctx, p)), documentIds: unique(use.flatMap((p) => p.docs)),
        calc: [`Sum of the annual amounts of ${use.length} income payer(s) with no person = ${ctx.money(sum)}.`] };
    }
    if (/Not income/.test(flag.textContent)) {
      const use = payers.filter((p) => NOT_INCOME_TYPES.has(p.type));
      const sum = use.reduce((a, p) => a + p.annual, 0);
      return { title: 'Deposits mapped as not income', value: sum, format: 'money', columns: payerColumns, rows: use.map((p) => payerLine(ctx, p)), documentIds: unique(use.flatMap((p) => p.docs)),
        calc: [`Sum of the annual amounts of ${use.length} payer(s) mapped to a type that does not count as income = ${ctx.money(sum)}.`] };
    }
    return null;
  }
  async function flagsCard(ctx) {
    const payers = await allPayers(ctx);
    const text = ctx.el.textContent.replace(/\s+/g, ' ');
    const noPerson = payers.filter((p) => !NOT_INCOME_TYPES.has(p.type) && !p.party);
    const pendingList = payers.filter((p) => !p.confirmed);
    const notIncome = payers.filter((p) => NOT_INCOME_TYPES.has(p.type));
    const hit = (re) => { const h = text.match(re); return h ? h[1] : null; };
    const items = [
      { name: 'Income payers with no person', shown: hit(/(\d[\d,]*) income payer/), value: noPerson.length },
      { name: 'Annual amount with no person', money: true, shown: hit(/\$(\d[\d,.]*) \/ yr not counted/), value: noPerson.reduce((a, p) => a + p.annual, 0) },
      { name: 'Suggestions not confirmed', shown: hit(/(\d[\d,]*) suggestion/), value: pendingList.length },
      { name: 'Not income, annual', money: true, shown: hit(/Not income: \$(\d[\d,.]*)/), value: notIncome.reduce((a, p) => a + p.annual, 0) },
    ];
    return cardOf(ctx, 'Mapping checks', items, { documentIds: unique(payers.flatMap((p) => p.docs)), calc: ['Recounted from the person, type, and basis selected on each payer row.'] });
  }

  async function excluded(ctx) {
    const box = ctx.el.closest('.excluded-item');
    const reason = Object.keys(REASONS).find((k) => box.textContent.includes(k));
    if (!reason) return null;
    return { metric: ['hub-income', { reason: REASONS[reason], measure: ctx.displayed && ctx.displayed.kind === 'money' ? 'amount' : 'count' }] };
  }
  async function excludedCard(ctx) {
    const reason = Object.keys(REASONS).find((k) => ctx.el.textContent.includes(k));
    if (!reason) return null;
    const m = await ctx.metric(['hub-income', { reason: REASONS[reason], measure: 'count' }]);
    const head = (ctx.el.querySelector('strong') || {}).textContent || '';
    const hit = head.match(/(\d[\d,]*)\s*·\s*\$(\d[\d,.]*)/);
    const items = [
      { name: `${reason}: rows`, shown: hit ? hit[1] : null, value: m.value },
      { name: `${reason}: amount`, money: true, shown: hit ? hit[2] : null, value: m.altValues.amount },
    ];
    return cardOf(ctx, `Excluded: ${reason}`, items, { documentIds: unique(m.rows.map((r) => r.documentId)), calc: m.calc });
  }

  async function accountDeposits(ctx) {
    const sel = ctx.el.closest('.map-account').querySelector('[data-account]');
    const account = sel ? sel.dataset.account : '';
    const m = await ctx.metric(['hub-income', { measure: 'count' }]);
    const rows = m.rows.filter((r) => r.account === account);
    return count(`Deposits into ${account}`, rows, m.columns, { calc: [`Deposit candidates landing in this account = ${rows.length}.`] });
  }
  async function payerCell(ctx) {
    const row = ctx.el.closest('tr[data-source]');
    if (!row) return null;
    const name = row.dataset.source;
    const col = [...row.cells].indexOf(ctx.el.closest('td'));
    if (col === 1) return { metric: ['hub-source', { name, measure: 'count' }] };
    if (col === 3) return { metric: ['hub-source', { name, measure: 'amount' }] };
    if (col === 2 && /^mo\b/.test(ctx.after)) return { metric: ['hub-source', { name, measure: 'months' }] };
    return null;
  }
  async function payerCard(ctx) {
    const name = ctx.el.closest('tr').dataset.source;
    const m = await ctx.metric(['hub-source', { name, measure: 'months' }]);
    const hit = ((ctx.el.querySelector('.doc-sub') || {}).textContent || '').match(/(\d[\d,]*) mo with deposits/);
    return cardOf(ctx, `Months with deposits: ${name}`, [{ name: 'Months with a deposit', shown: hit ? hit[1] : null, value: m.value }], { documentIds: unique(m.rows.map((r) => r.documentId)), calc: m.calc });
  }
  async function depositDetail(ctx) {
    const detail = ctx.el.closest('tr.map-detail');
    const inner = ctx.el.closest('tr');
    if (!detail || !inner) return null;
    const m = await ctx.metric(['hub-source', { name: detail.dataset.detail, measure: 'amount' }]);
    const row = m.rows[inner.rowIndex - 1];
    if (!row) return null;
    return { title: `Deposit ${row.date}`, value: row.amount, format: 'money', columns: m.columns, rows: [row], documentIds: [row.documentId],
      calc: [`Parsed from the statement: ${row.description}, ${row.date}, ${ctx.money(row.amount)}.`] };
  }

  async function checkLine(ctx) {
    if (/^statement/.test(ctx.after)) return unparsed(ctx);
    if (/^document/.test(ctx.after)) return { metric: 'documents-unclassified' };
    if (/^transaction/.test(ctx.after)) return { metric: ['transactions', { flow: 'unknown' }] };
    return null;
  }

  VeritasRecon.define({
    byId: { acceptedA: accepted, acceptedB: accepted, acceptedAMonthly: acceptedMonthly, acceptedBMonthly: acceptedMonthly, pendingCount: pending },
    match: [
      { selector: '.recon-step', recon: stepFigure },
      { selector: '.recon-checks', recon: checkLine },
      { selector: '#incomeDocs [data-field="annual"]', recon: reviewerAmount },
      { selector: '#incomeDocs .doc-sub', recon: docDetail },
      { selector: '#businessIncome td.num', recon: reviewerAmount },
      { selector: '#depositSources [data-map="custom"]', recon: payerInput },
      { selector: '#depositSources .map-account', recon: accountDeposits },
      { selector: '#depositSources tr.map-detail', recon: depositDetail },
      { selector: '#depositSources tr[data-source]', recon: payerCell },
      { selector: '.excluded-item', recon: excluded },
      { selector: '#incomeMapSummary .map-flag', recon: flagFigure },
      { selector: '#incomeMapSummary table', recon: mapSummaryCell },
    ],
    cards: [
      { selector: '.recon-step', recon: stepCard },
      { selector: '.excluded-item', recon: excludedCard },
      { selector: '#incomeMapSummary .map-flags', recon: flagsCard },
      { selector: '#depositSources tr[data-source] > td:nth-child(3)', recon: payerCard },
    ],
    inert: ['.doc-file', '.upload-name'],
  });
})();
