// Spousal Maintenance — income composition per party, guideline range from the
// Arizona courts' official calculator (via /api/matters/:id/spousal/official).
// Saved in localStorage, which matter-context.js scopes to the active client.
(() => {
  const STORE = 'veritas.spousal.v1';
  const SELECTED_STORE = 'veritas.spousal.selected';
  const SETTINGS = ['requesting', 'familySize', 'marriageDate', 'serviceDate', 'hearingDate', 'dobA', 'dobB', 'county', 'mortgage', 'attrA', 'attrB'];
  const REQUIRED = { familySize: 'family size', marriageDate: 'date of marriage', serviceDate: 'date of service', hearingDate: 'hearing date', dobA: 'date of birth (A)', dobB: 'date of birth (B)' };
  const DEFAULT_OPTS = ['YTD annualized', 'Last full year', '2-year average', '3-year average'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n, cents) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 }));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const todayIso = () => new Date().toISOString().slice(0, 10);

  const newSource = (name, labels = DEFAULT_OPTS) => {
    const opts = labels.map((label) => ({ id: uid(), label, amount: '' }));
    return { id: uid(), name, include: true, variable: false, sel: opts[0] ? opts[0].id : null, opts };
  };
  const blankState = () => ({ settings: {}, sources: { a: [newSource('Salary / wages')], b: [newSource('Salary / wages')] }, adj: { a: '', b: '' }, selected: 'mid' });

  let state = blankState();
  let intake = {};
  let result = null;
  let varResult = null;
  const cache = new Map();
  let timer = null;
  let seq = 0;

  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.sources) state = { ...blankState(), ...s }; } catch (e) { /* keep blank */ }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ } }

  function setting(id) {
    const v = state.settings[id];
    if (v !== undefined && v !== '') return v;
    if (id === 'marriageDate') return intake.marriageDate || '';
    if (id === 'serviceDate') return intake.separationDate || '';
    if (id === 'county') return intake.county || '';
    if (id === 'hearingDate') return todayIso();
    if (id === 'requesting') return 'a';
    return '';
  }

  const names = () => (window.VeritasMatter && window.VeritasMatter.partyNames) || { a: 'Party A', b: 'Party B' };
  const labels = () => (window.VeritasMatter && window.VeritasMatter.partyLabels) || { a: 'Petitioner', b: 'Respondent' };
  const payer = () => (setting('requesting') === 'a' ? 'b' : 'a');

  // ---- Income -------------------------------------------------------------

  const selectedAmount = (src) => { const o = src.opts.find((x) => x.id === src.sel); return o ? num(o.amount) : 0; };
  function incomeOf(p, { skipVariable = false } = {}) {
    let total = 0;
    for (const s of state.sources[p]) if (s.include && !(skipVariable && s.variable)) total += selectedAmount(s);
    return total + num(state.adj[p]);
  }
  const variableOf = (p) => state.sources[p].filter((s) => s.include && s.variable).reduce((t, s) => t + selectedAmount(s), 0);

  function payload(incomeA, incomeB) {
    return {
      requesting: setting('requesting'), familySize: setting('familySize'),
      marriageDate: setting('marriageDate'), serviceDate: setting('serviceDate'), hearingDate: setting('hearingDate'),
      dobA: setting('dobA'), dobB: setting('dobB'), county: setting('county'),
      mortgagePrincipal: num(setting('mortgage')), attributedA: num(setting('attrA')), attributedB: num(setting('attrB')),
      incomeA: Math.max(0, Math.round(incomeA)), incomeB: Math.max(0, Math.round(incomeB)),
    };
  }

  async function official(body) {
    const key = JSON.stringify(body);
    if (cache.has(key)) return cache.get(key);
    const id = window.VeritasMatter && window.VeritasMatter.id;
    if (!id) throw new Error('Open a client first');
    const p = fetch(`${window.API_BASE}/matters/${encodeURIComponent(id)}/spousal/official`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key,
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Server returned ${r.status}`);
      return d;
    });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  }

  const missing = () => Object.keys(REQUIRED).filter((k) => !setting(k));

  function scheduleCalc() {
    clearTimeout(timer);
    timer = setTimeout(calculate, 600);
  }

  async function calculate() {
    const my = ++seq;
    const gaps = missing();
    if (gaps.length) {
      result = null; varResult = null;
      renderResult(`Enter ${gaps.map((k) => REQUIRED[k]).join(', ')} to calculate.`);
      renderVariable();
      return;
    }
    if (incomeOf('a') <= 0 && incomeOf('b') <= 0) {
      result = null; varResult = null;
      renderResult('Enter income for at least one party to calculate.');
      renderVariable();
      return;
    }
    renderResult('Calculating with the official calculator…');
    const pay = payer();
    const full = payload(incomeOf('a'), incomeOf('b'));
    const hasVar = variableOf(pay) > 0;
    const base = hasVar ? payload(pay === 'a' ? incomeOf('a', { skipVariable: true }) : incomeOf('a'), pay === 'b' ? incomeOf('b', { skipVariable: true }) : incomeOf('b')) : null;
    try {
      const [r, rb] = await Promise.all([official(full), base ? official(base) : Promise.resolve(null)]);
      if (my !== seq) return;
      result = r;
      varResult = rb ? { full: r, base: rb, variable: variableOf(pay) } : null;
      renderResult();
      renderVariable();
      saveSelected();
    } catch (e) {
      if (my !== seq) return;
      result = null; varResult = null;
      renderResult(e.message, true);
      renderVariable();
    }
  }

  function saveSelected() {
    if (!result) return;
    const monthly = result[state.selected] ?? result.mid;
    try {
      localStorage.setItem(SELECTED_STORE, JSON.stringify({ level: state.selected, monthly, annual: monthly * 12, payer: payer(), at: new Date().toISOString() }));
    } catch (e) { /* ignore */ }
  }

  // ---- Rendering ----------------------------------------------------------

  function renderSummary() {
    const n = names(); const l = labels(); const req = setting('requesting');
    const card = (p) => {
      const lines = state.sources[p].map((s) => {
        const o = s.opts.find((x) => x.id === s.sel);
        return `<div class="sum-line${s.include ? '' : ' off'}"><span>${esc(s.name || 'Unnamed source')}${o && o.label ? ` <small>(${esc(o.label)})</small>` : ''}${s.variable ? ' · variable' : ''}</span><b>${money(selectedAmount(s))}</b></div>`;
      }).join('');
      const adj = num(state.adj[p]);
      return `<div class="party-sum"><h4><span>${esc(n[p])}</span><span class="role">${esc(l[p])} · ${p === req ? 'requesting' : 'paying'}</span></h4>${lines}${adj ? `<div class="sum-line"><span>Adjustment</span><b>${adj < 0 ? '−' : '+'}${money(Math.abs(adj))}</b></div>` : ''}<div class="sum-total"><span>Annual income</span><span>${money(incomeOf(p))}</span></div></div>`;
    };
    $('summary').innerHTML = `${card('a')}${card('b')}<div class="combined"><span>Combined annual income</span><span>${money(incomeOf('a') + incomeOf('b'))}</span></div>`;
  }

  function renderResult(status, isErr) {
    const r = result;
    $('gLow').textContent = r ? money(r.low, true) : '—';
    $('gMid').textContent = r ? money(r.mid, true) : '—';
    $('gHigh').textContent = r ? money(r.high, true) : '—';
    document.querySelectorAll('.g-card').forEach((c) => c.classList.toggle('on', !!r && c.dataset.level === state.selected));
    $('sourceTag').textContent = r ? r.source : 'Official calculator';
    const n = names();
    $('facts').innerHTML = r ? [
      r.durationLow || r.durationHigh ? `Duration range: <b>${esc(r.durationLow || '—')} to ${esc(r.durationHigh || '—')}</b>` : '',
      r.shareA != null ? `Income share: <b>${esc(n.a)} ${r.shareA}%</b> · <b>${esc(n.b)} ${r.shareB}%</b>` : '',
      `Rule of 65: <b>${r.ruleOf65 ? 'eligible' : 'not eligible'}</b>`,
    ].filter(Boolean).map((f) => `<span>${f}</span>`).join('') : '';
    const notes = [];
    if (r && r.message) notes.push(esc(r.message));
    if (r && r.requestorMismatched) notes.push('The official calculator flags the requesting party as the higher earner. Check "Party requesting maintenance".');
    $('selNote').hidden = !notes.length;
    $('selNote').className = 'callout warn';
    $('selNote').innerHTML = notes.join('<br>');
    const st = $('calcStatus');
    st.className = `calc-status${isErr ? ' err' : ''}`;
    st.textContent = status || (r ? `Selected: ${state.selected} (${money(r[state.selected], true)}/mo, ${money(r[state.selected] * 12)}/yr). Sent incomes, family size and dates only; calculated ${new Date(r.calculatedAt).toLocaleString()}.` : '');
  }

  function renderVariable() {
    const n = names(); const p = payer();
    const v = varResult;
    if (!v) {
      $('varGrid').innerHTML = '';
      $('varStatus').textContent = variableOf(p) > 0 ? '' : `Mark one or more of ${n[p]}'s sources as variable (e.g. bonus, RSU) to run this comparison.`;
      return;
    }
    const diffYr = (v.full.mid - v.base.mid) * 12;
    const pctShare = v.variable > 0 ? diffYr / v.variable : null;
    $('varGrid').innerHTML = `
      <div class="party-sum"><div class="role">Guideline mid, all income</div><div class="val">${money(v.full.mid, true)}<small>/mo</small></div><div class="sum-line"><span>Annual</span><b>${money(v.full.mid * 12)}</b></div></div>
      <div class="party-sum"><div class="role">Guideline mid, variable income left out</div><div class="val">${money(v.base.mid, true)}<small>/mo</small></div><div class="sum-line"><span>Annual</span><b>${money(v.base.mid * 12)}</b></div></div>
      <div class="party-sum" style="background:#f4fbf7;border-color:#9cc9b3"><div class="role">Equivalent share of variable income</div><div class="val">${pctShare == null ? '—' : `${(pctShare * 100).toFixed(1)}%`}</div><div class="sum-line"><span>Of ${money(v.variable)} variable/yr</span><b>${money(diffYr)}/yr</b></div></div>`;
    $('varStatus').textContent = `${n[p]} pays ${money(v.base.mid, true)}/mo on base income plus ${pctShare == null ? '—' : `${(pctShare * 100).toFixed(1)}%`} of each bonus/RSU dollar actually received, which matches the all-income mid at the selected amounts.`;
  }

  function renderSources() {
    const n = names(); const l = labels();
    for (const p of ['a', 'b']) {
      const col = $(p === 'a' ? 'colA' : 'colB');
      col.innerHTML = `<h4><span>${esc(n[p])} <span class="role" style="font-size:10.5px;color:var(--mute);font-weight:600">${esc(l[p])}</span></span><span><button type="button" class="link-btn" data-act="hub" data-p="${p}">+ From Income Hub</button> · <button type="button" class="link-btn" data-act="add-src" data-p="${p}">+ Source</button></span></h4>`
        + state.sources[p].map((s) => `
          <div class="src${s.include ? '' : ' excluded'}" data-p="${p}" data-s="${s.id}">
            <div class="src-head">
              <input class="name" data-f="name" value="${esc(s.name)}" placeholder="Source name (e.g. Bonus)" aria-label="Source name" />
              <label><input type="checkbox" data-f="include" ${s.include ? 'checked' : ''} /> Include</label>
              <label title="Bonus, RSU or other irregular pay"><input type="checkbox" data-f="variable" ${s.variable ? 'checked' : ''} /> Variable</label>
              <button type="button" class="rm" data-act="rm-src" title="Remove source">×</button>
            </div>
            <div class="opts">${s.opts.map((o) => `
              <div class="opt${o.id === s.sel ? ' on' : ''}" data-o="${o.id}">
                <input type="radio" name="sel-${s.id}" data-f="sel" ${o.id === s.sel ? 'checked' : ''} aria-label="Use this figure" />
                <input type="text" data-f="label" value="${esc(o.label)}" placeholder="Basis (e.g. 2-year average)" />
                <input type="number" data-f="amount" value="${esc(o.amount)}" placeholder="0" min="0" step="1" />
                <button type="button" class="rm" data-act="rm-opt" title="Remove option">×</button>
              </div>`).join('')}
            </div>
            <button type="button" class="link-btn" data-act="add-opt">+ Option</button>
          </div>`).join('')
        + `<div class="adj"><span>Other annual adjustment (+/−)</span><input type="number" step="1" data-adj="${p}" value="${esc(state.adj[p])}" placeholder="0" /></div>`;
    }
  }

  function renderSettings() {
    SETTINGS.forEach((id) => { $(id).value = state.settings[id] ?? ''; });
    fillDefaults();
  }

  function fillDefaults() {
    if (!state.settings.marriageDate) $('marriageDate').value = intake.marriageDate || '';
    if (!state.settings.serviceDate) $('serviceDate').value = intake.separationDate || '';
    if (!state.settings.county) $('county').value = intake.county || '';
    if (!state.settings.hearingDate) $('hearingDate').value = todayIso();
    if (!state.settings.requesting) $('requesting').value = 'a';
    $('marriageHint').textContent = !state.settings.marriageDate && intake.marriageDate ? 'From Case Intake' : '';
    $('serviceHint').textContent = !state.settings.serviceDate && intake.separationDate ? 'From Case Intake — confirm it is the service date' : '';
  }

  function renderLabels() {
    const n = names();
    $('requesting').options[0].textContent = n.a;
    $('requesting').options[1].textContent = n.b;
    $('dobALabel').textContent = `Date of birth, ${n.a}`;
    $('dobBLabel').textContent = `Date of birth, ${n.b}`;
    $('attrALabel').textContent = `Attributed income, ${n.a} ($/yr)`;
    $('attrBLabel').textContent = `Attributed income, ${n.b} ($/yr)`;
  }

  function renderAll() { renderLabels(); renderSummary(); renderSources(); renderResult(); renderVariable(); }

  // ---- Events -------------------------------------------------------------

  const findSrc = (el) => {
    const box = el.closest('.src');
    if (!box) return {};
    const p = box.dataset.p;
    const s = state.sources[p].find((x) => x.id === box.dataset.s);
    const optEl = el.closest('.opt');
    const o = optEl && s ? s.opts.find((x) => x.id === optEl.dataset.o) : null;
    return { p, s, o };
  };

  function changed({ structure = false } = {}) {
    save();
    if (structure) renderSources();
    renderSummary();
    scheduleCalc();
  }

  async function addFromHub(p) {
    const id = window.VeritasMatter && window.VeritasMatter.id;
    if (!id) return;
    try {
      const r = await fetch(`${window.API_BASE}/matters/${encodeURIComponent(id)}/analysis-summary`);
      const d = await r.json();
      const amt = d && d.acceptedIncomeByParty ? d.acceptedIncomeByParty[p === 'a' ? 'party_a' : 'party_b'] : 0;
      if (!amt) { alert('No accepted income for this party in the Income Hub yet. Accept income documents there first.'); return; }
      const src = newSource('Accepted income (Income Hub)', ['Accepted documents']);
      src.opts[0].amount = String(Math.round(amt));
      state.sources[p].push(src);
      changed({ structure: true });
    } catch (e) {
      alert(`Could not reach the Income Hub: ${e.message}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    renderSettings();
    renderAll();

    SETTINGS.forEach((id) => $(id).addEventListener('input', () => {
      state.settings[id] = $(id).value;
      save();
      if (id === 'requesting') { renderSummary(); renderVariable(); }
      fillDefaults();
      scheduleCalc();
    }));

    $('guide').addEventListener('click', (e) => {
      const c = e.target.closest('.g-card');
      if (!c || !result) return;
      state.selected = c.dataset.level;
      save(); saveSelected(); renderResult();
    });

    const cols = document.querySelector('.src-cols');
    cols.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.adj) { state.adj[t.dataset.adj] = t.value; return changed(); }
      const { s, o } = findSrc(t);
      if (!s) return;
      const f = t.dataset.f;
      if (f === 'name') s.name = t.value;
      else if (f === 'label' && o) o.label = t.value;
      else if (f === 'amount' && o) o.amount = t.value;
      else return;
      changed();
    });
    cols.addEventListener('change', (e) => {
      const t = e.target;
      const { s, o } = findSrc(t);
      if (!s) return;
      const f = t.dataset.f;
      if (f === 'include') s.include = t.checked;
      else if (f === 'variable') s.variable = t.checked;
      else if (f === 'sel' && o) s.sel = o.id;
      else return;
      changed({ structure: true });
    });
    cols.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'add-src') { state.sources[b.dataset.p].push(newSource('')); return changed({ structure: true }); }
      if (act === 'hub') return addFromHub(b.dataset.p);
      const { p, s, o } = findSrc(b);
      if (!s) return;
      if (act === 'rm-src') {
        if (!confirm(`Remove "${s.name || 'this source'}"?`)) return;
        state.sources[p] = state.sources[p].filter((x) => x !== s);
      } else if (act === 'add-opt') {
        const opt = { id: uid(), label: '', amount: '' };
        s.opts.push(opt);
        if (!s.sel) s.sel = opt.id;
      } else if (act === 'rm-opt' && o) {
        s.opts = s.opts.filter((x) => x !== o);
        if (s.sel === o.id) s.sel = s.opts[0] ? s.opts[0].id : null;
      } else return;
      changed({ structure: true });
    });
    // Selecting a figure by clicking anywhere on its row (not just the radio).
    cols.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.opt');
      if (!row || e.target.closest('input,button')) return;
      const { s, o } = findSrc(row);
      if (s && o && s.sel !== o.id) { s.sel = o.id; changed({ structure: true }); }
    });

    $('smReset').addEventListener('click', () => {
      if (!confirm('Clear all spousal maintenance inputs for this client?')) return;
      state = blankState(); result = null; varResult = null; cache.clear();
      try { localStorage.removeItem(SELECTED_STORE); } catch (e) { /* ignore */ }
      save(); renderSettings(); renderAll(); scheduleCalc();
    });
    $('smPrint').addEventListener('click', () => window.print());

    scheduleCalc();
  });

  window.addEventListener('veritas:matter', (e) => {
    let d = e.detail && e.detail.matter && e.detail.matter.details;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = null; } }
    intake = d || {};
    // A switch to another client re-scopes storage, so reload that client's inputs.
    if (document.readyState !== 'loading') { state = blankState(); result = null; varResult = null; cache.clear(); load(); renderSettings(); renderAll(); scheduleCalc(); }
  });
})();
