// Reconciliation evidence for one matter. Read-only. Every figure here is rebuilt
// from the same rows and rules the pages use, so a recon can show the line items,
// the calculation, and the source documents behind a number on screen, and the
// page can compare the rebuilt value with what it displays.
const express = require('express');
const { getOriginal } = require('../services/storage');
const { extractText } = require('../services/file-extractor');
const { extractIncomeEvidence } = require('../services/income-evidence-extractor');
const { expenseExclusion } = require('../services/expense-workbook');
const AFITaxonomy = require('../../afi-taxonomy');

const router = express.Router({ mergeParams: true });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const abs = (t) => Math.abs(Number(t.amount) || 0);
const last4 = (m) => String(m || '').replace(/\D/g, '').slice(-4);

// The rules below mirror server/index.js (analysis-summary, income-hub). index.js
// publishes its income rule on app.locals so both always count the same rows.
const ANALYSIS_MOVEMENT_RE = /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/;
const isAnalysisExpense = (t, category) => {
  const d = (t.description || '').toLowerCase();
  const movement = AFITaxonomy.isAccountMovement(category) || category === 'employment_income' || category === 'tax' || ANALYSIS_MOVEMENT_RE.test(d);
  return t.flow_type === 'expense' && category && !movement && abs(t) <= 100000;
};
const isAnalysisIncome = (t) => t.flow_type === 'income' && t.account_type !== 'credit_card'
  && !AFITaxonomy.excludedFromIncome(t.mapped_category || t.suggested_category, t.description, t.mapping_status);

// What an income document says depends only on the document and how it is classified.
const evidenceCache = new Map();
async function evidenceFor(doc) {
  const key = `${doc.id}|${doc.document_type || ''}`;
  if (evidenceCache.has(key)) return evidenceCache.get(key);
  let text = '';
  if (doc.s3_key) {
    try { text = (await extractText({ originalname: doc.filename, buffer: await getOriginal(doc.s3_key) })).text || ''; } catch (e) { /* unreadable: stays visible */ }
  }
  const ev = extractIncomeEvidence(doc.filename, text, doc.document_type);
  evidenceCache.set(key, ev);
  return ev;
}

async function loadMatter(req) {
  const id = req.params.matterId;
  const all = (sql, p) => new Promise((ok, no) => req.db.all(sql, p, (e, r) => (e ? no(e) : ok(r || []))));
  const [docs, statements, transactions, reviews] = await Promise.all([
    all(`SELECT id, filename, category, document_type, extraction_status, ocr_needed, manual_notes, uploaded_at, s3_key
         FROM documents WHERE matter_id = ? AND deleted_at IS NULL`, [id]),
    all(`SELECT id, document_id, bank_name, account_type, account_number_masked, statement_start, statement_end,
                beginning_balance, ending_balance, processing_status
         FROM bank_statements WHERE matter_id = ?`, [id]),
    all(`SELECT bt.id, bt.bank_statement_id, bt.transaction_date, bt.description, bt.amount, bt.flow_type, bt.suggested_category,
                bt.mapped_category, bt.mapping_status, bs.account_type, bs.bank_name, bs.account_number_masked, bs.document_id
         FROM bank_transactions bt JOIN bank_statements bs ON bs.id = bt.bank_statement_id
         WHERE bs.matter_id = ?`, [id]),
    all(`SELECT r.document_id, r.party, r.annual_amount, r.status FROM income_evidence_reviews r WHERE r.matter_id = ?`, [id]),
  ]);
  const docById = new Map(docs.map((d) => [d.id, d]));
  const activeTxns = transactions.filter((t) => docById.has(t.document_id));
  return { id, docs, docById, statements, transactions: activeTxns, reviews, incomeExclusion: req.app.locals.reconRules.incomeExclusion };
}

