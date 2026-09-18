/* Discovery Intake — AFI Expense Mapping from parsed discovery transactions. */

(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';

  // Categories, AFI-line roll-up and merchant rules all come from the shared
  // taxonomy in afi-taxonomy.js, loaded as a script before this file.
  const T = window.AFITaxonomy;
  const AFI_LINES = T.AFI_LINES;


  let allTransactions = [];
  // merchantKey -> category code chosen by a person (older saves: AFI line number, or null to skip)
  const userMappings = {};
  // merchantKey -> true once a person has accepted a flagged suggestion as-is
  const confirmedGuesses = {};

  function mappingStorageKey(kind = 'mappings') {
    const mid = matterId();
    return mid ? `veritas_afi_${kind}_${mid}` : null;
  }

  function loadUserMappings() {
    [[mappingStorageKey(), userMappings], [mappingStorageKey('confirmed'), confirmedGuesses]].forEach(([key, target]) => {
      if (!key) return;
      try {
        Object.assign(target, JSON.parse(localStorage.getItem(key) || '{}'));
      } catch (error) { /* ignore malformed local mapping state */ }
    });
  }

  function saveUserMappings() {
    const key = mappingStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(userMappings));
    const ck = mappingStorageKey('confirmed');
    if (ck) localStorage.setItem(ck, JSON.stringify(confirmedGuesses));
  }


  function isMappableExpense(transaction) {
    const description = (transaction.description || '').toLowerCase();
    const code = T.normalize(transaction.mapped_category || transaction.suggested_category) ||
      T.classify(transaction.description);
    const amount = Math.abs(parseFloat(transaction.amount) || 0);

    // Transfers, cash and credit-card payments move money between accounts;
    // they are not household spending and must never inflate an AFI total.
    // A merely-guessed "not spending" category stays in the list, flagged, so
    // a person sees it instead of it silently disappearing.
    const detail = T.classifyDetailed(transaction.description);
    const guessed = detail && detail.confidence === 'review' && detail.code === code;
    if ((T.treatmentFor(code) === 'none' && !guessed) || /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/.test(description)) {
      return false;
    }
    // A parsed amount over $100k is almost certainly an OCR/reference-ID error
    // and requires review before it can participate in a financial calculation.
    return amount > 0 && amount <= 100000;
  }

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
    loadUserMappings();
    setNote('Loading parsed transactions from discovery…');
    try {
      const [txRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}/bank-statements/transactions?limit=5000`),
        fetch(`${API_BASE}/matters/${mid}/bank-statements`),
      ]);
      const rows = await txRes.json();
      const stmts = await stRes.json();
      allTransactions = (rows || []).filter((t) => t.flow_type === 'expense' && isMappableExpense(t));
      statementSpans = (stmts || []).filter((s) => s.statement_start && s.statement_end);
      render();
      setNote(allTransactions.length
        ? `Loaded ${allTransactions.length} mappable expense transactions from parsed statements (payments and transfers excluded).`
        : 'No expense transactions found. Upload bank/card statements first.');
    } catch (e) {
      setNote('Could not load transactions — is the Node backend running on :3000?');
    }
  }

  /* ---------- Derive mapping ---------- */
  function computeMapping() {
    const lineTotals = {}; // line -> { total, rows }
    const shoppingTotal = { total: 0, rows: 0 };
    const offForm = {};    // category code -> { total, rows } for needs with no AFI box
    const unmapped = {};   // merchantKey -> { rows, amount, desc }
    const flagged = {};    // merchantKey -> { rows, amount, desc, code } best-guess categories
    let mapped = 0, flaggedRows = 0, total = 0;

    allTransactions.forEach((t) => {
      const amt = Math.abs(parseFloat(t.amount) || 0);
      total += amt;
      const mk = merchantKey(t.description);
      const detail = T.classifyDetailed(t.description);
      const cat = T.normalize(t.mapped_category || t.suggested_category) || (detail && detail.code);
      const userSet = userMappings[mk] !== undefined;

      // A best-guess category counts toward the totals but stays visible until
      // a person confirms it or picks something else. Whether it is a guess is
      // a property of the taxonomy rule that matched, so it is derived here.
      const isGuess = !!(detail && detail.confidence === 'review');
      if (cat && isGuess && !userSet && !confirmedGuesses[mk] && t.mapping_status !== 'confirmed') {
        if (!flagged[mk]) flagged[mk] = { rows: 0, amount: 0, desc: t.description, code: cat };
        flagged[mk].rows++;
        flagged[mk].amount += amt;
        flaggedRows++;
      }

      // A person's choice is stored as a category code. Older choices were
      // stored as an AFI line number (or null for "Other / Skip") and are
      // still honoured so nothing already mapped is lost.
      const override = userMappings[mk];
      const chosenCat = typeof override === 'string' ? override : null;
      const effCat = chosenCat || (userSet ? null : cat);
      const line = typeof override === 'number' ? override
        : effCat != null ? T.afiLineFor(effCat) : null;
      const treatment = effCat ? T.treatmentFor(effCat) : null;

      if (line != null) {
        mapped++;
        if (!lineTotals[line]) lineTotals[line] = { total: 0, rows: 0 };
        lineTotals[line].total += amt;
        lineTotals[line].rows++;
      } else if (override === null || treatment === 'none') {
        // "Other / Skip", or a person said it is not spending at all (a
        // transfer, income): handled, and kept out of every expense total.
        mapped++;
      } else if (treatment === 'discretionary') {
        mapped++;
        shoppingTotal.total += amt;
        shoppingTotal.rows++;
      } else if (effCat) {
        // Categorised, but a need (or legal/debt/excluded item) with no box on
        // the eight-line form: reported on its own line, not left "unmapped".
        mapped++;
        if (!offForm[effCat]) offForm[effCat] = { total: 0, rows: 0 };
        offForm[effCat].total += amt;
        offForm[effCat].rows++;
      } else {
        if (!unmapped[mk]) unmapped[mk] = { rows: 0, amount: 0, desc: t.description };
        unmapped[mk].rows++;
        unmapped[mk].amount += amt;
      }
    });

    return { lineTotals, shoppingTotal, offForm, unmapped, flagged, mapped, flaggedRows, total };
  }

  /* ---------- Render ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function render() {
    const { lineTotals, shoppingTotal, offForm, unmapped, flagged, mapped, flaggedRows, total } = computeMapping();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('afiMapRows', allTransactions.length);
    set('afiMapMapped', mapped - flaggedRows);
    // Needs review = nothing matched, plus best guesses nobody has confirmed yet.
    set('afiMapUnmapped', allTransactions.length - mapped + flaggedRows);
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
      if (shoppingTotal.rows) {
        const months = statementMonths();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>Review</td>
          <td>Shopping / Discretionary (Amazon and similar)</td>
          <td>${money(shoppingTotal.total)}</td>
          <td>${money(shoppingTotal.total / months)}</td>
          <td>${shoppingTotal.rows}</td>`;
        catBody.appendChild(tr);
      }
      Object.keys(offForm).sort((a, b) => offForm[b].total - offForm[a].total).forEach((code) => {
        const agg = offForm[code];
        const sec = T.sectionFor(code);
        const months = statementMonths();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(sec && sec.afiSection ? '§' + sec.afiSection : sec ? sec.label : '')}</td>
          <td>${esc(T.displayLabel(code))} <span style="color:#8a94a6;">(no box on the 8-line form)</span></td>
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
      // Every taxonomy category, grouped by AFI section. `selected` is a
      // category code, a legacy AFI line number, null for skip, or undefined.
      const options = (selected) => {
        let sel = selected;
        if (typeof sel === 'number') {
          const firstOnLine = T.CATEGORIES.find((c) => c.afiLine === sel);
          sel = firstOnLine ? firstOnLine.code : undefined;
        }
        const groups = T.SECTIONS.map((s) => {
          const items = T.categoriesForSection(s.key).map((c) =>
            `<option value="${esc(c.code)}" ${sel === c.code ? 'selected' : ''}>${esc(T.displayLabel(c.code))}${c.afiLine ? ` — Line ${c.afiLine}` : ''}</option>`).join('');
          const heading = s.afiSection && /^\d/.test(s.afiSection) ? `§${s.afiSection} ${s.label}` : s.label;
          return items ? `<optgroup label="${esc(heading)}">${items}</optgroup>` : '';
        }).join('');
        return `<option value="">— Select category —</option>${groups}` +
          `<option value="__skip" ${sel === null ? 'selected' : ''}>Other / Skip (leave out of AFI)</option>`;
      };

      // Best guesses first: recognisable merchants whose category a person
      // should confirm. They already count toward the totals above.
      Object.keys(flagged).sort((a, b) => flagged[b].amount - flagged[a].amount).forEach((mk) => {
        const f = flagged[mk];
        const tr = document.createElement('tr');
        tr.style.background = '#fffbeb';
        tr.innerHTML = `
          <td title="${esc(f.desc)}">${esc(mk || '(blank)')}
            <div style="margin-top:3px;"><span class="map-badge" style="background:#fef3c7;color:#92400e;">Suggested — review</span>
            <span style="font-size:10px;color:#6b7280;">${esc(T.displayLabel(f.code))}</span></div></td>
          <td>${f.rows}</td>
          <td>${money(f.amount)}</td>
          <td><div style="display:flex;gap:6px;align-items:center;">
            <select class="map-select" data-mk="${esc(mk)}">${options(f.code)}</select>
            <button type="button" class="btn ghost" style="padding:3px 8px;font-size:11px;white-space:nowrap;" data-confirm="${esc(mk)}">✓ Confirm</button>
          </div></td>`;
        unBody.appendChild(tr);
      });

      Object.keys(unmapped).sort((a, b) => unmapped[b].amount - unmapped[a].amount).forEach((mk) => {
        const u = unmapped[mk];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td title="${esc(u.desc)}">${esc(mk || '(blank)')}</td>
          <td>${u.rows}</td>
          <td>${money(u.amount)}</td>
          <td><select class="map-select" data-mk="${esc(mk)}">${options(userMappings[mk])}</select></td>`;
        unBody.appendChild(tr);
      });
      if (!unBody.children.length) {
        unBody.innerHTML = '<tr><td colspan="4" style="color:#999;padding:12px;">No unmapped or flagged merchants. 🎉</td></tr>';
      }

      unBody.querySelectorAll('button[data-confirm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          confirmedGuesses[btn.dataset.confirm] = true;
          saveUserMappings();
          render();
        });
      });

      // wire selects
      unBody.querySelectorAll('select[data-mk]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const v = sel.value;
          if (v === '') delete userMappings[sel.dataset.mk];
          else if (v === '__skip') userMappings[sel.dataset.mk] = null;
          else userMappings[sel.dataset.mk] = v;
          saveUserMappings();
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

  // Lead sheet + one tab per vendor + Unmatched tab, using the same overrides
  // currently applied in this mapper (a real Excel workbook — plain CSV has no tabs).
  async function exportVendorWorkbook(btn) {
    const mid = matterId();
    if (!mid) { setNote('No matter selected.'); return; }
    const originalLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Building workbook…'; }
    try {
      const response = await fetch(`${API_BASE}/matters/${mid}/documents/expense-workbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: userMappings }),
      });
      if (!response.ok) throw new Error('Workbook export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `expense-workbook-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      setNote('✓ Exported vendor workbook: lead sheet totals, one tab per vendor, and an Unmatched tab.');
    } catch (error) {
      setNote('Could not export the vendor workbook. Is the backend running on :3000?');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    }
  }

  function exportReconCSV() {
    const { lineTotals, offForm, unmapped, flagged } = computeMapping();
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = [['AFI Line', 'Category', 'Total', 'Monthly', 'Rows']];
    AFI_LINES.forEach(({ line, label }) => {
      const agg = lineTotals[line];
      if (agg) rows.push([line, q(label), agg.total.toFixed(2), (agg.total / statementMonths()).toFixed(2), agg.rows]);
    });
    Object.keys(offForm).forEach((code) => {
      const agg = offForm[code];
      const sec = T.sectionFor(code);
      rows.push([q(sec ? 'Section ' + (sec.afiSection || sec.label) : ''), q(T.labelFor(code) + ' (no box on 8-line form)'),
        agg.total.toFixed(2), (agg.total / statementMonths()).toFixed(2), agg.rows]);
    });
    rows.push([]);
    rows.push(['Flagged Merchant (suggested - needs review)', 'Suggested Category', 'Rows', 'Amount']);
    Object.keys(flagged).forEach((mk) => rows.push([q(mk), q(T.labelFor(flagged[mk].code)), flagged[mk].rows, flagged[mk].amount.toFixed(2)]));
    rows.push([]);
    rows.push(['Unmapped Merchant', 'Rows', 'Amount']);
    Object.keys(unmapped).forEach((mk) => rows.push([q(mk), unmapped[mk].rows, unmapped[mk].amount.toFixed(2)]));

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
    const workbookBtn = document.getElementById('afiExportWorkbookBtn');
    if (workbookBtn) workbookBtn.addEventListener('click', () => exportVendorWorkbook(workbookBtn));

    // hide the now-unused CSV file input
    const fi = document.getElementById('afiMapCsvInput');
    if (fi) fi.style.display = 'none';

    // auto-load if a matter is already selected
    if (matterId()) loadTransactions();
    window.addEventListener('matterSelected', loadTransactions);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
