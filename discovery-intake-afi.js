/* Discovery Intake — AFI Expense Mapping from parsed discovery transactions. */

(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  // AFI expense lines 1-8 (must match afi-form-populator.html)
  const AFI_LINES = [
    { line: 1, label: 'Health Insurance Premium' },
    { line: 2, label: 'Childcare/Dependent Care' },
    { line: 3, label: 'Medical/Dental (Out-of-Pocket)' },
    { line: 4, label: 'Education/Books/Supplies' },
    { line: 5, label: 'Housing (Mortgage/Rent/Utilities)' },
    { line: 6, label: 'Utilities (Phone/Internet/Cable)' },
    { line: 7, label: 'Transportation (Car/Gas/Insurance)' },
    { line: 8, label: 'Food/Groceries' },
  ];

  // Map parser's suggested_category -> AFI line number
  const CATEGORY_TO_LINE = {
    insurance: 1,
    childcare: 2,
    medical: 3,
    education: 4,
    housing: 5,
    utilities: 6,
    fuel: 7,
    groceries: 8,
    dining: 8,
    shopping: null, // discretionary, no AFI line
    transfer: null,
    tax: null,
    employment_income: null, // income, not expense
  };

  let allTransactions = [];
  // merchantKey -> afiLine (number|null) for user overrides
  const userMappings = {};

  function matterId() {
    return (
      (window.Veritas && window.Veritas.currentMatterId) ||
      new URLSearchParams(location.search).get('matter') ||
      localStorage.getItem('currentMatterId') ||
      null
    );
  }

  function merchantKey(desc) {
    return (desc || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).slice(0, 3).join(' ').trim();
  }

  function setNote(msg) {
    const el = document.getElementById('afiMapNote');
    if (el) el.textContent = msg;
  }

  function money(n) {
    return '$' + (Math.abs(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let statementSpans = [];

  /* ---------- Load ---------- */
  async function loadTransactions() {
    const mid = matterId();
    if (!mid) { setNote('No matter selected. Select a case first.'); return; }
    setNote('Loading parsed transactions from discovery…');
    try {
      const [txRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}/bank-statements/transactions?limit=5000`),
        fetch(`${API_BASE}/matters/${mid}/bank-statements`),
      ]);
      const rows = await txRes.json();
      const stmts = await stRes.json();
      allTransactions = (rows || []).filter((t) => t.flow_type === 'expense');
      statementSpans = (stmts || []).filter((s) => s.statement_start && s.statement_end);
      render();
      setNote(allTransactions.length
        ? `Loaded ${allTransactions.length} expense transactions from parsed statements.`
        : 'No expense transactions found. Upload bank/card statements first.');
    } catch (e) {
      setNote('Could not load transactions — is the Node backend running on :3000?');
    }
  }

  /* ---------- Derive mapping ---------- */
  function computeMapping() {
    const lineTotals = {}; // line -> { total, rows }
    const unmapped = {};   // merchantKey -> { rows, amount, desc }
    let mapped = 0, total = 0;

    allTransactions.forEach((t) => {
      const amt = Math.abs(parseFloat(t.amount) || 0);
      total += amt;
      const cat = t.mapped_category || t.suggested_category;
      let line = cat != null ? CATEGORY_TO_LINE[cat] : undefined;

      // user override by merchant
      const mk = merchantKey(t.description);
      if (userMappings[mk] !== undefined) line = userMappings[mk];

      if (line != null && line !== undefined) {
        mapped++;
        if (!lineTotals[line]) lineTotals[line] = { total: 0, rows: 0 };
        lineTotals[line].total += amt;
        lineTotals[line].rows++;
      } else {
        if (!unmapped[mk]) unmapped[mk] = { rows: 0, amount: 0, desc: t.description };
        unmapped[mk].rows++;
        unmapped[mk].amount += amt;
      }
    });

    return { lineTotals, unmapped, mapped, total };
  }

  /* ---------- Render ---------- */
  function render() {
    const { lineTotals, unmapped, mapped, total } = computeMapping();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('afiMapRows', allTransactions.length);
    set('afiMapMapped', mapped);
    set('afiMapUnmapped', allTransactions.length - mapped);
    set('afiMapTotal', money(total));

    // Category table
    const catBody = document.getElementById('afiMapCategoryBody');
    if (catBody) {
      catBody.innerHTML = '';
      AFI_LINES.forEach(({ line, label }) => {
        const agg = lineTotals[line];
        if (!agg) return;
        const months = statementMonths();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>Line ${line}</td>
          <td>${label}</td>
          <td>${money(agg.total)}</td>
          <td>${money(agg.total / months)}</td>
          <td>${agg.rows}</td>`;
        catBody.appendChild(tr);
      });
      if (!catBody.children.length) {
        catBody.innerHTML = '<tr><td colspan="5" style="color:#999;padding:12px;">No mapped transactions yet.</td></tr>';
      }
    }

    // Unmapped merchants table
    const unBody = document.getElementById('afiUnmappedBody');
    if (unBody) {
      unBody.innerHTML = '';
      const keys = Object.keys(unmapped).sort((a, b) => unmapped[b].amount - unmapped[a].amount);
      keys.forEach((mk) => {
        const u = unmapped[mk];
        const tr = document.createElement('tr');
        const opts = [`<option value="">— Select AFI line —</option>`]
          .concat(AFI_LINES.map(({ line, label }) =>
            `<option value="${line}" ${userMappings[mk] === line ? 'selected' : ''}>${line}. ${label}</option>`))
          .concat([`<option value="none" ${userMappings[mk] === null ? 'selected' : ''}>Other / Skip</option>`])
          .join('');
        tr.innerHTML = `
          <td title="${(u.desc || '').replace(/"/g, '&quot;')}">${mk || '(blank)'}</td>
          <td>${u.rows}</td>
          <td>${money(u.amount)}</td>
          <td><select class="map-select" data-mk="${mk}">${opts}</select></td>`;
        unBody.appendChild(tr);
      });
      if (!unBody.children.length) {
        unBody.innerHTML = '<tr><td colspan="4" style="color:#999;padding:12px;">No unmapped merchants. 🎉</td></tr>';
      }

      // wire selects
      unBody.querySelectorAll('select[data-mk]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const v = sel.value;
          if (v === '') delete userMappings[sel.dataset.mk];
          else if (v === 'none') userMappings[sel.dataset.mk] = null;
          else userMappings[sel.dataset.mk] = parseInt(v, 10);
          render();
        });
      });
    }
  }

  function statementMonths() {
    // Prefer actual statement coverage: sum of statement periods in months.
    if (statementSpans.length) {
      let totalDays = 0;
      statementSpans.forEach((s) => {
        const a = new Date(s.statement_start), b = new Date(s.statement_end);
        if (!isNaN(a) && !isNaN(b) && b > a) totalDays += (b - a) / 86400000;
      });
      const months = totalDays / 30.44;
      if (months > 0) return Math.max(1, months);
    }
    // Fallback: count distinct YYYY-MM in expense transactions, min 1.
    const months = new Set();
    allTransactions.forEach((t) => {
      const d = (t.transaction_date || '').slice(0, 7);
      if (d) months.add(d);
    });
    return Math.max(1, months.size);
  }

  /* ---------- Actions ---------- */
  function applyMappings() {
    render();
    setNote(`Applied mappings. ${Object.keys(userMappings).length} merchant override(s) active.`);
  }

  function pushToAFI() {
    const { lineTotals } = computeMapping();
    if (Object.keys(lineTotals).length === 0) {
      setNote('Nothing to push — map at least one transaction to an AFI line first.');
      return;
    }
    const months = statementMonths();

    // Load existing draft or start fresh
    let draft = { expenses: [0, 0, 0, 0, 0, 0, 0, 0], income: { w2: 0, ss: 0, other: 0 }, notes: '' };
    try {
      const saved = localStorage.getItem('afi_form_draft');
      if (saved) draft = Object.assign(draft, JSON.parse(saved));
    } catch (e) { /* ignore */ }

    AFI_LINES.forEach(({ line }) => {
      const agg = lineTotals[line];
      if (agg) draft.expenses[line - 1] = +(agg.total / months).toFixed(2); // monthly
    });

    draft.notes = (draft.notes ? draft.notes + '\n' : '') +
      `Auto-filled from Discovery transactions on ${new Date().toLocaleDateString()} (${months} month(s) of data).`;
    draft.savedDate = new Date().toISOString();

    localStorage.setItem('afi_form_draft', JSON.stringify(draft));
    setNote(`✓ Pushed monthly totals to AFI draft. Open afi-form-populator.html and it will load automatically.`);
  }

  function exportReconCSV() {
    const { lineTotals, unmapped } = computeMapping();
    const rows = [['AFI Line', 'Category', 'Total', 'Monthly', 'Rows']];
    AFI_LINES.forEach(({ line, label }) => {
      const agg = lineTotals[line];
      if (agg) rows.push([line, `"${label}"`, agg.total.toFixed(2), (agg.total / statementMonths()).toFixed(2), agg.rows]);
    });
    rows.push([]);
    rows.push(['Unmapped Merchant', 'Rows', 'Amount']);
    Object.keys(unmapped).forEach((mk) => rows.push([`"${mk}"`, unmapped[mk].rows, unmapped[mk].amount.toFixed(2)]));

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `afi-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- Init ---------- */
  function init() {
    const loadBtn = document.getElementById('afiMapCsvBtn');
    if (loadBtn) {
      loadBtn.textContent = 'Load from Discovery';
      loadBtn.addEventListener('click', loadTransactions);
    }
    const applyBtn = document.getElementById('afiApplyUnmappedBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyMappings);
    const pushBtn = document.getElementById('afiPushMappedBtn');
    if (pushBtn) pushBtn.addEventListener('click', pushToAFI);
    const exportBtn = document.getElementById('afiExportReconBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportReconCSV);

    // hide the now-unused CSV file input
    const fi = document.getElementById('afiMapCsvInput');
    if (fi) fi.style.display = 'none';

    // auto-load if a matter is already selected
    if (matterId()) loadTransactions();
    window.addEventListener('matterSelected', loadTransactions);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
