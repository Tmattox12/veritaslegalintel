// Recons for Billing & Trust (billing.html, billing.js, server/routes/billing.js).
// Totals are rebuilt from the time entries and the trust ledger rather than from the
// totals the billing summary returns, so a disagreement between them shows.
(function () {
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const summaryOf = (ctx) => ctx.json('billing/summary');
  const hoursOf = (e) => Number(e.hours) || 0;
  const amountOf = (e) => round2(hoursOf(e) * Number(e.rate));
  const signed = (t) => (t.kind === 'deposit' ? 1 : -1) * Number(t.amount);
  const KIND = { deposit: 'Deposit', applied: 'Applied to fees', refund: 'Refund' };

  const entryColumns = [{ key: 'date', label: 'Work date' }, { key: 'timekeeper', label: 'Timekeeper' }, { key: 'status', label: 'Status' }, { key: 'hours', label: 'Hours', align: 'right' }, { key: 'rate', label: 'Rate', money: true, align: 'right' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const entryLine = (e) => ({ date: e.work_date, timekeeper: e.timekeeper || '', status: e.status, hours: hoursOf(e), rate: Number(e.rate), amount: amountOf(e) });
  const ledgerColumns = [{ key: 'date', label: 'Date' }, { key: 'kind', label: 'Type' }, { key: 'memo', label: 'Memo' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const ledgerLine = (t) => ({ date: t.txn_date, kind: KIND[t.kind] || t.kind, memo: t.memo || '', amount: Number(t.amount) });

  const sumStatus = (s, st) => round2(s.entries.filter((e) => e.status === st).reduce((a, e) => a + amountOf(e), 0));
  const balanceOf = (s) => round2(s.trust.ledger.reduce((a, t) => a + signed(t), 0));
  const wipOf = (s) => { const draft = sumStatus(s, 'draft'); const approved = sumStatus(s, 'approved'); return { draft, approved, total: round2(draft + approved) }; };

  const trustBalance = async (ctx) => {
    const s = await summaryOf(ctx);
    const inn = s.trust.ledger.filter((t) => t.kind === 'deposit').reduce((a, t) => a + Number(t.amount), 0);
    const out = s.trust.ledger.filter((t) => t.kind !== 'deposit').reduce((a, t) => a + Number(t.amount), 0);
    return { title: 'Trust balance', value: balanceOf(s), format: 'money', columns: ledgerColumns, rows: s.trust.ledger.map(ledgerLine),
      summary: { 'Ledger entries': s.trust.ledger.length, Deposits: ctx.money(inn), 'Applied and refunded': ctx.money(out) },
      calc: [`Deposits ${ctx.money(inn)} - applied and refunded ${ctx.money(out)} = ${ctx.money(inn - out)}.`], note: 'From the trust ledger on this page.' };
  };
  const wipRecon = (which) => async (ctx) => {
    const s = await summaryOf(ctx);
    const w = wipOf(s);
    const list = s.entries.filter((e) => (which === 'total' ? e.status === 'draft' || e.status === 'approved' : e.status === which));
    return { title: which === 'total' ? 'Unbilled work' : `Unbilled work: ${which}`, value: w[which], format: 'money', columns: entryColumns, rows: list.map(entryLine),
      calc: ['Each entry = hours x rate, rounded to the cent.', which === 'total' ? `Draft ${ctx.money(w.draft)} + approved ${ctx.money(w.approved)} = ${ctx.money(w.total)}.` : `Sum of ${list.length} ${which} entries = ${ctx.money(w[which])}.`] };
  };
  const available = async (ctx) => {
    const s = await summaryOf(ctx);
    const bal = balanceOf(s); const w = wipOf(s);
    return { title: 'Available after unbilled', value: round2(bal - w.total), format: 'money', columns: entryColumns, rows: s.entries.filter((e) => e.status === 'draft' || e.status === 'approved').map(entryLine),
      inputs: [{ label: 'Trust balance', value: ctx.money(bal), origin: 'module' }, { label: 'Unbilled work', value: ctx.money(w.total), origin: 'module' }],
      calc: [`Trust balance ${ctx.money(bal)} - unbilled work ${ctx.money(w.total)} = ${ctx.money(bal - w.total)}.`] };
  };
  const setting = (field, title) => async (ctx) => {
    const s = await summaryOf(ctx);
    return { title, status: 'entered', value: s.settings[field], inputs: [{ label: title, value: ctx.money(s.settings[field]), origin: 'entered' }], calc: ['A fee term saved for this matter on this page.'] };
  };
  const replenish = async (ctx) => {
    const s = await summaryOf(ctx);
    const avail = round2(balanceOf(s) - wipOf(s).total);
    const v = round2(Math.max(0, Number(s.settings.retainer_amount) - avail));
    return { title: 'Suggested replenishment', value: v, format: 'money',
      inputs: [{ label: 'Retainer amount', value: ctx.money(s.settings.retainer_amount), origin: 'entered' }, { label: 'Available after unbilled', value: ctx.money(avail), origin: 'module' }],
      calc: [`Retainer ${ctx.money(s.settings.retainer_amount)} - available ${ctx.money(avail)} = ${ctx.money(v)}. Never below zero.`] };
  };
  const burnEntries = (s) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return s.entries.filter((e) => ['draft', 'approved', 'billed'].includes(e.status) && e.work_date >= since);
  };
  const burn = (s) => {
    const fees = round2(burnEntries(s).reduce((a, e) => a + hoursOf(e) * Number(e.rate), 0));
    const perDay = round2(fees / 30);
    const avail = round2(balanceOf(s) - wipOf(s).total);
    return { fees, perDay, avail, daysLeft: perDay > 0 ? Math.max(0, Math.floor(avail / perDay)) : null };
  };
  const burnRate = async (ctx) => {
    const s = await summaryOf(ctx);
    const b = burn(s);
    return { title: 'Billing per day', value: b.perDay, format: 'money', columns: entryColumns, rows: burnEntries(s).map(entryLine),
      calc: [`Draft, approved and billed time worked in the last 30 days = ${ctx.money(b.fees)}.`, `Per day = ${ctx.money(b.fees)} / 30 = ${ctx.money(b.perDay)}.`] };
  };

  const kpiFigure = async (ctx) => {
    const box = ctx.el.closest('.kpi');
    const label = (box.querySelector('.kpi-label') || {}).textContent || '';
    if (ctx.text === '30' && /^days/.test(ctx.after)) return { status: 'text', calc: ['The look-back period for the burn rate. It is a fixed window in the app, not a figure from this matter.'] };
    if (label === 'Trust balance') return trustBalance(ctx);
    if (label === 'Unbilled work') {
      if (ctx.el.closest('.kpi-value')) return wipRecon('total')(ctx);
      if (/^approved/.test(ctx.after)) return wipRecon('approved')(ctx);
      if (/^draft/.test(ctx.after)) return wipRecon('draft')(ctx);
    }
    if (label === 'Available after unbilled') return ctx.el.closest('.kpi-value') ? available(ctx) : setting('evergreen_min', 'Evergreen minimum')(ctx);
    if (label === 'Retainer runway' && ctx.displayed && ctx.displayed.kind === 'money') return burnRate(ctx);
    return null;
  };
  // The days and minutes figures are split from their unit in the page, so they are
  // read from the card's own value.
  const kpiCard = async (ctx) => {
    const label = (ctx.el.querySelector('.kpi-label') || {}).textContent || '';
    const text = (ctx.el.querySelector('.kpi-value') || {}).textContent || '';
    const n = Number((text.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, ''));
    ctx.text = text.trim();
    ctx.displayed = { kind: 'number', value: n, raw: n, scale: 1, decimals: 0, negative: false };
    const s = await summaryOf(ctx);
    if (label === 'Retainer runway') {
      const b = burn(s);
      return { title: 'Retainer runway', value: b.daysLeft, format: 'count', columns: entryColumns, rows: burnEntries(s).map(entryLine),
        inputs: [{ label: 'Available after unbilled', value: ctx.money(b.avail), origin: 'module' }, { label: 'Billing per day', value: ctx.money(b.perDay), origin: 'module' }],
        calc: [`Draft, approved and billed time worked in the last 30 days = ${ctx.money(b.fees)}, or ${ctx.money(b.perDay)} per day.`, `Days left = ${ctx.money(b.avail)} / ${ctx.money(b.perDay)}, rounded down = ${b.daysLeft}.`] };
    }
    const days = 120;
    const activity = await ctx.json(`billing/activity?days=${days}`);
    const pending = activity.filter((a) => !a.entry_id);
    const seconds = pending.reduce((a, r) => a + Number(r.active_seconds), 0);
    return { title: 'Activity not yet drafted', value: Math.round(seconds / 60), format: 'count',
      columns: [{ key: 'started', label: 'Started' }, { key: 'page', label: 'Where' }, { key: 'seconds', label: 'Active seconds', align: 'right' }],
      rows: pending.map((a) => ({ started: a.started_at, page: a.page_label || a.page || '', seconds: a.active_seconds })),
      calc: [`Captured activity not yet built into a draft, last ${days} days: ${seconds} active seconds.`, `Minutes = ${seconds} / 60, rounded = ${Math.round(seconds / 60)}.`],
      note: `The server total covers all dates. This recalculation can read back only the last ${days} days of activity.` };
  };

  const alertFigure = async (ctx) => {
    const b = ctx.before;
    if (/unbilled work \($/.test(b) || /not yet billed is$/.test(b)) return wipRecon('total')(ctx);
    if (/trust balance \($/.test(b) || /trust balance is$/.test(b)) return trustBalance(ctx);
    if (/only$/.test(b) || /leaving$/.test(b)) return available(ctx);
    if (/maintained at$/.test(b)) return setting('retainer_amount', 'Retainer amount')(ctx);
    if (/falls below$/.test(b)) return setting('evergreen_min', 'Evergreen minimum')(ctx);
    if (/deposit$/.test(b) || /replenishment:?$/.test(ctx.el.closest('strong') ? ((ctx.el.closest('strong').previousSibling || {}).textContent || '').trim() : '')) return replenish(ctx);
    return null;
  };

  // ---------- time entries ----------
  const entryOf = async (ctx) => {
    const tr = ctx.el.closest('tr[data-id]');
    if (!tr) return null;
    return (await summaryOf(ctx)).entries.find((e) => e.id === tr.dataset.id) || null;
  };
  const toTenths = (seconds, rounding) => {
    const tenths = seconds / 360;
    return Math.max(1, rounding === 'nearest' ? Math.round(tenths) : Math.ceil(tenths - 1e-9)) / 10;
  };
  const entryCell = async (ctx) => {
    const e = await entryOf(ctx);
    if (!e) return null;
    const s = await summaryOf(ctx);
    const cell = ctx.el.closest('td');
    const col = [...cell.parentElement.cells].indexOf(cell);
    const input = { label: 'Hours', value: hoursOf(e), origin: e.source === 'auto' ? 'module' : 'entered' };
    if (col === 2) {
      if (e.source === 'auto' && e.active_seconds) {
        const built = toTenths(Number(e.active_seconds), s.settings.rounding);
        const edited = Math.abs(built - hoursOf(e)) > 1e-9;
        return { title: 'Hours', value: edited ? hoursOf(e) : built, status: edited ? 'entered' : undefined, inputs: [{ label: 'Active seconds captured', value: Number(e.active_seconds), origin: 'module' }, input],
          calc: [`Captured ${e.active_seconds} active seconds = ${built} hours, rounded ${s.settings.rounding === 'nearest' ? 'to the nearest' : 'up to the next'} 0.1 with a 0.1 minimum.`, ...(edited ? [`A person changed this entry to ${hoursOf(e)} hours.`] : [])] };
      }
      return { title: 'Hours', status: 'entered', value: hoursOf(e), inputs: [input], calc: ['A person typed these hours.'] };
    }
    if (col === 3) return { title: 'Rate', status: 'entered', value: Number(e.rate), inputs: [{ label: 'Rate', value: ctx.money(e.rate), origin: 'entered' }], calc: ['Fee-agreement rate for this role when the entry was created, or a rate typed on the entry.'] };
    if (col === 4) return { title: 'Amount', value: amountOf(e), format: 'money', inputs: [input, { label: 'Rate', value: ctx.money(e.rate), origin: 'entered' }], calc: [`${hoursOf(e)} hours x ${ctx.money(e.rate)} = ${ctx.money(amountOf(e))}.`] };
    return null;
  };
  // Text inside the description column: an opened activity block, or wording of the entry.
  const entryText = async (ctx) => {
    const ev = ctx.el.closest('.evidence');
    if (ev) {
      const id = ev.id.replace(/^ev-/, '');
      const days = (document.getElementById('activityDays') || {}).value || '14';
      const list = (await ctx.json(`billing/activity?days=${days}`)).filter((a) => a.entry_id === id).sort((a, b) => a.started_at.localeCompare(b.started_at));
      const blocks = blocksOf(list);
      const pos = [...ev.children].indexOf(ctx.el.closest('.evidence > div'));
      const b = blocks[pos];
      if (b && /^min/.test(ctx.after)) return { title: 'Active minutes in this block', value: Math.max(1, Math.round(b.seconds / 60)), format: 'count', calc: [`${b.seconds} active seconds / 60, rounded, at least 1.`] };
    }
    return { status: 'text', calc: ['This number is in the wording of the entry description. It is not a billing figure.'] };
  };

  // ---------- activity log ----------
  function blocksOf(rows) {
    const blocks = new Map();
    rows.forEach((r) => {
      const t = new Date(r.started_at);
      const start = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), Math.floor(t.getMinutes() / 6) * 6);
      const key = `${r.user_id}|${start.toISOString()}`;
      const b = blocks.get(key) || { start, seconds: 0, rows: [] };
      b.seconds += Number(r.active_seconds);
      b.rows.push(r);
      blocks.set(key, b);
    });
    return [...blocks.values()];
  }
  const activityFigure = async (ctx) => {
    if (ctx.el.closest('td div')) return { status: 'text', calc: ['This number is part of the logged description of an action. It is not a time or billing figure.'] };
    const tr = ctx.row;
    if (!tr || !/^min/.test(ctx.after)) return null;
    const days = (document.getElementById('activityDays') || {}).value || '14';
    const list = await ctx.json(`billing/activity?days=${days}`);
    const blocks = blocksOf(list).sort((a, b) => b.start - a.start);
    const dataRows = [...tr.parentElement.rows].filter((r) => !r.querySelector('.day-head'));
    const b = blocks[dataRows.indexOf(tr)];
    if (!b) return null;
    return { title: 'Active minutes in this 6-minute block', value: Math.max(1, Math.round(b.seconds / 60)), format: 'count',
      columns: [{ key: 'started', label: 'Started' }, { key: 'page', label: 'Where' }, { key: 'seconds', label: 'Active seconds', align: 'right' }],
      rows: b.rows.map((a) => ({ started: a.started_at, page: a.page_label || a.page || '', seconds: a.active_seconds })),
      calc: [`Heartbeats in this block total ${b.seconds} active seconds.`, `Minutes = ${b.seconds} / 60, rounded, at least 1 = ${Math.max(1, Math.round(b.seconds / 60))}.`] };
  };

  // ---------- trust ledger ----------
  const trustCell = async (ctx) => {
    const tr = ctx.row;
    const cell = ctx.el.closest('td');
    if (!tr || !cell) return null;
    const s = await summaryOf(ctx);
    const pos = [...tr.parentElement.rows].indexOf(tr);
    const t = s.trust.ledger[pos];
    if (!t) return null;
    const col = [...tr.cells].indexOf(cell);
    if (col === 3) return { title: `${KIND[t.kind] || t.kind} ${t.txn_date}`, status: 'entered', value: Number(t.amount), inputs: [{ label: 'Amount', value: ctx.money(t.amount), origin: t.kind === 'applied' ? 'module' : 'entered' }],
      calc: [t.kind === 'applied' ? 'Moved out of trust when a statement was issued.' : 'A person recorded this on the trust ledger.'] };
    if (col === 4) {
      const upTo = s.trust.ledger.slice(pos).reverse();
      const bal = upTo.reduce((a, x) => a + signed(x), 0);
      return { title: `Trust balance after ${t.txn_date}`, value: bal, format: 'money', columns: ledgerColumns, rows: upTo.map(ledgerLine),
        calc: [`Running balance of the ${upTo.length} ledger entries through this one, oldest first: deposits add, applied and refunds subtract = ${ctx.money(bal)}.`] };
    }
    return null;
  };

  // ---------- statements ----------
  async function invoiceData(ctx, inv) {
    const data = await ctx.json(`billing/invoices/${encodeURIComponent(inv.id)}`);
    const s = await summaryOf(ctx);
    const hours = Math.round(data.entries.reduce((a, e) => a + hoursOf(e), 0) * 10) / 10;
    const fees = round2(data.entries.reduce((a, e) => a + amountOf(e), 0));
    const appliedRows = s.trust.ledger.filter((t) => t.invoice_id === inv.id);
    const applied = round2(appliedRows.reduce((a, t) => a + Number(t.amount), 0));
    const through = s.trust.ledger.filter((t) => t.invoice_id === inv.id || (t.created_at && inv.created_at && t.created_at <= inv.created_at));
    const after = round2(through.reduce((a, t) => a + signed(t), 0));
    return { entries: data.entries, hours, fees, applied, due: round2(fees - applied), after, through };
  }
  const invoiceFigure = async (ctx, inv, field) => {
    const d = await invoiceData(ctx, inv);
    const rows = d.entries.map(entryLine);
    if (field === 'hours') return { title: `Statement ${inv.number}: hours`, value: d.hours, columns: entryColumns, rows, calc: [`Sum of hours on ${rows.length} entries = ${d.hours}.`] };
    if (field === 'fees') return { title: `Statement ${inv.number}: fees`, value: d.fees, format: 'money', columns: entryColumns, rows, calc: [`Sum of hours x rate on ${rows.length} entries = ${ctx.money(d.fees)}.`] };
    if (field === 'applied') return { title: `Statement ${inv.number}: from trust`, value: d.applied, format: 'money', columns: ledgerColumns, rows: d.through.filter((t) => t.invoice_id === inv.id).map(ledgerLine), calc: [`Trust ledger entries tied to this statement = ${ctx.money(d.applied)}.`] };
    if (field === 'due') return { title: `Statement ${inv.number}: due`, value: d.due, format: 'money', columns: entryColumns, rows, calc: [`Fees ${ctx.money(d.fees)} - applied from trust ${ctx.money(d.applied)} = ${ctx.money(d.due)}.`] };
    if (field === 'after') return { title: `Statement ${inv.number}: trust after`, value: d.after, format: 'money', columns: ledgerColumns, rows: d.through.map(ledgerLine), calc: [`Ledger entries up to and including this statement: deposits less applied and refunds = ${ctx.money(d.after)}.`] };
    if (field === 'before') return { title: `Statement ${inv.number}: balance before`, value: round2(d.after + d.applied), format: 'money', columns: ledgerColumns, rows: d.through.map(ledgerLine), calc: [`Trust after ${ctx.money(d.after)} + applied ${ctx.money(d.applied)} = ${ctx.money(d.after + d.applied)}.`] };
    return null;
  };
  const invoiceCell = async (ctx) => {
    const tr = ctx.row;
    const btn = tr && tr.querySelector('button[data-invoice]');
    if (!btn) return null;
    const inv = (await summaryOf(ctx)).invoices.find((i) => i.id === btn.dataset.invoice);
    if (!inv) return null;
    const col = [...tr.cells].indexOf(ctx.el.closest('td'));
    return invoiceFigure(ctx, inv, { 3: 'hours', 4: 'fees', 5: 'applied', 6: 'due', 7: 'after' }[col]);
  };

  // ---------- efficiency report ----------
  const volumes = async (ctx) => {
    const [docs, statements, tx, ev] = await Promise.all([ctx.metric('documents'), ctx.metric('statements'), ctx.metric('transactions'), ctx.json('documents/income-evidence')]);
    const reviewed = (ev.evidence || []).filter((e) => e.reviewStatus === 'accepted' || e.reviewStatus === 'rejected');
    return { documents: docs.value, statements: statements.value, transactions: tx.value, incomeDocs: reviewed.length };
  };
  const effModel = async (ctx) => {
    const [e, v] = await Promise.all([ctx.json('billing/efficiency'), volumes(ctx)]);
    const b = e.baselines;
    const manual = { intake: { unit: v.documents, per: b.document, what: 'documents' }, transactions: { unit: v.transactions, per: b.transaction, what: 'transactions' }, income: { unit: v.incomeDocs, per: b.incomeDoc, what: 'income documents reviewed' } };
    const rows = e.groups.map((g) => {
      const m = manual[g.key];
      const actualHrs = g.seconds / 3600;
      const manualHrs = m ? (m.unit * m.per) / 60 : null;
      return { ...g, m, actualHrs, manualHrs, savings: manualHrs == null ? null : (manualHrs - actualHrs) * e.rate };
    }).filter((r) => r.actualHrs > 0 || r.manualHrs);
    const counted = rows.filter((r) => r.manualHrs != null);
    const total = { manualHrs: counted.reduce((a, r) => a + r.manualHrs, 0), actualHrs: counted.reduce((a, r) => a + r.actualHrs, 0) };
    total.savings = (total.manualHrs - total.actualHrs) * e.rate;
    return { e, v, rows, counted, total };
  };
  const effColumns = [{ key: 'label', label: 'Work' }, { key: 'manual', label: 'By hand (hrs)', align: 'right' }, { key: 'actual', label: 'Actual (hrs)', align: 'right' }];
  const effLines = (list) => list.map((r) => ({ label: r.label, manual: r.manualHrs == null ? '' : r.manualHrs.toFixed(2), actual: r.actualHrs.toFixed(2) }));
  const effFigure = async (ctx) => {
    const tr = ctx.row;
    const cell = ctx.el.closest('td');
    if (!tr || !cell) return null;
    const { e, v, rows, counted, total } = await effModel(ctx);
    const first = (tr.cells[0].textContent || '').trim();
    const isTotal = /^Total \(rows/.test(first);
    const r = isTotal ? null : rows.find((x) => x.label === first);
    if (!isTotal && !r) return null;
    const col = [...tr.cells].indexOf(cell) + (isTotal ? 1 : 0);
    const isMoney = ctx.displayed && ctx.displayed.kind === 'money';
    const money = ctx.money;
    const inputs = [{ label: 'Attorney rate', value: money(e.rate), origin: 'entered' }];
    if (col === 1 && r && r.m) {
      if (/^statements/.test(ctx.after)) return { metric: 'statements' };
      if (/^transactions/.test(ctx.after)) return { metric: 'transactions' };
      if (/^documents/.test(ctx.after)) return { metric: 'documents' };
      return null;
    }
    const manualCalc = r && r.m ? [`${r.m.unit} ${r.m.what} x ${r.m.per} minutes by hand = ${r.m.unit * r.m.per} minutes.`, `Hours = ${r.m.unit * r.m.per} / 60 = ${r.manualHrs.toFixed(2)}. The minutes are the firm's estimate.`] : [];
    const sumCalc = isTotal ? [`Sum of the rows that have an estimate: ${counted.length}.`] : [];
    const list = isTotal ? counted : [r];
    const common = { columns: effColumns, rows: effLines(list), inputs, summary: { 'Documents counted': v.documents, 'Transactions counted': v.transactions, 'Income documents reviewed': v.incomeDocs } };
    if (col === 2) {
      const hrs = isTotal ? total.manualHrs : r.manualHrs;
      if (hrs == null) return null;
      return isMoney ? { ...common, title: `${first}: by hand, cost`, value: hrs * e.rate, format: 'money', calc: [...sumCalc, ...manualCalc, `${hrs.toFixed(2)} hours x ${money(e.rate)} = ${money(hrs * e.rate)}.`] }
        : { ...common, title: `${first}: by hand, hours`, value: hrs, calc: [...sumCalc, ...manualCalc] };
    }
    if (col === 3) {
      const hrs = isTotal ? total.actualHrs : r.actualHrs;
      const secs = isTotal ? counted.reduce((a, x) => a + x.seconds, 0) : r.seconds;
      const base = { ...common, inputs: inputs.concat([{ label: 'Active seconds in these pages', value: secs, origin: 'module' }]) };
      return isMoney ? { ...base, title: `${first}: actual, cost`, value: hrs * e.rate, format: 'money', calc: [`${secs} active seconds / 3,600 = ${hrs.toFixed(2)} hours.`, `${hrs.toFixed(2)} x ${money(e.rate)} = ${money(hrs * e.rate)}.`] }
        : { ...base, title: `${first}: actual, hours`, value: hrs, calc: [`${secs} active seconds / 3,600 = ${hrs.toFixed(2)} hours.`] };
    }
    if (col === 4) {
      const manualHrs = isTotal ? total.manualHrs : r.manualHrs;
      const actualHrs = isTotal ? total.actualHrs : r.actualHrs;
      const sav = isTotal ? total.savings : r.savings;
      if (sav == null) return null;
      return { ...common, title: `${first}: client savings`, value: sav, format: 'money', calc: [...sumCalc, ...manualCalc, `(${manualHrs.toFixed(2)} by-hand hours - ${actualHrs.toFixed(2)} actual hours) x ${money(e.rate)} = ${money(sav)}.`], note: 'An estimate that rests on the firm\'s by-hand minutes.' };
    }
    return null;
  };
  // The income-document volume is written without a word the page can pick up.
  const effCard = async (ctx) => {
    const { v, rows } = await effModel(ctx);
    const text = ctx.el.textContent.replace(/\s+/g, ' ');
    const hit = text.match(/(\d[\d,]*) income documents reviewed/);
    const r = rows.find((x) => x.key === 'income');
    if (hit && r) {
      const n = Number(hit[1].replace(/,/g, ''));
      ctx.text = hit[1];
      ctx.displayed = { kind: 'number', value: n, raw: n, scale: 1, decimals: 0, negative: false };
    }
    const ev = await ctx.json('documents/income-evidence');
    const reviewed = (ev.evidence || []).filter((e) => e.reviewStatus === 'accepted' || e.reviewStatus === 'rejected');
    return { title: 'Income documents reviewed', value: hit && r ? v.incomeDocs : null, status: hit && r ? undefined : 'nodata', format: 'count',
      columns: [{ key: 'filename', label: 'Document' }, { key: 'status', label: 'Review' }], rows: reviewed.map((e) => ({ filename: e.filename, status: e.reviewStatus, documentId: e.documentId })),
      documentIds: reviewed.map((e) => e.documentId), calc: [`Income documents with an accepted or rejected review = ${reviewed.length}.`] };
  };

  // ---------- printed views ----------
  const printedFigure = async (ctx) => {
    const stmt = ctx.el.closest('.stmt');
    if (!stmt) return null;
    const h1 = (stmt.querySelector('h1') || {}).textContent || '';
    if (/Efficiency/.test(h1)) {
      if (ctx.el.closest('table')) return effFigure(ctx);
      const { e, total } = await effModel(ctx);
      if (/at$/.test(ctx.before) || /both at$/.test(ctx.before)) return { title: 'Attorney rate', status: 'entered', value: e.rate, calc: ['The attorney rate in the fee agreement terms on this page.'] };
      return { title: 'Estimated fee savings', value: total.savings, format: 'money', calc: [`(${total.manualHrs.toFixed(2)} by-hand hours - ${total.actualHrs.toFixed(2)} actual hours) x ${ctx.money(e.rate)} = ${ctx.money(total.savings)}.`], note: 'An estimate that rests on the firm\'s by-hand minutes.' };
    }
    const number = Number(((stmt.textContent.match(/Statement #(\d+)/) || [])[1]));
    const inv = (await summaryOf(ctx)).invoices.find((i) => Number(i.number) === number);
    if (!inv) return null;
    const tr = ctx.row;
    const first = tr ? (tr.cells[0].textContent || '').trim() : '';
    const map = [[/^Total fees/, null], [/^Balance before/, 'before'], [/^Applied to fees/, 'applied'], [/^Remaining in trust/, 'after'], [/^Fees not covered/, 'due']];
    if (/^Total fees/.test(first)) return invoiceFigure(ctx, inv, ctx.displayed && ctx.displayed.kind === 'money' ? 'fees' : 'hours');
    const hit = map.find(([re]) => re.test(first));
    if (hit && hit[1]) return invoiceFigure(ctx, inv, hit[1]);
    if (/^Amount requested/.test(first)) {
      const s = await summaryOf(ctx);
      const d = await invoiceData(ctx, inv);
      const min = Number(s.settings.evergreen_min);
      const v = d.after < min ? round2(Number(s.settings.retainer_amount) - d.after + d.due) : d.due;
      return { title: `Statement ${inv.number}: amount requested`, value: v, format: 'money',
        inputs: [{ label: 'Retainer amount (current terms)', value: ctx.money(s.settings.retainer_amount), origin: 'entered' }, { label: 'Evergreen minimum (current terms)', value: ctx.money(min), origin: 'entered' }],
        calc: [d.after < min ? `Trust after ${ctx.money(d.after)} is below the minimum, so: retainer ${ctx.money(s.settings.retainer_amount)} - trust after ${ctx.money(d.after)} + due ${ctx.money(d.due)} = ${ctx.money(v)}.` : `Trust after is at or above the minimum, so the request is the amount due: ${ctx.money(v)}.`],
        note: 'Rebuilt with the fee terms saved now. If the terms changed after this statement was issued, this can differ.' };
    }
    // Entry lines: date, timekeeper, description, hours, rate, amount.
    const col = tr ? [...tr.cells].indexOf(ctx.el.closest('td')) : -1;
    if (col === 2) return { status: 'text', calc: ['This number is in the wording of the entry description. It is not a billing figure.'] };
    const data = await invoiceData(ctx, inv);
    const pos = tr ? [...tr.parentElement.rows].indexOf(tr) : -1;
    const e = data.entries[pos];
    if (!e) return null;
    if (col === 3) return { title: 'Hours', status: 'entered', value: hoursOf(e), calc: ['Hours on this billed entry.'] };
    if (col === 4) return { title: 'Rate', status: 'entered', value: Number(e.rate), calc: ['Rate on this billed entry.'] };
    if (col === 5) return { title: 'Amount', value: amountOf(e), format: 'money', calc: [`${hoursOf(e)} hours x ${ctx.money(e.rate)} = ${ctx.money(amountOf(e))}.`] };
    return null;
  };

  const typed = (title, note) => (ctx) => ({ title: title || ctx.label, status: 'entered', calc: [note] });
  const wording = (why) => () => ({ status: 'text', calc: [why] });

  VeritasRecon.define({
    match: [
      { selector: '.bill-note', recon: wording('This number describes how the page works. It is not a figure from this matter.') },
      { selector: '.kpi', recon: kpiFigure },
      { selector: '#alerts', recon: alertFigure },
      { selector: '#entriesTable .hrs', recon: entryCell },
      { selector: '#entriesTable td.num', recon: entryCell },
      { selector: '#entriesTable td', recon: entryText },
      { selector: '#activityTable', recon: activityFigure },
      { selector: '#trustTable', recon: trustCell },
      { selector: '#invoiceTable', recon: invoiceCell },
      { selector: '#efficiencyTable', recon: effFigure },
      { selector: '#statementView', recon: printedFigure },
      { selector: '#settingsForm', recon: typed('', 'A fee term saved for this matter. A person sets it from the engagement agreement.') },
      { selector: '#baselineForm', recon: typed('', 'The firm\'s estimate of minutes by hand. A person sets it; the report labels it as an estimate.') },
      { selector: '#manualForm', recon: typed('', 'A value being typed into the form to add time. It is not saved until the form is submitted.') },
      { selector: '#trustForm', recon: typed('', 'A value being typed into the form to record trust activity. It is not saved until the form is submitted.') },
    ],
    cards: [
      { selector: '.kpi:has(.unit)', recon: kpiCard },
      { selector: '.bill-section:has(#efficiencyTable) .bill-tools', buttonLabel: 'View income-document count', recon: effCard },
    ],
    inert: ['#trustTable td:nth-child(3)', '#invoiceTable td:first-child'],
  });
})();
