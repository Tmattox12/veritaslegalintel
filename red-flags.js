// Red Flags & Data Audit: a working view for the legal team and a judge
// summary built from the same findings. Findings and report wording are saved
// per matter on the server (/api/matters/:id/red-flags); nothing about a case is
// written into this file.
(function () {
  const SEV = [
    { key: 'critical', label: 'Critical', group: 'Critical issues' },
    { key: 'high', label: 'High', group: 'High priority' },
    { key: 'medium', label: 'Medium', group: 'Medium priority' },
    { key: 'low', label: 'Low', group: 'Low priority' },
    { key: 'on_file', label: 'On file', group: 'Documents on file (verified)' },
  ];
  const CAT = [
    { key: 'disclosure', label: 'Disclosure & missing documents' },
    { key: 'income', label: 'Income & earning capacity' },
    { key: 'spending', label: 'Spending & lifestyle' },
    { key: 'expert', label: 'Expert opinions & budgets' },
    { key: 'conduct', label: 'Conduct & court-order compliance' },
    { key: 'other', label: 'Other' },
  ];
  const sevRank = Object.fromEntries(SEV.map((s, i) => [s.key, i]));
  const sevLabel = Object.fromEntries(SEV.map((s) => [s.key, s.label]));
  const catLabel = Object.fromEntries(CAT.map((c) => [c.key, c.label]));

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const matterId = () => window.VeritasMatter && window.VeritasMatter.id;
  const api = (p) => `${window.API_BASE}/matters/${encodeURIComponent(matterId())}/${p}`;

  let findings = [];
  let report = {};
  let auto = null;
  let sevFilter = '';
  let loadSeq = 0;

  function status(msg, isErr) {
    const el = $('rfStatus');
    el.hidden = !msg;
    el.textContent = msg || '';
    el.style.color = isErr ? 'var(--red)' : '';
  }

  async function call(method, path, body) {
    const r = await fetch(api(path), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }

  // ---------- loading ----------
  async function load() {
    const seq = ++loadSeq;
    if (!matterId()) { findings = []; report = {}; auto = null; render(); return; }
    status('');
    try {
      const d = await call('GET', 'red-flags');
      if (seq !== loadSeq) return;
      findings = d.findings || [];
      report = d.report || {};
    } catch (e) {
      if (seq !== loadSeq) return;
      findings = []; report = {};
      status('Could not load red flags. The Veritas server may be offline; nothing has been lost.', true);
    }
    render();
    try {
      const g = await call('GET', 'documents/gap-analysis');
      if (seq !== loadSeq) return;
      auto = g;
    } catch (e) { if (seq === loadSeq) auto = { error: true }; }
    renderAuto();
    renderMissing();
  }

  // ---------- helpers ----------
  const party = () => {
    const n = (window.VeritasMatter && window.VeritasMatter.partyNames) || { a: 'Party A', b: 'Party B' };
    const l = (window.VeritasMatter && window.VeritasMatter.partyLabels) || { a: 'Petitioner', b: 'Respondent' };
    return { n, l };
  };
  const sortFlags = (list) => list.slice().sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || (a.sortOrder - b.sortOrder));
  const fmtDate = (iso) => {
    const d = iso ? new Date(iso + 'T12:00:00') : new Date();
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  function visible() {
    const cat = $('fCategory').value;
    const st = $('fStatus').value;
    const needle = $('fSearch').value.trim().toLowerCase();
    return findings.filter((f) => {
      if (sevFilter && f.severity !== sevFilter) return false;
      if (cat && f.category !== cat) return false;
      if (st && f.status !== st) return false;
      if (needle) {
        const hay = [f.title, f.headline, f.detail, f.impact, f.action, f.request, f.source, ...(f.facts || []).map((x) => `${x.label} ${x.value}`)].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  // ---------- working view ----------
  function render() {
    renderStats();
    renderGroups();
    renderRecs();
    renderCatTable();
    renderMissing();
    renderJudge();
  }

  function renderStats() {
    const open = findings.filter((f) => f.status === 'open');
    $('stats').innerHTML = SEV.map((s) => {
      const n = (s.key === 'on_file' ? findings : open).filter((f) => f.severity === s.key).length;
      return `<button type="button" class="stat ${s.key}${sevFilter === s.key ? ' on' : ''}" data-sev="${s.key}">
        <div class="n">${n}</div><div class="l">${esc(s.key === 'on_file' ? 'On file' : s.label + ' open')}</div></button>`;
    }).join('');
  }

  function factsHtml(f) {
    if (!f.facts || !f.facts.length) return '';
    return `<div class="facts">${f.facts.map((x) => `<div class="fact"><div class="k">${esc(x.label)}</div><div class="v">${esc(x.value)}</div></div>`).join('')}</div>`;
  }

  function flagHtml(f, idx, list) {
    const prev = list[idx - 1], next = list[idx + 1];
    return `<article class="rf-flag ${f.severity}${f.status === 'resolved' ? ' resolved' : ''}" data-id="${esc(f.id)}">
      <div class="flag-head">
        <span class="badge ${f.severity}">${esc(sevLabel[f.severity])}</span>
        <span class="flag-title">${esc(f.title)}</span>
        ${f.headline ? `<span class="flag-headline">${esc(f.headline)}</span>` : ''}
      </div>
      ${f.detail ? `<div class="flag-body">${esc(f.detail)}</div>` : ''}
      ${factsHtml(f)}
      ${f.impact ? `<div class="box impact"><b>Impact</b>${esc(f.impact)}</div>` : ''}
      ${f.action ? `<div class="box action"><b>Red flag / action</b>${esc(f.action)}</div>` : ''}
      ${f.request ? `<div class="box request"><b>Request</b>${esc(f.request)}</div>` : ''}
      <div class="flag-foot">
        <span class="badge cat">${esc(catLabel[f.category] || f.category)}</span>
        ${f.status === 'resolved' ? '<span class="badge resolved">Resolved</span>' : ''}
        ${f.source ? `<span>Source: ${esc(f.source)}</span>` : ''}
        <span class="spacer"></span>
        <label class="chk no-print"><input type="checkbox" data-act="summary" ${f.inSummary ? 'checked' : ''} ${f.severity === 'on_file' ? 'disabled' : ''}/> In judge summary</label>
        <button type="button" class="mini no-print" data-act="up" ${prev && prev.severity === f.severity ? '' : 'disabled'} aria-label="Move up">↑</button>
        <button type="button" class="mini no-print" data-act="down" ${next && next.severity === f.severity ? '' : 'disabled'} aria-label="Move down">↓</button>
        <button type="button" class="mini no-print" data-act="toggle">${f.status === 'resolved' ? 'Reopen' : 'Resolve'}</button>
        <button type="button" class="mini no-print" data-act="edit">Edit</button>
        <button type="button" class="mini danger no-print" data-act="delete">Delete</button>
      </div>
    </article>`;
  }

  function renderGroups() {
    const el = $('groups');
    if (!matterId()) { el.innerHTML = '<div class="empty">Select a client to see their red flags.</div>'; $('fCount').textContent = ''; return; }
    if (!findings.length) {
      el.innerHTML = '<div class="empty">No red flags written up yet. Click <b>+ Add red flag</b>, or add one from the automatic checks below.</div>';
      $('fCount').textContent = '';
      return;
    }
    const list = sortFlags(visible());
    $('fCount').textContent = list.length < findings.length ? `${list.length} of ${findings.length} shown` : `${findings.length} total`;
    if (!list.length) { el.innerHTML = '<div class="empty">No red flags match these filters.</div>'; return; }
    el.innerHTML = SEV.map((s) => {
      const items = list.filter((f) => f.severity === s.key);
      if (!items.length) return '';
      return `<section class="sev-group"><h3><span class="badge ${s.key}">${items.length}</span>${esc(s.group)}</h3>
        ${items.map((f, i) => flagHtml(f, i, items)).join('')}</section>`;
    }).join('');
  }

  function renderRecs() {
    const recs = report.recommendations || [];
    $('recsWork').innerHTML = recs.length
      ? `<ol class="recs">${recs.map((r) => `<li>${r.title ? `<b>${esc(r.title)}.</b> ` : ''}${esc(r.text)}</li>`).join('')}</ol>`
      : '<div class="empty">No recommended actions yet. Click <b>Edit</b> to add them; they also appear in the judge summary.</div>';
  }

  function renderCatTable() {
    const open = findings.filter((f) => f.status === 'open' && f.severity !== 'on_file');
    const rows = CAT.map((c) => {
      const items = sortFlags(open.filter((f) => f.category === c.key));
      if (!items.length) return '';
      const top = items[0].severity;
      return `<tr><td><b>${esc(c.label)}</b></td><td>${items.length}</td><td>${items.map((f) => esc(f.title)).join('; ')}</td><td><span class="badge ${top}">${esc(sevLabel[top])}</span></td></tr>`;
    }).join('');
    $('catTable').innerHTML = rows
      ? `<table class="rf"><thead><tr><th>Category</th><th>Open</th><th>Issues</th><th>Highest</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">No open red flags.</div>';
  }

  function renderMissing() {
    const el = $('missingList');
    const rows = sortFlags(findings.filter((f) => f.status === 'open' && f.request && f.severity !== 'on_file'))
      .map((f) => ({ sev: f.severity, doc: f.title, req: f.request, impact: f.headline || '' }));
    if (auto && !auto.error) {
      (auto.missingRequiredDocs || []).forEach((d) => rows.push({ sev: 'high', doc: d.label, req: 'Required document type not found in discovery', impact: 'Automatic check' }));
    }
    el.innerHTML = rows.length
      ? `<table class="rf"><thead><tr><th>#</th><th>Document</th><th>Request</th><th>Key figure</th></tr></thead><tbody>${rows.map((r, i) =>
          `<tr><td><span class="badge ${r.sev}">${i + 1}</span></td><td><b>${esc(r.doc)}</b></td><td>${esc(r.req)}</td><td>${esc(r.impact)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Nothing outstanding. Add a "Document to request" to a red flag to list it here.</div>';
  }

  function renderAuto() {
    const sumEl = $('autoSummary'), listEl = $('autoList');
    $('rfpWrap').hidden = true;
    if (!matterId()) { sumEl.innerHTML = ''; listEl.innerHTML = ''; return; }
    if (!auto) { sumEl.innerHTML = '<div class="rf-note">Checking documents…</div>'; listEl.innerHTML = ''; return; }
    if (auto.error) { sumEl.innerHTML = '<div class="rf-note" style="color:var(--red)">Automatic checks unavailable. The Veritas server may be offline.</div>'; listEl.innerHTML = ''; return; }
    const items = [];
    (auto.missingRequiredDocs || []).forEach((d) => items.push({
      sev: 'high', title: `Missing: ${d.label}`, text: 'Required under Rule 49 but not found in discovery.',
      seed: { severity: 'high', category: 'disclosure', title: `${d.label} not produced`, detail: `${d.label} is a required disclosure but was not found in the documents produced.`, request: d.label },
    }));
    (auto.statementGaps || []).forEach((g) => items.push({
      sev: 'medium', title: `Statement gap: ${g.account}`, text: `${g.after} → ${g.before}; missing ${(g.missingMonths || []).join(', ')}`,
      seed: { severity: 'medium', category: 'disclosure', title: `Statement gap — ${g.account}`, headline: `${(g.missingMonths || []).length} month(s) missing`,
        detail: `Statements for ${g.account} skip from ${g.after} to ${g.before}.`, facts: [{ label: 'Missing', value: (g.missingMonths || []).join(', ') }],
        request: `${g.account} statements for ${(g.missingMonths || []).join(', ')}` },
    }));
    (auto.thinCoverage || []).forEach((t) => items.push({
      sev: 'low', title: `Only one statement: ${t.account}`, text: `Only ${t.onlyMonth} is on file.`,
      seed: { severity: 'low', category: 'disclosure', title: `Limited statement history — ${t.account}`, detail: `Only one statement (${t.onlyMonth}) is on file for ${t.account}.`, request: `${t.account} statements for the full review period` },
    }));
    sumEl.innerHTML = `<div class="rf-note"><b>${items.length}</b> item(s) · <b>${auto.requiredDocsPresent ?? 0}/${auto.requiredDocsTotal ?? 0}</b> required document types present · <b>${auto.totalStatements ?? 0}</b> statements across <b>${auto.accounts ?? 0}</b> account(s).</div>`;
    listEl.innerHTML = items.length
      ? items.map((it, i) => `<div class="auto-card"><span class="badge ${it.sev}">${esc(sevLabel[it.sev])}</span><div class="t"><b>${esc(it.title)}</b><br/>${esc(it.text)}</div><button type="button" class="mini" data-seed="${i}">Add as red flag</button></div>`).join('')
      : '<div class="empty">No gaps detected. All required document types are present and statement coverage is continuous.</div>';
    listEl._seeds = items.map((it) => it.seed);
    $('rfpWrap').hidden = !items.length;
  }

  // ---------- judge summary ----------
  function renderJudge() {
    const el = $('judge');
    const m = (window.VeritasMatter && window.VeritasMatter.matter) || {};
    if (!matterId()) { el.innerHTML = '<div class="j-empty">Select a client to build the summary.</div>'; return; }
    const { n, l } = party();
    const inc = sortFlags(findings.filter((f) => f.status === 'open' && f.inSummary && f.severity !== 'on_file'));
    const crit = inc.filter((f) => f.severity === 'critical');
    const high = inc.filter((f) => f.severity === 'high');
    const rest = inc.filter((f) => f.severity === 'medium' || f.severity === 'low');
    const court = m.court || [m.state ? `Superior Court of ${m.state}` : 'Superior Court', m.county ? `${m.county} County` : ''].filter(Boolean).join(', ');
    const caption = m.name || m.client_name || 'Case';
    const subj = report.subjectParty ? `${l[report.subjectParty]} (${n[report.subjectParty]})` : '';
    const intro = report.intro || `This summary identifies deficiencies in ${subj ? subj + "'s" : 'the'} disclosures, undisclosed or unverified assets, material contradictions in the record, and related conduct issues.`;
    const dateStr = fmtDate(report.reportDate);
    const req = inc.filter((f) => f.request).length;

    const findCard = (f, i) => `<div class="j-find ${f.severity}"><h4>${i != null ? `${i + 1}. ` : ''}${esc(f.title)}${f.headline ? ` — ${esc(f.headline)}` : ''}</h4>
      ${f.detail ? `<p><b>Finding:</b> ${esc(f.detail)}</p>` : ''}
      ${f.impact ? `<div class="j-impact">IMPACT: ${esc(f.impact)}</div>` : ''}</div>`;

    const bySection = CAT.map((c) => {
      const items = rest.filter((f) => f.category === c.key);
      return items.length ? `<div class="j-sec"><div class="j-title">${esc(c.label)}</div>${items.map((f) => findCard(f)).join('')}</div>` : '';
    }).join('');

    const recs = report.recommendations || [];
    el.innerHTML = `
      <div class="j-head"><h1>RED FLAGS SUMMARY</h1>
        <div class="j-cap">${esc(caption)}</div>
        <div class="j-court">${esc(court)}${m.case_no ? ` | No. ${esc(m.case_no)}` : ''}</div>
        <div class="j-court" style="margin-top:10px;font-size:12px;">${esc(dateStr)}</div></div>
      <div class="j-body">
        <div class="j-sum"><h3>Disclosure, credibility &amp; conduct issues</h3><p>${esc(intro)}</p>
          <div class="j-tiles">
            <div class="j-tile"><strong>Critical issues</strong><div>${crit.length}</div></div>
            <div class="j-tile"><strong>High priority</strong><div>${high.length}</div></div>
            <div class="j-tile"><strong>Other issues</strong><div>${rest.length}</div></div>
            <div class="j-tile"><strong>Documents requested</strong><div>${req}</div></div>
          </div></div>
        ${!inc.length ? '<div class="j-empty">No open red flags are marked "In judge summary" yet.</div>' : ''}
        ${crit.length ? `<div class="j-sec"><div class="j-title">Critical findings</div>${crit.map((f, i) => findCard(f, i)).join('')}</div>` : ''}
        ${high.length ? `<div class="j-sec"><div class="j-title">High priority discrepancies</div>
          <table class="j-tbl"><thead><tr><th>Issue</th><th>Key figure</th><th>Impact</th></tr></thead><tbody>
          ${high.map((f) => `<tr><td><b>${esc(f.title)}</b>${f.detail ? `<br/>${esc(f.detail)}` : ''}</td><td><span class="j-key">${esc(f.headline || '—')}</span></td><td>${esc(f.impact || f.action || '')}</td></tr>`).join('')}
          </tbody></table></div>` : ''}
        ${bySection}
        ${report.conclusionTitle || report.conclusionText ? `<div class="j-verdict"><div class="lbl">${esc(report.conclusionLabel || 'Summary conclusion')}</div>
          ${report.conclusionTitle ? `<div class="ttl">${esc(report.conclusionTitle)}</div>` : ''}${report.conclusionText ? `<p>${esc(report.conclusionText)}</p>` : ''}</div>` : ''}
        ${recs.length ? `<div class="j-sec"><div class="j-title">Recommended court actions</div><ol class="j-recs">${recs.map((r) => `<li>${r.title ? `<b>${esc(r.title)}:</b> ` : ''}${esc(r.text)}</li>`).join('')}</ol></div>` : ''}
      </div>
      <div class="j-foot">${esc(caption)}${m.case_no ? ` | No. ${esc(m.case_no)}` : ''}${court ? ` | ${esc(court)}` : ''}<br/>Red Flags Summary | ${esc(dateStr)}${report.periodReviewed ? ` | Period reviewed: ${esc(report.periodReviewed)}` : ''}</div>`;
  }

  // ---------- finding editor ----------
  let editing = null;
  function factRow(f) {
    const row = document.createElement('div');
    row.className = 'fact-row';
    row.innerHTML = `<input class="fl" maxlength="300" placeholder="Label" value="${esc(f && f.label)}" /><input class="fv" maxlength="300" placeholder="Value" value="${esc(f && f.value)}" /><button type="button" class="rm" aria-label="Remove">×</button>`;
    row.querySelector('.rm').onclick = () => row.remove();
    $('eFacts').appendChild(row);
  }
  function openFlag(f) {
    editing = f && f.id ? f.id : null;
    const d = f || {};
    $('dlgFlagTitle').textContent = editing ? 'Edit red flag' : 'New red flag';
    $('eTitle').value = d.title || '';
    $('eSeverity').value = d.severity || 'high';
    $('eCategory').value = d.category || 'disclosure';
    $('eHeadline').value = d.headline || '';
    $('eDetail').value = d.detail || '';
    $('eImpact').value = d.impact || '';
    $('eAction').value = d.action || '';
    $('eRequest').value = d.request || '';
    $('eSource').value = d.source || '';
    $('eStatus').value = d.status || 'open';
    $('eInSummary').checked = d.inSummary !== false;
    $('eFacts').innerHTML = '';
    (d.facts || []).forEach(factRow);
    $('eErr').textContent = '';
    $('dlgFlag').showModal();
    $('eTitle').focus();
  }
  async function saveFlag() {
    const body = {
      title: $('eTitle').value, severity: $('eSeverity').value, category: $('eCategory').value,
      headline: $('eHeadline').value, detail: $('eDetail').value, impact: $('eImpact').value,
      action: $('eAction').value, request: $('eRequest').value, source: $('eSource').value,
      status: $('eStatus').value, inSummary: $('eInSummary').checked,
      facts: [...$('eFacts').querySelectorAll('.fact-row')].map((r) => ({ label: r.querySelector('.fl').value, value: r.querySelector('.fv').value })),
    };
    if (!body.title.trim()) { $('eErr').textContent = 'Title is required.'; return false; }
    $('eSave').disabled = true;
    try {
      const saved = editing ? await call('PUT', `red-flags/findings/${encodeURIComponent(editing)}`, body) : await call('POST', 'red-flags/findings', body);
      const i = findings.findIndex((x) => x.id === saved.id);
      if (i >= 0) findings[i] = saved; else findings.push(saved);
      render();
      return true;
    } catch (e) { $('eErr').textContent = e.message; return false; }
    finally { $('eSave').disabled = false; }
  }

  // ---------- report editor ----------
  function recRow(r) {
    const row = document.createElement('div');
    row.className = 'rec-row';
    row.innerHTML = `<input class="rt" maxlength="300" placeholder="Short title" value="${esc(r && r.title)}" /><textarea class="rx" placeholder="What to ask the court for, and why">${esc(r && r.text)}</textarea><button type="button" class="rm" aria-label="Remove">×</button>`;
    row.querySelector('.rm').onclick = () => row.remove();
    $('rRecs').appendChild(row);
  }
  function openReport() {
    const { n } = party();
    $('rSubjA').textContent = n.a; $('rSubjB').textContent = n.b;
    $('rSubject').value = report.subjectParty || '';
    $('rDate').value = report.reportDate || '';
    $('rPeriod').value = report.periodReviewed || '';
    $('rIntro').value = report.intro || '';
    $('rConcLabel').value = report.conclusionLabel || '';
    $('rConcTitle').value = report.conclusionTitle || '';
    $('rConcText').value = report.conclusionText || '';
    $('rRecs').innerHTML = '';
    (report.recommendations || []).forEach(recRow);
    $('rErr').textContent = '';
    $('dlgReport').showModal();
  }
  async function saveReport() {
    const body = {
      subjectParty: $('rSubject').value, reportDate: $('rDate').value, periodReviewed: $('rPeriod').value,
      intro: $('rIntro').value, conclusionLabel: $('rConcLabel').value, conclusionTitle: $('rConcTitle').value,
      conclusionText: $('rConcText').value,
      recommendations: [...$('rRecs').querySelectorAll('.rec-row')].map((r) => ({ title: r.querySelector('.rt').value, text: r.querySelector('.rx').value })),
    };
    $('rSave').disabled = true;
    try { report = await call('PUT', 'red-flags/report', body); render(); return true; }
    catch (e) { $('rErr').textContent = e.message; return false; }
    finally { $('rSave').disabled = false; }
  }

  // Keeps the dialog open when a save fails.
  function wireDialog(dlg, form, save) {
    form.addEventListener('submit', async (e) => {
      if (e.submitter && e.submitter.value === 'cancel') return;
      e.preventDefault();
      if (await save()) dlg.close();
    });
  }

  // ---------- actions on a finding ----------
  async function onFlagAction(e) {
    const btn = e.target.closest('[data-act]');
    const card = e.target.closest('.rf-flag');
    if (!btn || !card) return;
    const f = findings.find((x) => x.id === card.dataset.id);
    if (!f) return;
    const act = btn.dataset.act;
    try {
      if (act === 'edit') return openFlag(f);
      if (act === 'delete') {
        if (!confirm(`Delete "${f.title}"? This cannot be undone.`)) return;
        await call('DELETE', `red-flags/findings/${encodeURIComponent(f.id)}`);
        findings = findings.filter((x) => x.id !== f.id);
      } else if (act === 'toggle') {
        Object.assign(f, await call('PUT', `red-flags/findings/${encodeURIComponent(f.id)}`, { status: f.status === 'resolved' ? 'open' : 'resolved' }));
      } else if (act === 'summary') {
        Object.assign(f, await call('PUT', `red-flags/findings/${encodeURIComponent(f.id)}`, { inSummary: btn.checked }));
      } else if (act === 'up' || act === 'down') {
        const same = sortFlags(findings.filter((x) => x.severity === f.severity));
        const i = same.indexOf(f), j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= same.length) return;
        // Renumber the group so equal sort orders can still be swapped.
        [same[i], same[j]] = [same[j], same[i]];
        await Promise.all(same.map((x, k) => {
          const so = (k + 1) * 10;
          if (x.sortOrder === so) return null;
          x.sortOrder = so;
          return call('PUT', `red-flags/findings/${encodeURIComponent(x.id)}`, { sortOrder: so });
        }));
      }
      status('');
    } catch (err) { status(`Could not save: ${err.message}`, true); }
    render();
  }

  // ---------- RFP ----------
  async function genRfp() {
    const out = $('rfpOutput');
    out.innerHTML = '<div class="rf-note">Drafting…</div>';
    try {
      const d = await call('GET', 'documents/rfp');
      if (!d.success) throw new Error(d.error || 'failed');
      out.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;"><b style="flex:1">Request for Production (${d.itemCount} item${d.itemCount === 1 ? '' : 's'})</b>
        <button class="mini" id="rfpCopy" type="button">Copy</button><button class="mini" id="rfpDocx" type="button">Download Word (.docx)</button></div>
        <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:13px;line-height:1.6;background:#fafaf7;padding:14px;border-radius:6px;border:1px solid var(--line);margin:0">${esc(d.rfp)}</pre>`;
      $('rfpCopy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(d.rfp);
      $('rfpDocx').onclick = () => { location.href = api('documents/rfp.docx'); };
    } catch (e) { out.innerHTML = '<div class="rf-note" style="color:var(--red)">Could not draft the request. The Veritas server may be offline.</div>'; }
  }

  // ---------- wiring ----------
  function setView(v) {
    document.querySelectorAll('.rf-tab').forEach((t) => t.classList.toggle('on', t.dataset.view === v));
    $('viewWork').hidden = v !== 'work';
    $('viewJudge').hidden = v !== 'judge';
    try { sessionStorage.setItem('veritas.redflags.view', v); } catch (e) { /* ignore */ }
  }

  function init() {
    $('eSeverity').innerHTML = SEV.map((s) => `<option value="${s.key}">${esc(s.label)}</option>`).join('');
    $('eCategory').innerHTML = CAT.map((c) => `<option value="${c.key}">${esc(c.label)}</option>`).join('');
    $('fCategory').innerHTML += CAT.map((c) => `<option value="${c.key}">${esc(c.label)}</option>`).join('');

    document.querySelectorAll('.rf-tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
    let v = 'work';
    try { v = sessionStorage.getItem('veritas.redflags.view') || 'work'; } catch (e) { /* ignore */ }
    if (location.hash === '#judge') v = 'judge';
    setView(v === 'judge' ? 'judge' : 'work');

    $('stats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sev]'); if (!b) return;
      sevFilter = sevFilter === b.dataset.sev ? '' : b.dataset.sev;
      if (b.dataset.sev === 'on_file' && sevFilter) $('fStatus').value = '';
      renderStats(); renderGroups();
    });
    ['fCategory', 'fStatus'].forEach((id) => $(id).addEventListener('change', renderGroups));
    $('fSearch').addEventListener('input', renderGroups);
    $('groups').addEventListener('click', onFlagAction);
    $('groups').addEventListener('change', (e) => { if (e.target.matches('[data-act="summary"]')) onFlagAction(e); });
    $('autoList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-seed]'); if (!b) return;
      const seed = ($('autoList')._seeds || [])[Number(b.dataset.seed)];
      if (seed) openFlag(seed);
    });

    $('rfAdd').addEventListener('click', () => { if (matterId()) openFlag(null); });
    $('eAddFact').addEventListener('click', () => factRow(null));
    $('rAddRec').addEventListener('click', () => recRow(null));
    $('editReport').addEventListener('click', () => { if (matterId()) openReport(); });
    $('editReport2').addEventListener('click', () => { if (matterId()) openReport(); });
    $('genRfpBtn').addEventListener('click', genRfp);
    $('rfPrint').addEventListener('click', () => window.print());
    wireDialog($('dlgFlag'), $('formFlag'), saveFlag);
    wireDialog($('dlgReport'), $('formReport'), saveReport);

    window.addEventListener('veritas:matter', load);
    if (window.VeritasMatter && window.VeritasMatter.matter) load();
    else render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
