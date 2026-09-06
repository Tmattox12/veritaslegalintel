/* Discovery Intake — Rule 49 (Arizona) Document Checklist.
   Auto-generates the required-disclosure list and checks items off by matching
   uploaded documents (by category + filename/keyword) for the active matter. */

(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  // Rule 49 disclosure items. Each has a matcher over {category, filename, bucket}.
  // bucket = our internal bucket id (financial|income|property|legal|disclosure|other)
  const RULE49 = [
    {
      id: 'afi',
      label: 'Affidavit of Financial Information (AFI)',
      bucket: 'disclosure',
      match: /affidavit|afi\b|financial information/i,
      note: 'Fully completed & signed, both parties',
    },
    {
      id: 'tax-returns',
      label: 'Federal & State Tax Returns',
      bucket: 'income',
      match: /1040|tax return|schedule c|form 1040/i,
      note: 'Last 3 years, all schedules',
    },
    {
      id: 'w2-k1',
      label: 'W-2s, 1099s & K-1s',
      bucket: 'income',
      match: /w-?2|1099|k-?1/i,
      note: 'Last 3 years',
    },
    {
      id: 'pay-stubs',
      label: 'Pay Stubs / Payroll Records',
      bucket: 'income',
      match: /pay\s?stub|payroll|earnings statement/i,
      note: 'Most recent 6 months, both parties',
    },
    {
      id: 'bank-statements',
      label: 'Bank Statements (checking & savings)',
      bucket: 'financial',
      match: /bank statement|checking|savings/i,
      note: 'Typically 12–36 months, all accounts',
    },
    {
      id: 'credit-cards',
      label: 'Credit Card Statements',
      bucket: 'financial',
      match: /credit card|visa|mastercard|amex|discover/i,
      note: 'Typically 12–36 months',
    },
    {
      id: 'retirement',
      label: 'Retirement / Investment / Brokerage Statements',
      bucket: 'financial',
      match: /401\(?k\)?|ira\b|retirement|brokerage|investment|pension/i,
      note: 'Most recent + marriage-date if available',
    },
    {
      id: 'real-property',
      label: 'Real Property — deeds, appraisals, mortgage',
      bucket: 'property',
      match: /deed|appraisal|mortgage|title|closing statement|hud-1/i,
      note: 'All real property, current value evidence',
    },
    {
      id: 'vehicles',
      label: 'Vehicle Titles & Valuations',
      bucket: 'property',
      match: /vehicle|car title|dmv|auto|kbb|blue book/i,
      note: 'All vehicles, boats, RVs',
    },
    {
      id: 'insurance',
      label: 'Insurance Policies (health/life/home/auto)',
      bucket: 'other',
      match: /insurance|policy|declaration/i,
      note: 'Declarations pages',
    },
    {
      id: 'debts',
      label: 'Loan / Debt Statements',
      bucket: 'financial',
      match: /loan|debt|line of credit|student loan|personal loan/i,
      note: 'All outstanding debts',
    },
    {
      id: 'business',
      label: 'Business Interests — valuations, P&L, returns',
      bucket: 'financial',
      match: /business|llc|corp|profit|p&l|balance sheet|1120|1065/i,
      note: 'If either party owns a business',
    },
    {
      id: 'pleadings',
      label: 'Court Filings / Orders / Agreements',
      bucket: 'legal',
      match: /order|petition|decree|pleading|stipulation|minute entry|agreement/i,
      note: 'Pleadings & prior orders',
    },
    {
      id: 'prenup',
      label: 'Prenuptial / Postnuptial Agreements',
      bucket: 'legal',
      match: /prenup|premarital|postnuptial|marital agreement/i,
      note: 'If applicable',
    },
  ];

  function matterId() {
    return (
      (window.Veritas && window.Veritas.currentMatterId) ||
      new URLSearchParams(location.search).get('matter') ||
      localStorage.getItem('currentMatterId') ||
      null
    );
  }

  function bucketOf(d) {
    const c = (d.category || '').toLowerCase();
    if (c.includes('financial statement')) return 'financial';
    if (c.includes('tax') || c.includes('income')) return 'income';
    if (c.includes('property') || c.includes('asset')) return 'property';
    if (c.includes('court') || c.includes('legal')) return 'legal';
    if (c.includes('afi') || c.includes('disclosure')) return 'disclosure';
    return 'other';
  }

  // Find docs satisfying a checklist item
  function matchesFor(item, docs) {
    return docs.filter((d) => {
      const fn = (d.filename || '').toLowerCase();
      const catOk = bucketOf(d) === item.bucket;
      const nameOk = item.match.test(fn);
      // Match on bucket + keyword in filename, OR strong filename keyword alone.
      return (catOk && nameOk) || nameOk;
    });
  }

  function render(docs) {
    const host = document.getElementById('checklistContainer');
    if (!host) return;

    if (!matterId()) {
      host.innerHTML = '<div style="font-size:48px;margin-bottom:12px;">📋</div><div>No case selected. Create or select a case to view the document checklist.</div>';
      return;
    }

    const rows = RULE49.map((item) => {
      const found = matchesFor(item, docs);
      return { item, found, received: found.length > 0 };
    });

    const received = rows.filter((r) => r.received).length;
    const pct = Math.round((received / rows.length) * 100);

    const rowHtml = rows.map(({ item, found, received }) => {
      const status = received
        ? `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#e8f5e9;color:#2e7d32;font-size:11px;font-weight:700;">✓ Received (${found.length})</span>`
        : `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#ffebee;color:#c62828;font-size:11px;font-weight:700;">⚠ Missing</span>`;
      const files = received
        ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;">${found.map((f) => f.filename).join(', ')}</div>`
        : '';
      return `
        <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:start;padding:12px;border-bottom:1px solid #eef2f7;">
          <div style="font-size:16px;">${received ? '✅' : '⬜'}</div>
          <div>
            <div style="font-weight:600;color:#1c3f66;font-size:13px;">${item.label}</div>
            <div style="font-size:11px;color:#8a94a3;margin-top:2px;">${item.note}</div>
            ${files}
          </div>
          <div>${status}</div>
        </div>`;
    }).join('');

    host.innerHTML = `
      <div style="padding:16px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;color:#1c3f66;">${received} of ${rows.length} required items received</div>
          <div style="font-size:12px;color:#2e5b8a;font-weight:700;">${pct}% complete</div>
        </div>
        <div style="background:#eef2f7;border-radius:6px;height:8px;overflow:hidden;margin-bottom:16px;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2e5b8a,#2e7d32);"></div>
        </div>
        <div style="border:1px solid #e6ecf3;border-radius:8px;overflow:hidden;">${rowHtml}</div>
      </div>`;
  }

  async function loadChecklist() {
    const mid = matterId();
    const host = document.getElementById('checklistContainer');
    if (!host) return;
    if (!mid) { render([]); return; }
    try {
      const r = await fetch(`${API_BASE}/matters/${mid}/documents`);
      const docs = await r.json();
      render(docs || []);
    } catch (e) {
      host.innerHTML = '<div style="padding:20px;color:#c62828;">Could not load documents — is the Node backend running on :3000?</div>';
    }
  }

  function init() {
    loadChecklist();
    // Refresh when a matter is selected or a doc finishes uploading
    window.addEventListener('matterSelected', loadChecklist);
    // uploads module re-renders buckets; poll-light: also re-run on queue completion
    const q = document.getElementById('uploadQueue');
    if (q) {
      const obs = new MutationObserver(() => {
        // debounce
        clearTimeout(window.__ckT);
        window.__ckT = setTimeout(loadChecklist, 600);
      });
      obs.observe(q, { childList: true, subtree: true });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
