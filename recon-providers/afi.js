// Recons for AFI Discrepancy Analysis (afi.html). The only live figures on this page today are
// in the shared Discovery analysis feed (discovery-bridge.js); each is rebuilt from the server.
(function () {
  // Text before and after a figure on its own line of the feed.
  const around = (ctx) => {
    const box = ctx.el.closest('div');
    const r = document.createRange();
    r.selectNodeContents(box); r.setEndBefore(ctx.el);
    const pre = r.toString().replace(/\s+/g, ' ');
    r.selectNodeContents(box); r.setStartAfter(ctx.el);
    return { box, pre, post: r.toString().replace(/\s+/g, ' ').trim() };
  };
  const EVIDENCE_COLUMNS = [{ key: 'filename', label: 'Document' }, { key: 'kind', label: 'Type' }, { key: 'gross', label: 'Gross', money: true, align: 'right' }, { key: 'net', label: 'Net or payment', money: true, align: 'right' }];
  const payStubs = async (ctx) => ((await ctx.json('documents/income-evidence')).evidence || []).filter((e) => e.kind === 'pay_stub');
  const stubRows = (list) => list.map((e) => ({ filename: e.filename, kind: e.documentType, gross: e.grossPay, net: e.netPay || e.paymentAmount, documentId: e.documentId }));
  const stubIds = (list) => list.map((e) => e.documentId);
  const REVIEW = 'Read automatically from the document. A reviewer has not necessarily confirmed it.';

  const BASES = { avg12: 'avg12Month', avg6: 'avg6Month', avg3: 'avg3Month', runrate: 'lastMonthRunRate' };
  const selected = async (ctx, party, name) => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`veritas_income_selection_${ctx.matterId}`) || 'null'); } catch (e) { saved = null; }
    const pick = saved && saved[party];
    const title = `Selected income basis (${name})`;
    if (!pick || !pick.basis) return { title, status: 'nodata', calc: ['No income basis has been selected for this party on the Income Engine.'] };
    const spec = pick.basis === 'accepted' ? ['accepted-income', { party }] : BASES[pick.basis] ? ['deposit-basis', { basis: BASES[pick.basis] }] : null;
    if (!spec) {
      return { title, status: 'explained', inputs: [{ label: `Saved selection (${pick.basis})`, value: Number(pick.amount) || 0, origin: 'module' }], calc: [`Saved by another Veritas page under the basis "${pick.basis}". The server has no rebuild for that basis, so this is not recalculated here.`] };
    }
    const m = await ctx.metric(spec);
    return { title, metric: spec, value: Math.round(Number(m.value) || 0), calc: [...(m.calc || []), `The Income Engine saves the selection rounded to the whole dollar = ${ctx.money(Math.round(Number(m.value) || 0))}.`] };
  };

  async function feed(ctx) {
    if (!ctx.displayed) return null;
    const isMoney = ctx.displayed.kind === 'money';
    // Mapped expense chips read "category: $x/mo".
    if (isMoney && ctx.el.parentElement.tagName === 'SPAN' && /^[\w-]+:\s*$/.test(ctx.before)) return { metric: ['expense-category', { category: ctx.before.replace(/:\s*$/, '') }] };
    const { box, pre, post } = around(ctx);
    if (!isMoney) {
      // The period in a basis name such as "12-month bank-deposit average".
      if (/^-month/i.test(post)) return { status: 'text', calc: ['Part of the name of the selected income basis: the period it averages over.'] };
      if (/^documents?\b/i.test(post)) return { metric: 'documents' };
      if (/^statements?\b/i.test(post)) return { metric: 'statements' };
      if (/^transactions?\b/i.test(post)) return { metric: 'transactions' };
      if (/^months?\b/i.test(post)) return { metric: 'coverage-months' };
      if (/Pay stubs:\s*$/.test(pre)) {
        const list = await payStubs(ctx);
        return { title: 'Pay stubs', value: list.length, format: 'count', columns: EVIDENCE_COLUMNS, rows: stubRows(list), documentIds: stubIds(list), calc: [`Income documents read as pay stubs = ${list.length}.`] };
      }
      return null;
    }
    if (/candidates:\s*$/.test(pre)) return { metric: ['income-candidate', { period: 'monthly' }] };
    if (/\(\s*$/.test(pre) || /^\/yr annualized/.test(post)) return { metric: ['income-candidate', { period: 'annual' }] };
    if (/^Selected income basis/.test(box.textContent.trim())) {
      if (/Party A\s*$/.test(pre) || /^Party A/.test(post)) return selected(ctx, 'party_a', 'Party A');
      return selected(ctx, 'party_b', 'Party B');
    }
    if (/Accepted document income:\s*$/.test(pre)) return { metric: 'accepted-income' };
    if (/Party A\s*$/.test(pre)) return { metric: ['accepted-income', { party: 'party_a' }] };
    if (/Party B\s*$/.test(pre)) return { metric: ['accepted-income', { party: 'party_b' }] };
    if (/documented gross:\s*$/.test(pre) || /documented net:\s*$/.test(pre)) {
      const gross = /gross:\s*$/.test(pre);
      const list = await payStubs(ctx);
      const value = list.reduce((t, e) => t + (gross ? e.grossPay || 0 : e.netPay || e.paymentAmount || 0), 0);
      return { title: gross ? 'Documented gross' : 'Documented net', value, columns: EVIDENCE_COLUMNS, rows: stubRows(list), documentIds: stubIds(list), note: REVIEW,
        calc: [`Add the ${gross ? 'gross pay' : 'net pay (or payment amount when no net is read)'} from each pay stub = ${ctx.money(value)}.`, 'These are the totals of the stubs on file, not an annual figure.'] };
    }
    // One document's line: "filename - type · Gross $x · Net $y · Payment $z".
    const which = /Gross\s*$/.test(pre) ? 'grossPay' : /Net\s*$/.test(pre) ? 'netPay' : /Payment\s*$/.test(pre) ? 'paymentAmount' : null;
    if (which) {
      const line = box.textContent.trim();
      const list = (await ctx.json('documents/income-evidence')).evidence || [];
      const doc = list.find((e) => line.startsWith(e.filename));
      if (!doc) return null;
      const label = { grossPay: 'Gross pay', netPay: 'Net pay', paymentAmount: 'Payment' }[which];
      return { title: `${label}: ${doc.filename}`, value: doc[which], columns: EVIDENCE_COLUMNS, rows: stubRows([doc]), documentIds: [doc.documentId], note: REVIEW, calc: [`${label} read from ${doc.filename} = ${ctx.money(doc[which])}.`] };
    }
    return null;
  }

  VeritasRecon.define({ match: [{ selector: '#discoveryAnalysisBridge', recon: feed }] });
})();
