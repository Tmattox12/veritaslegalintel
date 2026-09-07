/* Shared Discovery -> analysis bridge.
 * Shows source-backed document, transaction, income-candidate, and mapped-expense
 * totals on AFI, spousal-maintenance, and child-support pages for the active matter.
 */
(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  function matterId() {
    return new URLSearchParams(location.search).get('matter') || localStorage.getItem('currentMatterId') || null;
  }

  function money(value) {
    return '$' + (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function addPanel(summary, incomeEvidence) {
    let host = document.getElementById('discoveryAnalysisBridge');
    if (!host) {
      host = document.createElement('section');
      host.id = 'discoveryAnalysisBridge';
      host.style.cssText = 'margin:0 0 20px;padding:14px 16px;border:1px solid #cdddea;border-left:4px solid #2e5b8a;border-radius:8px;background:#f7fafd;';
      const target = document.querySelector('.page-head, .content > .panel, .container');
      if (target && target.parentNode) target.parentNode.insertBefore(host, target.nextSibling);
      else document.body.prepend(host);
    }

    const categoryRows = Object.entries(summary.monthlyExpenses || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => `<span style="display:inline-block;margin:3px 6px 0 0;padding:3px 6px;background:#e8f3ff;border-radius:4px;font-size:11px;color:#1c5b9c;">${name}: ${money(value)}/mo</span>`)
      .join('');
    const evidenceSummary = incomeEvidence?.summary || {};
    const acceptedByParty = summary.acceptedIncomeByParty || {};
    const incomeRows = (incomeEvidence?.evidence || []).map((item) => {
      const amounts = [
        item.grossPay != null ? `Gross ${money(item.grossPay)}` : null,
        item.netPay != null ? `Net ${money(item.netPay)}` : null,
        item.paymentAmount != null ? `Payment ${money(item.paymentAmount)}` : null,
      ].filter(Boolean).join(' · ');
      return `<div style="font-size:11px;color:#42526e;margin-top:3px;">${item.filename} — <strong>${item.documentType}</strong>${amounts ? ` · ${amounts}` : ''}</div>`;
    }).join('');

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="font-weight:700;color:#1c3f66;">📥 Discovery analysis feed</div>
        <button type="button" id="discoveryBridgeRefresh" class="btn ghost" style="padding:5px 9px;font-size:11px;">Refresh</button>
      </div>
      <div style="font-size:12px;color:#42526e;margin-top:6px;">
        <strong>${summary.documentCount}</strong> documents · <strong>${summary.statementCount}</strong> statements · <strong>${summary.transactionCount}</strong> transactions · <strong>${summary.coverageMonths}</strong> months of statement coverage
      </div>
      <div style="font-size:12px;color:#42526e;margin-top:5px;">
        Bank-deposit income candidates: <strong>${money(summary.monthlyIncomeCandidate)}/mo</strong> (${money(summary.annualIncomeCandidate)}/yr annualized)
        <span style="color:#8a6a1f;">Review only — not calculation-ready.</span>
      </div>
      <div style="font-size:12px;color:#42526e;margin-top:5px;">
        Accepted document income: <strong>${money(summary.acceptedIncomeAnnual)}/yr</strong>
        <span style="color:#51617a;">Party A ${money(acceptedByParty.party_a)} · Party B ${money(acceptedByParty.party_b)} · ${summary.acceptedIncomeEvidence?.length || 0} approved source(s)</span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #dbe5f0;">
        <div style="font-size:12px;font-weight:700;color:#1c3f66;">Income documents on file: ${evidenceSummary.documentCount || 0}</div>
        <div style="font-size:11px;color:#42526e;margin-top:3px;">Pay stubs: <strong>${evidenceSummary.payStubCount || 0}</strong> · documented gross: <strong>${money(evidenceSummary.documentedGrossTotal)}</strong> · documented net: <strong>${money(evidenceSummary.documentedNetTotal)}</strong></div>
        ${incomeRows || '<div style="font-size:11px;color:#999;margin-top:3px;">No classified income document is available yet.</div>'}
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:5px;">Mapped recurring expenses from discovery:</div>
      <div>${categoryRows || '<span style="font-size:11px;color:#999;">No mapped recurring expenses yet. Use Discovery Intake → Load from Discovery to map merchants.</span>'}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:7px;">This feed excludes credit-card payments/refunds from income candidates and treats only accepted income evidence as calculation-ready.</div>
    `;
    host.querySelector('#discoveryBridgeRefresh').addEventListener('click', load);
  }

  async function load() {
    const mid = matterId();
    if (!mid) return;
    try {
      const [summaryResponse, incomeResponse] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}/analysis-summary`),
        fetch(`${API_BASE}/matters/${mid}/documents/income-evidence`),
      ]);
      if (!summaryResponse.ok || !incomeResponse.ok) return;
      const summary = await summaryResponse.json();
      const incomeEvidence = await incomeResponse.json();
      localStorage.setItem(`veritas_discovery_summary_${mid}`, JSON.stringify(summary));
      localStorage.setItem(`veritas_income_evidence_${mid}`, JSON.stringify(incomeEvidence));
      window.VeritasDiscovery = summary;
      window.VeritasIncomeEvidence = incomeEvidence;
      addPanel(summary, incomeEvidence);
      window.dispatchEvent(new CustomEvent('discoverySummaryReady', { detail: { summary, incomeEvidence } }));
    } catch (error) {
      console.warn('Discovery analysis feed unavailable', error);
    }
  }

  document.addEventListener('DOMContentLoaded', load);
  window.addEventListener('matterSelected', load);
})();
