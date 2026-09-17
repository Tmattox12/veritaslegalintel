/* Income Engine — renders selectable income-basis cards per party.
 *
 * Bases shown:
 *  - 12-month average (bank deposit candidate)
 *  - 6-month average
 *  - 3-month average
 *  - Last-month run-rate
 *  - Documented / accepted evidence (pay stubs, benefits) per party
 *
 * Deposit-derived bases are REVIEW-ONLY candidates. Accepted document
 * evidence is the calculation-ready figure. Selecting a card sets the
 * party's income basis in the master summary and flows downstream.
 */
(function () {
  'use strict';

  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  const state = {
    analysis: null,
    evidence: null,
    selection: {
      party_a: { basis: 'accepted', amount: 0 },
      party_b: { basis: 'accepted', amount: 0 },
    },
  };

  function matterId() {
    return (
      (window.Veritas && window.Veritas.currentMatterId) ||
      new URLSearchParams(location.search).get('matter') ||
      localStorage.getItem('currentMatterId') || null
    );
  }

  function money(n) {
    return '$' + (Math.round(Number(n) || 0)).toLocaleString('en-US');
  }

  function card(opts) {
    const el = document.createElement('div');
    el.className = 'income-card' + (opts.active ? ' active' : '');
    el.style.cursor = 'pointer';
    el.innerHTML = `
      <div class="income-card-head">
        <div>
          <div class="income-card-title">${opts.title}</div>
          <div class="income-card-sub">${opts.sub}</div>
        </div>
        <span class="income-card-badge">${opts.badge}</span>
      </div>
      <div class="income-card-value">${money(opts.amount)}</div>
      <div class="income-card-meta">${opts.meta || ''}</div>
      ${opts.reviewOnly ? '<div class="income-card-foot" style="color:#8a6a1f;border-color:#8a6a1f;">Review only — confirm before use</div>' : ''}
    `;
    el.addEventListener('click', () => {
      if (opts.reviewOnly && !window.confirm('This is a bank-deposit candidate, not accepted evidence. Use it as a review basis?')) return;
      select(opts.party, opts.basis, opts.amount, el);
    });
    return el;
  }

  function select(party, basis, amount, el) {
    state.selection[party] = { basis, amount: Math.round(Number(amount) || 0) };
    const mid = matterId();
    if (mid) localStorage.setItem(`veritas_income_selection_${mid}`, JSON.stringify(state.selection));
    const grid = el.closest('.income-grid, .income-compare-grid');
    if (grid) grid.querySelectorAll('.income-card,.income-compare-card').forEach((c) => c.classList.remove('active'));
    el.classList.add('active');
    renderSummary();
  }

  function renderCards() {
    const a = state.analysis;
    if (!a) return;
    const dc = a.depositCandidates || {};
    const acc = a.accepted || { party_a: 0, party_b: 0, sources: [] };

    const payingGrid = document.getElementById('payingSpouseCards');
    const primaryGrid = document.getElementById('primaryEarnedCards');
    const compareGrid = document.getElementById('earnedIncomeComparisonCards');

    const depositBases = [
      { key: 'avg12', label: '12-Month Average', value: dc.avg12Month, sub: `${dc.monthsCovered || 0} mo of deposits (${dc.firstMonth || '—'} → ${dc.lastMonth || '—'})` },
      { key: 'avg6', label: '6-Month Average', value: dc.avg6Month, sub: 'Recent 6-month deposit trend' },
      { key: 'avg3', label: '3-Month Average', value: dc.avg3Month, sub: 'Most recent quarter' },
      { key: 'runrate', label: 'Last-Month Run-Rate', value: dc.lastMonthRunRate, sub: 'Latest month annualized' },
    ];

    if (payingGrid) {
      payingGrid.innerHTML = '';
      depositBases.forEach((b) => {
        payingGrid.appendChild(card({
          party: 'party_a', basis: b.key, amount: b.value,
          title: b.label, sub: b.sub, badge: 'Bank', reviewOnly: true,
          meta: `<div class="income-card-row"><span>Monthly</span><strong>${money(b.value / 12)}</strong></div>`,
        }));
      });
      payingGrid.appendChild(card({
        party: 'party_a', basis: 'accepted', amount: acc.party_a,
        title: 'Accepted Document Income', sub: 'Pay stubs / benefits you reviewed & accepted', badge: 'W-2 · Docs',
        meta: `<div class="income-card-row"><span>Monthly</span><strong>${money(acc.party_a / 12)}</strong></div><div class="income-card-row"><span>Sources</span><strong>${acc.sources.filter((s) => s.party === 'party_a').length}</strong></div>`,
      }));
    }

    if (primaryGrid) {
      primaryGrid.innerHTML = '';
      depositBases.forEach((b) => {
        primaryGrid.appendChild(card({
          party: 'party_b', basis: b.key, amount: b.value,
          title: b.label, sub: b.sub, badge: 'Bank', reviewOnly: true,
          meta: `<div class="income-card-row"><span>Monthly</span><strong>${money(b.value / 12)}</strong></div>`,
        }));
      });
      primaryGrid.appendChild(card({
        party: 'party_b', basis: 'accepted', amount: acc.party_b,
        title: 'Accepted Document Income', sub: 'Pay stubs / benefits you reviewed & accepted', badge: 'W-2 · Docs',
        meta: `<div class="income-card-row"><span>Monthly</span><strong>${money(acc.party_b / 12)}</strong></div><div class="income-card-row"><span>Sources</span><strong>${acc.sources.filter((s) => s.party === 'party_b').length}</strong></div>`,
      }));
    }

    if (compareGrid) {
      compareGrid.innerHTML = '';
      const mkCompare = (party, label) => {
        const accepted = party === 'party_a' ? acc.party_a : acc.party_b;
        const best = Math.max(dc.avg12Month || 0, dc.avg6Month || 0);
        const el = document.createElement('div');
        el.className = 'income-compare-card';
        el.innerHTML = `
          <div class="income-compare-title">${label}</div>
          <div class="income-compare-sub">Accepted vs best deposit candidate</div>
          <div class="income-compare-value">${money(accepted)}</div>
          <div class="income-compare-var">Deposit candidate (12/6-mo best): <strong>${money(best)}</strong></div>
          <div class="income-compare-var">Using accepted evidence for calculation.</div>`;
        return el;
      };
      compareGrid.appendChild(mkCompare('party_a', 'Party A basis'));
      compareGrid.appendChild(mkCompare('party_b', 'Party B basis'));
    }

    const secGrid = document.getElementById('secondaryEarnedCards');
    if (secGrid && !secGrid.children.length) {
      secGrid.innerHTML = '<div class="income-group-note" style="grid-column:1/-1;">No secondary income source imported yet.</div>';
    }
    const estateGrid = document.getElementById('estateIncomeCards');
    if (estateGrid && !estateGrid.children.length) {
      estateGrid.innerHTML = '<div class="income-group-note" style="grid-column:1/-1;">No property/investment income basis imported yet.</div>';
    }

    renderSummary();
  }

  function renderSummary() {
    const acc = (state.analysis && state.analysis.accepted) || { party_a: 0, party_b: 0 };
    const selA = state.selection.party_a;
    const selB = state.selection.party_b;

    const amountA = selA.amount || acc.party_a || 0;
    const amountB = selB.amount || acc.party_b || 0;
    const combined = amountA + amountB;

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    set('ieSumLuisAnnual', money(amountA));
    set('ieSumLuisMonthly', money(amountA / 12));
    set('ieSumConiAnnual', money(amountB));
    set('ieSumConiMonthly', money(amountB / 12));
    set('ieSumCombinedAnnual', money(combined));
    set('ieSumCombinedMonthly', money(combined / 12));

    const pctA = combined ? Math.round((amountA / combined) * 100) : 0;
    const pctB = combined ? Math.round((amountB / combined) * 100) : 0;
    set('ieSumLuisPct', pctA + '%');
    set('ieSumConiPct', pctB + '%');
    set('ieSumSplitLuis', '[Party A] ' + pctA + '%');
    set('ieSumSplitConi', '[Party B] ' + pctB + '%');

    const basisLabel = (s, accAmt) => {
      if (!s.amount && accAmt) return 'Accepted document evidence';
      const names = { avg12: '12-month avg', avg6: '6-month avg', avg3: '3-month avg', runrate: 'Run-rate', accepted: 'Accepted documents', manual: 'Manual entry' };
      return names[s.basis] || '—';
    };
    set('ieSumLuisLabel', 'Basis: ' + basisLabel(selA, acc.party_a));
    set('ieSumConiLabel', 'Basis: ' + basisLabel(selB, acc.party_b));

    window.VeritasIncomeSelection = {
      party_a: { amount: amountA, basis: selA.basis },
      party_b: { amount: amountB, basis: selB.basis },
      combined,
    };
    window.dispatchEvent(new CustomEvent('incomeSelectionReady', { detail: window.VeritasIncomeSelection }));
  }

  async function load() {
    const mid = matterId();
    if (!mid) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`veritas_income_selection_${mid}`) || 'null');
      if (saved?.party_a && saved?.party_b) {
        state.selection.party_a = saved.party_a;
        state.selection.party_b = saved.party_b;
      }
    } catch (error) { /* ignore malformed saved selection */ }
    try {
      const [analysisRes, evidenceRes] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}/income-analysis`),
        fetch(`${API_BASE}/matters/${mid}/documents/income-evidence`),
      ]);
      if (analysisRes.ok) state.analysis = await analysisRes.json();
      if (evidenceRes.ok) state.evidence = await evidenceRes.json();
      renderCards();
    } catch (e) {
      console.warn('Income analysis unavailable', e);
    }
  }

  document.addEventListener('DOMContentLoaded', load);
  window.addEventListener('matterSelected', load);
  window.addEventListener('discoverySummaryReady', load);
})();