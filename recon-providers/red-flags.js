// Recons for Red Flags & Data Audit (red-flags.html, red-flags.js).
// Findings are written by the legal team, so figures inside a finding are entered, with
// the source the finding names. Counts are recomputed from the saved findings, and the
// automatic-check figures from the gap analysis and parsed statements.
(function () {
  const SEV = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', on_file: 'On file' };
  const CAT = { disclosure: 'Disclosure & missing documents', income: 'Income & earning capacity', spending: 'Spending & lifestyle', expert: 'Expert opinions & budgets', conduct: 'Conduct & court-order compliance', other: 'Other' };

  const load = (ctx) => ctx.json('red-flags');
  const gap = (ctx) => ctx.json('documents/gap-analysis');

  // A finding's source is free text. It links only when it names a document on file.
  async function docLinks(ctx) {
    let rows = [];
    try { rows = (await ctx.metric('documents')).rows || []; } catch (e) { rows = []; }
    return (source) => {
      const s = String(source || '').toLowerCase();
      if (!s) return null;
      const hit = rows.find((d) => d.filename && s.includes(String(d.filename).toLowerCase()));
      return hit ? hit.documentId : null;
    };
  }

  const FLAG_COLUMNS = [{ key: 'title', label: 'Finding' }, { key: 'severity', label: 'Severity' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }, { key: 'source', label: 'Source named' }];
  async function flagRows(ctx, list) {
    const linkOf = await docLinks(ctx);
    return list.map((f) => {
      const row = { title: f.title, severity: SEV[f.severity] || f.severity, category: CAT[f.category] || f.category, status: f.status, source: f.source || '' };
      const id = linkOf(f.source);
      if (id) row.documentId = id;
      return row;
    });
  }
  async function countRecon(ctx, title, list, calc) {
    return { title, format: 'count', value: list.length, columns: FLAG_COLUMNS, rows: await flagRows(ctx, list), summary: { Findings: list.length }, calc: [...calc, `Count of findings listed = ${list.length}.`] };
  }

  // ---------- count cards ----------
  async function statCard(ctx) {
    const key = ctx.el.dataset.sev;
    // Compare with the card's number only: its caption would be read as part of it ("1 Medium" as 1M).
    const shown = (ctx.el.querySelector('.n') || {}).textContent || '0';
    ctx.text = shown.trim();
    ctx.displayed = { kind: 'number', value: Number(shown) || 0, raw: Number(shown) || 0, scale: 1, decimals: 0 };
    const { findings } = await load(ctx);
    const list = key === 'on_file' ? findings.filter((f) => f.severity === 'on_file') : findings.filter((f) => f.severity === key && f.status === 'open');
    return countRecon(ctx, key === 'on_file' ? 'On file' : `${SEV[key]} open`, list,
      [key === 'on_file' ? 'Saved findings with severity "On file", open or resolved.' : `Saved findings with severity "${SEV[key]}" and status open.`]);
  }

  // Group headings follow the same filters the list on the page uses.
  async function groupBadge(ctx) {
    const key = Object.keys(SEV).find((k) => ctx.el.closest('.badge').classList.contains(k));
    const { findings } = await load(ctx);
    const cat = ctx.txt('#fCategory'), st = ctx.txt('#fStatus');
    const catEl = document.getElementById('fCategory'), stEl = document.getElementById('fStatus');
    const needle = ctx.txt('#fSearch').toLowerCase();
    const on = document.querySelector('#stats .stat.on');
    const list = findings.filter((f) => {
      if (f.severity !== key) return false;
      if (on && on.dataset.sev !== f.severity) return false;
      if (catEl && catEl.value && f.category !== catEl.value) return false;
      if (stEl && stEl.value && f.status !== stEl.value) return false;
      if (needle) {
        const hay = [f.title, f.headline, f.detail, f.impact, f.action, f.request, f.source, ...(f.facts || []).map((x) => `${x.label} ${x.value}`)].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const filters = [catEl && catEl.value ? `category "${cat}"` : '', stEl && stEl.value ? `status "${st}"` : '', needle ? `search "${needle}"` : ''].filter(Boolean);
    return countRecon(ctx, `${SEV[key]} group`, list, [`Saved findings with severity "${SEV[key]}"${filters.length ? `, filtered by ${filters.join(', ')}` : ''}.`]);
  }

  async function categoryCell(ctx) {
    const td = ctx.el.closest('td');
    if (!td || td.cellIndex !== 1) return { status: 'entered', calc: ['This number is part of a finding title written by the legal team.'] };
    const label = ctx.row.cells[0].textContent.trim();
    const key = Object.keys(CAT).find((k) => CAT[k] === label);
    const { findings } = await load(ctx);
    const list = findings.filter((f) => f.status === 'open' && f.severity !== 'on_file' && f.category === key);
    return countRecon(ctx, `Open: ${label}`, list, [`Open findings in "${label}", not counting on-file items.`]);
  }

  // ---------- figures inside a finding ----------
  async function enteredIn(ctx, f, title) {
    const linkOf = await docLinks(ctx);
    const id = f && linkOf(f.source);
    const named = f && f.source && !id ? [{ filename: f.source, summary: 'Source named in this finding. It does not match a document on file for this matter, so it cannot be opened from here.' }] : undefined;
    return { title, status: 'entered', documentIds: id ? [id] : undefined, sources: named,
      summary: f ? { Finding: f.title, Severity: SEV[f.severity] || f.severity, 'Source named': f.source || 'None given' } : {},
      note: f && !f.source ? 'This finding does not name a source.' : '',
      calc: ['The legal team wrote this figure into the finding. Veritas did not calculate it.'] };
  }
  async function inFlagCard(ctx) {
    const card = ctx.el.closest('.rf-flag');
    if (!card) return null;
    const { findings } = await load(ctx);
    const f = findings.find((x) => x.id === card.dataset.id);
    const fact = ctx.el.closest('.fact');
    const k = fact && fact.querySelector('.k');
    return enteredIn(ctx, f, (k && k.textContent) || (f && f.headline) || (f && f.title) || 'Finding');
  }

  // Judge summary and document list quote finding text, so find the finding that says it.
  const quoting = (list, text) => list.find((f) => [f.title, f.headline, f.detail, f.impact, f.action, f.request, f.source, ...(f.facts || []).map((x) => x.value)].some((v) => String(v || '').includes(text)));
  async function quoted(ctx) {
    const { findings } = await load(ctx);
    const f = quoting(findings, ctx.text);
    if (f) return enteredIn(ctx, f, f.title);
    return { title: 'Report wording', status: 'entered', calc: ['The legal team wrote this in the report wording for this matter. Veritas did not calculate it.'] };
  }

  async function missingCell(ctx) {
    if (ctx.el.closest('td').cellIndex === 0) return { title: 'Row number', status: 'text', calc: ['This is the row\'s number in the list. It is not a figure.'] };
    const { findings } = await load(ctx);
    const doc = ctx.row ? ctx.row.cells[1].textContent.trim() : '';
    const f = findings.find((x) => x.title === doc && x.request);
    if (f) return enteredIn(ctx, f, f.title);
    const g = await gap(ctx);
    if ((g.missingRequiredDocs || []).some((d) => d.label === doc)) return { status: 'text', calc: ['This number is part of the name of a required document type.'] };
    return quoted(ctx);
  }

  // ---------- judge summary tiles ----------
  async function judgeTile(ctx) {
    const label = ((ctx.el.closest('.j-tile') || {}).querySelector ? ctx.el.closest('.j-tile').querySelector('strong').textContent : '').trim();
    const { findings } = await load(ctx);
    const inc = findings.filter((f) => f.status === 'open' && f.inSummary && f.severity !== 'on_file');
    const rule = 'Open findings marked "In judge summary", not counting on-file items';
    if (label === 'Critical issues') return countRecon(ctx, label, inc.filter((f) => f.severity === 'critical'), [`${rule}, with severity Critical.`]);
    if (label === 'High priority') return countRecon(ctx, label, inc.filter((f) => f.severity === 'high'), [`${rule}, with severity High.`]);
    if (label === 'Other issues') return countRecon(ctx, label, inc.filter((f) => f.severity === 'medium' || f.severity === 'low'), [`${rule}, with severity Medium or Low.`]);
    if (label === 'Documents requested') return countRecon(ctx, label, inc.filter((f) => f.request), [`${rule}, that include a document to request.`]);
    return null;
  }

  // ---------- automatic checks ----------
  async function autoItems(ctx) {
    const g = await gap(ctx);
    const rows = [];
    (g.missingRequiredDocs || []).forEach((d) => rows.push({ kind: 'Missing required document type', item: d.label, detail: '' }));
    (g.statementGaps || []).forEach((x) => rows.push({ kind: 'Statement gap', item: x.account, detail: `${x.after} to ${x.before}; missing ${(x.missingMonths || []).join(', ')}` }));
    (g.thinCoverage || []).forEach((x) => rows.push({ kind: 'Only one statement', item: x.account, detail: `Only ${x.onlyMonth} is on file` }));
    return { title: 'Automatic-check items', format: 'count', value: rows.length, columns: [{ key: 'kind', label: 'Check' }, { key: 'item', label: 'Item' }, { key: 'detail', label: 'Detail' }], rows,
      summary: { 'Missing document types': (g.missingRequiredDocs || []).length, 'Statement gaps': (g.statementGaps || []).length, 'Accounts with one statement': (g.thinCoverage || []).length },
      calc: [`Missing document types ${(g.missingRequiredDocs || []).length} + statement gaps ${(g.statementGaps || []).length} + accounts with one statement ${(g.thinCoverage || []).length} = ${rows.length}.`] };
  }
  async function autoStatements(ctx) {
    const m = await ctx.metric('statements');
    return { metric: 'statements', title: 'Statements checked', value: m.rows.length, format: 'count', calc: ['Bank and card statements whose parsing finished without error.', `Count of statements listed = ${m.rows.length}.`] };
  }
  async function autoAccounts(ctx) {
    const m = await ctx.metric('statements');
    const dated = m.rows.filter((r) => r.hasStart);
    const accounts = [...new Set(dated.map((r) => r.accountKey))];
    const described = new Set(dated.map((r) => r.account)).size;
    return { metric: 'statements', title: 'Accounts checked', value: accounts.length, format: 'count', summary: { 'Account numbers': accounts.join('; ') || 'None', 'Statements with a date': dated.length },
      calc: ['Take the account number read from every parsed statement that has a start date, or the bank name when no number was read.', `Count of distinct account numbers = ${accounts.length}.`],
      note: described !== accounts.length ? `The same number appears under more than one bank or account type (${described} combinations), so check the numbers read from these statements against the originals.` : '' };
  }
  async function autoSummaryFigure(ctx) {
    const b = ctx.el.closest('b');
    const next = b && b.nextSibling ? b.nextSibling.textContent.trim() : '';
    if (/^item/i.test(next)) return autoItems(ctx);
    if (/^statements/i.test(next)) return autoStatements(ctx);
    if (/^account/i.test(next)) return autoAccounts(ctx);
    return null;
  }
  // "n/m required document types" isn't picked up as a figure by itself, so it gets a button.
  async function requiredDocs(ctx) {
    const hit = /(\d+)\/(\d+)/.exec(ctx.text);
    if (!hit) return { status: 'nodata', calc: ['The automatic check has not finished.'] };
    const g = await gap(ctx);
    const missing = g.missingRequiredDocs || [];
    const v = (g.requiredDocsTotal || 0) - missing.length;
    ctx.text = hit[0];
    ctx.displayed = { kind: 'number', value: Number(hit[1]), raw: Number(hit[1]), scale: 1, decimals: 0 };
    return { title: 'Required document types present', format: 'count', value: v,
      columns: [{ key: 'label', label: 'Missing document type' }], rows: missing.map((d) => ({ label: d.label })),
      summary: { 'Required types': g.requiredDocsTotal || 0, Missing: missing.length, Present: v },
      calc: [`Present = ${g.requiredDocsTotal || 0} required types - ${missing.length} missing = ${v}.`, 'A type counts as present when a document\'s category or file name matches it. That match is by wording only, so check the documents themselves.'] };
  }

  // ---------- drafted request for production ----------
  async function rfpFigure(ctx) {
    const d = await ctx.json('documents/rfp');
    if (ctx.el.closest('pre') || !/^items?/i.test(ctx.after)) return { status: 'text', calc: ['This number is part of the drafted wording of the request.'] };
    const rows = String(d.rfp || '').split('\n').filter((l) => /^\d+\.\s/.test(l)).map((l) => ({ item: l }));
    return { title: 'Items requested', format: 'count', value: rows.length, columns: [{ key: 'item', label: 'Item in the draft' }], rows, calc: [`Count of numbered items in the draft = ${rows.length}.`] };
  }

  VeritasRecon.define({
    match: [
      { selector: '.sev-group h3 .badge', recon: groupBadge },
      { selector: '.rf-flag', recon: inFlagCard },
      { selector: '#catTable td', recon: categoryCell },
      { selector: '#missingList td', recon: missingCell },
      { selector: '.j-tile', recon: judgeTile },
      { selector: '#judge', recon: quoted },
      { selector: '#recsWork', recon: quoted },
      { selector: '#autoSummary', recon: autoSummaryFigure },
      { selector: '#autoList', recon: () => ({ status: 'text', calc: ['This number is part of the wording of an automatic check, such as a document type or an account name.'] }) },
      { selector: '#rfpOutput', recon: rfpFigure },
    ],
    cards: [
      { selector: '#stats .stat', recon: statCard },
      { selector: '#autoSummary .rf-note', buttonLabel: 'View document recon', recon: requiredDocs },
    ],
    // The list's row numbers.
    inert: ['#missingList td:first-child'],
  });
})();
