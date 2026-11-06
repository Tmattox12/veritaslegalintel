// Recons for the Spousal Maintenance guideline page (spousal.html).
// The Discovery analysis feed panel is rebuilt from the server's recon metrics and from
// income document evidence. The Live Calculation block has no calculator behind it on
// this page (spousal.js is an empty script), so its figures stay at the written $0 and
// are reported that way; a nonzero figure falls through to "no calculation on record".
(function () {
  const PARTY = { a: 'party_a', b: 'party_b' };
  const DEPOSIT = { avg12: 'avg12Month', avg6: 'avg6Month', avg3: 'avg3Month', runrate: 'lastMonthRunRate' };

  // A count sits in a <strong> and its noun follows the <strong>.
  const wordAfter = (ctx) => {
    if (ctx.after) return ctx.after;
    const p = ctx.el.parentElement;
    return p && p.nextSibling ? String(p.nextSibling.textContent).trim() : '';
  };
  const lineOf = (el) => { const d = el.closest('div'); return d ? d.textContent.trim() : ''; };

  // ---- the saved income selection ----
  function selection(ctx) {
    try { return JSON.parse(localStorage.getItem(`veritas_income_selection_${ctx.matterId}`) || 'null'); } catch (e) { return null; }
  }
  function builderState() {
    try { return JSON.parse(localStorage.getItem('veritas_income_builder') || '{}'); } catch (e) { return {}; }
  }
  // The Income Engine's selected basis for one saved card, rebuilt from what was typed on it.
  function cardAmount(card) {
    const inputs = card.inputs || {};
    const n = (k) => { const v = parseFloat(inputs[k]); return Number.isNaN(v) ? null : Math.max(0, v); };
    const avg = (vals) => { const got = vals.filter((v) => v != null); return got.length ? got.reduce((a, b) => a + b, 0) / got.length : 0; };
    if (card.basis === '3yr') return avg([n('y3'), n('y2'), n('y1')]);
    if (card.basis === '2yr') return avg([n('y2'), n('y1')]);
    if (card.basis === 'ytd') { const y = n('ytd'); return y == null ? 0 : (y / Math.min(12, n('ytdMonths') || Math.max(1, new Date().getMonth()))) * 12; }
    if (card.basis === 'imputed') return n('imputed') || 0;
    return 0;
  }
  async function selectedRecon(ctx, p) {
    const pick = (selection(ctx) || {})[PARTY[p]];
    if (!pick) return { title: `Selected income: ${ctx.names[p]}`, value: 0, calc: ['No income basis has been selected for this party.'] };
    if (pick.basis === 'accepted') return { metric: ['accepted-income', { party: PARTY[p] }], title: `Selected income: ${ctx.names[p]}` };
    if (DEPOSIT[pick.basis]) return { metric: ['deposit-basis', { basis: DEPOSIT[pick.basis] }], title: `Selected income: ${ctx.names[p]}` };
    if (pick.basis === 'builder') {
      const saved = builderState()[p === 'a' ? 'partyA' : 'partyB'] || {};
      const rows = (saved.types || []).map((type) => { const c = (saved.cards || {})[type] || {}; return { source: type, basis: c.basis || 'none', amount: cardAmount(c) }; });
      const total = rows.reduce((a, r) => a + r.amount, 0);
      return { title: `Selected income: ${ctx.names[p]}`, value: Math.round(total), columns: [{ key: 'source', label: 'Income source' }, { key: 'basis', label: 'Selected basis' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }], rows,
        calc: [`The Income Engine total for this party = the selected basis on each checked source = ${ctx.money(total)}, rounded to the dollar.`], note: 'These amounts are typed in the Income Engine and are not linked to a document.' };
    }
    return { title: `Selected income: ${ctx.names[p]}`, status: 'explained', inputs: [{ label: 'Saved selection', value: ctx.text, origin: 'module' }], calc: [`The selection was saved with the basis "${pick.basis}", which this recon has no formula for.`] };
  }

  // ---- income documents ----
  async function evidenceRecon(ctx, measure) {
    const ev = await ctx.json('documents/income-evidence');
    const stubs = (ev.evidence || []).filter((x) => x.kind === 'pay_stub');
    const amountOf = (x) => (measure === 'gross' ? (x.grossPay || 0) : (x.netPay || x.paymentAmount || 0));
    const total = stubs.reduce((a, x) => a + amountOf(x), 0);
    const columns = [{ key: 'filename', label: 'Document' }, { key: 'payDate', label: 'Pay date' }, { key: 'amount', label: measure === 'gross' ? 'Gross' : 'Net', money: true, align: 'right' }];
    const rows = stubs.map((x) => ({ filename: x.filename, payDate: x.payDate || '', amount: amountOf(x), documentId: x.documentId }));
    const documentIds = stubs.map((x) => x.documentId);
    if (measure === 'count') return { title: 'Pay stubs on file', value: stubs.length, format: 'count', columns: columns.slice(0, 2), rows, documentIds, calc: [`Income documents read as pay stubs = ${stubs.length}.`] };
    return { title: `Documented ${measure} pay`, value: total, columns, rows, documentIds, calc: [`Sum of the ${measure} amount read from each pay stub = ${ctx.money(total)}.`, 'Read from the document text and still subject to review.'] };
  }
  async function documentRow(ctx) {
    const ev = await ctx.json('documents/income-evidence');
    const line = lineOf(ctx.el);
    const item = (ev.evidence || []).find((x) => line.startsWith(x.filename));
    if (!item) return null;
    const key = /Gross\s*$/.test(ctx.before) ? 'grossPay' : /Net\s*$/.test(ctx.before) ? 'netPay' : /Payment\s*$/.test(ctx.before) ? 'paymentAmount' : null;
    if (!key) return { status: 'text', calc: ['This number is part of the document\'s file name.'] };
    const label = { grossPay: 'Gross pay', netPay: 'Net pay', paymentAmount: 'Payment' }[key];
    return { title: `${label}: ${item.filename}`, value: item[key], columns: [{ key: 'filename', label: 'Document' }, { key: 'payDate', label: 'Date' }, { key: 'amount', label, money: true, align: 'right' }],
      rows: [{ filename: item.filename, payDate: item.payDate || '', amount: item[key], documentId: item.documentId }], documentIds: [item.documentId], calc: [`${label} read from this document = ${ctx.money(item[key])}.`] };
  }

  async function feedRecon(ctx) {
    const line = lineOf(ctx.el);
    const word = wordAfter(ctx);
    const parent = ctx.el.parentElement;
    if (/^\d[\d,]*\s*documents/.test(line) || /documents · /.test(line)) {
      if (/^documents/.test(word)) return { metric: 'documents' };
      if (/^statements/.test(word)) return { metric: 'statements' };
      if (/^transactions/.test(word)) return { metric: 'transactions' };
      if (/^months/.test(word)) return { metric: 'coverage-months' };
    }
    if (/^Bank-deposit income candidates/.test(line)) return { metric: ['income-candidate', { period: /\($/.test(ctx.before) || /^\(/.test(ctx.text) ? 'annual' : 'monthly' }] };
    if (/^Accepted document income/.test(line)) {
      if (parent.tagName === 'STRONG') return { metric: 'accepted-income' };
      return { metric: ['accepted-income', { party: /Party B\s*$/.test(ctx.before) ? PARTY.b : PARTY.a }] };
    }
    if (/^Selected income basis/.test(line)) return selectedRecon(ctx, /Party B\s*$/.test(ctx.before) ? 'b' : 'a');
    if (/^Pay stubs/.test(line)) {
      const before = parent.previousSibling ? String(parent.previousSibling.textContent) : '';
      if (/Pay stubs:\s*$/.test(before)) return evidenceRecon(ctx, 'count');
      if (/gross:\s*$/.test(before)) return evidenceRecon(ctx, 'gross');
      if (/net:\s*$/.test(before)) return evidenceRecon(ctx, 'net');
    }
    // A mapped expense chip reads "category: $amount/mo".
    if (parent.tagName === 'SPAN') {
      const cat = ctx.before.replace(/:\s*$/, '').trim();
      if (cat) return { metric: ['expense-category', { category: cat }] };
    }
    return documentRow(ctx);
  }

  // ---- the Live Calculation block ----
  const EMPTY_ENGINE = 'The calculator script for this page is empty, so this figure is the written starting value and does not respond to the inputs above.';
  const notBuilt = (title) => (ctx) => {
    if (ctx.displayed && ctx.displayed.value) return null;
    return { title, status: 'nodata', note: EMPTY_ENGINE, calc: ['Nothing has calculated this figure.'] };
  };

  VeritasRecon.define({
    byId: {
      mrMonthly: notBuilt('Monthly maintenance'), mrAnnual: notBuilt('Annual maintenance'), mrGap: notBuilt('Income gap'), mrTotal: notBuilt('Total exposure'),
      fNeed: notBuilt('Recipient need'), fGap: notBuilt('Income gap'), fMonthly: notBuilt('Result per month'),
    },
    match: [
      { selector: '#discoveryAnalysisBridge', recon: feedRecon },
      { selector: '.mr-stat > span', recon: () => ({ status: 'text', calc: ['This percentage is part of the label "Duration (30-50%)". It is not a figure for this case.'] }) },
    ],
  });
})();