const txnColumns = [
  { key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'account', label: 'Account' },
  { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', money: true, align: 'right' },
];
const txnRow = (t) => ({
  date: t.transaction_date || '',
  description: t.description || '',
  account: [t.bank_name, t.account_type, last4(t.account_number_masked) ? `••${last4(t.account_number_masked)}` : null].filter(Boolean).join(' '),
  category: t.mapped_category || t.suggested_category || '',
  amount: round2(abs(t)),
  documentId: t.document_id,
});
const sortByDate = (rows) => rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

// One row per statement: how many of the matching transactions came from it, and their total.
function byStatementRows(m, txns) {
  const g = new Map();
  txns.forEach((t) => {
    const r = g.get(t.bank_statement_id) || { statementId: t.bank_statement_id, documentId: t.document_id, count: 0, amount: 0 };
    r.count++; r.amount += abs(t);
    g.set(t.bank_statement_id, r);
  });
  const stById = new Map(m.statements.map((s) => [s.id, s]));
  return [...g.values()].map((r) => {
    const s = stById.get(r.statementId) || {};
    return {
      statement: (m.docById.get(r.documentId) || {}).filename || '',
      account: [s.bank_name, s.account_type, last4(s.account_number_masked) ? `••${last4(s.account_number_masked)}` : null].filter(Boolean).join(' '),
      period: [s.statement_start, s.statement_end].filter(Boolean).join(' to '),
      count: r.count, amount: round2(r.amount), documentId: r.documentId,
    };
  }).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}
const statementColumns = [
  { key: 'statement', label: 'Statement' }, { key: 'account', label: 'Account' }, { key: 'period', label: 'Period' },
  { key: 'count', label: 'Transactions', align: 'right' }, { key: 'amount', label: 'Amount', money: true, align: 'right' },
];

const docColumns = [{ key: 'filename', label: 'Document' }, { key: 'category', label: 'Category' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Read status' }];
const docRow = (d) => ({ filename: d.filename, category: d.category || 'Unclassified', type: d.document_type || '', status: d.extraction_status || '', documentId: d.id });

// Metric builders. Each returns the rebuilt value plus how it was reached.
function metricBuilders(m) {
  const completed = m.statements.filter((s) => s.processing_status === 'completed' && m.docById.has(s.document_id));
  const coverage = new Set(completed.map((s) => (s.statement_start || '').slice(0, 7)).filter(Boolean));
  const monthCount = Math.max(1, coverage.size);
  const money0 = (v) => money(v);

  const docsMetric = (title, list, note) => ({
    title, format: 'count', value: list.length, columns: docColumns, rows: list.map(docRow),
    summary: { Documents: list.length },
    calc: [note, `Count of documents listed = ${list.length}.`],
  });

  const incomeCandidates = () => {
    const rows = m.transactions.filter(isAnalysisIncome);
    const total = rows.reduce((a, t) => a + abs(t), 0);
    return { rows, total, monthly: total / monthCount };
  };

  const hubIncome = () => {
    const inflow = m.transactions.filter((t) => t.flow_type === 'income');
    const candidates = inflow.filter((t) => !m.incomeExclusion(t));
    const excluded = (reason) => inflow.filter((t) => m.incomeExclusion(t) === reason);
    return { inflow, candidates, excluded };
  };

  const sourceName = (t) => (t.description || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).slice(0, 4).join(' ').trim() || 'UNKNOWN';

  const flowMetric = (title, list, calc) => {
    const total = round2(list.reduce((a, t) => a + abs(t), 0));
    return { title, format: 'count', value: list.length, altValues: { amount: total }, columns: statementColumns, rows: byStatementRows(m, list),
      summary: { Transactions: list.length, 'Total amount': money0(total) }, calc };
  };

  return {
    documents: (q) => {
      const list = q.category ? m.docs.filter((d) => (d.category || 'Unclassified') === q.category) : m.docs;
      return docsMetric(q.category ? `${q.category} documents` : 'Documents', list,
        q.category ? `Documents in this matter filed under "${q.category}", excluding deleted documents.` : 'All documents uploaded to this matter, excluding deleted documents.');
    },
    'documents-unclassified': () => docsMetric('Unclassified documents', m.docs.filter((d) => !d.category || d.category === 'Unclassified' || d.category === 'Other'),
      'Documents whose category is blank, "Unclassified", or "Other".'),
    statements: () => ({
      title: 'Statements parsed', format: 'count', value: completed.length,
      columns: [{ key: 'statement', label: 'Statement' }, { key: 'account', label: 'Account' }, { key: 'period', label: 'Period' },
        { key: 'opening', label: 'Opening', money: true, align: 'right' }, { key: 'closing', label: 'Closing', money: true, align: 'right' }],
      rows: completed.map((s) => ({ statement: m.docById.get(s.document_id).filename,
        account: [s.bank_name, s.account_type, last4(s.account_number_masked) ? `••${last4(s.account_number_masked)}` : null].filter(Boolean).join(' '),
        period: [s.statement_start, s.statement_end].filter(Boolean).join(' to '), opening: s.beginning_balance, closing: s.ending_balance, documentId: s.document_id,
        accountKey: s.account_number_masked || s.bank_name || 'unknown', hasStart: !!s.statement_start }))
        .sort((a, b) => String(a.period).localeCompare(String(b.period))),
      summary: { 'Statements with processing complete': completed.length },
      calc: ['Bank and card statements whose parsing finished without error.', `Count of statements listed = ${completed.length}.`],
    }),
    'statements-hub': (q) => {
      const statementDocs = m.docs.filter((d) => d.category === 'Financial Statements');
      const parsed = new Set(m.statements.filter((s) => s.processing_status === 'completed').map((s) => s.document_id));
      const failed = new Set(m.statements.filter((s) => s.processing_status === 'error').map((s) => s.document_id));
      const pick = q.which === 'failed' ? statementDocs.filter((d) => failed.has(d.id) && !parsed.has(d.id))
        : q.which === 'parsed' ? statementDocs.filter((d) => parsed.has(d.id)) : statementDocs;
      const label = q.which === 'failed' ? 'Statements that failed to parse' : q.which === 'parsed' ? 'Statement documents parsed' : 'Statement documents';
      return docsMetric(label, pick, `Documents filed under "Financial Statements"${q.which === 'failed' ? ' with a parse error and no successful parse' : q.which === 'parsed' ? ' with a completed parse' : ''}.`);
    },
    'coverage-months': () => {
      const g = new Map();
      completed.forEach((s) => { const k = (s.statement_start || '').slice(0, 7); if (!k) return; const r = g.get(k) || { month: k, count: 0, files: [], documentId: s.document_id }; r.count++; r.files.push(m.docById.get(s.document_id).filename); g.set(k, r); });
      return { title: 'Months covered', format: 'count', value: g.size, columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Statements', align: 'right' }, { key: 'files', label: 'Documents' }],
        rows: [...g.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, files: r.files.join(', ') })),
        summary: { 'Distinct statement months': g.size }, calc: ['Take the start month of every parsed statement.', `Count of distinct months = ${g.size}.`],
        sourceIds: completed.map((s) => s.document_id) };
    },
    transactions: (q) => {
      const list = q.flow ? m.transactions.filter((t) => (['income', 'expense', 'transfer', 'unknown'].includes(t.flow_type) ? t.flow_type : 'unknown') === q.flow) : m.transactions;
      return flowMetric(q.flow ? `${q.flow} transactions` : 'Transactions parsed', list,
        [`Every transaction parsed from statements in this matter${q.flow ? ` with direction "${q.flow}"` : ''}, grouped by statement.`, `Sum of the Transactions column = ${list.length.toLocaleString()}.`]);
    },
    'income-candidate': (q) => {
      const c = incomeCandidates();
      const monthly = round2(c.monthly), annual = round2(c.monthly * 12);
      const isAnnual = q.period === 'annual';
      return { title: isAnnual ? 'Bank-deposit income candidates (annualized)' : 'Bank-deposit income candidates (monthly)', format: 'money', value: isAnnual ? annual : monthly,
        columns: txnColumns, rows: sortByDate(c.rows.map(txnRow)),
        summary: { 'Deposit rows': c.rows.length, 'Total deposits': money0(c.total), 'Statement months': monthCount, 'Monthly average': money0(monthly), Annualized: money0(annual) },
        calc: ['Include deposits on non-credit-card accounts. Exclude card credits and account movements.', `Total of the rows listed = ${money0(c.total)}.`,
          `Monthly average = ${money0(c.total)} / ${monthCount} statement months = ${money0(monthly)}.`, ...(isAnnual ? [`Annualized = ${money0(c.monthly)} x 12 = ${money0(annual)}.`] : []),
          'Review only. These deposits are candidates, not accepted income.'] };
    },
    'accepted-income': (q) => {
      const rows = m.reviews.filter((r) => r.status === 'accepted' && Number(r.annual_amount) > 0 && m.docById.has(r.document_id) && (!q.party || r.party === q.party));
      const total = round2(rows.reduce((a, r) => a + Number(r.annual_amount), 0));
      return { title: q.party ? `Accepted income (${q.party === 'party_a' ? 'Party A' : 'Party B'})` : 'Accepted income', format: 'money', value: total,
        columns: [{ key: 'filename', label: 'Document' }, { key: 'party', label: 'Party' }, { key: 'amount', label: 'Annual amount accepted', money: true, align: 'right' }],
        rows: rows.map((r) => ({ filename: m.docById.get(r.document_id).filename, party: r.party === 'party_a' ? 'Party A' : r.party === 'party_b' ? 'Party B' : '', amount: Number(r.annual_amount), documentId: r.document_id })),
        summary: { 'Documents accepted': rows.length, 'Annual total': money0(total) },
        calc: ['Each amount was entered and accepted by a reviewer in the Income Hub for that document.', `Sum of the accepted annual amounts = ${money0(total)}.`] };
    },
    'expense-category': (q) => {
      const rows = m.transactions.filter((t) => { const c = t.mapped_category || t.suggested_category; return c === q.category && isAnalysisExpense(t, c); });
      const total = rows.reduce((a, t) => a + abs(t), 0);
      const monthly = round2(total / monthCount);
      return { title: `Expense: ${q.category}`, format: 'money', value: monthly, columns: txnColumns, rows: sortByDate(rows.map(txnRow)),
        summary: { Transactions: rows.length, Total: money0(total), 'Statement months': monthCount, 'Monthly average': money0(monthly) },
        calc: [`Outflows mapped to "${q.category}", excluding transfers, card payments, and amounts over $100,000 held for review.`, `Total = ${money0(total)}.`, `Monthly average = ${money0(total)} / ${monthCount} statement months = ${money0(monthly)}.`] };
    },
    'hub-income': (q) => {
      const h = hubIncome();
      const reason = q.reason;
      const list = q.which === 'all' ? h.inflow : reason ? h.excluded(reason) : h.candidates;
      const total = round2(list.reduce((a, t) => a + abs(t), 0));
      const labels = { card_credit: 'Credit card credits and refunds', account_movement: 'Account movements', transfer_or_refund: 'Transfers and refunds' };
      const title = q.which === 'all' ? 'All money coming in' : reason ? `Excluded from income: ${labels[reason] || reason}` : 'Income deposit candidates';
      return { title, format: q.measure === 'count' ? 'count' : 'money', value: q.measure === 'count' ? list.length : total, altValues: { count: list.length, amount: total },
        columns: txnColumns, rows: sortByDate(list.map(txnRow)), summary: { Rows: list.length, Total: money0(total) },
        calc: [reason ? `Inflows the Income Hub rule classifies as "${labels[reason] || reason}".` : q.which === 'all' ? 'Every transaction whose direction is money in.' : 'Inflows left after removing card credits, account movements, transfers, and refunds.', `${list.length} rows totaling ${money0(total)}.`] };
    },
    'hub-source': (q) => {
      const rows = hubIncome().candidates.filter((t) => sourceName(t) === q.name);
      const total = rows.reduce((a, t) => a + abs(t), 0);
      const months = new Set(rows.map((t) => (t.transaction_date || '').slice(0, 7)).filter(Boolean)).size;
      const monthly = round2(total / Math.max(1, months));
      const v = q.measure === 'monthly' ? monthly : q.measure === 'count' ? rows.length : q.measure === 'months' ? months : round2(total);
      return { title: `Income source: ${q.name}`, format: q.measure === 'count' || q.measure === 'months' ? 'count' : 'money', value: v, columns: txnColumns, rows: sortByDate(rows.map(txnRow)),
        summary: { Deposits: rows.length, Total: money0(total), 'Months with deposits': months, 'Average per month with a deposit': money0(monthly) },
        calc: [`Deposit candidates whose description begins "${q.name}".`, `Total = ${money0(total)} across ${rows.length} deposits.`, `Average = ${money0(total)} / ${months} months that had a deposit = ${money0(monthly)}.`] };
    },
    'hub-expense': (q) => {
      const out = m.transactions.filter((t) => t.flow_type === 'expense');
      const list = q.which === 'all' ? out : q.reason ? out.filter((t) => expenseExclusion(t) === q.reason) : out.filter((t) => !expenseExclusion(t));
      const total = round2(list.reduce((a, t) => a + abs(t), 0));
      return { title: q.which === 'all' ? 'All money going out' : q.reason ? `Excluded from expenses: ${q.reason.replace(/_/g, ' ')}` : 'Expense transactions to map',
        format: q.measure === 'count' ? 'count' : 'money', value: q.measure === 'count' ? list.length : total, altValues: { count: list.length, amount: total },
        columns: txnColumns, rows: sortByDate(list.map(txnRow)), summary: { Rows: list.length, Total: money0(total) },
        calc: [q.reason ? `Outflows the expense rule excludes as "${q.reason.replace(/_/g, ' ')}".` : q.which === 'all' ? 'Every transaction whose direction is money out.' : 'Outflows left after removing account movements, transfers and payments, amounts held for review, and zero amounts.', `${list.length} rows totaling ${money0(total)}.`] };
    },
    'deposit-basis': (q) => {
      const dep = m.transactions.filter((t) => t.flow_type === 'income' && !m.incomeExclusion(t));
      const byMonth = {};
      dep.forEach((t) => { const k = (t.transaction_date || '').slice(0, 7); if (k) byMonth[k] = (byMonth[k] || 0) + abs(t); });
      const seen = Object.keys(byMonth).sort();
      const months = [];
      if (seen.length) { const c = new Date(`${seen[0]}-01T00:00:00Z`); const e = new Date(`${seen[seen.length - 1]}-01T00:00:00Z`); while (c <= e) { months.push(c.toISOString().slice(0, 7)); c.setUTCMonth(c.getUTCMonth() + 1); } }
      const n = { avg12Month: 12, avg6Month: 6, avg3Month: 3, lastMonthRunRate: 1 }[q.basis] || 12;
      const useMonths = months.slice(-n);
      const vals = useMonths.map((k) => byMonth[k] || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length ? sum / vals.length : 0;
      const annual = round2(avg * 12);
      const inUse = new Set(useMonths);
      return { title: `Deposit basis (last ${n} month${n === 1 ? '' : 's'})`, format: 'money', value: annual,
        columns: txnColumns, rows: sortByDate(dep.filter((t) => inUse.has((t.transaction_date || '').slice(0, 7))).map(txnRow)),
        summary: { Months: useMonths.join(', '), 'Deposits in period': money0(sum), 'Monthly average': money0(avg), Annualized: money0(annual) },
        calc: [`Months used, with any month lacking deposits counted as zero: ${useMonths.join(', ') || 'none'}.`, `Total deposits = ${money0(sum)}.`, `Monthly average = ${money0(sum)} / ${vals.length} = ${money0(avg)}.`, `Annualized = ${money0(avg)} x 12 = ${money0(annual)}.`, 'Review only until accepted.'] };
    },
  };
}

// Plain-language description of a source document, built only from what was read from it.
async function sourceSummary(m, doc, contribution) {
  const parts = [];
  const st = m.statements.filter((s) => s.document_id === doc.id);
  for (const s of st) {
    const acct = [s.bank_name, s.account_type, last4(s.account_number_masked) ? `••${last4(s.account_number_masked)}` : null].filter(Boolean).join(' ');
    const txns = m.transactions.filter((t) => t.bank_statement_id === s.id);
    const inflow = txns.filter((t) => t.flow_type === 'income').reduce((a, t) => a + abs(t), 0);
    const outflow = txns.filter((t) => t.flow_type === 'expense').reduce((a, t) => a + abs(t), 0);
    const unknown = txns.filter((t) => !['income', 'expense'].includes(t.flow_type)).length;
    if (s.processing_status !== 'completed') { parts.push(`${acct || 'Statement'}: parsing ${s.processing_status}.`); continue; }
    parts.push(`${acct || 'Statement'}, ${[s.statement_start, s.statement_end].filter(Boolean).join(' to ') || 'period not read'}. ${txns.length} transactions read: ${money(inflow)} in, ${money(outflow)} out.`);
    if (s.beginning_balance != null && s.ending_balance != null) {
      const expected = s.account_type === 'credit_card' ? s.beginning_balance + outflow - inflow : s.beginning_balance + inflow - outflow;
      const diff = round2(s.ending_balance - expected);
      parts.push(`Opening ${money(s.beginning_balance)}, closing ${money(s.ending_balance)}. ${unknown ? `${unknown} rows have no direction, so the balance can't be fully proved.` : diff === 0 ? 'Activity read ties to the closing balance.' : `Activity read differs from the closing balance by ${money(Math.abs(diff))}; check against the original.`}`);
    }
  }
  if (doc.category === 'Tax Returns & Income') {
    const ev = await evidenceFor(doc);
    const f = [ev.kind === 'pay_stub' ? 'Pay stub' : ev.kind === 'social_security_statement' ? 'Social Security statement' : ev.kind === 'tax_income_record' ? 'Tax or income record' : 'Income document'];
    if (ev.payDate) f.push(`pay date ${ev.payDate}`);
    if (ev.grossPay != null) f.push(`gross ${money(ev.grossPay)}`);
    if (ev.netPay != null) f.push(`net ${money(ev.netPay)}`);
    if (ev.paymentAmount != null) f.push(`payment ${money(ev.paymentAmount)}`);
    parts.push(`${f.join(', ')}.`);
    const rev = m.reviews.find((r) => r.document_id === doc.id);
    if (rev) parts.push(`Review: ${rev.status}${rev.annual_amount ? `, ${money(rev.annual_amount)} per year` : ''}${rev.party ? `, ${rev.party === 'party_a' ? 'Party A' : 'Party B'}` : ''}.`);
  }
  if (!parts.length) parts.push(`${doc.document_type || 'Document'} filed under ${doc.category || 'Unclassified'}.`);
  if (doc.ocr_needed) parts.push('Text could not be read automatically; figures from this document need checking against the original.');
  if (doc.manual_notes) parts.push(`Notes: ${doc.manual_notes}`);
  return { documentId: doc.id, filename: doc.filename, category: doc.category || 'Unclassified', type: doc.document_type || '', summary: parts.join(' '), contribution: contribution || '', url: `documents/${encodeURIComponent(doc.id)}/original` };
}

async function attachSources(m, result) {
  const contrib = new Map();
  (result.rows || []).forEach((r) => {
    if (!r.documentId) return;
    const c = contrib.get(r.documentId) || { rows: 0, amount: 0 };
    c.rows++; c.amount += Number(r.amount) || 0;
    contrib.set(r.documentId, c);
  });
  (result.sourceIds || []).forEach((id) => { if (!contrib.has(id)) contrib.set(id, { rows: 0, amount: 0 }); });
  const out = [];
  for (const [id, c] of contrib) {
    const doc = m.docById.get(id);
    if (doc) out.push(await sourceSummary(m, doc, c.rows ? `${c.rows} line${c.rows === 1 ? '' : 's'}${c.amount ? `, ${money(c.amount)}` : ''} in this recon` : ''));
  }
  result.sources = out.sort((a, b) => a.filename.localeCompare(b.filename));
  delete result.sourceIds;
  return result;
}

// GET /api/matters/:matterId/recon/metric/:key?category=&party=&...
router.get('/metric/:key', async (req, res) => {
  try {
    const m = await loadMatter(req);
    const build = metricBuilders(m)[req.params.key];
    if (!build) return res.status(404).json({ error: 'Unknown metric' });
    res.json(await attachSources(m, build(req.query)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/matters/:matterId/recon/documents  all documents with their summaries.
router.get('/documents', async (req, res) => {
  try {
    const m = await loadMatter(req);
    const list = [];
    for (const d of m.docs) list.push(await sourceSummary(m, d));
    res.json({ documents: list.sort((a, b) => a.filename.localeCompare(b.filename)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/matters/:matterId/recon/sources { ids: [documentId...] }  summaries for chosen documents.
router.post('/sources', async (req, res) => {
  try {
    const m = await loadMatter(req);
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.slice(0, 500) : [];
    const list = [];
    for (const id of ids) { const d = m.docById.get(id); if (d) list.push(await sourceSummary(m, d)); }
    res.json({ sources: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/matters/:matterId/recon/lookup { items: [{ amount, decimals }] }
// Finds where an amount appears in this matter's source records. An amount shown
// without cents matches within 50 cents and is reported as approximate.
router.post('/lookup', async (req, res) => {
  try {
    const m = await loadMatter(req);
    const items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 5000) : [];
    const index = [];
    m.transactions.forEach((t) => index.push({ amount: abs(t), kind: 'Transaction', date: t.transaction_date || '', description: t.description || '', documentId: t.document_id }));
    m.statements.forEach((s) => {
      if (!m.docById.has(s.document_id)) return;
      if (s.beginning_balance != null) index.push({ amount: Math.abs(s.beginning_balance), kind: 'Statement opening balance', date: s.statement_start || '', description: s.bank_name || '', documentId: s.document_id });
      if (s.ending_balance != null) index.push({ amount: Math.abs(s.ending_balance), kind: 'Statement closing balance', date: s.statement_end || '', description: s.bank_name || '', documentId: s.document_id });
    });
    m.reviews.forEach((r) => { if (r.annual_amount && m.docById.has(r.document_id)) index.push({ amount: Number(r.annual_amount), kind: `Income review (${r.status})`, date: '', description: 'Annual amount', documentId: r.document_id }); });
    for (const d of m.docs.filter((x) => x.category === 'Tax Returns & Income')) {
      const ev = await evidenceFor(d);
      [['grossPay', 'Gross pay'], ['netPay', 'Net pay'], ['paymentAmount', 'Payment']].forEach(([k, label]) => {
        if (ev[k] != null) index.push({ amount: Math.abs(Number(ev[k])), kind: label, date: ev.payDate || '', description: d.filename, documentId: d.id });
      });
    }
    const results = [];
    const docsUsed = new Set();
    items.forEach((it) => {
      const amt = Math.abs(Number(it.amount));
      if (!Number.isFinite(amt) || amt === 0) { results.push({ matches: [], total: 0, approximate: false }); return; }
      const exactWanted = Number(it.decimals) >= 2;
      const tol = exactWanted ? 0.005 : 0.5;
      const hits = index.filter((x) => Math.abs(x.amount - amt) <= tol);
      hits.slice(0, 25).forEach((h) => docsUsed.add(h.documentId));
      results.push({ total: hits.length, approximate: !exactWanted, matches: hits.slice(0, 25).map((h) => ({ kind: h.kind, date: h.date, description: h.description, amount: round2(h.amount), documentId: h.documentId, filename: m.docById.get(h.documentId).filename })) });
    });
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
