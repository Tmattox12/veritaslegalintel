/* Income Engine — surface income detected in parsed discovery statements
   and let the user import it into the "other annual income" fields. */

(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  function matterId() {
    return (
      (window.Veritas && window.Veritas.currentMatterId) ||
      new URLSearchParams(location.search).get('matter') ||
      localStorage.getItem('currentMatterId') ||
      null
    );
  }

  function money(n) {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function fetchIncome() {
    const mid = matterId();
    if (!mid) return null;
    try {
      const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements/transactions?limit=5000`);
      const rows = await r.json();
      return (rows || []).filter((t) => t.flow_type === 'income');
    } catch (e) {
      return null;
    }
  }

  // Group income transactions into recurring sources
  function groupSources(incomeTxns) {
    const src = {};
    incomeTxns.forEach((t) => {
      const key = (t.description || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).slice(0, 4).join(' ').trim() || 'Unknown';
      if (!src[key]) src[key] = { total: 0, count: 0, months: new Set() };
      src[key].total += Math.abs(parseFloat(t.amount) || 0);
      src[key].count++;
      const m = (t.transaction_date || '').slice(0, 7);
      if (m) src[key].months.add(m);
    });
    return Object.entries(src)
      .map(([name, s]) => ({
        name,
        total: s.total,
        count: s.count,
        months: Math.max(1, s.months.size),
        monthly: s.total / Math.max(1, s.months.size),
        annual: (s.total / Math.max(1, s.months.size)) * 12,
      }))
      .sort((a, b) => b.total - a.total);
  }

  function showBanner(sources) {
    const banner = document.getElementById('ieDiscoveryImport');
    if (!banner) return;
    if (!sources.length) return;

    const totalMonthly = sources.reduce((s, x) => s + x.monthly, 0);
    document.getElementById('ieDiscoveryImportSummary').textContent =
      `${sources.length} income source(s) found · ${money(totalMonthly)}/mo detected from bank/card statements.`;
    banner.style.display = '';

    document.getElementById('ieDiscoveryImportBtn').addEventListener('click', () => openReview(sources));
  }

  function openReview(sources) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const rows = sources.map((s, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;"><input type="checkbox" data-i="${i}" checked></td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${s.count}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(s.monthly)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(s.annual)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <select data-party="${i}" style="padding:4px;border:1px solid #cdd8e7;border-radius:4px;">
            <option value="paying">Party A</option>
            <option value="supported">Party B</option>
          </select>
        </td>
      </tr>`).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;max-width:820px;width:100%;max-height:80vh;overflow:auto;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#1c3f66;">📥 Import Income from Discovery</h3>
          <button class="btn ghost" id="ieCloseRev">Close</button>
        </div>
        <p style="font-size:12px;color:#51617a;margin:0 0 12px;">Checked sources are summed into each party's <strong>annual</strong> income and written into the "Other annual income" fields. Adjust party assignment as needed.</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f6f9fd;text-align:left;">
            <th style="padding:8px;"></th><th style="padding:8px;">Source</th><th style="padding:8px;text-align:center;">Deposits</th>
            <th style="padding:8px;text-align:right;">Monthly</th><th style="padding:8px;text-align:right;">Annualized</th><th style="padding:8px;">Party</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:14px;gap:8px;">
          <button class="btn" id="ieDoImport">Import selected</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#ieCloseRev').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ieDoImport').addEventListener('click', () => {
      doImport(overlay, sources);
    });
  }

  function doImport(overlay, sources) {
    let paying = 0, supported = 0;
    overlay.querySelectorAll('input[type=checkbox][data-i]').forEach((cb) => {
      if (!cb.checked) return;
      const i = parseInt(cb.dataset.i, 10);
      const party = overlay.querySelector(`select[data-party="${i}"]`).value;
      if (party === 'paying') paying += sources[i].annual; else supported += sources[i].annual;
    });

    const payingEl = document.getElementById('iePayingOtherAnnual');
    const supportedEl = document.getElementById('ieSupportedOtherAnnual');
    if (payingEl && paying > 0) payingEl.value = Math.round(paying);
    if (supportedEl && supported > 0) supportedEl.value = Math.round(supported);

    // Trigger recalculation if the page exposes one
    ['input', 'change'].forEach((ev) => {
      if (payingEl) payingEl.dispatchEvent(new Event(ev, { bubbles: true }));
      if (supportedEl) supportedEl.dispatchEvent(new Event(ev, { bubbles: true }));
    });

    overlay.remove();
    const banner = document.getElementById('ieDiscoveryImport');
    if (banner) {
      banner.style.borderLeftColor = '#1c6b52';
      document.getElementById('ieDiscoveryImportSummary').textContent =
        `✓ Imported — Party A +${money(paying)}/yr, Party B +${money(supported)}/yr into "Other annual income".`;
    }
  }

  async function init() {
    const income = await fetchIncome();
    if (!income) return; // backend down or no matter
    showBanner(groupSources(income));
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('matterSelected', init);
})();
