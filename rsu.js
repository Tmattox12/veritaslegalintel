// RSU / Stock Analysis — two tables.
//   Table 1: grant-by-grant ledger of shares held in the stock plan account
//            (vested − tax withheld + dividend shares − sold = net held), the
//            marital share of what is held, its value, and the split.
//   Table 2: every tranche vesting after the date of service. Tranches already
//            vested are in the account (Table 1) and shown only to tie to the
//            W-2; only tranches still unvested are left to split, in shares.
// Saved in localStorage, which matter-context.js scopes to the active client.
(() => {
  const STORE = 'veritas.rsu.v3';
  const OLD_STORE = 'veritas.rsu.v2';
  const SETTINGS = ['employee', 'marriageDate', 'dosDate', 'hireDate', 'method', 'split', 'account', 'asOf', 'valDate', 'price', 'ticker', 'reserve'];
  const METHODS = { hug: 'Hug', nelson: 'Nelson' };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const sh = (n) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const pct = (p) => (p == null || Number.isNaN(p) ? '—' : `${(p * 100).toFixed(2)}%`);
  const fmtDate = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' }) : '—');
  const longDate = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }) : '—');
  const ms = (s) => Date.parse(`${s}T00:00:00Z`);
  const days = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);
  const later = (a, b) => (!a ? b : !b ? a : ms(a) > ms(b) ? a : b);
  const earlier = (a, b) => (!a ? b : !b ? a : ms(a) < ms(b) ? a : b);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const todayIso = () => new Date().toISOString().slice(0, 10);

  let state = { settings: {}, grants: [], tranches: {} };
  let intake = {};

  function addMonths(s, n) {
    const d = new Date(`${s}T00:00:00Z`);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
  }

  function setting(id) {
    const v = state.settings[id];
    if (v !== undefined && v !== '') return v;
    if (id === 'marriageDate') return intake.marriageDate || '';
    if (id === 'dosDate') return intake.separationDate || '';
    if (id === 'method') return 'hug';
    if (id === 'asOf') return todayIso();
    return '';
  }

  const newGrant = () => ({ id: Math.random().toString(36).slice(2, 9), grantId: '', grantDate: '', shares: '', count: '3', months: '12', tax: '', deu: '', sold: '', basis: '' });

  // ---- Calculation -------------------------------------------------------

  // Share of one tranche that is community under a method, or null if a needed date is missing.
  function maritalPct(grant, vest, method, ctx) {
    const { marriage, dos, hire } = ctx;
    if (!dos || !grant.grantDate || !vest) return null;
    if (ms(grant.grantDate) > ms(dos)) return 0;            // granted after service: separate
    if (marriage && ms(vest) <= ms(marriage)) return 0;      // vested before marriage: separate
    const start = method === 'hug' ? hire : grant.grantDate;
    if (!start) return null;
    const den = days(start, vest);
    if (den <= 0) return 1;
    const numer = days(later(start, marriage), earlier(dos, vest));
    return clamp01(numer / den);
  }

  function tranchesOf(g) {
    const total = num(g.shares);
    const count = Math.max(1, Math.round(num(g.count)) || 1);
    const months = Math.max(1, Math.round(num(g.months)) || 12);
    if (!g.grantDate || !total) return [];
    const first = g.firstVest || addMonths(g.grantDate, months);
    return Array.from({ length: count }, (_, i) => {
      const key = `${g.id}:${i}`;
      const ov = state.tranches[key] || {};
      const shares = ov.shares !== undefined && ov.shares !== '' ? num(ov.shares) : total / count;
      return { key, grant: g, date: ov.date || addMonths(first, months * i), dateEdited: !!ov.date, shares, sharesEdited: ov.shares !== undefined && ov.shares !== '', basis: ov.basis ?? '' };
    });
  }

  function compute() {
    const ctx = { marriage: setting('marriageDate'), dos: setting('dosDate'), hire: setting('hireDate') };
    const asOf = setting('asOf');
    const price = num(setting('price'));
    const method = setting('method');
    const split = setting('split') === '' ? 0.5 : clamp01(num(setting('split')) / 100);
    const reserve = setting('reserve') === '' ? 0.15 : clamp01(num(setting('reserve')) / 100);

    const all = [];
    const t1 = state.grants.map((g) => {
      const tr = tranchesOf(g).map((t) => ({ ...t, hug: maritalPct(g, t.date, 'hug', ctx), nelson: maritalPct(g, t.date, 'nelson', ctx) }));
      all.push(...tr);
      const atDos = ctx.dos ? tr.filter((t) => ms(t.date) <= ms(ctx.dos)).reduce((s, t) => s + t.shares, 0) : null;
      const vestedNow = tr.filter((t) => ms(t.date) <= ms(asOf));
      const vestedShares = vestedNow.reduce((s, t) => s + t.shares, 0);
      const net = vestedShares - num(g.tax) + num(g.deu) - num(g.sold);
      // Blend the vested tranches' percentages, weighted by shares.
      const blend = vestedShares > 0 && vestedNow.every((t) => t[method] != null)
        ? vestedNow.reduce((s, t) => s + t.shares * t[method], 0) / vestedShares
        : (vestedShares > 0 ? null : 0);
      const mShares = blend == null ? null : net * blend;
      const gross = mShares == null ? null : mShares * price;
      const basis = num(g.basis);
      const gain = mShares == null ? null : mShares * (price - basis);
      const afterReserve = gross == null ? null : gross - Math.max(0, gain) * reserve;
      return { g, atDos, vestedShares, net, blend, mShares, gross, gain, afterReserve, each: mShares == null ? null : mShares * split };
    });

    const sum = (rows, f) => rows.reduce((s, r) => (s == null || r[f] == null ? null : s + r[f]), 0);
    const t1Tot = {
      granted: state.grants.reduce((s, g) => s + num(g.shares), 0),
      atDos: sum(t1, 'atDos'), vested: sum(t1, 'vestedShares'), net: sum(t1, 'net'),
      tax: state.grants.reduce((s, g) => s + num(g.tax), 0), deu: state.grants.reduce((s, g) => s + num(g.deu), 0), sold: state.grants.reduce((s, g) => s + num(g.sold), 0),
      mShares: sum(t1, 'mShares'), gross: sum(t1, 'gross'), gain: sum(t1, 'gain'), afterReserve: sum(t1, 'afterReserve'), each: sum(t1, 'each'),
    };

    // Table 2: tranches vesting after DOS.
    const t2 = ctx.dos ? all.filter((t) => ms(t.date) > ms(ctx.dos)).sort((a, b) => ms(a.date) - ms(b.date) || a.grant.grantDate.localeCompare(b.grant.grantDate)) : [];
    t2.forEach((t) => {
      t.pct = t[method];
      t.post = ms(t.grant.grantDate) > ms(ctx.dos);
      t.vested = ms(t.date) <= ms(asOf);
      t.mShares = t.pct == null ? null : t.shares * t.pct;
      t.basisValue = t.basis !== '' ? num(t.basis) : t.vested ? null : t.shares * price;
      t.basisIsFmv = t.basis === '' && !t.vested;
      t.mValue = t.basisValue == null || t.pct == null ? null : t.basisValue * t.pct;
    });
    const remaining = t2.filter((t) => !t.vested && !t.post);
    const remTot = {
      shares: remaining.reduce((s, t) => s + t.shares, 0),
      mShares: sum(remaining, 'mShares'),
      hugShares: remaining.reduce((s, t) => (s == null || t.hug == null ? null : s + t.shares * t.hug), 0),
      nelsonShares: remaining.reduce((s, t) => (s == null || t.nelson == null ? null : s + t.shares * t.nelson), 0),
      mValue: sum(remaining, 'mValue'),
    };
    return { ctx, asOf, price, method, split, reserve, t1, t1Tot, t2, remaining, remTot };
  }

  // ---- Rendering ---------------------------------------------------------

  function names() {
    const n = (window.VeritasMatter || {}).partyNames || { a: 'Party A', b: 'Party B' };
    const emp = setting('employee') || 'a';
    return { emp: n[emp] || 'Employee spouse', np: n[emp === 'a' ? 'b' : 'a'] || 'Non-employee spouse', all: n };
  }

  const inp = (field, value, cls = '', type = 'number', extra = '') =>
    `<input data-g="${field}" type="${type}" ${type === 'number' ? 'step="any" min="0"' : ''} class="${cls}" value="${esc(value)}" ${extra} />`;

  function renderTable1(r, n) {
    const M = METHODS[r.method];
    $('t1PctHead').textContent = `${M} %`;
    $('t1ResHead').textContent = `Less ${(r.reserve * 100).toFixed(0)}% gain reserve`;
    $('t1SplitHead').textContent = `${(r.split * 100).toFixed(0)}/${(100 - r.split * 100).toFixed(0)} split (shares each)`;
    const acct = setting('account');
    $('t1Title').textContent = `Table 1 — RSU Grant Summary: ${M} Apportionment (Vested / Sellable Shares)`;
    $('t1Sub').textContent = [acct && `Account ${acct}`, `Ledger through ${longDate(r.asOf)}`, `Date of service ${longDate(r.ctx.dos)}`,
      r.price ? `Price ${money(r.price)}/share${setting('valDate') ? ` on ${fmtDate(setting('valDate'))}` : ''}${setting('ticker') ? ` (${setting('ticker')})` : ''}` : 'Enter share price'].filter(Boolean).join(' · ');

    const body = $('t1').querySelector('tbody');
    if (!state.grants.length) { body.innerHTML = '<tr><td class="l" colspan="18" style="color:var(--mute);padding:14px;">No grants yet — click “+ Add grant” and enter each grant from the award notices.</td></tr>'; return; }
    body.innerHTML = r.t1.map((row) => {
      const g = row.g;
      return `<tr data-id="${g.id}">
        <td class="l">${inp('grantId', g.grantId, 'l', 'text', 'placeholder="ID" style="width:84px"')}</td>
        <td class="l">${inp('grantDate', g.grantDate, '', 'date')}</td>
        <td class="l">${inp('count', g.count, 'sm', 'number', 'step="1" min="1" title="Installments"')} × ${inp('months', g.months, 'sm', 'number', 'step="1" min="1" title="Months apart"')}</td>
        <td>${inp('shares', g.shares)}</td>
        <td class="key">${sh(row.atDos)}</td>
        <td>${sh(row.vestedShares)}</td>
        <td>${inp('tax', g.tax, '', 'number', 'title="Shares withheld for tax at vest"')}</td>
        <td>${inp('deu', g.deu, '', 'number', 'title="Dividend equivalent units / reinvested dividend shares"')}</td>
        <td>${inp('sold', g.sold, '', 'number', 'title="Shares sold from this grant"')}</td>
        <td class="net">${sh(row.net)}</td>
        <td>${row.blend == null ? `<small>${r.method === 'hug' ? 'needs hire date' : 'needs dates'}</small>` : pct(row.blend)}</td>
        <td class="mar">${sh(row.mShares)}</td>
        <td class="key">${r.price ? money(row.gross) : '—'}</td>
        <td>${inp('basis', g.basis, '', 'number', 'title="Cost basis per share (FMV at vest)"')}</td>
        <td class="pos">${r.price ? money(row.gain) : '—'}</td>
        <td class="key">${r.price ? money(row.afterReserve) : '—'}</td>
        <td class="key">${row.each == null ? '—' : `${sh(row.each)} each`}</td>
        <td class="no-print"><button class="rm" type="button" data-rm="${g.id}" title="Remove grant">×</button></td>
      </tr>`;
    }).join('') + `<tr class="tot">
        <td class="l" colspan="3">Totals</td><td>${sh(r.t1Tot.granted)}</td><td>${sh(r.t1Tot.atDos)}</td><td>${sh(r.t1Tot.vested)}</td>
        <td class="neg">${r.t1Tot.tax ? `−${sh(r.t1Tot.tax)}` : '—'}</td><td class="pos">${r.t1Tot.deu ? `+${sh(r.t1Tot.deu)}` : '—'}</td><td class="neg">${r.t1Tot.sold ? `−${sh(r.t1Tot.sold)}` : '—'}</td>
        <td class="net">${sh(r.t1Tot.net)}</td><td></td><td class="mar">${sh(r.t1Tot.mShares)}</td>
        <td>${r.price ? money(r.t1Tot.gross) : '—'}</td><td></td><td>${r.price ? money(r.t1Tot.gain) : '—'}</td><td>${r.price ? money(r.t1Tot.afterReserve) : '—'}</td>
        <td>${r.t1Tot.each == null ? '—' : `${sh(r.t1Tot.each)} each`}</td><td class="no-print"></td></tr>`;
  }

  function renderTable2(r, n) {
    const M = METHODS[r.method];
    $('t2MarHead').textContent = `${M} marital shares`;
    $('t2ValHead').textContent = `${M} value used`;
    const acct = setting('account');
    $('t2Sub').textContent = [acct && `Account ${acct}`, `Date of service ${longDate(r.ctx.dos)}`, `Vested through ${longDate(r.asOf)} = already in Table 1`].filter(Boolean).join(' · ');
    const body = $('t2').querySelector('tbody');
    if (!r.ctx.dos) { body.innerHTML = '<tr><td class="l" colspan="9" style="color:var(--mute);padding:14px;">Enter the date of service.</td></tr>'; return; }
    if (!r.t2.length) { body.innerHTML = '<tr><td class="l" colspan="9" style="color:var(--mute);padding:14px;">No tranches vest after the date of service.</td></tr>'; return; }

    const label = (t) => `${esc(t.grant.grantId || 'Grant')}<small>granted ${fmtDate(t.grant.grantDate)}</small>`;
    const rowHtml = (t, cls, treat) => `<tr class="${cls}" data-key="${t.key}">
      <td class="l">${label(t)}</td>
      <td class="l"><input data-t="date" type="date" class="${t.dateEdited ? 'ov' : ''}" value="${esc(t.date)}" /></td>
      <td><input data-t="shares" type="number" step="any" min="0" class="${t.sharesEdited ? 'ov' : ''}" value="${Math.round(t.shares * 100) / 100}" title="Shares actually delivered / scheduled" /></td>
      <td>${t.hug == null ? '<small>needs hire date</small>' : pct(t.hug)}</td>
      <td>${pct(t.nelson)}</td>
      <td class="mar">${sh(t.mShares)}</td>
      <td><input data-t="basis" type="number" step="any" min="0" value="${esc(t.basis)}" placeholder="${t.basisIsFmv && r.price ? (t.shares * r.price).toFixed(2) : t.vested ? 'W-2 gross' : 'FMV'}" style="width:92px" />${t.basisIsFmv && r.price ? '<small>shares × price (reference)</small>' : ''}</td>
      <td class="key">${money(t.mValue)}</td>
      <td class="treat">${treat}</td></tr>`;

    let html = '';
    const vested = r.t2.filter((t) => t.vested);
    const years = [...new Set(vested.map((t) => t.date.slice(0, 4)))];
    if (vested.length) html += `<tr class="sec"><td colspan="9">Vested after DOS — already in the account (Table 1); listed to tie to W-2 / payroll</td></tr>`;
    years.forEach((y) => {
      const rows = vested.filter((t) => t.date.startsWith(y));
      rows.forEach((t) => {
        html += rowHtml(t, t.post ? 'sep' : 'dup', t.post ? 'Granted after DOS — separate (0%)' : 'Duplicate — already in Table 1 / account');
      });
      const pre = rows.filter((t) => !t.post);
      const tShares = pre.reduce((s, t) => s + t.shares, 0);
      const tM = pre.reduce((s, t) => (s == null || t.mShares == null ? null : s + t.mShares), 0);
      const tBasis = rows.reduce((s, t) => s + (t.basisValue || 0), 0);
      const tVal = pre.reduce((s, t) => (s == null || t.mValue == null ? null : s + t.mValue), 0);
      html += `<tr class="grp"><td class="l" colspan="2">${y} W-2 duplicate subtotal</td><td>${sh(tShares)}${rows.length > pre.length ? `<small>post-DOS grant excluded</small>` : ''}</td><td colspan="2">row ${METHODS[r.method]} %</td>
        <td>${sh(tM)}</td><td>${tBasis ? money(tBasis) : '—'}<small>payroll gross</small></td><td>${money(tVal)}</td><td class="treat">Ties to the ${y} paystub / W-2, reduced by ${METHODS[r.method]} %. Not added to the split.</td></tr>`;
    });

    html += `<tr class="sec"><td colspan="9">Still unvested — remaining to split</td></tr>`;
    if (!r.remaining.length) html += '<tr><td class="l" colspan="9" style="color:var(--mute);">None — every tranche from a pre-DOS grant has vested and is in Table 1.</td></tr>';
    r.remaining.forEach((t) => { html += rowHtml(t, '', 'Unvested — divide in shares if, as, and when vested'); });
    // Post-DOS grants' future tranches are separate; one line instead of a row each.
    const postUnvested = r.t2.filter((t) => !t.vested && t.post);
    if (postUnvested.length) {
      const ids = [...new Set(postUnvested.map((t) => t.grant.grantId || 'grant'))].join(', ');
      html += `<tr class="sep"><td class="l" colspan="2">Granted after DOS (${esc(ids)})</td><td>${sh(postUnvested.reduce((s, t) => s + t.shares, 0))}</td><td>0.00%</td><td>0.00%</td><td>0.00</td><td></td><td>—</td><td class="treat">Separate — not counted</td></tr>`;
    }
    const rt = r.remTot;
    html += `<tr class="split"><td class="l" colspan="2">Total counted for split</td><td>${sh(rt.shares)}</td><td>${sh(rt.hugShares)}<small>Hug shares</small></td><td>${sh(rt.nelsonShares)}<small>Nelson shares</small></td>
      <td>${sh(rt.mShares)}<small>${esc(n.np)} ${(r.split * 100).toFixed(0)}%: ${sh(rt.mShares == null ? null : rt.mShares * r.split)} shares</small></td>
      <td>Future FMV</td><td>${money(rt.mValue)}<small>${esc(n.np)}: ${money(rt.mValue == null ? null : rt.mValue * r.split)} (reference)</small></td><td class="treat">Only unvested rows from pre-DOS grants are included.</td></tr>`;
    body.innerHTML = html;
  }

  function renderSummary(r, n) {
    const M = METHODS[r.method];
    const t1Each = r.t1Tot.each;
    const t2Np = r.remTot.mShares == null ? null : r.remTot.mShares * r.split;
    const totalNp = t1Each == null || t2Np == null ? null : t1Each + t2Np;
    const card = (label, value, sub) => `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-delta">${sub}</span></div>`;
    $('summary').innerHTML =
      card('Table 1 · marital shares held', sh(r.t1Tot.mShares), r.price ? `${money(r.t1Tot.gross)} gross · ${money(r.t1Tot.afterReserve)} after reserve` : 'Enter share price') +
      card('Table 2 · unvested marital shares', sh(r.remTot.mShares), `${sh(r.remTot.shares)} unvested shares from pre-DOS grants`) +
      card(`To ${esc(n.np)}`, totalNp == null ? '—' : `${sh(totalNp)} <span class="unit">sh</span>`, `${sh(t1Each)} now + ${sh(t2Np)} when vested`) +
      card('Method', M, `${(r.split * 100).toFixed(0)}% of community to ${esc(n.np)}`);

    const other = r.method === 'hug' ? 'nelson' : 'hug';
    const otherShares = r.remTot[`${other}Shares`];
    $('narrative').textContent = totalNp == null
      ? 'Enter the date of service, hire date, and grants to see the division.'
      : `Under ${M}, ${n.np} receives ${sh(t1Each)} shares from the account now (Table 1) and ${sh(t2Np)} shares of the unvested tranches as they vest (Table 2), ${sh(totalNp)} shares in total.` +
        (otherShares != null ? ` For the unvested tranches, ${METHODS[other]} would give ${sh(otherShares * r.split)} shares instead of ${sh(t2Np)}.` : '') +
        ' Post-DOS vests already in the account are counted once, in Table 1. Confirm delivered share counts and dates against the statements.';
  }

  function renderChecks(r) {
    const el = $('t1Check');
    const issues = [];
    r.t1.forEach((row) => {
      const id = row.g.grantId || 'A grant';
      if (row.net < -0.005) issues.push(`${id}: tax withheld and sold are more than the ${sh(row.vestedShares)} shares vested by the ledger date — check the vesting schedule or the ledger date.`);
      if (num(row.g.tax) && row.vestedShares && num(row.g.tax) / row.vestedShares > 0.6) issues.push(`${id}: ${(num(row.g.tax) / row.vestedShares * 100).toFixed(0)}% of vested shares withheld for tax looks high — the tax figure may include unvested shares.`);
    });
    el.hidden = !issues.length;
    el.className = 'callout warn no-print';
    el.innerHTML = issues.map(esc).join('<br>');
  }

  function render() {
    const r = compute();
    const n = names();
    const empSel = $('employee');
    empSel.options[0].text = n.all.a; empSel.options[1].text = n.all.b;
    $('marriageHint').textContent = !state.settings.marriageDate && intake.marriageDate ? 'From Case Intake' : '';
    $('dosHint').textContent = !state.settings.dosDate && intake.separationDate ? 'From Case Intake — confirm it is the service date' : 'Community ends here — A.R.S. § 25-211(A)(2)';
    renderSummary(r, n);
    renderTable1(r, n);
    renderTable2(r, n);
    renderChecks(r);
  }

  // ---- Persistence & events ---------------------------------------------

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); $('saveStatus').textContent = 'Saved automatically for this client only.'; } catch (_) { $('saveStatus').textContent = 'Could not save in this browser.'; }
  }

  // The earlier version kept grants without the account ledger; carry them over.
  function migrate(old) {
    const s = old.settings || {};
    return {
      settings: { employee: s.employee, marriageDate: s.marriageDate, dosDate: s.dosDate, hireDate: s.hireDate, method: s.method === 'nelson' ? 'nelson' : 'hug', split: s.split, valDate: s.valDate, price: s.price, ticker: s.ticker },
      grants: (old.grants || []).filter((g) => g.type !== 'Option').map((g) => ({ ...newGrant(), id: g.id, grantId: g.label || '', grantDate: g.grantDate || '', shares: g.shares || '', count: g.count || '3', months: g.months || '12', firstVest: g.firstVest || '' })),
      tranches: Object.fromEntries(Object.entries(old.overrides || {}).map(([k, v]) => [k, { shares: v.shares, date: v.date }])),
    };
  }

  function load() {
    try {
      let s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) { const old = JSON.parse(localStorage.getItem(OLD_STORE) || 'null'); if (old) s = migrate(old); }
      if (s && typeof s === 'object') state = { settings: s.settings || {}, grants: Array.isArray(s.grants) ? s.grants : [], tranches: s.tranches || {} };
    } catch (_) { /* start empty */ }
    SETTINGS.forEach((id) => { $(id).value = state.settings[id] ?? ''; });
    if (!state.settings.method) $('method').value = 'hug';
    if (!state.settings.employee) $('employee').value = 'a';
    if (!state.settings.asOf) $('asOf').value = todayIso();
    fillIntakeDefaults();
  }

  function fillIntakeDefaults() {
    if (!state.settings.marriageDate) $('marriageDate').value = intake.marriageDate || '';
    if (!state.settings.dosDate) $('dosDate').value = intake.separationDate || '';
  }

  function onMatter(e) {
    const m = (e && e.detail && e.detail.matter) || (window.VeritasMatter || {}).matter;
    let d = m && m.details;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = null; } }
    intake = d || {};
    fillIntakeDefaults();
    render();
  }

  function toCsv() {
    const r = compute();
    const n = names();
    const M = METHODS[r.method];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const f2 = (v) => (v == null || Number.isNaN(v) ? '' : v.toFixed(2));
    const f4 = (v) => (v == null || Number.isNaN(v) ? '' : (v * 100).toFixed(4));
    const lines = [
      ['RSU / Stock Analysis'], ['Account', setting('account')], ['Employee spouse', n.emp], ['Date of marriage', setting('marriageDate')], ['Date of service', setting('dosDate')],
      ['Hire date', setting('hireDate')], ['Ledger as of', r.asOf], ['Price', r.price], ['Price date', setting('valDate')], ['Method', M], [`Share to ${n.np}`, `${(r.split * 100).toFixed(2)}%`], ['Gain reserve', `${(r.reserve * 100).toFixed(1)}%`], [],
      ['Table 1 - RSU Grant Summary'],
      ['Grant ID', 'Grant date', 'Installments', 'Months apart', 'Shares granted', 'Vested @ DOS', 'Vested to date', 'Tax withheld', 'DEU / DRIP', 'Sold', 'Net held', `${M} %`, 'Marital shares', 'Gross marital value', 'Basis / share', 'Unrealized gain', 'Less gain reserve', 'Shares each'],
      ...r.t1.map((x) => [x.g.grantId, x.g.grantDate, x.g.count, x.g.months, x.g.shares, f2(x.atDos), f2(x.vestedShares), x.g.tax, x.g.deu, x.g.sold, f2(x.net), f4(x.blend), f2(x.mShares), f2(x.gross), x.g.basis, f2(x.gain), f2(x.afterReserve), f2(x.each)]),
      ['Totals', '', '', '', f2(r.t1Tot.granted), f2(r.t1Tot.atDos), f2(r.t1Tot.vested), f2(r.t1Tot.tax), f2(r.t1Tot.deu), f2(r.t1Tot.sold), f2(r.t1Tot.net), '', f2(r.t1Tot.mShares), f2(r.t1Tot.gross), '', f2(r.t1Tot.gain), f2(r.t1Tot.afterReserve), f2(r.t1Tot.each)],
      [],
      ['Table 2 - Tranches Unvested at Date of Service'],
      ['Grant ID', 'Grant date', 'Vest date', 'Shares', 'Hug %', 'Nelson %', `${M} marital shares`, 'W-2 / FMV basis', `${M} value used`, 'Treatment'],
      ...r.t2.map((t) => [t.grant.grantId, t.grant.grantDate, t.date, f2(t.shares), f4(t.hug), f4(t.nelson), f2(t.mShares), f2(t.basisValue), f2(t.mValue),
        t.post ? 'Granted after DOS - separate' : t.vested ? 'Already in Table 1 (W-2 duplicate)' : 'Unvested - remaining to split']),
      ['Total counted for split', '', '', f2(r.remTot.shares), '', '', f2(r.remTot.mShares), '', f2(r.remTot.mValue), `${n.np}: ${f2(r.remTot.mShares == null ? null : r.remTot.mShares * r.split)} shares`],
    ];
    const blob = new Blob([lines.map((l) => l.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RSU Tables ${r.asOf}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Re-render without losing the cursor in the field being typed in.
  function rerenderKeepingFocus() {
    const a = document.activeElement;
    const sel = a && a.closest && (a.closest('tr[data-id]') ? `tr[data-id="${a.closest('tr').dataset.id}"] [data-g="${a.dataset.g}"]`
      : a.closest('tr[data-key]') ? `tr[data-key="${a.closest('tr').dataset.key}"] [data-t="${a.dataset.t}"]` : null);
    render();
    if (sel) { const el = document.querySelector(sel); if (el) el.focus(); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    render();

    SETTINGS.forEach((id) => $(id).addEventListener('input', () => { state.settings[id] = $(id).value; save(); render(); }));

    const t1 = $('t1').querySelector('tbody');
    // Table 1 recalculates when a field is left, so typing is never interrupted.
    t1.addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-id]'); const f = e.target.dataset.g;
      if (!tr || !f) return;
      const g = state.grants.find((x) => x.id === tr.dataset.id);
      g[f] = e.target.value;
      // A new schedule makes per-tranche edits meaningless.
      if (['shares', 'count', 'months', 'grantDate'].includes(f)) Object.keys(state.tranches).forEach((k) => { if (k.startsWith(`${g.id}:`)) delete state.tranches[k]; });
      save(); rerenderKeepingFocus();
    });
    t1.addEventListener('click', (e) => {
      const id = e.target.dataset.rm; if (!id) return;
      const g = state.grants.find((x) => x.id === id);
      if (g && (g.grantId || g.shares) && !confirm(`Remove grant ${g.grantId || ''}?`)) return;
      state.grants = state.grants.filter((x) => x.id !== id);
      Object.keys(state.tranches).forEach((k) => { if (k.startsWith(`${id}:`)) delete state.tranches[k]; });
      save(); render();
    });
    $('addGrant').addEventListener('click', () => { state.grants.push(newGrant()); save(); render(); });

    $('t2').querySelector('tbody').addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-key]'); const f = e.target.dataset.t;
      if (!tr || !f) return;
      state.tranches[tr.dataset.key] = { ...(state.tranches[tr.dataset.key] || {}), [f]: e.target.value };
      save(); rerenderKeepingFocus();
    });

    $('rsuCsv').addEventListener('click', toCsv);
    $('rsuPrint').addEventListener('click', () => window.print());
    $('rsuReset').addEventListener('click', () => {
      if (!confirm('Clear the RSU analysis for this client?')) return;
      state = { settings: {}, grants: [], tranches: {} };
      save(); load(); render();
    });

    window.addEventListener('veritas:matter', onMatter);
    if ((window.VeritasMatter || {}).matter) onMatter();
  });
})();
