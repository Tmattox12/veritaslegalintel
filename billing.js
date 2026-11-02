/* Billing & Trust — review captured time, manage the retainer, issue statements.
 * Everything is for the active matter only and comes from
 * /api/matters/:id/billing (server/routes/billing.js). Time is captured by
 * time-tracker.js on every other page; this page is not tracked itself. */
(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';
  const esc = window.renderSafeText;

  let summary = null;
  let activity = [];

  const matterId = () => (window.VeritasMatter && window.VeritasMatter.id) || null;
  const api = (path) => `${API_BASE}/matters/${encodeURIComponent(matterId())}/billing${path}`;
  const money = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const hrs = (n) => (Number(n) || 0).toFixed(1);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDate = (s) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const STATUS_LABEL = { draft: 'Draft', approved: 'Approved', billed: 'Billed', written_off: 'Written off' };

  async function call(path, method = 'GET', body) {
    const r = await fetch(api(path), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }

  function flash(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `form-msg ${ok ? 'ok' : 'err'}`;
    if (ok) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
  }

  async function load() {
    if (!matterId()) return;
    try {
      const days = document.getElementById('activityDays').value;
      [summary, activity] = await Promise.all([call('/summary'), call(`/activity?days=${days}`)]);
    } catch (e) {
      document.getElementById('kpis').innerHTML = `<div class="kpi" style="grid-column:1/-1;"><span class="kpi-label">Backend offline</span><div class="kpi-delta">${esc(e.message)}. Start the server (start-veritas.bat), then reload this page.</div></div>`;
      return;
    }
    renderKpis();
    renderAlerts();
    renderEntries();
    renderActivity();
    renderTrust();
    renderSettings();
    renderInvoices();
    loadEfficiency();
  }

  // ---------- KPIs & alerts ----------

  function renderKpis() {
    const { trust, wip, burn, uncapturedMinutes } = summary;
    const runway = burn.daysLeft == null
      ? '<span class="kpi-delta">No billing in the last 30 days</span>'
      : `<span class="kpi-delta ${burn.daysLeft < 21 ? 'warn' : ''}">≈ ${money(burn.perDay)}/day · runs out ${fmtDate(burn.depletesOn)}</span>`;
    document.getElementById('kpis').innerHTML = `
      <div class="kpi"><span class="kpi-label">Trust balance</span><span class="kpi-value">${money(trust.balance)}</span><span class="kpi-delta">Retainer held for this client</span></div>
      <div class="kpi"><span class="kpi-label">Unbilled work</span><span class="kpi-value">${money(wip.total)}</span><span class="kpi-delta">${money(wip.approved)} approved · ${money(wip.draft)} draft</span></div>
      <div class="kpi"><span class="kpi-label">Available after unbilled</span><span class="kpi-value ${trust.available < 0 ? 'danger' : trust.available < summary.settings.evergreen_min ? 'warn' : 'good'}">${money(trust.available)}</span><span class="kpi-delta">Evergreen minimum ${money(summary.settings.evergreen_min)}</span></div>
      <div class="kpi"><span class="kpi-label">Retainer runway</span><span class="kpi-value ${burn.daysLeft != null && burn.daysLeft < 21 ? 'warn' : ''}">${burn.daysLeft == null ? '—' : `${burn.daysLeft}<span class="unit"> days</span>`}</span>${runway}</div>
      <div class="kpi"><span class="kpi-label">Activity not yet drafted</span><span class="kpi-value">${uncapturedMinutes}<span class="unit"> min</span></span><span class="kpi-delta">Click "Build drafts from activity"</span></div>`;
  }

  function replenishLetter() {
    const { matter, trust, wip, settings, alerts } = summary;
    const client = matter.client_name || matter.name || 'Client';
    return `Dear ${client},

Under our fee agreement, your retainer is held in our client trust account and applied to fees as they are billed. Your current trust balance is ${money(trust.balance)}, and work in progress not yet billed is ${money(wip.total)}, leaving ${money(trust.available)} available.

Our agreement provides that the retainer is maintained at ${money(settings.retainer_amount)} and replenished when it falls below ${money(settings.evergreen_min)}. Please deposit ${money(alerts.replenishSuggested)} at your earliest convenience so work on your case can continue without interruption.

Thank you,`;
  }

  function renderAlerts() {
    const { alerts, trust, wip } = summary;
    const el = document.getElementById('alerts');
    if (!alerts.workingAtRisk && !alerts.belowEvergreen) { el.innerHTML = ''; return; }
    const red = alerts.workingAtRisk;
    el.innerHTML = `
      <div class="alert ${red ? 'red' : 'amber'}">
        <strong>${red ? 'Working at risk:' : 'Retainer below evergreen minimum:'}</strong>
        ${red
          ? `unbilled work (${money(wip.total)}) is more than the trust balance (${money(trust.balance)}).`
          : `after unbilled work, only ${money(trust.available)} remains in trust.`}
        Suggested replenishment: <strong>${money(alerts.replenishSuggested)}</strong>.
        <details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;">Draft replenishment request</summary>
          <pre id="replenishText">${esc(replenishLetter())}</pre>
          <button class="btn ghost sm" id="copyReplenish" style="margin-top:8px;">Copy to clipboard</button>
        </details>
      </div>`;
    document.getElementById('copyReplenish').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(replenishLetter()); e.target.textContent = 'Copied'; } catch (err) { e.target.textContent = 'Select the text and copy'; }
    });
  }

  // ---------- Entries ----------

  function visibleEntries() {
    const all = summary.entries;
    return document.getElementById('entryFilter').value === 'all' ? all : all.filter((e) => e.status === 'draft' || e.status === 'approved');
  }

  function renderEntries() {
    const rows = visibleEntries();
    const table = document.getElementById('entriesTable');
    if (!rows.length) {
      table.innerHTML = '<tr><td class="empty">No unbilled time. Work on this client in Veritas, then click "Build drafts from activity", or add time manually below.</td></tr>';
      return;
    }
    table.innerHTML = `
      <thead><tr><th>Date</th><th>Timekeeper</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th><th>Task</th><th>Description</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(entryRow).join('')}</tbody>`;
  }

  function entryRow(e) {
    const locked = e.status === 'billed' || e.status === 'written_off';
    const captured = e.source === 'auto'
      ? `<div class="src">Captured ${e.started_at ? `${fmtTime(e.started_at)}–${fmtTime(e.ended_at)}` : ''} · ${Math.round(e.active_seconds / 60)} active min</div>
         <button class="linkish" data-act="evidence" data-id="${esc(e.id)}">Show activity</button><div class="evidence" id="ev-${esc(e.id)}" hidden></div>`
      : '<div class="src">Entered manually</div>';
    const actions = e.status === 'draft'
      ? `<button class="btn primary sm" data-act="approve" data-id="${esc(e.id)}">Approve</button><button class="btn ghost sm" data-act="writeoff" data-id="${esc(e.id)}">Write off</button>`
      : e.status === 'approved'
        ? `<button class="btn ghost sm" data-act="reopen" data-id="${esc(e.id)}">Back to draft</button>`
        : e.status === 'written_off'
          ? `<button class="btn ghost sm" data-act="reopen" data-id="${esc(e.id)}">Restore</button>`
          : '';
    return `<tr class="${esc(e.status)}" data-id="${esc(e.id)}">
      <td class="nowrap">${fmtDate(e.work_date)}</td>
      <td>${locked ? esc(e.timekeeper || '—') : `<input data-field="timekeeper" value="${esc(e.timekeeper || '')}" placeholder="Name" style="width:110px;" />`}
        <div style="margin-top:4px;">${locked ? esc(e.role) : `<select data-field="role"><option value="attorney" ${e.role === 'attorney' ? 'selected' : ''}>Attorney</option><option value="paralegal" ${e.role === 'paralegal' ? 'selected' : ''}>Paralegal</option></select>`}</div></td>
      <td class="num">${locked ? hrs(e.hours) : `<input class="hrs" data-field="hours" type="number" min="0.1" max="24" step="0.1" value="${hrs(e.hours)}" />`}</td>
      <td class="num">${money(e.rate)}</td>
      <td class="num">${money(e.amount)}</td>
      <td>${locked ? esc(e.task_code || '') : `<input class="code" data-field="taskCode" value="${esc(e.task_code || '')}" />`}</td>
      <td>${locked ? esc(e.narrative || '') : `<textarea data-field="narrative">${esc(e.narrative || '')}</textarea>`}${captured}</td>
      <td><span class="pill ${esc(e.status)}">${STATUS_LABEL[e.status] || esc(e.status)}</span><div style="margin-top:4px;"><span class="pill ${esc(e.source)}">${e.source === 'auto' ? 'Captured' : 'Manual'}</span></div></td>
      <td class="actions">${actions}</td>
    </tr>`;
  }

  async function patchEntry(id, body) {
    try { await call(`/entries/${encodeURIComponent(id)}`, 'PATCH', body); }
    catch (e) { alert(e.message); }
    await load();
  }

  function showEvidence(id) {
    const box = document.getElementById(`ev-${id}`);
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    const rows = activity.filter((a) => a.entry_id === id).sort((a, b) => a.started_at.localeCompare(b.started_at));
    box.innerHTML = rows.length
      ? blocksOf(rows).map((b) => `<div><strong>${fmtTime(b.start)}</strong> · ${Math.max(1, Math.round(b.seconds / 60))} min · ${esc([...b.pages].join(', '))}${b.actions.length ? ` — ${esc(b.actions.map(actionText).join('; '))}` : ''}</div>`).join('')
      : 'This activity is older than the log range selected below. Choose a longer range to see it.';
    box.hidden = false;
  }

  document.getElementById('entriesTable').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'evidence') return showEvidence(id);
    const row = btn.closest('tr');
    const narrative = row.querySelector('[data-field="narrative"]');
    if (act === 'approve') {
      // Save any unsaved edit in the same request as the approval.
      patchEntry(id, { status: 'approved', ...(narrative ? { narrative: narrative.value } : {}) });
    } else if (act === 'writeoff') {
      if (confirm('Write off this time? It stays in the record but will not be billed.')) patchEntry(id, { status: 'written_off' });
    } else if (act === 'reopen') {
      patchEntry(id, { status: 'draft' });
    }
  });

  document.getElementById('entriesTable').addEventListener('change', (ev) => {
    const field = ev.target.dataset.field;
    if (!field) return;
    const id = ev.target.closest('tr').dataset.id;
    // Hours and role change the amount, so reload. Text edits save quietly so
    // a click on Approve right after editing is not lost to a re-render.
    if (field === 'hours' || field === 'role') return patchEntry(id, { [field]: ev.target.value });
    call(`/entries/${encodeURIComponent(id)}`, 'PATCH', { [field]: ev.target.value })
      .then(() => { const e = summary.entries.find((x) => x.id === id); if (e) e[{ taskCode: 'task_code' }[field] || field] = ev.target.value; })
      .catch((e) => alert(e.message));
  });

  document.getElementById('entryFilter').addEventListener('change', renderEntries);

  document.getElementById('approveAll').addEventListener('click', async () => {
    const drafts = summary.entries.filter((e) => e.status === 'draft');
    if (!drafts.length) return alert('No drafts to approve.');
    if (!confirm(`Approve ${drafts.length} draft entr${drafts.length === 1 ? 'y' : 'ies'}? Approve only after you have read each description and confirmed the time.`)) return;
    for (const e of drafts) {
      try { await call(`/entries/${encodeURIComponent(e.id)}`, 'PATCH', { status: 'approved' }); }
      catch (err) { alert(`${fmtDate(e.work_date)}: ${err.message}`); }
    }
    load();
  });

  document.getElementById('buildDrafts').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      // Include the session in progress: the user is on this page, so they have stopped working.
      const r = await call('/build-drafts', 'POST', { includeOpen: true });
      btn.textContent = r.created ? `${r.created} draft${r.created === 1 ? '' : 's'} created` : 'Nothing new to draft';
      setTimeout(() => { btn.textContent = 'Build drafts from activity'; }, 2500);
      await load();
    } catch (e) { alert(e.message); }
    btn.disabled = false;
  });

  document.getElementById('manualForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const body = Object.fromEntries(new FormData(f).entries());
    if (!body.rate) delete body.rate;
    body.userId = localStorage.getItem('currentUserId') || null;
    try {
      await call('/entries', 'POST', body);
      f.reset();
      f.workDate.value = today();
      flash('manualMsg', 'Draft entry added. Approve it in the table above.', true);
      load();
    } catch (e) { flash('manualMsg', e.message, false); }
  });

  document.getElementById('exportCsv').addEventListener('click', () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Date', 'Timekeeper', 'Role', 'Hours', 'Rate', 'Amount', 'Task code', 'Status', 'Source', 'Description'];
    const lines = summary.entries.map((e) => [e.work_date, e.timekeeper, e.role, hrs(e.hours), e.rate, e.amount.toFixed(2), e.task_code, STATUS_LABEL[e.status], e.source, e.narrative].map(cell).join(','));
    const blob = new Blob([[head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `time-entries-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Activity log (6-minute blocks) ----------

  const actionText = (a) => [a.verb, a.noun].filter(Boolean).join(' ') + (a.detail ? ` (${a.detail})` : '');

  function blocksOf(rows) {
    const blocks = new Map();
    rows.forEach((r) => {
      const t = new Date(r.started_at);
      const start = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), Math.floor(t.getMinutes() / 6) * 6);
      const key = `${r.user_id}|${start.toISOString()}`;
      const b = blocks.get(key) || { start, user: r.user_name || r.user_id, date: r.local_date, seconds: 0, pages: new Set(), actions: [], entries: new Set() };
      b.seconds += r.active_seconds;
      if (r.page_label || r.page) b.pages.add(r.page_label || r.page);
      b.actions.push(...(r.actions || []));
      b.entries.add(r.entry_id || 'pending');
      blocks.set(key, b);
    });
    return [...blocks.values()];
  }

  function blockStatus(b) {
    if (b.entries.has('pending')) return '<span class="pill draft">Not yet drafted</span>';
    if ([...b.entries].every((e) => e === 'below_minimum')) return '<span class="pill written_off">Under 1 min — not billed</span>';
    const statuses = [...b.entries].map((id) => (summary.entries.find((e) => e.id === id) || {}).status).filter(Boolean);
    const s = statuses[0] || 'billed';
    return `<span class="pill ${esc(s)}">${STATUS_LABEL[s] || esc(s)}</span>`;
  }

  function renderActivity() {
    const table = document.getElementById('activityTable');
    if (!activity.length) {
      table.innerHTML = '<tr><td class="empty">No activity recorded in this period. Time is captured automatically on every Veritas page while this client is open.</td></tr>';
      return;
    }
    const blocks = blocksOf(activity).sort((a, b) => b.start - a.start);
    const multiUser = new Set(blocks.map((b) => b.user)).size > 1;
    let lastDate = null;
    const body = blocks.map((b) => {
      const end = new Date(b.start.getTime() + 6 * 60000);
      const head = b.date !== lastDate ? `<tr><td class="day-head" colspan="${multiUser ? 6 : 5}">${fmtDate(b.date)}</td></tr>` : '';
      lastDate = b.date;
      return `${head}<tr>
        <td style="white-space:nowrap;">${fmtTime(b.start)}–${fmtTime(end)}</td>
        ${multiUser ? `<td>${esc(b.user)}</td>` : ''}
        <td class="num">${Math.max(1, Math.round(b.seconds / 60))} min</td>
        <td>${esc([...b.pages].join(', '))}</td>
        <td>${b.actions.length ? b.actions.map((a) => `<div>${esc(actionText(a))}</div>`).join('') : '<span style="color:var(--mute);">Review / analysis</span>'}</td>
        <td>${blockStatus(b)}</td>
      </tr>`;
    }).join('');
    table.innerHTML = `<thead><tr><th>Block</th>${multiUser ? '<th>User</th>' : ''}<th class="num">Active</th><th>Where</th><th>What was done</th><th>Status</th></tr></thead><tbody>${body}</tbody>`;
  }

  document.getElementById('activityDays').addEventListener('change', load);

  // ---------- Trust ----------

  function renderTrust() {
    const ledger = summary.trust.ledger;
    const table = document.getElementById('trustTable');
    if (!ledger.length) {
      table.innerHTML = '<tr><td class="empty">No trust activity yet. Record the initial retainer deposit below.</td></tr>';
      return;
    }
    // Running balance, oldest first, then shown newest first.
    let bal = 0;
    const withBal = [...ledger].reverse().map((t) => { bal += t.kind === 'deposit' ? t.amount : -t.amount; return { ...t, bal }; }).reverse();
    const KIND = { deposit: 'Deposit', applied: 'Applied to fees', refund: 'Refund' };
    table.innerHTML = `<thead><tr><th>Date</th><th>Type</th><th>Memo</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead>
      <tbody>${withBal.map((t) => `<tr>
        <td>${fmtDate(t.txn_date)}</td><td>${KIND[t.kind]}</td><td>${esc(t.memo || '')}</td>
        <td class="num" style="color:${t.kind === 'deposit' ? 'var(--green)' : 'var(--ink)'};">${t.kind === 'deposit' ? '+' : '−'}${money(t.amount)}</td>
        <td class="num">${money(t.bal)}</td></tr>`).join('')}</tbody>`;
  }

  document.getElementById('trustForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const body = Object.fromEntries(new FormData(f).entries());
    try {
      await call('/trust', 'POST', body);
      f.reset();
      f.date.value = today();
      flash('trustMsg', 'Recorded.', true);
      load();
    } catch (e) { flash('trustMsg', e.message, false); }
  });

  // ---------- Fee terms ----------

  function renderSettings() {
    const s = summary.settings;
    const f = document.getElementById('settingsForm');
    if (f.contains(document.activeElement)) return;
    f.attorneyRate.value = s.attorney_rate;
    f.paralegalRate.value = s.paralegal_rate;
    f.retainerAmount.value = s.retainer_amount;
    f.evergreenMin.value = s.evergreen_min;
    f.rounding.value = s.rounding;
  }

  document.getElementById('settingsForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    try {
      await call('/settings', 'PUT', body);
      flash('settingsMsg', 'Saved.', true);
      load();
    } catch (e) { flash('settingsMsg', e.message, false); }
  });

  // ---------- Statements ----------

  function renderInvoices() {
    const table = document.getElementById('invoiceTable');
    const list = summary.invoices;
    if (!list.length) {
      table.innerHTML = '<tr><td class="empty">No statements yet. Approve entries, then click "Prepare statement".</td></tr>';
      return;
    }
    table.innerHTML = `<thead><tr><th>#</th><th>Issued</th><th>Period</th><th class="num">Hours</th><th class="num">Fees</th><th class="num">From trust</th><th class="num">Due</th><th class="num">Trust after</th><th></th></tr></thead>
      <tbody>${list.map((i) => `<tr>
        <td>${i.number}</td><td>${fmtDate(i.created_at)}</td><td>${fmtDate(i.period_start)} – ${fmtDate(i.period_end)}</td>
        <td class="num">${hrs(i.hours_total)}</td><td class="num">${money(i.fees_total)}</td><td class="num">${money(i.trust_applied)}</td>
        <td class="num">${money(i.amount_due)}</td><td class="num">${money(i.trust_balance_after)}</td>
        <td class="actions"><button class="btn ghost sm" data-invoice="${esc(i.id)}">View / print</button><a class="btn ghost sm" style="text-align:center;margin-top:4px;display:block;text-decoration:none;" href="${api(`/invoices/${encodeURIComponent(i.id)}/ledes`)}" title="LEDES 1998B e-billing file">LEDES file</a></td></tr>`).join('')}</tbody>`;
  }

  document.getElementById('invoiceTable').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-invoice]');
    if (btn) openStatement(btn.dataset.invoice);
  });

  // ---------- Efficiency report ----------

  let efficiency = null;

  // One row per kind of work: volume × by-hand minutes vs. active time in Veritas.
  function efficiencyRows() {
    const e = efficiency;
    const b = e.baselines;
    const v = e.volumes;
    const manual = {
      intake: { volume: `${v.documents} documents`, minutes: v.documents * b.document },
      transactions: { volume: `${v.transactions.toLocaleString()} transactions on ${v.statements} statements`, minutes: v.transactions * b.transaction },
      income: { volume: `${v.incomeDocs} income documents reviewed`, minutes: v.incomeDocs * b.incomeDoc },
    };
    const rows = e.groups.map((g) => {
      const m = manual[g.key];
      const actualHrs = g.seconds / 3600;
      const manualHrs = m ? m.minutes / 60 : null;
      return { label: g.label, volume: m ? m.volume : '—', manualHrs, actualHrs, savings: manualHrs == null ? null : (manualHrs - actualHrs) * e.rate };
    }).filter((r) => r.actualHrs > 0 || r.manualHrs);
    const counted = rows.filter((r) => r.manualHrs != null);
    const total = {
      manualHrs: counted.reduce((s, r) => s + r.manualHrs, 0),
      actualHrs: counted.reduce((s, r) => s + r.actualHrs, 0),
    };
    total.savings = (total.manualHrs - total.actualHrs) * e.rate;
    return { rows, total };
  }

  function efficiencyTableHtml() {
    const { rows, total } = efficiencyRows();
    const rate = efficiency.rate;
    if (!rows.length) return '<tr><td class="empty">No work recorded for this client yet.</td></tr>';
    const h = (n) => (n == null ? '—' : n.toFixed(1));
    const signed = (n) => (n == null ? '—' : `${n < 0 ? '−' : ''}${money(Math.abs(n))}`);
    return `<thead><tr><th>Work</th><th>Volume</th><th class="num">By hand (est.)</th><th class="num">Actual in Veritas</th><th class="num">Client savings</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.volume)}</td>
        <td class="num">${r.manualHrs == null ? '—' : `${h(r.manualHrs)} hrs<div class="src">${money(r.manualHrs * rate)}</div>`}</td>
        <td class="num">${h(r.actualHrs)} hrs<div class="src">${money(r.actualHrs * rate)}</div></td>
        <td class="num"><strong>${signed(r.savings)}</strong></td></tr>`).join('')}
      <tr><td colspan="2"><strong>Total (rows with an estimate)</strong></td>
        <td class="num"><strong>${h(total.manualHrs)} hrs</strong><div class="src">${money(total.manualHrs * rate)}</div></td>
        <td class="num"><strong>${h(total.actualHrs)} hrs</strong><div class="src">${money(total.actualHrs * rate)}</div></td>
        <td class="num"><strong>${signed(total.savings)}</strong></td></tr></tbody>`;
  }

  async function loadEfficiency() {
    try { efficiency = await call('/efficiency'); } catch (e) { document.getElementById('efficiencyTable').innerHTML = `<tr><td class="empty">${esc(e.message)}</td></tr>`; return; }
    const f = document.getElementById('baselineForm');
    if (!f.contains(document.activeElement)) Object.entries(efficiency.baselines).forEach(([k, v]) => { if (f[k]) f[k].value = v; });
    document.getElementById('efficiencyTable').innerHTML = efficiencyTableHtml();
  }

  document.getElementById('baselineForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await call('/efficiency/baselines', 'PUT', Object.fromEntries(new FormData(ev.target).entries()));
      flash('baselineMsg', 'Saved.', true);
      loadEfficiency();
    } catch (e) { flash('baselineMsg', e.message, false); }
  });

  document.getElementById('printEfficiency').addEventListener('click', () => {
    if (!efficiency) return;
    const { total } = efficiencyRows();
    const m = efficiency.matter;
    const view = document.getElementById('statementView');
    view.innerHTML = `
      <div class="stmt-bar"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="print">Print / save PDF</button></div>
      <div class="stmt">
        <h1>Efficiency Report</h1>
        <div style="color:#55637a;">${esc(m.client_name || m.name)} · ${esc(m.name)}${m.case_no ? ` · Case No. ${esc(m.case_no)}` : ''} · Prepared ${fmtDate(today())}</div>
        <p style="margin:16px 0;line-height:1.6;">Our firm uses Veritas to organize and analyze the financial records in your case. The table compares the time this work would typically take by hand with the time actually spent, both at ${money(efficiency.rate)} per hour.
        ${total.savings > 0 ? `So far, that is an estimated <strong>${money(total.savings)}</strong> less in fees for the same work.` : ''}</p>
        <table>${efficiencyTableHtml()}</table>
        <p style="color:#55637a;font-size:11px;line-height:1.5;">"By hand" figures are the firm's estimates of typical time for the same volume of work. You are billed only for actual time recorded and approved by your attorney.</p>
      </div>`;
    view.classList.add('open');
    view.onclick = (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'print') window.print();
      if (act === 'close' || e.target === view) view.classList.remove('open');
    };
  });

  document.getElementById('prepareStatement').addEventListener('click', async () => {
    const approved = summary.entries.filter((e) => e.status === 'approved');
    if (!approved.length) return alert('There are no approved entries to bill. Approve the time entries first.');
    const fees = approved.reduce((s, e) => s + e.amount, 0);
    const drafts = summary.entries.filter((e) => e.status === 'draft').length;
    const msg = `Issue a statement for ${approved.length} approved entr${approved.length === 1 ? 'y' : 'ies'} (${money(fees)})?\n\n` +
      `Up to ${money(Math.min(Math.max(summary.trust.balance, 0), fees))} will be applied from trust. Billed entries are locked.` +
      (drafts ? `\n\n${drafts} draft entr${drafts === 1 ? 'y is' : 'ies are'} not approved and will not be included.` : '');
    if (!confirm(msg)) return;
    try {
      const r = await call('/invoices', 'POST', {});
      await load();
      openStatement(r.id);
    } catch (e) { alert(e.message); }
  });

  async function openStatement(id) {
    let data;
    try { data = await call(`/invoices/${encodeURIComponent(id)}`); } catch (e) { return alert(e.message); }
    const { invoice: inv, matter, entries } = data;
    const before = inv.trust_balance_after + inv.trust_applied;
    const view = document.getElementById('statementView');
    view.innerHTML = `
      <div class="stmt-bar"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="print">Print / save PDF</button></div>
      <div class="stmt">
        <h1>Statement of Account</h1>
        <div style="color:#55637a;">Statement #${inv.number} · Issued ${fmtDate(inv.created_at)}</div>
        <div class="meta">
          <div><strong>${esc(matter.client_name || matter.name)}</strong><br>${esc(matter.name)}${matter.case_no ? `<br>Case No. ${esc(matter.case_no)}` : ''}</div>
          <div style="text-align:right;">Services ${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}</div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Timekeeper</th><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
          <tbody>${entries.map((e) => `<tr>
            <td style="white-space:nowrap;">${fmtDate(e.work_date)}</td>
            <td>${esc(e.timekeeper || '')}<div style="color:#8a96aa;font-size:11px;text-transform:capitalize;">${esc(e.role)}</div></td>
            <td>${esc(e.narrative || '')}</td>
            <td class="num">${hrs(e.hours)}</td><td class="num">${money(e.rate)}</td><td class="num">${money(e.hours * e.rate)}</td></tr>`).join('')}</tbody>
          <tbody class="totals"><tr><td colspan="3">Total fees this statement</td><td class="num">${hrs(inv.hours_total)}</td><td></td><td class="num">${money(inv.fees_total)}</td></tr></tbody>
        </table>
        <div class="box">
          <strong>Trust account (retainer)</strong>
          <table style="margin:8px 0 0;">
            <tr><td>Balance before this statement</td><td class="num">${money(before)}</td></tr>
            <tr><td>Applied to fees</td><td class="num">−${money(inv.trust_applied)}</td></tr>
            <tr class="totals"><td>Remaining in trust</td><td class="num">${money(inv.trust_balance_after)}</td></tr>
          </table>
        </div>
        <div class="box">
          <table style="margin:0;">
            <tr><td>Fees not covered by trust (due now)</td><td class="num">${money(inv.amount_due)}</td></tr>
            <tr class="totals"><td>Amount requested${inv.replenish_requested > inv.amount_due ? ' (including retainer replenishment)' : ''}</td><td class="num">${money(inv.replenish_requested)}</td></tr>
          </table>
          ${inv.replenish_requested > inv.amount_due ? '<div style="margin-top:8px;color:#55637a;">Your trust balance is below the minimum in your fee agreement. The amount requested restores your retainer.</div>' : ''}
        </div>
      </div>`;
    view.classList.add('open');
    view.onclick = (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'print') window.print();
      if (act === 'close' || e.target === view) view.classList.remove('open');
    };
  }

  // ---------- Start ----------

  function init() {
    document.querySelector('#manualForm [name="workDate"]').value = today();
    document.querySelector('#trustForm [name="date"]').value = today();
    if (!matterId()) return;
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
