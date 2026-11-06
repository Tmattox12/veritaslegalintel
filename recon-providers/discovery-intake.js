// Recons for Discovery Intake (discovery-intake.html, logic in discovery-intake-uploads.js
// and discovery-checklist.js). Counts are rebuilt from the document list, the statement
// list and the recon metrics. The Recent Activity list is written into the page as sample
// text and keeps the default "not tied" status on purpose.
(function () {
  const docColumns = [{ key: 'filename', label: 'Document' }, { key: 'category', label: 'Category' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Read status' }];
  const docLine = (d) => ({ filename: d.filename, category: d.category || '', type: d.document_type || '', status: d.extraction_status || '', documentId: d.id });
  const docs = (ctx) => ctx.json('documents');
  const counted = (title, list, calc) => ({ title, format: 'count', value: list.length, columns: docColumns, rows: list.map(docLine), documentIds: list.map((d) => d.id), calc });
  const bucket = (d) => {
    const c = (d.category || '').toLowerCase();
    if (c.includes('financial statement')) return 'financial';
    if (c.includes('tax') || c.includes('income')) return 'income';
    if (c.includes('property') || c.includes('asset')) return 'property';
    if (c.includes('court') || c.includes('legal')) return 'legal';
    if (c.includes('afi') || c.includes('disclosure')) return 'disclosure';
    return 'other';
  };

  // ---------- stat boxes ----------
  const allDocs = async (ctx) => counted('Documents processed', await docs(ctx), ['Every document uploaded to this matter, leaving out deleted ones.', `Count = ${(await docs(ctx)).length}.`]);
  const inBucket = (key, title, words) => async (ctx) => {
    const list = (await docs(ctx)).filter((d) => bucket(d) === key);
    return counted(title, list, [`Documents whose category contains ${words} = ${list.length}.`]);
  };
  const ocr = async (ctx) => {
    const list = (await docs(ctx)).filter((d) => d.ocr_needed);
    return counted('Documents needing OCR review', list, [`Documents flagged as needing OCR review = ${list.length}.`]);
  };

  // ---------- currently stored ----------
  const nextWord = (el) => {
    const host = el.closest('strong') || el;
    return ((host.nextSibling && host.nextSibling.textContent) || '').trim();
  };
  async function storedFigure(ctx) {
    const word = ctx.after || nextWord(ctx.el);
    if (/^documents/.test(word)) return allDocs(ctx);
    if (/^statements/.test(word)) return { metric: 'statements' };
    if (/^transactions/.test(word)) return { metric: 'transactions' };
    return null;
  }
  async function storedCard(ctx) {
    const box = ctx.el;
    const text = box.textContent.replace(/\s+/g, ' ');
    const list = await docs(ctx);
    const parsed = list.filter((d) => d.extraction_status === 'parsed').length;
    const review = list.filter((d) => d.extraction_status === 'needs_review' || d.ocr_needed).length;
    const other = list.filter((d) => d.category === 'Other').length;
    const cov = await ctx.metric('coverage-months');
    const statements = await ctx.metric('statements');
    const tx = await ctx.metric('transactions');
    const items = [
      { name: 'Documents', re: /(\d[\d,]*) documents/, value: list.length },
      { name: 'Statements', re: /(\d[\d,]*) statements/, value: statements.value },
      { name: 'Transactions', re: /(\d[\d,]*) transactions/, value: tx.value },
      { name: 'Parsed', re: /(\d[\d,]*) parsed/, value: parsed },
      { name: 'Need OCR or parsing review', re: /(\d[\d,]*) need OCR/, value: review },
      { name: 'Need category review', re: /(\d[\d,]*) need category/, value: other },
    ];
    return figureTable(ctx, 'Currently stored for this matter', text, items, { documentIds: list.map((d) => d.id),
      summary: { 'Months with a parsed statement': cov.value },
      calc: ['Documents come from the matter\'s document list. Statements and transactions are recounted from the parsed records.', 'Need category review counts only documents filed under "Other".'] });
  }
  function figureTable(ctx, title, text, items, extra) {
    const shownOf = (i) => { const h = text.match(i.re); return h ? h[1] : null; };
    const num = (s) => Number(String(s).replace(/,/g, ''));
    const rows = items.map((i) => { const shown = shownOf(i); return { figure: i.name, shown: shown == null ? 'not shown' : shown, recalc: Number(i.value).toLocaleString(), ties: shown == null ? '' : num(shown) === Number(i.value) ? 'Yes' : 'No', raw: shown, value: i.value }; });
    const present = rows.filter((r) => r.raw != null);
    const head = present.find((r) => r.ties === 'No') || present[0];
    if (head) { const n = num(head.raw); ctx.text = head.raw; ctx.displayed = { kind: 'number', value: n, raw: n, scale: 1, decimals: 0, negative: false }; }
    return { title, format: 'count', value: head ? head.value : null, rows,
      columns: [{ key: 'figure', label: 'Figure' }, { key: 'shown', label: 'On screen', align: 'right' }, { key: 'recalc', label: 'Recalculated', align: 'right' }, { key: 'ties', label: 'Ties' }], ...extra };
  }

  // ---------- parsed statements ----------
  async function statementFigure(ctx) {
    const item = ctx.el.closest('.doc-item');
    const csv = item && item.querySelector('[data-csv]');
    if (!csv) return null;
    const statements = await ctx.json('bank-statements');
    const st = statements.find((s) => String(s.id) === csv.dataset.csv);
    if (!st) return null;
    const all = await ctx.json('bank-statements/transactions?limit=1000000');
    const list = all.filter((t) => t.bank_statement_id === st.id);
    const rows = list.map((t) => ({ date: t.transaction_date || '', description: t.description || '', flow: t.flow_type || '', amount: Math.abs(Number(t.amount) || 0), documentId: st.document_id }));
    const columns = [{ key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'flow', label: 'Direction' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
    const documentIds = st.document_id ? [st.document_id] : [];
    if (/^transactions/.test(ctx.after)) return { title: `Transactions: ${st.filename || 'statement'}`, format: 'count', value: rows.length, columns, rows, documentIds, calc: [`Transactions parsed from this statement = ${rows.length}.`] };
    const isBegin = /Beginning\s*$/.test(ctx.before);
    const isEnd = /Ending\s*$/.test(ctx.before);
    if (!isBegin && !isEnd) return null;
    const sumFlow = (f) => list.filter((t) => t.flow_type === f).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0);
    const inflow = sumFlow('income');
    const outflow = sumFlow('expense');
    const card = st.account_type === 'credit_card';
    const expected = card ? st.beginning_balance + outflow - inflow : st.beginning_balance + inflow - outflow;
    const diff = st.ending_balance - expected;
    const label = isBegin ? 'Beginning balance' : 'Ending balance';
    return { title: `${label}: ${st.filename || 'statement'}`, value: isBegin ? st.beginning_balance : st.ending_balance, format: 'money', columns, rows, documentIds,
      summary: { Opening: ctx.money(st.beginning_balance), 'Money in': ctx.money(inflow), 'Money out': ctx.money(outflow), Closing: ctx.money(st.ending_balance) },
      calc: [`${label} read from the statement: ${ctx.money(isBegin ? st.beginning_balance : st.ending_balance)}.`,
        `Check: opening ${ctx.money(st.beginning_balance)} ${card ? '+ charges' : '+ money in'} ${ctx.money(card ? outflow : inflow)} ${card ? '- credits' : '- money out'} ${ctx.money(card ? inflow : outflow)} = ${ctx.money(expected)}.`,
        Math.abs(diff) < 0.005 ? 'That matches the closing balance on the statement.' : `That differs from the closing balance by ${ctx.money(Math.abs(diff))}; compare the transactions with the original.`] };
  }

  // ---------- Rule 49 checklist, same matching as discovery-checklist.js ----------
  const RULE49 = [
    ['Affidavit of Financial Information (AFI)', /affidavit|afi\b|financial information/i],
    ['Federal & State Tax Returns', /1040|tax return|schedule c|form 1040/i],
    ['W-2s, 1099s & K-1s', /w-?2|1099|k-?1/i],
    ['Pay Stubs / Payroll Records', /pay\s?stub|payroll|earnings statement/i],
    ['Bank Statements (checking & savings)', /bank statement|checking|savings/i],
    ['Credit Card Statements', /credit card|visa|mastercard|amex|discover/i],
    ['Retirement / Investment / Brokerage Statements', /401\(?k\)?|ira\b|retirement|brokerage|investment|pension/i],
    ['Real Property — deeds, appraisals, mortgage', /deed|appraisal|mortgage|title|closing statement|hud-1/i],
    ['Vehicle Titles & Valuations', /vehicle|car title|dmv|auto|kbb|blue book/i],
    ['Insurance Policies (health/life/home/auto)', /insurance|policy|declaration/i],
    ['Loan / Debt Statements', /loan|debt|line of credit|student loan|personal loan/i],
    ['Business Interests — valuations, P&L, returns', /business|llc|corp|profit|p&l|balance sheet|1120|1065/i],
    ['Court Filings / Orders / Agreements', /order|petition|decree|pleading|stipulation|minute entry|agreement/i],
    ['Prenuptial / Postnuptial Agreements', /prenup|premarital|postnuptial|marital agreement/i],
  ];
  async function checklist(ctx) {
    const list = await docs(ctx);
    return RULE49.map(([item, re]) => { const found = list.filter((d) => re.test((d.filename || '').toLowerCase())); return { item, found }; });
  }
  const checklistColumns = [{ key: 'item', label: 'Required item' }, { key: 'count', label: 'Matched documents', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'files', label: 'Files' }];
  const checklistRows = (rows) => rows.map((r) => ({ item: r.item, count: r.found.length, status: r.found.length ? 'Received' : 'Missing', files: r.found.map((d) => d.filename).join(', ') }));
  async function checklistPct(ctx) {
    if (!ctx.displayed || ctx.displayed.kind !== 'percent') return null;
    const rows = await checklist(ctx);
    const received = rows.filter((r) => r.found.length).length;
    return { title: 'Checklist complete', value: Math.round((received / rows.length) * 100), columns: checklistColumns, rows: checklistRows(rows),
      documentIds: [...new Set(rows.flatMap((r) => r.found.map((d) => d.id)))],
      calc: [`Items with at least one document whose filename matches = ${received} of ${rows.length}.`, `Percent = ${received} / ${rows.length} = ${Math.round((received / rows.length) * 100)}%.`],
      note: 'An item counts as received when any one filename matches. It does not test whether the required period or both parties are covered.' };
  }
  async function checklistCard(ctx) {
    const rows = await checklist(ctx);
    const received = rows.filter((r) => r.found.length).length;
    const text = ctx.el.textContent.replace(/\s+/g, ' ');
    const items = [
      { name: 'Items received', re: /(\d+) of \d+ required/, value: received },
      { name: 'Items required', re: /\d+ of (\d+) required/, value: rows.length },
    ];
    const out = figureTable(ctx, 'Rule 49 checklist', text, items, { calc: [`Items with at least one document whose filename matches = ${received} of ${rows.length}.`] });
    const shownRows = out.rows;
    return { ...out, columns: checklistColumns, rows: checklistRows(rows), summary: Object.fromEntries(shownRows.map((r) => [r.figure, `${r.shown} on screen, ${r.recalc} recalculated`])),
      documentIds: [...new Set(rows.flatMap((r) => r.found.map((d) => d.id)))] };
  }
  const checklistNote = () => ({ status: 'text', calc: ['This number is part of the wording of a checklist item, written in discovery-checklist.js. It describes what to collect and is not calculated from this matter.'] });
  async function checklistFigure(ctx) {
    if (ctx.displayed && ctx.displayed.kind === 'percent') return checklistPct(ctx);
    return checklistNote();
  }

  // ---------- status badge ----------
  async function badgeFigure(ctx) {
    if (/^transactions/.test(ctx.after)) return { metric: 'transactions' };
    return null;
  }

  // ---------- pop-up lists opened from buttons ----------
  async function overlayFigure(ctx) {
    const box = ctx.el.closest('div[style*="z-index: 9999"]');
    if (!box) return null;
    if (box.querySelector('#covClose')) {
      const cov = await ctx.json('bank-statements/coverage');
      const panel = ctx.el.closest('div[style*="border-radius:8px"]');
      if (panel) {
        const name = (panel.firstElementChild.firstChild || {}).textContent;
        const acct = cov.accounts.find((a) => a.account === String(name).trim());
        if (acct && /^statement/.test(ctx.after)) return { title: `Statements: ${acct.account}`, format: 'count', value: acct.months.length, calc: [`Parsed statements on this account = ${acct.months.length}.`], columns: [{ key: 'file', label: 'Statement' }, { key: 'start', label: 'From' }, { key: 'end', label: 'To' }, { key: 'tx', label: 'Transactions', align: 'right' }], rows: acct.months };
        if (acct && /^transactions/.test(ctx.after)) { const total = acct.months.reduce((a, m) => a + (m.tx || 0), 0); return { title: `Transactions: ${acct.account}`, format: 'count', value: total, calc: [`Sum of the transactions on this account's statements = ${total}.`], columns: [{ key: 'file', label: 'Statement' }, { key: 'tx', label: 'Transactions', align: 'right' }], rows: acct.months }; }
      }
      if (/^statement/.test(ctx.after)) return { metric: 'statements' };
      if (/^transactions/.test(ctx.after)) return { metric: 'transactions' };
      if (/^account/.test(ctx.after)) { const a = cov.accounts; return { title: 'Accounts', format: 'count', value: a.length, columns: [{ key: 'account', label: 'Account' }, { key: 'type', label: 'Type' }, { key: 'totalTx', label: 'Transactions', align: 'right' }], rows: a, calc: [`Distinct accounts among parsed statements = ${a.length}.`] }; }
      return null;
    }
    if (box.querySelector('#txClose') && ctx.row && ctx.displayed && ctx.displayed.kind === 'money') {
      const date = ctx.row.cells[0].textContent.trim();
      const desc = ctx.row.cells[1].textContent.trim();
      const [all, statements] = await Promise.all([ctx.json('bank-statements/transactions?limit=1000000'), ctx.json('bank-statements')]);
      const hits = all.filter((t) => (t.transaction_date || '') === date && (t.description || '').trim() === desc);
      const pos = [...ctx.row.parentElement.rows].filter((r) => r.cells[0].textContent.trim() === date && r.cells[1].textContent.trim() === desc).indexOf(ctx.row);
      const t = hits[pos] || hits[0];
      if (!t) return null;
      const st = statements.find((s) => s.id === t.bank_statement_id);
      return { title: `Transaction ${date}`, value: Math.abs(Number(t.amount) || 0), format: 'money', documentIds: st && st.document_id ? [st.document_id] : [], calc: [`Parsed from the statement: ${desc}, ${date}.`] };
    }
    return null;
  }

  const sessionCount = () => ({ status: 'explained', calc: ['A count from the upload just run in this browser. Veritas does not store these batch counts, so they cannot be recalculated afterward. The documents themselves are listed on this page.'] });

  VeritasRecon.define({
    byId: {
      totalDocs: allDocs,
      bankCount: inBucket('financial', 'Financial statements uploaded', '"financial statement"'),
      taxCount: inBucket('income', 'Tax and income documents', '"tax" or "income"'),
      ocrCount: ocr,
      paystubCount: () => ({ metric: 'transactions' }),
      diStatusBadge: badgeFigure,
      storedRecon: storedFigure,
      statementsList: statementFigure,
      checklistContainer: checklistFigure,
      uploadBatchProgress: sessionCount,
      uploadRecon: sessionCount,
    },
    match: [
      { selector: 'div[style*="z-index: 9999"]', recon: overlayFigure },
      { selector: '#diStatusBadge', recon: (ctx) => (/^docs?\b/.test(ctx.after) ? { metric: 'documents' } : /^transaction/.test(ctx.after) ? { metric: 'transactions' } : null) },
      // "account: 3 mo / 15 tx" lines in the stored summary
      { selector: '#storedRecon', recon: async (ctx) => {
        const isMonths = /^mo\b/.test(ctx.after);
        if (!isMonths && !/^tx\b/.test(ctx.after)) return null;
        const account = (ctx.before.match(/(?:^|·\s*)([^·:]+):(?:\s*\d[\d,]*\s*mo\s*\/)?\s*$/) || [])[1];
        const cov = await ctx.json('bank-statements/coverage');
        const a = (cov.accounts || []).find((x) => x.account === (account || '').trim());
        if (!a) return null;
        const tx = a.months.reduce((s, x) => s + (x.tx || 0), 0);
        return { title: `${a.account}: ${isMonths ? 'statements' : 'transactions'}`, format: 'count', value: isMonths ? a.months.length : tx,
          columns: [{ key: 'file', label: 'Statement' }, { key: 'start', label: 'From' }, { key: 'end', label: 'To' }, { key: 'tx', label: 'Transactions', align: 'right' }],
          rows: a.months, calc: [isMonths ? `Each row is one statement for this account. Count = ${a.months.length}.` : `Sum of the Transactions column = ${tx}.`] };
      } },
    ],
    cards: [
      { selector: '#storedRecon', recon: storedCard },
      { selector: '#checklistContainer > div[style*="padding:16px"]', recon: checklistCard },
    ],
    inert: ['.doc-name', '#checklistContainer div[style*="margin-top:4px"]', '#reconFolderSummary'],
  });
})();
