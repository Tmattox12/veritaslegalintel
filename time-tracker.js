// Time capture for billing. Loaded by matter-context.js on every page.
//
// Counts only ACTIVE time on the open matter: the tab must be visible and the
// user must have moused, typed, scrolled or clicked recently. Once input stops
// for IDLE_MS, only the first GRACE_MS after the last input is kept — reading
// a statement for a minute counts, walking away from the desk does not.
//
// About once a minute it sends a heartbeat (seconds worked, page, actions) to
// /api/matters/:id/billing/activity. The Billing & Trust page turns those
// heartbeats into DRAFT time entries for the attorney to review and approve.
//
// Actions are picked up automatically from the app's own API calls (uploads,
// reviews, reclassifications, ...). Pages can add their own:
//   VeritasTime.log('Built', 'income imputation scenario', 'Mother — 40 hr/wk at $18')
(function () {
  const API = 'http://localhost:3000/api';
  const PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  // Billing administration and setup pages are not billable client work.
  const NOT_TRACKED = new Set(['billing.html', 'auth.html', 'admin-reset.html', 'reset-data.html', 'sidebar.html', 'cases.html']);
  if (NOT_TRACKED.has(PAGE) || window.VeritasTime) return;

  const IDLE_MS = 5 * 60 * 1000;
  const GRACE_MS = 60 * 1000;
  const TICK_MS = 5000;
  const BEAT_MS = 60 * 1000;
  const PAUSE_KEY = 'veritas.time.paused';

  const PAGE_LABELS = {
    'index.html': 'Dashboard',
    'case-intake.html': 'Case intake',
    'case-detail.html': 'Case detail',
    'discovery-intake.html': 'Document intake',
    'discovery-management.html': 'Discovery management',
    'document-hub-master.html': 'Document hubs',
    'document-hub-income.html': 'Income documents',
    'document-hub-expenses.html': 'Expense documents',
    'document-hub-business.html': 'Business documents',
    'document-hub-tax.html': 'Tax documents',
    'document-hub-assets.html': 'Asset documents',
    'document-hub-realestate.html': 'Real estate documents',
    'document-hub-investments.html': 'Investment documents',
    'document-hub-retirement.html': 'Retirement documents',
    'document-hub-liabilities.html': 'Liability documents',
    'document-hub-legal.html': 'Legal documents',
    'document-reconciliation-hub.html': 'Document reconciliation',
    'merchant-mapping-review.html': 'Expense category review',
    'income-imputation.html': 'Income analysis',
    'income-engine-builder.html': 'Income analysis',
    'income-reconciliation.html': 'Income reconciliation',
    'spousal.html': 'Spousal maintenance analysis',
    'child-support.html': 'Child support calculation',
    'child-support-calculator.html': 'Child support calculation',
    'equitable-distribution.html': 'Community property division analysis',
    'rsu.html': 'RSU / equity compensation analysis',
    'custody.html': 'Parenting time analysis',
    'afi.html': 'Affidavit of Financial Information (AFI)',
    'credits.html': 'Credits and adjustments',
    'cashflow.html': 'Cash flow analysis',
    'forensic-tracing.html': 'Forensic tracing',
    'settlement.html': 'Settlement modeling',
    'settlement-modeling.html': 'Settlement modeling',
    'red-flags.html': 'Red-flag review',
    'audit-reconciliation.html': 'Audit reconciliation',
    'estate.html': 'Reports',
    'regulations.html': 'Legal research (support guidelines)',
  };

  function pageLabel() {
    if (PAGE_LABELS[PAGE]) return PAGE_LABELS[PAGE];
    // Fallback: the page title without the client name prefix or app suffix.
    return (document.title.split(' — ').pop() || PAGE).replace(/\s*[-|]\s*Veritas.*$/i, '').trim() || PAGE;
  }

  const matterId = () => (window.VeritasMatter && window.VeritasMatter.id) || null;
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let paused = false;
  try { paused = sessionStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { /* private mode */ }

  let lastInput = Date.now();
  let lastTick = Date.now();
  let committedMs = 0;   // credited and waiting to be sent
  let pendingMs = 0;     // accrued since last input; credited on input, trimmed on idle
  let beatStart = new Date();
  let actions = [];
  let todaySeconds = 0;  // already on the server today, for the chip

  const isActiveNow = () => !paused && matterId() && document.visibilityState === 'visible';

  function onInput() {
    const now = Date.now();
    if (now - lastInput >= IDLE_MS) {
      // Coming back from idle: the idle gap itself is not counted.
      lastTick = now;
    }
    lastInput = now;
    committedMs += pendingMs;
    pendingMs = 0;
  }
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, onInput, { passive: true, capture: true }));

  function tick() {
    const now = Date.now();
    const elapsed = Math.min(now - lastTick, TICK_MS * 3);
    lastTick = now;
    if (!isActiveNow()) { pendingMs = Math.min(pendingMs, GRACE_MS); return; }
    if (now - lastInput < IDLE_MS) {
      pendingMs += elapsed;
    } else if (pendingMs) {
      committedMs += Math.min(pendingMs, GRACE_MS);
      pendingMs = 0;
    }
    renderChip();
  }

  async function beat(final) {
    const id = matterId();
    if (!id) return;
    if (final) { committedMs += Math.min(pendingMs, GRACE_MS); pendingMs = 0; }
    const seconds = Math.round(committedMs / 1000);
    if (!seconds && !actions.length) { beatStart = new Date(); return; }
    const body = {
      userId: localStorage.getItem('currentUserId') || 'user-unknown',
      userName: localStorage.getItem('veritas_user_name') || null,
      page: PAGE,
      pageLabel: pageLabel(),
      localDate: localDate(beatStart),
      startedAt: beatStart.toISOString(),
      endedAt: new Date().toISOString(),
      activeSeconds: seconds,
      actions,
    };
    // Reset before sending so a slow request never double-counts. On failure
    // the time goes back and the next heartbeat covers the whole span.
    committedMs -= seconds * 1000;
    const sentActions = actions;
    const sentStart = beatStart;
    actions = [];
    beatStart = new Date();
    try {
      const r = await rawFetch(`${API}/matters/${encodeURIComponent(id)}/billing/activity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!final,
      });
      if (!r.ok) throw new Error(r.status);
      todaySeconds += seconds;
    } catch (e) {
      // Backend down: keep the time and actions for the next heartbeat.
      committedMs += seconds * 1000;
      actions = sentActions.concat(actions);
      beatStart = sentStart;
    }
    renderChip();
  }

  // ---------- Automatic action capture from the app's API calls ----------

  const rawFetch = window.fetch.bind(window);
  const ACTION_RULES = [
    [/\/bank-statements\/upload$/, 'POST', () => ['Uploaded and parsed', 'bank statement']],
    [/\/bank-statements\/refresh-headers$/, 'POST', () => ['Refreshed', 'statement header']],
    [/\/documents\/upload$/, 'POST', () => ['Uploaded and processed', 'document']],
    [/\/documents\/income-evidence\/[^/]+\/review$/, 'POST', (b) => [b && b.status === 'rejected' ? 'Rejected' : 'Reviewed and accepted', 'income document']],
    [/\/documents\/reprocess$/, 'POST', () => ['Re-processed', 'document set']],
    [/\/documents\/reconcile$/, 'POST', () => ['Reconciled', 'document set']],
    [/\/documents\/expense-workbook$/, 'POST', () => ['Generated', 'expense workbook']],
    [/\/documents\/classify-account$/, 'POST', () => ['Reclassified', 'account statement set']],
    [/\/merchants\/[^/]+\/(confirm|remap)$/, 'POST', () => ['Reviewed', 'expense category']],
    [/\/api\/documents\/[^/]+\/manual-entry$/, 'POST', () => ['Abstracted', 'unreadable document']],
    [/\/api\/documents\/[^/]+\/retry-extraction$/, 'POST', () => ['Re-ran extraction on', 'document']],
    [/\/api\/documents\/[^/]+\/category$/, 'PATCH', () => ['Reclassified', 'document']],
    [/\/api\/documents\/[^/]+\/review$/, 'POST', () => ['Completed OCR review of', 'document']],
    [/\/api\/documents\/[^/]+$/, 'DELETE', () => ['Removed', 'duplicate or irrelevant document']],
    [/\/api\/matters\/[^/]+\/parties$/, 'PATCH', () => ['Updated', 'party information']],
    [/\/api\/matters\/[^/]+$/, 'PUT', () => ['Updated', 'case intake information']],
    [/\/api\/chat$/, 'POST', () => ['Ran', 'AI-assisted analysis query']],
  ];

  function describeRequest(url, method, body) {
    if (/\/billing\//.test(url)) return null;
    for (const [re, m, fn] of ACTION_RULES) {
      if (m === method && re.test(url)) {
        let parsed = null;
        if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch (e) { /* not JSON */ } }
        const [verb, noun] = fn(parsed);
        let detail = '';
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
          const f = body.get('file');
          if (f && f.name) detail = f.name;
        }
        return { verb, noun, detail };
      }
    }
    return null;
  }

  window.fetch = function (input, init) {
    const p = rawFetch(input, init);
    try {
      const url = (typeof input === 'string' ? input : input && input.url) || '';
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const action = method !== 'GET' && url.includes('/api/') && describeRequest(url.split('?')[0], method, init && init.body);
      if (action) p.then((r) => { if (r.ok) log(action.verb, action.noun, action.detail); }, () => {});
    } catch (e) { /* never break the page's request */ }
    return p;
  };

  window.addEventListener('beforeprint', () => log('Prepared printed', 'report', pageLabel()));

  function log(verb, noun, detail) {
    if (!matterId() || paused) return;
    actions.push({ at: new Date().toISOString(), verb: String(verb || ''), noun: String(noun || ''), detail: String(detail || '') });
    onInput();
  }

  // ---------- Timer chip ----------

  let chip;
  function renderChip() {
    if (!chip) return;
    const id = matterId();
    chip.style.display = id ? 'flex' : 'none';
    if (!id) return;
    const total = todaySeconds + Math.round((committedMs + pendingMs) / 1000);
    const mins = Math.floor(total / 60);
    const idle = Date.now() - lastInput >= IDLE_MS;
    const state = paused ? 'Paused' : idle ? 'Idle' : 'Tracking';
    const color = paused ? '#b8813b' : idle ? '#8a96aa' : '#2f7d5b';
    chip.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
      <span><strong>${state}</strong> · ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`} today</span>
      <button type="button" data-act="toggle" style="border:1px solid #e4e8f0;background:#fff;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;color:#1c3350;">${paused ? 'Resume' : 'Pause'}</button>
      <a href="billing.html" style="font-size:11px;color:#274566;">Billing</a>`;
    chip.title = 'Active time on this client today. Counts only while you are working in Veritas; stops when idle.';
  }

  function mountChip() {
    chip = document.createElement('div');
    chip.id = 'veritasTimeChip';
    chip.style.cssText = 'position:fixed;bottom:34px;right:92px;z-index:9998;display:none;align-items:center;gap:8px;' +
      'background:#fff;border:1px solid #e4e8f0;border-radius:999px;padding:6px 12px;font:12px Inter,system-ui,sans-serif;' +
      'color:#1a2432;box-shadow:0 8px 24px rgba(16,27,44,.08);';
    chip.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="toggle"]')) {
        if (!paused) beat(false);
        paused = !paused;
        try { sessionStorage.setItem(PAUSE_KEY, paused ? '1' : '0'); } catch (err) { /* private mode */ }
        onInput();
        renderChip();
      }
    });
    document.body.appendChild(chip);
    renderChip();
  }

  async function loadToday() {
    const id = matterId();
    if (!id) return;
    try {
      const qs = new URLSearchParams({ userId: localStorage.getItem('currentUserId') || 'user-unknown', date: localDate() });
      const r = await rawFetch(`${API}/matters/${encodeURIComponent(id)}/billing/activity/today?${qs}`);
      if (r.ok) todaySeconds = (await r.json()).seconds || 0;
    } catch (e) { /* offline: chip shows this session only */ }
    renderChip();
  }

  setInterval(tick, TICK_MS);
  setInterval(() => beat(false), BEAT_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') beat(true); });
  window.addEventListener('pagehide', () => beat(true));
  window.addEventListener('veritas:matter', loadToday);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountChip);
  else mountChip();

  window.VeritasTime = {
    log,
    get paused() { return paused; },
  };
})();
