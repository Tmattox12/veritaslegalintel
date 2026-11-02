/* Income Hub — intake reconciliation, then review & allocation of income.
 * Document Intake parses raw files; this page shows where those files and
 * transactions landed, and is where income documents are assigned to a party
 * and accepted. Only accepted documents reach the Income Engine. Bank deposits
 * are shown for comparison and are never accepted income. All data comes from
 * the backend for the active matter. */
(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';
  const esc = window.renderSafeText;
  // The classifier files business returns under the same tax-record type as
  // personal returns, so business income is recognized by its form name.
  const BUSINESS_RE = /\bk-?1\b|\b1065\b|\b1120(?:-?s)?\b|schedule\s*c\b|sch[\s_-]*c\b|profit\s*(?:and|&)?\s*loss|\bp\s*&\s*l\b|\bpnl\b/i;

  let evidence = [];

  function matterId() {
    return (window.VeritasMatter && window.VeritasMatter.id) || localStorage.getItem('currentMatterId') || null;
  }

  function partyNames() {
    return (window.VeritasMatter && window.VeritasMatter.partyNames) || { a: 'Party A', b: 'Party B' };
  }

  function money(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function isBusiness(item) {
    return BUSINESS_RE.test(item.filename || '');
  }

  function empty(title, text) {
    return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(text)}</div>`;
  }

  // ---------- 1 · Intake → Income reconciliation ----------

  function renderRecon(hub) {
    const el = document.getElementById('reconBody');
    const strip = document.getElementById('reconStrip');
    const i = hub.intake;
    const f = i.byFlow;
    const ex = hub.inflows.excluded;
    const excludedCount = ex.card_credit.count + ex.account_movement.count + ex.transfer_or_refund.count;
    const unparsed = i.statementDocuments - i.statementsParsed;
    const flowTotal = f.income + f.expense + f.transfer + f.unknown;
    const inflowTotal = hub.inflows.candidates.count + excludedCount;

    const checks = [];
    if (unparsed > 0) checks.push(`<span class="recon-gap">⚠ ${unparsed} statement(s) uploaded but not parsed${i.statementsFailed ? ` (${i.statementsFailed} failed)` : ''} — their transactions are missing below.</span>`);
    if (i.unclassifiedDocuments > 0) checks.push(`<span class="recon-gap">⚠ ${i.unclassifiedDocuments} document(s) unclassified at intake — check whether any are income records.</span>`);
    if (f.unknown > 0) checks.push(`<span class="recon-gap">⚠ ${f.unknown} transaction(s) with no direction (in/out/transfer) — resolve at intake.</span>`);
    if (flowTotal !== i.transactions || inflowTotal !== hub.inflows.count) checks.push('<span class="recon-gap">⚠ Transaction counts do not tie — re-run parsing at intake.</span>');
    if (!checks.length && i.documents) checks.push('<span class="recon-ok">✓ Everything parsed at intake is accounted for.</span>');

    strip.classList.toggle('has-gap', checks.some((c) => c.includes('recon-gap')));

    if (!i.documents) {
      el.innerHTML = empty('Nothing at intake yet', 'Upload pay stubs, tax returns, and bank statements in Document Intake to start.');
      return;
    }

    el.innerHTML = `
      <div class="recon-flow">
        <div class="recon-step">
          <div class="recon-step-label">At intake</div>
          <div class="recon-step-value">${i.documents} docs</div>
          <div class="recon-step-detail">
            ${i.incomeDocuments} income · ${i.statementDocuments} statements<br>
            ${i.documents - i.incomeDocuments - i.statementDocuments - i.unclassifiedDocuments} other · <span class="${i.unclassifiedDocuments ? 'recon-gap' : ''}">${i.unclassifiedDocuments} unclassified</span>
          </div>
        </div>
        <div class="recon-step">
          <div class="recon-step-label">Statements parsed</div>
          <div class="recon-step-value">${i.statementsParsed} / ${i.statementDocuments}</div>
          <div class="recon-step-detail">
            ${i.transactions} transactions<br>
            <span class="${unparsed ? 'recon-gap' : ''}">${unparsed} not parsed</span>
          </div>
        </div>
        <div class="recon-step">
          <div class="recon-step-label">Routed by direction</div>
          <div class="recon-step-value">${f.income} in</div>
          <div class="recon-step-detail">
            ${f.expense} out → Expense Hub · ${f.transfer} transfers<br>
            <span class="${f.unknown ? 'recon-gap' : ''}">${f.unknown} unclassified</span>
          </div>
        </div>
        <div class="recon-step">
          <div class="recon-step-label">Income candidates</div>
          <div class="recon-step-value">${hub.inflows.candidates.count}</div>
          <div class="recon-step-detail">
            ${money(hub.inflows.candidates.amount)} in deposits<br>
            ${excludedCount} inflows excluded (see below)
          </div>
        </div>
      </div>
      <div class="recon-checks">${checks.join('')}</div>`;
  }

  // ---------- 2 · Allocation summary ----------

  function renderSummary() {
    const accepted = evidence.filter((e) => e.reviewStatus === 'accepted' && Number(e.annualAmount) > 0);
    const total = (party) => accepted.filter((e) => e.party === party).reduce((s, e) => s + Number(e.annualAmount), 0);
    const a = total('party_a');
    const b = total('party_b');
    document.getElementById('acceptedA').textContent = money(a);
    document.getElementById('acceptedAMonthly').textContent = `${money(a / 12)} / mo · ${accepted.filter((e) => e.party === 'party_a').length} source(s)`;
    document.getElementById('acceptedB').textContent = money(b);
    document.getElementById('acceptedBMonthly').textContent = `${money(b / 12)} / mo · ${accepted.filter((e) => e.party === 'party_b').length} source(s)`;
    document.getElementById('pendingCount').textContent = evidence.filter((e) => !e.reviewStatus || e.reviewStatus === 'pending').length;
  }

  // ---------- 3 · Income documents: review & allocate ----------

  function docDetail(item) {
    const bits = [item.documentType || 'Type pending'];
    if (item.grossPay != null) bits.push(`Gross ${money(item.grossPay)}`);
    if (item.netPay != null) bits.push(`Net ${money(item.netPay)}`);
    if (item.paymentAmount != null && item.netPay == null) bits.push(`Payment ${money(item.paymentAmount)}`);
    if (item.payPeriod) bits.push(item.payPeriod);
    else if (item.payDate) bits.push(`Paid ${item.payDate}`);
    return bits.join(' · ');
  }

  function renderIncomeDocs() {
    const el = document.getElementById('incomeDocs');
    if (!evidence.length) {
      el.innerHTML = empty('No income documents classified yet', 'Pay stubs, W-2s, 1099s, K-1s, and benefit statements uploaded in Document Intake appear here.');
      return;
    }
    const names = partyNames();
    el.innerHTML = `
      <div class="hub-table-wrap">
        <table class="hub-table">
          <thead><tr><th>Document</th><th>Party</th><th class="num">Annual amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${evidence.map((item, idx) => `
              <tr data-idx="${idx}">
                <td>
                  <div class="doc-file">${esc(item.filename)}${isBusiness(item) ? ' <span class="status-pill" style="background:#efe9f7;color:#6b4f9a;">Business</span>' : ''}</div>
                  <div class="doc-sub">${esc(docDetail(item))}</div>
                </td>
                <td>
                  <select data-field="party">
                    <option value="">Choose…</option>
                    <option value="party_a" ${item.party === 'party_a' ? 'selected' : ''}>${esc(names.a)}</option>
                    <option value="party_b" ${item.party === 'party_b' ? 'selected' : ''}>${esc(names.b)}</option>
                  </select>
                </td>
                <td class="num"><input data-field="annual" type="number" min="0" step="1" placeholder="Annual $" value="${item.annualAmount ?? ''}"></td>
                <td><span class="status-pill ${esc(item.reviewStatus || 'pending')}" data-review-status>${esc(item.reviewStatus || 'pending')}</span><div class="row-msg"></div></td>
                <td><div class="row-actions"><button type="button" class="btn-accept" data-act="accepted">Accept</button><button type="button" class="btn-reject" data-act="rejected">Reject</button></div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  async function saveReview(row, status) {
    const item = evidence[Number(row.dataset.idx)];
    const party = row.querySelector('[data-field="party"]').value;
    const annualAmount = row.querySelector('[data-field="annual"]').value;
    const msg = row.querySelector('.row-msg');
    msg.textContent = '';
    if (!party) { msg.textContent = 'Choose a party'; return; }
    if (status === 'accepted' && !(Number(annualAmount) > 0)) { msg.textContent = 'Enter the annual amount'; return; }
    try {
      const r = await fetch(`${API_BASE}/matters/${matterId()}/documents/income-evidence/${item.documentId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party, annualAmount, status }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Save failed');
      item.party = party;
      item.annualAmount = annualAmount === '' ? null : Number(annualAmount);
      item.reviewStatus = status;
      const pill = row.querySelector('[data-review-status]');
      pill.className = `status-pill ${status}`;
      pill.textContent = status;
      renderSummary();
      renderBusiness();
    } catch (e) {
      msg.textContent = e.message;
    }
  }

  // ---------- 4 · Business income ----------

  function renderBusiness() {
    const el = document.getElementById('businessIncome');
    const items = evidence.filter(isBusiness);
    if (!items.length) {
      el.innerHTML = '<div style="font-size:12px;color:#7a8a9a;">No K-1, 1065, 1120, Schedule C, or P&amp;L documents at intake for this matter.</div>';
      return;
    }
    const names = partyNames();
    const label = (p) => (p === 'party_a' ? names.a : p === 'party_b' ? names.b : 'Unassigned');
    el.innerHTML = `
      <div class="hub-table-wrap">
        <table class="hub-table">
          <thead><tr><th>Business document</th><th>Party</th><th class="num">Annual amount</th><th>Status</th></tr></thead>
          <tbody>${items.map((item) => `
            <tr>
              <td class="doc-file">${esc(item.filename)}</td>
              <td>${esc(label(item.party))}</td>
              <td class="num">${item.annualAmount ? money(item.annualAmount) : '—'}</td>
              <td><span class="status-pill ${esc(item.reviewStatus || 'pending')}">${esc(item.reviewStatus || 'pending')}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ---------- 5 · Bank deposits: map each payer to a person & income type ----------
  // Like the Expense Hub's merchant mapping: every payer gets a suggested person
  // and income type that the user confirms or changes. Choices are saved per
  // payer in localStorage (scoped to the active client by matter-context.js).

  const MAP_KEY = 'veritas_income_mapping';
  const INCOME_TYPES = [
    { id: 'wages', label: 'Wages / salary', counts: true },
    { id: 'bonus', label: 'Bonus / commission', counts: true },
    { id: 'rsu', label: 'RSU / stock proceeds', counts: true },
    { id: 'self', label: 'Self-employment / business', counts: true },
    { id: 'rental', label: 'Rental income', counts: true },
    { id: 'invest', label: 'Interest / dividends', counts: true },
    { id: 'benefits', label: 'Social Security / disability / unemployment', counts: true },
    { id: 'maint', label: 'Spousal maintenance received', counts: true },
    { id: 'other', label: 'Other income', counts: true },
    { id: 'childsupport', label: 'Child support received', counts: false },
    { id: 'refund', label: 'Refund / reimbursement', counts: false },
    { id: 'taxrefund', label: 'Tax refund', counts: false },
    { id: 'transfer', label: 'Transfer between own accounts', counts: false },
    { id: 'gift', label: 'Gift / loan', counts: false },
    { id: 'duplicate', label: 'Already counted (e.g. from pay stubs)', counts: false },
  ];
  const TYPE = Object.fromEntries(INCOME_TYPES.map((t) => [t.id, t]));
  const TYPE_RULES = [
    [/PAYROLL|DIR DEP|DIRECT DEP|SALARY|PAYRL|\bADP\b|GUSTO|PAYCHEX/, 'wages'],
    [/DEPT OF REV|\bIRS\b|TREAS 310|TAX REF|FRANCHISE TAX/, 'taxrefund'],
    [/\bSSA\b|SOC SEC|\bSSI\b|UNEMPLOY|DISABILITY|\bDES\b/, 'benefits'],
    [/ETRADE|E TRADE|SCHWAB|FIDELITY|MORGAN STANLEY|SHAREWORKS/, 'rsu'],
    [/QUICKBOOKS|INTUIT|SQUARE|STRIPE|EDI PAYM|INVOICE/, 'self'],
    [/INTEREST|DIVIDEND|INT PAID/, 'invest'],
    [/\bRENT\b|RENTAL/, 'rental'],
    [/DEBIT CRD|PURCHASE|RETURN|REFUND|REVERSAL|CASHBACK|REWARD|SNAP|REBATE/, 'refund'],
    [/TRANSFER|XFER|FROM CHK|FROM SAV/, 'transfer'],
  ];
  const BASES = {
    monthly: 'Avg/mo (months paid) × 12',
    span: 'Avg/mo (whole span) × 12',
    last12: 'Last 12 months',
    custom: 'Custom amount',
  };

  let hubData = null;
  let incomeMap = { sources: {}, accounts: {} };

  function loadMap() {
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_KEY) || '{}');
      incomeMap = { sources: saved.sources || {}, accounts: saved.accounts || {} };
    } catch (e) { incomeMap = { sources: {}, accounts: {} }; }
  }
  function saveMap() {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(incomeMap)); } catch (e) { /* storage blocked */ }
  }

  function suggestType(name) {
    const hit = TYPE_RULES.find(([re]) => re.test(name));
    return hit ? hit[1] : 'other';
  }

  // A payer's person is suggested only when every deposit landed in accounts
  // the user has said belong to the same person.
  function suggestParty(s) {
    const owners = new Set(Object.keys(s.accounts || {}).map((a) => incomeMap.accounts[a] || ''));
    return owners.size === 1 ? [...owners][0] : '';
  }

  function monthsSpanned(first, last) {
    if (!first || !last) return 1;
    const [y1, m1] = first.split('-').map(Number);
    const [y2, m2] = last.split('-').map(Number);
    return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
  }

  function latestDepositDate() {
    return (hubData.sources || []).reduce((d, s) => (s.last && s.last > d ? s.last : d), '');
  }

  function annualFor(s, basis, custom) {
    if (basis === 'custom') return Number(custom) || 0;
    if (basis === 'span') return (s.total / monthsSpanned(s.first, s.last)) * 12;
    if (basis === 'last12') {
      const end = latestDepositDate();
      if (!end) return 0;
      const start = new Date(`${end}T00:00:00Z`);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      const from = start.toISOString().slice(0, 10);
      return (s.deposits || []).filter((d) => d.date > from && d.date <= end).reduce((t, d) => t + d.amount, 0);
    }
    return s.monthly * 12;
  }

  // The effective mapping for a payer: the user's choice, else the suggestion.
  function mappingFor(s) {
    const m = incomeMap.sources[s.name] || {};
    const type = m.type || suggestType(s.name);
    const party = m.party !== undefined ? m.party : suggestParty(s);
    const basis = m.basis || (type === 'taxrefund' || type === 'refund' ? 'last12' : 'monthly');
    return { type, party, basis, custom: m.custom ?? '', note: m.note || '', confirmed: !!m.confirmed, annual: annualFor(s, basis, m.custom) };
  }

  // Only what the user actually chose is stored; anything left unset keeps
  // following the suggestions (e.g. a later account-owner choice).
  function setMapping(name, patch) {
    incomeMap.sources[name] = { ...incomeMap.sources[name], ...patch, confirmed: true };
    saveMap();
  }

  function partyOptions(selected) {
    const n = partyNames();
    return [['', 'Choose…'], ['party_a', n.a], ['party_b', n.b], ['joint', 'Joint (½ each)']]
      .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }

  function typeOptions(selected) {
    const group = (counts, label) => `<optgroup label="${label}">${INCOME_TYPES.filter((t) => t.counts === counts)
      .map((t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</optgroup>`;
    return group(true, 'Counts as income') + group(false, 'Not income');
  }

  function renderAccounts() {
    const accounts = {};
    hubData.sources.forEach((s) => Object.entries(s.accounts || {}).forEach(([a, c]) => { accounts[a] = (accounts[a] || 0) + c; }));
    const list = Object.entries(accounts).sort((x, y) => y[1] - x[1]);
    if (!list.length) return '';
    return `
      <div class="map-accounts">
        <div class="map-sub-title">Whose accounts are these?</div>
        <div class="map-sub-note">Set each account's owner and payers paid only into that person's accounts are assigned to them automatically.</div>
        <div class="map-account-grid">${list.map(([a, c]) => `
          <label class="map-account"><span>${esc(a)} <em>${c} deposit${c === 1 ? '' : 's'}</em></span>
            <select data-account="${esc(a)}">${partyOptions(incomeMap.accounts[a] || '')}</select></label>`).join('')}
        </div>
      </div>`;
  }

  function renderMapSummary() {
    const n = partyNames();
    const by = {};
    let excluded = 0, unassigned = 0, unassignedCount = 0, pending = 0;
    hubData.sources.forEach((s) => {
      const m = mappingFor(s);
      if (!m.confirmed) pending++;
      if (!TYPE[m.type].counts) { excluded += m.annual; return; }
      if (!m.party) { unassigned += m.annual; unassignedCount++; return; }
      const row = by[m.type] || (by[m.type] = { party_a: 0, party_b: 0 });
      if (m.party === 'joint') { row.party_a += m.annual / 2; row.party_b += m.annual / 2; } else row[m.party] += m.annual;
    });
    const types = INCOME_TYPES.filter((t) => by[t.id]);
    const tot = types.reduce((t, x) => ({ a: t.a + by[x.id].party_a, b: t.b + by[x.id].party_b }), { a: 0, b: 0 });
    const el = document.getElementById('incomeMapSummary');
    el.innerHTML = `
      <div class="map-sub-title">Mapped deposit income by person (annual)</div>
      ${types.length ? `<div class="hub-table-wrap"><table class="hub-table">
        <thead><tr><th>Income type</th><th class="num">${esc(n.a)}</th><th class="num">${esc(n.b)}</th><th class="num">Total</th></tr></thead>
        <tbody>${types.map((t) => `<tr><td>${esc(t.label)}</td><td class="num">${money(by[t.id].party_a)}</td><td class="num">${money(by[t.id].party_b)}</td><td class="num">${money(by[t.id].party_a + by[t.id].party_b)}</td></tr>`).join('')}
          <tr class="map-total"><td>Total income</td><td class="num">${money(tot.a)}</td><td class="num">${money(tot.b)}</td><td class="num">${money(tot.a + tot.b)}</td></tr>
          <tr class="map-total"><td>Per month</td><td class="num">${money(tot.a / 12)}</td><td class="num">${money(tot.b / 12)}</td><td class="num">${money((tot.a + tot.b) / 12)}</td></tr>
        </tbody></table></div>` : '<div class="map-sub-note">Nothing mapped to a person yet.</div>'}
      <div class="map-flags">
        ${unassignedCount ? `<span class="map-flag warn">⚠ ${unassignedCount} income payer(s) with no person — ${money(unassigned)} / yr not counted</span>` : ''}
        ${pending ? `<span class="map-flag">${pending} suggestion(s) not yet confirmed</span>` : '<span class="map-flag ok">✓ All payers confirmed</span>'}
        <span class="map-flag">Not income: ${money(excluded)} / yr (refunds, transfers, tax refunds…)</span>
      </div>
      <div class="map-sub-note" style="margin-top:8px;">Deposits are <strong>net</strong> pay. For wages, the gross from pay stubs and W-2s above is usually the better figure — map the payroll deposit as “Already counted” once those are accepted.</div>`;
  }

  function depositRows(s) {
    return `<tr class="map-detail" data-detail="${esc(s.name)}"><td colspan="8"><div class="hub-table-wrap"><table class="hub-table">
      <thead><tr><th>Date</th><th>Description</th><th>Account</th><th class="num">Amount</th></tr></thead>
      <tbody>${(s.deposits || []).map((d) => `<tr><td>${esc(d.date)}</td><td>${esc(d.description)}</td><td>${esc(d.account)}</td><td class="num">${money(d.amount)}</td></tr>`).join('')}</tbody>
    </table></div></td></tr>`;
  }

  function renderDeposits(hub) {
    hubData = hub;
    loadMap();
    const el = document.getElementById('depositSources');
    const ex = hub.inflows.excluded;
    const excluded = [
      ['Credit-card credits', 'payments and refunds on cards — not income', ex.card_credit],
      ['Account movement', 'confirmed transfers between accounts', ex.account_movement],
      ['Transfers / refunds / P2P', 'Zelle, Venmo, PayPal, refunds, card payments', ex.transfer_or_refund],
    ];
    const excludedHtml = `
      <div class="excluded-list">
        ${excluded.map(([title, why, b]) => `<div class="excluded-item"><strong>${b.count} · ${money(b.amount)}</strong> ${esc(title)}<br><span style="font-size:11px;color:#7a8a9a;">${esc(why)}</span></div>`).join('')}
      </div>`;

    if (!hub.sources.length) {
      document.getElementById('incomeMapSummary').innerHTML = '';
      el.innerHTML = empty('No deposit candidates', hub.intake.transactions ? 'No non-card deposits remain after excluding transfers and refunds.' : 'Parse bank statements at intake to see deposits here.') + (hub.inflows.count ? excludedHtml : '');
      return;
    }
    el.innerHTML = `
      ${renderAccounts()}
      <div class="map-toolbar">
        <div class="map-sub-title" style="margin:0;">Payers</div>
        <div><button type="button" class="btn-accept" data-map-act="confirm-all">✓ Confirm all suggestions</button>
        <button type="button" class="btn-plain" data-map-act="csv">Download CSV</button></div>
      </div>
      <div class="hub-table-wrap">
        <table class="hub-table map-table">
          <thead><tr><th>Payer (from description)</th><th class="num">Deposits</th><th>Period</th><th class="num">Total</th><th>Person</th><th>Income type</th><th>Annual basis</th><th class="num">Annual amount</th></tr></thead>
          <tbody>${hub.sources.map((s) => {
            const m = mappingFor(s);
            const counts = TYPE[m.type].counts;
            return `
            <tr data-source="${esc(s.name)}" class="${counts ? '' : 'map-notincome'}">
              <td><button type="button" class="map-expand" data-map-act="toggle" title="Show deposits">▸</button>
                <span class="doc-file">${esc(s.name)}</span>
                ${m.confirmed ? '' : '<span class="status-pill pending" title="Suggested — change it or confirm">suggested</span>'}
                <div class="doc-sub">${esc(Object.keys(s.accounts || {}).join(' · '))}</div></td>
              <td class="num">${s.count}</td>
              <td style="white-space:nowrap;">${esc((s.first || '—').slice(0, 7))} → ${esc((s.last || '—').slice(0, 7))}<div class="doc-sub" style="margin:0;">${s.months} mo with deposits</div></td>
              <td class="num">${money(s.total)}</td>
              <td><select data-map="party" class="${counts && !m.party ? 'map-missing' : ''}">${partyOptions(m.party)}</select></td>
              <td><select data-map="type">${typeOptions(m.type)}</select></td>
              <td><select data-map="basis">${Object.entries(BASES).map(([k, l]) => `<option value="${k}" ${k === m.basis ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
              <td class="num"><input data-map="custom" type="number" min="0" step="1" value="${Math.round(m.annual)}" title="Type an amount to override"></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:12px;font-weight:700;color:#1c3f66;margin-top:16px;">Inflows excluded before mapping</div>
      ${excludedHtml}`;
    renderMapSummary();
  }

  function rerenderMapping() {
    const open = [...document.querySelectorAll('#depositSources tr.map-detail')].map((r) => r.dataset.detail);
    renderDeposits(hubData);
    open.forEach((name) => toggleDetail(name));
  }

  function toggleDetail(name) {
    const row = [...document.querySelectorAll('#depositSources tr[data-source]')].find((r) => r.dataset.source === name);
    if (!row) return;
    const next = row.nextElementSibling;
    const btn = row.querySelector('.map-expand');
    if (next && next.classList.contains('map-detail')) { next.remove(); btn.textContent = '▸'; return; }
    row.insertAdjacentHTML('afterend', depositRows(hubData.sources.find((s) => s.name === name)));
    btn.textContent = '▾';
  }

  function downloadMappingCsv() {
    const n = partyNames();
    const who = { party_a: n.a, party_b: n.b, joint: 'Joint', '': 'Unassigned' };
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Payer', 'Accounts', 'Deposits', 'First', 'Last', 'Total', 'Person', 'Income type', 'Counts as income', 'Annual basis', 'Annual amount', 'Confirmed']];
    hubData.sources.forEach((s) => {
      const m = mappingFor(s);
      rows.push([s.name, Object.keys(s.accounts || {}).join('; '), s.count, s.first, s.last, s.total.toFixed(2), who[m.party] ?? m.party,
        TYPE[m.type].label, TYPE[m.type].counts ? 'Yes' : 'No', BASES[m.basis], m.annual.toFixed(2), m.confirmed ? 'Yes' : 'Suggested']);
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = `Income Mapping ${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.addEventListener('change', (e) => {
    const acct = e.target.closest('#depositSources [data-account]');
    if (acct) {
      incomeMap.accounts[acct.dataset.account] = acct.value;
      saveMap();
      rerenderMapping();
      return;
    }
    const field = e.target.dataset && e.target.dataset.map;
    const row = e.target.closest('#depositSources tr[data-source]');
    if (!field || !row) return;
    const name = row.dataset.source;
    if (field === 'custom') setMapping(name, { basis: 'custom', custom: e.target.value });
    else if (field === 'basis') setMapping(name, { basis: e.target.value });
    else setMapping(name, { [field]: e.target.value });
    rerenderMapping();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#depositSources [data-map-act]');
    if (!btn) return;
    const act = btn.dataset.mapAct;
    if (act === 'toggle') toggleDetail(btn.closest('tr').dataset.source);
    if (act === 'csv') downloadMappingCsv();
    if (act === 'confirm-all') {
      hubData.sources.forEach((s) => { if (!mappingFor(s).confirmed) setMapping(s.name, {}); });
      rerenderMapping();
    }
  });

  // ---------- load ----------

  function backendDown() {
    const msg = empty('Could not reach the backend', 'Start the Node server on :3000 (start-veritas.bat), then reload. Zeros here do not mean data was lost.');
    ['reconBody', 'incomeDocs', 'depositSources'].forEach((id) => { document.getElementById(id).innerHTML = msg; });
  }

  async function load() {
    const mid = matterId();
    document.querySelectorAll('[data-intake-link]').forEach((a) => { a.href = `discovery-intake.html?matter=${mid || ''}`; });
    if (!mid) return;
    try {
      const [hubRes, evRes] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}/income-hub`),
        fetch(`${API_BASE}/matters/${mid}/documents/income-evidence`),
      ]);
      if (!hubRes.ok || !evRes.ok) throw new Error('API error');
      const hub = await hubRes.json();
      evidence = (await evRes.json()).evidence || [];
      renderRecon(hub);
      renderSummary();
      renderIncomeDocs();
      renderBusiness();
      renderDeposits(hub);
    } catch (e) {
      backendDown();
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#incomeDocs [data-act]');
    if (btn) saveReview(btn.closest('tr'), btn.dataset.act);
  });

  // Party names arrive with the matter; re-render the selects when they do.
  window.addEventListener('veritas:matter', (e) => {
    const banner = document.getElementById('activeMatterBanner');
    if (banner) banner.innerHTML = `Active case: <strong>${esc(e.detail.matter.name || 'Untitled Case')}</strong>`;
    if (evidence.length) { renderIncomeDocs(); renderBusiness(); }
    if (hubData) rerenderMapping();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
