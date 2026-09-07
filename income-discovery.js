/* Income Engine — surface reviewable, document-backed income evidence.
  Bank candidates exclude credit-card payments; pay stubs/benefit records are
  presented separately and never annualized without attorney review. */

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
      return (rows || []).filter((t) => {
        const category = t.mapped_category || t.suggested_category;
        const description = (t.description || '').toLowerCase();
        const isAccountMovement =
          category === 'transfer' || category === 'employment_income' || category === 'tax' ||
          /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/.test(description);
        return t.flow_type === 'income' && t.account_type !== 'credit_card' && !isAccountMovement;
      });
    } catch (e) {
      return null;
    }
  }

  async function fetchIncomeEvidence() {
    const mid = matterId();
    if (!mid) return null;
    try {
      const response = await fetch(`${API_BASE}/matters/${mid}/documents/income-evidence`);
      return response.ok ? response.json() : null;
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

  function showBanner(sources, documentEvidence) {
    const banner = document.getElementById('ieDiscoveryImport');
    if (!banner) return;
    const evidenceSummary = documentEvidence?.summary || {};
    if (!sources.length && !evidenceSummary.documentCount) return;

    const totalMonthly = sources.reduce((s, x) => s + x.monthly, 0);
    const acceptedEvidence = (documentEvidence?.evidence || []).filter((item) =>
      item.reviewStatus === 'accepted' && Number(item.annualAmount) > 0 && ['party_a', 'party_b'].includes(item.party)
    );
    const acceptedTotal = acceptedEvidence.reduce((sum, item) => sum + Number(item.annualAmount || 0), 0);
    document.getElementById('ieDiscoveryImportSummary').textContent =
      `${acceptedEvidence.length ? `${acceptedEvidence.length} accepted income source(s), ${money(acceptedTotal)}/yr approved.` : 'No income document accepted yet.'} ${evidenceSummary.documentCount || 0} income document(s) on file (${evidenceSummary.payStubCount || 0} pay stub) · documented gross ${money(evidenceSummary.documentedGrossTotal)} · documented net ${money(evidenceSummary.documentedNetTotal)}. ${sources.length ? `${sources.length} non-card bank deposit candidate(s), ${money(totalMonthly)}/mo, remain review-only.` : 'No non-card bank deposit candidates automatically included.'}`;
    banner.style.display = '';

    document.getElementById('ieDiscoveryImportBtn').onclick = () => openReview(sources, documentEvidence);
  }

  function openReview(sources, documentEvidence) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const rows = sources.map((s) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${s.count}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(s.monthly)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(s.annual)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#8a6a1f;font-weight:600;">Review only — not imported</td>
      </tr>`).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;max-width:820px;width:100%;max-height:80vh;overflow:auto;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#1c3f66;">📥 Import Income from Discovery</h3>
          <button class="btn ghost" id="ieCloseRev">Close</button>
        </div>
        <p style="font-size:12px;color:#51617a;margin:0 0 12px;">Income documents are source evidence. Bank deposit candidates below exclude credit-card payments; select only reviewed recurring income before importing annual values.</p>
        <div style="font-size:12px;color:#42526e;background:#f7fafd;border:1px solid #d8e3f1;padding:10px;border-radius:6px;margin-bottom:12px;">
          ${(documentEvidence?.evidence || []).map((item) => `<div>${item.filename} — <strong>${item.documentType}</strong>${item.grossPay != null ? ` · Gross ${money(item.grossPay)}` : ''}${item.netPay != null ? ` · Net ${money(item.netPay)}` : ''}</div>`).join('') || 'No classified income document evidence.'}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f6f9fd;text-align:left;">
            <th style="padding:8px;">Source</th><th style="padding:8px;text-align:center;">Deposits</th>
            <th style="padding:8px;text-align:right;">Monthly</th><th style="padding:8px;text-align:right;">Annualized</th><th style="padding:8px;">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#1c3f66;margin-bottom:8px;">Review classified income documents</div>
          ${(documentEvidence?.evidence || []).map((item, index) => `
            <div style="display:grid;grid-template-columns:minmax(180px,1fr) 130px 120px 110px auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf2f7;font-size:11px;">
              <div><strong>${item.filename}</strong><br><span style="color:#6b7280;">${item.documentType}${item.grossPay != null ? ` · Gross ${money(item.grossPay)}` : ''}${item.netPay != null ? ` · Net ${money(item.netPay)}` : ''}</span></div>
              <select data-evidence-party="${index}" style="padding:5px;border:1px solid #cdd8e7;border-radius:4px;"><option value="party_a" ${item.party === 'party_a' ? 'selected' : ''}>Party A</option><option value="party_b" ${item.party === 'party_b' ? 'selected' : ''}>Party B</option></select>
              <input data-evidence-annual="${index}" type="number" min="0" step="1" placeholder="Annual amount" value="${item.annualAmount ?? ''}" style="padding:5px;border:1px solid #cdd8e7;border-radius:4px;min-width:0;">
              <span data-evidence-status="${index}" style="color:${item.reviewStatus === 'accepted' ? '#2e7d32' : item.reviewStatus === 'rejected' ? '#c62828' : '#8a6a1f'};font-weight:600;">${item.reviewStatus || 'pending'}</span>
              <div style="display:flex;gap:5px;"><button type="button" data-evidence-accept="${index}" style="padding:5px 7px;border:0;border-radius:4px;background:#2e7d32;color:#fff;cursor:pointer;">Accept</button><button type="button" data-evidence-reject="${index}" style="padding:5px 7px;border:1px solid #c62828;border-radius:4px;background:#fff;color:#c62828;cursor:pointer;">Reject</button></div>
            </div>`).join('') || '<div style="font-size:11px;color:#999;">No income evidence documents classified.</div>'}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px;gap:8px;">
          <button class="btn" id="ieDoImport">Import accepted evidence</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#ieCloseRev').addEventListener('click', () => overlay.remove());
    (documentEvidence?.evidence || []).forEach((item, index) => {
      const saveReview = async (status) => {
        const party = overlay.querySelector(`[data-evidence-party="${index}"]`).value;
        const annualAmount = overlay.querySelector(`[data-evidence-annual="${index}"]`).value;
        const statusEl = overlay.querySelector(`[data-evidence-status="${index}"]`);
        if (status === 'accepted' && (!annualAmount || Number(annualAmount) <= 0)) {
          statusEl.textContent = 'enter annual amount';
          statusEl.style.color = '#c62828';
          return;
        }
        try {
          const response = await fetch(`${API_BASE}/matters/${matterId()}/documents/income-evidence/${item.documentId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ party, annualAmount, status }),
          });
          if (!response.ok) throw new Error('Review save failed');
          item.party = party;
          item.annualAmount = annualAmount === '' ? null : Number(annualAmount);
          item.reviewStatus = status;
          statusEl.textContent = status;
          statusEl.style.color = status === 'accepted' ? '#2e7d32' : '#c62828';
        } catch (error) {
          statusEl.textContent = 'save failed';
          statusEl.style.color = '#c62828';
        }
      };
      overlay.querySelector(`[data-evidence-accept="${index}"]`).addEventListener('click', () => saveReview('accepted'));
      overlay.querySelector(`[data-evidence-reject="${index}"]`).addEventListener('click', () => saveReview('rejected'));
    });
    overlay.querySelector('#ieDoImport').addEventListener('click', () => {
      doImport(overlay, documentEvidence);
    });
  }

  async function doImport(overlay, documentEvidence) {
    const importBtn = overlay.querySelector('#ieDoImport');
    let latestEvidence = documentEvidence;
    try {
      const response = await fetch(`${API_BASE}/matters/${matterId()}/documents/income-evidence`);
      if (response.ok) latestEvidence = await response.json();
    } catch (error) {
      // Fall back to the modal's current review state if refresh fails.
    }

    const accepted = (latestEvidence?.evidence || []).filter((item) =>
      item.reviewStatus === 'accepted' && Number(item.annualAmount) > 0 && ['party_a', 'party_b'].includes(item.party)
    );
    if (!accepted.length) {
      importBtn.textContent = 'No accepted evidence to import';
      setTimeout(() => { importBtn.textContent = 'Import accepted evidence'; }, 2500);
      return;
    }

    const paying = accepted
      .filter((item) => item.party === 'party_a')
      .reduce((sum, item) => sum + Number(item.annualAmount || 0), 0);
    const supported = accepted
      .filter((item) => item.party === 'party_b')
      .reduce((sum, item) => sum + Number(item.annualAmount || 0), 0);

    const payingEl = document.getElementById('iePayingOtherAnnual');
    const supportedEl = document.getElementById('ieSupportedOtherAnnual');
    if (payingEl) payingEl.value = Math.round(paying);
    if (supportedEl) supportedEl.value = Math.round(supported);

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
        `✓ Imported accepted document income — Party A ${money(paying)}/yr, Party B ${money(supported)}/yr from ${accepted.length} reviewed source(s).`;
    }
  }

  async function init() {
    const [income, evidence] = await Promise.all([fetchIncome(), fetchIncomeEvidence()]);
    if (!income && !evidence) return;
    showBanner(groupSources(income || []), evidence);
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('matterSelected', init);
})();
