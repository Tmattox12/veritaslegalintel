// Reconciliation on every number. matter-context.js loads this on every page.
//
// Finds each figure on the page (dollars, percents, counts, numeric fields) and
// makes it open one standard recon: line items, summary, how it was calculated,
// source documents with links and summaries. The recon recomputes the figure and
// compares it with what is displayed, and says plainly when it does not tie.
//
// A page describes its figures in recon-providers/<page>.js:
//
//   VeritasRecon.define({
//     byId: { someElementId: (ctx) => recon },         // element or an ancestor has this id
//     match: [{ selector: '.css', label: /regex/, recon: (ctx) => recon }],  // first match wins
//     cards: [{ selector: '.card', recon: (ctx) => recon }],  // adds a "View recon" button to each card
//     inert: ['.css'],                                 // not figures: row numbers, step numbers
//   });
//
// A recon function may be async and returns (all fields optional):
//   title     heading
//   metric    server metric key, or [key, {params}]; its rows, calc, sources and value are merged in
//   valueFrom 'amount' | 'count': use that alternate value from the metric
//   value     the figure recomputed from its inputs, in the units displayed (percent as 21.0, not .21)
//   columns   [{ key, label, money, align }]   rows  [{ ..., documentId }]
//   summary   { label: value }                 calc  ['step', ...]
//   inputs    [{ label, value, origin }]  origin: entered | intake | document | module | court | reference | default
//   documentIds [id, ...]                      sources [{ filename, summary, url, contribution }]
//   status    only for figures that are not calculated: reference | entered | nodata | text | nottied | explained
//   note      extra sentence shown under the status
// Return null to fall through to the next definition.
//
// ctx: el, text, after and before (text beside the figure), displayed {value, decimals, kind}, label, id, row (tr), matterId, matter, names, labels,
//      num(selector) number from a field or text, txt(selector), money(n), json(path) cached GET under the matter.
(function () {
  if (window.VeritasRecon) return;
  const PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const AUDIT = /[?&]reconAudit=1\b/.test(location.search);

  const defs = { byId: {}, match: [], cards: [], inert: [] };
  const SKIP = 'script,style,noscript,textarea,select,option,input,svg,canvas,dialog,.sidebar,.topbar,nav,thead,th,title,h1,code,'
    + '[data-no-recon],#vrModal,#veritasTimeChip,#veritasTimeChip *,.vr-num,.vr-info,.vr-card-btn,.vr-pill,[class*="ai-chat"],#vrAuditResult,[data-party-box]';
  const PROSE = 'p,li,small,label,.hint,.sub,.note,.rf-note,.panel-note,.callout,.tag,.subtitle,.desc,.description,blockquote,summary,h2,h3,h4,h5';
  const INTERACTIVE = 'a,button,label,summary,[onclick],[role=button]';
  const NOUNS = 'documents?|statements?|transactions?|months?|unclassified|accepted|approved|active|AFI|categor(?:y|ies)|docs?|sh|tx|mo|items?|accounts?|sources?|deposits?|years?|yrs?|mins?|minutes?|hours?|hrs?|children|child|days?|checks?|pages?|rows?|issues?|flags?|shares?|units?|tranches?|periods?|weeks?';
  const NUM_RE = new RegExp(
    '\\(?[-−+]?\\$\\s?[-−]?\\d[\\d,]*(?:\\.\\d+)?(?:\\s?[KkMm](?![a-zA-Z]))?\\)?'
    + '|(?<![\\d.,$])[-−+]?\\d+(?:\\.\\d+)?\\s?%'
    + '|(?<![\\d.,$/-])(?<!\\b(?:Table|Section|Rule|Form|Schedule|Step|Part|Exhibit|Line|Tab|Phase|Box|Article|Chapter|Tier|Level|Option|Scenario|No\\.|§)\\s)\\d[\\d,]*(?:\\.\\d+)?(?=[\\s-]+(?:' + NOUNS + ')\\b)'
    + '|(?<=[A-Za-z)]:\\s)\\d[\\d,]*(?:\\.\\d+)?(?=\\s*$|\\s*[·|;,])'
    + '|(?<![\\d.,$/-])\\d[\\d,]*(?=\\s+(?:of|/)\\s+\\d)'
    + '|(?<=\\d\\s(?:of|/)\\s)\\d[\\d,]*(?![\\d/])', 'g');
  const BARE_RE = /^\(?[-−+]?\d[\d,]*(?:\.\d+)?\)?$/;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (Number(n) < 0 ? '-' : '') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const matterId = () => window.VeritasMatter && window.VeritasMatter.id;
  const base = () => `${window.API_BASE}/matters/${encodeURIComponent(matterId())}`;

  function parseDisplayed(text) {
    const t = String(text).trim();
    const kind = t.includes('$') ? 'money' : t.includes('%') ? 'percent' : 'number';
    const m = t.replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?:\s?([KkMm])(?![a-zA-Z]))?/);
    if (!m) return null;
    const scale = /k/i.test(m[2] || '') ? 1e3 : /m/i.test(m[2] || '') ? 1e6 : 1;
    const decimals = (m[1].split('.')[1] || '').length;
    return { kind, value: Number(m[1]) * scale, raw: Number(m[1]), scale, decimals, negative: /^[(\-−]|\$\s?[-−]/.test(t) };
  }

  // ---------- finding figures ----------
  const inertSel = () => defs.inert.join(',');
  function isYearOrDate(text, parentText) {
    const v = text.replace(/[(),\s]/g, '');
    if (/^(19|20)\d\d$/.test(v)) return true;
    return /^\d{1,2}$/.test(v) && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(parentText || '');
  }

  function wrapNode(node, ranges) {
    const frag = document.createDocumentFragment();
    const s = node.nodeValue;
    let at = 0;
    const parent = node.parentElement;
    const inert = !!parent.closest(INTERACTIVE);
    ranges.forEach(([from, to]) => {
      if (from > at) frag.appendChild(document.createTextNode(s.slice(at, from)));
      const span = document.createElement('span');
      span.className = 'vr-num' + (inert ? ' vr-inert' : '');
      span.textContent = s.slice(from, to);
      if (!inert) { span.tabIndex = 0; span.setAttribute('role', 'button'); span.title = 'View recon'; }
      frag.appendChild(span);
      if (inert) {
        const i = document.createElement('span');
        i.className = 'vr-info'; i.textContent = 'ⓘ'; i.tabIndex = 0; i.setAttribute('role', 'button');
        i.setAttribute('aria-label', 'View recon'); i.title = 'View recon';
        frag.appendChild(i);
      }
      at = to;
    });
    if (at < s.length) frag.appendChild(document.createTextNode(s.slice(at)));
    node.parentNode.replaceChild(frag, node);
  }

  function scan() {
    if (!document.body) return;
    observer.disconnect();
    const skipInert = inertSel();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !/\d/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest(SKIP) || (skipInert && p.closest(skipInert))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const work = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) work.push(n);
    work.forEach((n) => {
      const s = n.nodeValue;
      const trimmed = s.trim();
      const parent = n.parentElement;
      const sole = parent.childNodes.length === 1;
      if (sole && BARE_RE.test(trimmed) && !parent.closest('a,button,li') && !isYearOrDate(trimmed, '')) {
        const from = s.indexOf(trimmed);
        wrapNode(n, [[from, from + trimmed.length]]);
        return;
      }
      const ranges = [];
      NUM_RE.lastIndex = 0;
      for (let m = NUM_RE.exec(s); m; m = NUM_RE.exec(s)) ranges.push([m.index, m.index + m[0].length]);
      if (ranges.length) wrapNode(n, ranges);
    });
    addCardButtons();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  let timer = null;
  let lastChange = Date.now();
  const observer = new MutationObserver(() => {
    lastChange = Date.now();
    clearTimeout(timer);
    timer = setTimeout(scan, 200);
  });

  function addCardButtons() {
    defs.cards.forEach((c, idx) => {
      document.querySelectorAll(c.selector).forEach((card) => {
        if (card.querySelector(':scope > .vr-card-btn')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'vr-card-btn'; b.textContent = c.buttonLabel || 'View recon'; b.dataset.vrCard = idx;
        card.appendChild(b);
      });
    });
  }

  // ---------- label for a figure ----------
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const stripNums = (s) => clean(String(s).replace(/ⓘ/g, ''));
  function labelFor(el) {
    const td = el.closest('td');
    if (td && td.parentElement) {
      const cells = [...td.parentElement.children];
      const col = cells.indexOf(td);
      const table = td.closest('table');
      const head = table && table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[col];
      const first = stripNums(cells[0].textContent);
      const headText = head ? stripNums(head.textContent) : '';
      if (col > 0) return clean(`${first.slice(0, 60)}${headText ? ` · ${headText}` : ''}`);
      return first.slice(0, 80);
    }
    let cur = el.closest(':not(.vr-num)');
    for (let up = 0; cur && up < 5; up++, cur = cur.parentElement) {
      const own = stripNums(cur.textContent);
      if (up === 0 && own.length > el.textContent.length + 2 && own.length < 90) return own;
      const lab = cur.querySelector(':scope > label, :scope > [class*="label"], :scope > [class*="title"], :scope > [class*="lbl"], :scope > [class*="name"], :scope > h3, :scope > h4, :scope > h5, :scope > strong');
      if (lab && !lab.contains(el) && stripNums(lab.textContent)) return stripNums(lab.textContent).slice(0, 90);
      let prev = cur.previousElementSibling;
      if (prev && !prev.querySelector('.vr-num') && stripNums(prev.textContent) && stripNums(prev.textContent).length < 90) return stripNums(prev.textContent);
    }
    return stripNums((el.parentElement || el).textContent).slice(0, 90);
  }

  // ---------- evidence helpers ----------
  const jsonCache = new Map();
  function json(path) {
    const url = `${base()}/${String(path).replace(/^\//, '')}`;
    if (!jsonCache.has(url)) {
      jsonCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Could not load (${r.status})`)))));
    }
    return jsonCache.get(url);
  }
  function metric(spec) {
    const [key, params] = Array.isArray(spec) ? spec : [spec, null];
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return json(`recon/metric/${encodeURIComponent(key)}${qs}`);
  }
  async function lookup(items) {
    if (!matterId() || !items.length) return items.map(() => ({ matches: [], total: 0 }));
    const r = await fetch(`${base()}/recon/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
    return (await r.json()).results;
  }

  let pageSource = null;
  let rawSource = '';
  async function sourceText() {
    if (pageSource === null) {
      try {
        // Only text a reader sees in the page as written, not its code.
        const html = await (await fetch(location.pathname, { cache: 'force-cache' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
        pageSource = doc.body ? doc.body.textContent : '';
        rawSource = html;
      } catch (e) { pageSource = ''; }
    }
    return pageSource;
  }
  function inStaticText(src, text) {
    const squeeze = (x) => x.replace(/[\s()]+/g, '');
    const t = squeeze(text);
    return !!t && squeeze(src).includes(t);
  }

  // Text immediately after or before a figure, e.g. "months covered" after the 3 in "3 months covered".
  function textBeside(el, dir) {
    const out = [];
    for (let n = el[`${dir}Sibling`]; n && out.join(' ').length < 60; n = n[`${dir}Sibling`]) {
      if (n.nodeType === 1 && n.classList.contains('vr-info')) continue;
      out[dir === 'next' ? 'push' : 'unshift'](n.textContent);
    }
    return out.join(' ');
  }

  function makeCtx(el) {
    const vm = window.VeritasMatter || {};
    const isInput = el.matches && el.matches('input,select,textarea');
    const text = isInput ? el.value : clean(el.textContent);
    const read = (sel) => document.querySelector(sel);
    return {
      el, text, displayed: parseDisplayed(text), label: isInput ? inputLabel(el) : labelFor(el),
      after: isInput ? '' : clean(textBeside(el, 'next')), before: isInput ? '' : clean(textBeside(el, 'previous')),
      id: (el.closest('[id]') || {}).id || '', row: el.closest && el.closest('tr'),
      matterId: matterId(), matter: vm.matter || {}, names: vm.partyNames || { a: 'Party A', b: 'Party B' }, labels: vm.partyLabels || { a: 'Petitioner', b: 'Respondent' },
      money, json, metric,
      txt: (sel) => { const n = read(sel); return n ? clean(n.value != null && n.matches('input,select,textarea') ? n.value : n.textContent) : ''; },
      num: (sel) => { const n = read(sel); if (!n) return 0; const raw = n.matches('input,select,textarea') ? n.value : n.textContent; const p = parseFloat(String(raw).replace(/[^0-9.\-]/g, '')); return Number.isFinite(p) ? p : 0; },
    };
  }

  function inputLabel(el) {
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return stripNums(l.textContent); }
    const wrap = el.closest('label'); if (wrap) return stripNums(wrap.textContent);
    const box = el.parentElement;
    const lab = box && box.querySelector('label,[class*="label"]');
    if (lab && !lab.contains(el)) return stripNums(lab.textContent);
    const td = el.closest('td');
    if (td && td.parentElement) return stripNums(td.parentElement.cells[0].textContent).slice(0, 80);
    return el.getAttribute('aria-label') || el.placeholder || el.name || el.id || 'Entered value';
  }

  async function feedCount(ctx) {
    if (!ctx.el.closest('#discoveryAnalysisBridge')) return null;
    if (/^approved source/.test(ctx.after)) {
      const m = await metric('accepted-income');
      return { metric: 'accepted-income', title: 'Approved income sources', value: m.rows.length, format: 'count' };
    }
    if (/Income documents on file:$/.test(ctx.before)) return { metric: ['documents', { category: 'Tax Returns & Income' }] };
    return null;
  }

  function findDefinition(ctx) {
    const list = [feedCount];
    for (let n = ctx.el; n && n !== document.body; n = n.parentElement) {
      if (n.id && defs.byId[n.id]) list.push(defs.byId[n.id]);
    }
    defs.match.forEach((m) => {
      if (m.selector && !(ctx.el.closest && ctx.el.closest(m.selector))) return;
      if (m.label && !m.label.test(ctx.label)) return;
      list.push(m.recon);
    });
    return list;
  }

  // Rounds the recomputed value the way the figure is displayed, then compares.
  function ties(d, value) {
    if (Number(value) < 0 && !d.negative && Math.abs(Number(value)) >= 0.005) return false;
    const v = Math.abs(Number(value)) / d.scale;
    const f = Math.pow(10, d.decimals);
    return Math.abs(Math.round(v * f) / f - d.raw) < 0.5 / f + 1e-9;
  }

  async function finish(ctx, r) {
    const out = { ...r };
    if (out.metric) {
      const m = await metric(out.metric);
      Object.keys(m).forEach((k) => { if (out[k] == null) out[k] = m[k]; });
      if (out.valueFrom && m.altValues) out.value = m.altValues[out.valueFrom];
      if (out.format == null) out.format = m.format;
    }
    if (out.documentIds && out.documentIds.length) {
      const res = await fetch(`${base()}/recon/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: out.documentIds }) });
      if (res.ok) out.sources = (out.sources || []).concat((await res.json()).sources);
    }
    const rowDocs = (out.rows || []).some((x) => x.documentId);
    const hasDocs = (out.sources && out.sources.length) || rowDocs;
    const d = ctx.displayed;
    if (!out.status) {
      if (out.value != null && d) {
        if (!ties(d, out.value)) out.status = 'difference';
        else if (d.value === 0 && !(out.rows || []).length && !(out.inputs || []).some((i) => Number(i.value))) out.status = 'nodata';
        else out.status = hasDocs ? 'tied' : 'calculated';
      } else out.status = 'explained';
    }
    return out;
  }

  // Figures with no definition: say what is actually known about them.
  async function fallback(ctx, found) {
    const d = ctx.displayed;
    const isInput = ctx.el.matches('input,select,textarea');
    if (!d) return { status: 'explained' };
    if (d.value === 0) return { status: 'nodata', calc: ['This figure is zero because nothing has been entered or loaded for it yet.'] };
    if (isInput) {
      const hit = found || (await lookup([{ amount: d.value, decimals: d.decimals }]))[0];
      const rows = (hit.matches || []).map((x) => ({ ...x }));
      return { status: 'entered', note: rows.length ? `This amount also appears in ${hit.total} source record${hit.total === 1 ? '' : 's'} below, but the field is not linked to them.` : 'No source record in this matter shows this amount.',
        columns: rows.length ? MATCH_COLUMNS : null, rows, documentIds: [...new Set(rows.map((x) => x.documentId))], calc: ['This value is what is in the field. Veritas did not calculate it.'] };
    }
    const src = await sourceText();
    if (inStaticText(src, `${ctx.before.slice(-14)} ${ctx.text} ${ctx.after.slice(0, 14)}`)) {
      if (ctx.el.closest(PROSE)) return { status: 'text', calc: ['This number is part of the wording written on this page. It does not come from this client\'s records.'] };
      return { status: 'nottied', calc: ['This number is written directly into this page. It does not come from this client\'s records and has no source document.'] };
    }
    if (ctx.el.closest(PROSE) && inStaticText(rawSource, ctx.text)) return { status: 'text', calc: ['This number is part of the wording written on this page. It does not come from this client\'s records.'] };
    if (d.kind === 'money') {
      const hit = found || (await lookup([{ amount: d.value, decimals: d.decimals }]))[0];
      if (hit.total) {
        const rows = hit.matches;
        return { status: 'matched', note: hit.approximate ? 'Shown without cents, so this is matched within 50 cents.' : (hit.total > rows.length ? `Showing ${rows.length} of ${hit.total} matches.` : ''),
          columns: MATCH_COLUMNS, rows, documentIds: [...new Set(rows.map((x) => x.documentId))],
          calc: ['No calculation is on record for this figure, so Veritas searched this matter\'s source records for the same amount.', 'A match shows where the amount appears. It does not prove the figure was built from that record.'] };
      }
    }
    return { status: 'unexplained', calc: ['This page produced the figure, but no calculation is on record for it and the amount was not found in this matter\'s source records.'] };
  }

  const MATCH_COLUMNS = [{ key: 'kind', label: 'Found as' }, { key: 'date', label: 'Date' }, { key: 'description', label: 'Description' }, { key: 'filename', label: 'Document' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];

  async function resolve(el, found) {
    const ctx = makeCtx(el);
    const candidates = findDefinition(ctx);
    for (const fn of candidates) {
      const r = await fn(ctx);
      if (r) return { ctx, recon: await finish(ctx, r) };
    }
    return { ctx, recon: await finish(ctx, await fallback(ctx, found)) };
  }

  // ---------- the recon window ----------
  const STATUS = {
    tied: ['#e3f2ea', '#1f5a3f', '✓ Ties to source documents', 'Recalculated from the rows below; the result matches the figure on screen.'],
    calculated: ['#e8f0fa', '#1c3f66', '✓ Recalculated and ties', 'The math matches the figure on screen. Its inputs are listed below; no source document is attached to this figure.'],
    matched: ['#fff6e0', '#7a5a0c', 'Amount found in source records', ''],
    difference: ['#fbe7e2', '#8e2417', '✗ Does not tie', ''],
    entered: ['#fff6e0', '#7a5a0c', 'Entered by hand', 'A person typed this value. It is not linked to a source document.'],
    reference: ['#eef1f7', '#44536b', 'Legal or schedule figure', 'A fixed figure from a statute, guideline, or schedule, not from this client\'s records.'],
    nodata: ['#eef1f7', '#44536b', 'Nothing recorded yet', ''],
    text: ['#eef1f7', '#44536b', 'Wording on this page', 'Not a figure for this case.'],
    nottied: ['#fbe7e2', '#8e2417', '✗ Not tied: written into this page', 'Don\'t rely on this number.'],
    unexplained: ['#fbe7e2', '#8e2417', '✗ Not tied: no calculation on record', 'Don\'t rely on this number until it is checked.'],
    explained: ['#fff6e0', '#7a5a0c', 'Explained, not recalculated', ''],
  };

  function ensureModal() {
    let m = document.getElementById('vrModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'vrModal'; m.hidden = true;
    m.innerHTML = `<div class="vr-back" data-vr-close></div><div class="vr-dlg" role="dialog" aria-modal="true" aria-labelledby="vrTitle">
      <div class="vr-head"><h2 id="vrTitle"></h2><button type="button" class="vr-x" data-vr-close aria-label="Close">×</button></div>
      <div class="vr-body" id="vrBody"></div>
      <div class="vr-foot"><button type="button" class="vr-btn" id="vrCsv">Export CSV</button><button type="button" class="vr-btn vr-primary" data-vr-close>Close</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-vr-close]')) closeModal();
      const more = e.target.closest('[data-vr-more]');
      if (more) { renderRows(more.closest('.vr-sec'), current, true); }
    });
    m.querySelector('#vrCsv').addEventListener('click', exportCsv);
    return m;
  }

  let current = null;
  let returnFocus = null;
  function closeModal() {
    const m = document.getElementById('vrModal');
    if (m) m.hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
    current = null;
  }
  const docHref = (s) => (/^https?:|^\//.test(s.url || '') ? s.url : `${base()}/${s.url}`);
  const fmtCell = (c, v) => (c.money ? (v == null || v === '' ? '—' : money(v)) : esc(v == null ? '' : v));

  const ROW_LIMIT = 200;
  function renderRows(sec, r, all) {
    const cols = r.columns || [];
    const rows = all ? r.rows : r.rows.slice(0, ROW_LIMIT);
    const anyDoc = r.rows.some((x) => x.documentId);
    const docUrl = (x) => `${base()}/documents/${encodeURIComponent(x.documentId)}/original`;
    sec.innerHTML = `<h3>Line items (${r.rows.length.toLocaleString()})</h3><div class="vr-tablewrap"><table class="vr-table"><thead><tr>${cols.map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.label)}</th>`).join('')}${anyDoc ? '<th>Source</th>' : ''}</tr></thead>
      <tbody>${rows.map((x) => `<tr>${cols.map((c) => `<td style="text-align:${c.align || 'left'}">${fmtCell(c, x[c.key])}</td>`).join('')}${anyDoc ? `<td>${x.documentId ? `<a href="${esc(docUrl(x))}" target="_blank" rel="noopener">Open</a>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      ${!all && r.rows.length > ROW_LIMIT ? `<button type="button" class="vr-link" data-vr-more>Show all ${r.rows.length.toLocaleString()} lines</button>` : ''}`;
  }

  function render(ctx, r) {
    current = { ...r, label: ctx.label, shown: ctx.text };
    const [bg, fg, head, sub] = STATUS[r.status] || STATUS.explained;
    const d = ctx.displayed;
    const unit = (v) => (d && d.kind === 'percent' ? `${v}%` : r.format === 'count' || (d && d.kind === 'number') ? Number(v).toLocaleString() : money(v));
    let diffLine = '';
    if (r.status === 'difference' && d) {
      const diff = Math.abs(Math.abs(Number(r.value)) - d.value);
      diffLine = `On screen: ${esc(ctx.text)}. Recalculated: ${esc(unit(r.value))}. Off by ${esc(d.kind === 'percent' ? `${diff.toFixed(2)} points` : r.format === 'count' || d.kind === 'number' ? diff.toLocaleString() : money(diff))}.`;
    } else if (r.value != null && d && r.status !== 'reference') {
      diffLine = `On screen: ${esc(ctx.text)}. Recalculated: ${esc(unit(r.value))}.`;
    }
    const inputsHtml = (r.inputs && r.inputs.length) ? `<div class="vr-sec"><h3>Inputs</h3><div class="vr-tablewrap"><table class="vr-table"><thead><tr><th>Input</th><th style="text-align:right">Value</th><th>Where it comes from</th></tr></thead><tbody>${r.inputs.map((i) => `<tr><td>${esc(i.label)}</td><td style="text-align:right">${esc(typeof i.value === 'number' ? i.value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : i.value)}</td><td>${esc({ entered: 'Typed in on this page', intake: 'Case Intake', document: 'Source document', module: 'Another Veritas module', court: 'Official court calculator', reference: 'Statute or schedule', default: 'Default on this page' }[i.origin] || i.origin || '')}</td></tr>`).join('')}</tbody></table></div></div>` : '';
    const summaryHtml = r.summary && Object.keys(r.summary).length ? `<div class="vr-summary"><h3>Summary</h3>${Object.entries(r.summary).map(([k, v]) => `<div class="vr-sumline"><span>${esc(k)}:</span><strong>${esc(typeof v === 'number' ? v.toLocaleString() : v)}</strong></div>`).join('')}</div>` : '';
    const calcHtml = r.calc && r.calc.length ? `<div class="vr-calc"><h3>How this number was calculated</h3><ol>${r.calc.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '';
    const srcHtml = `<div class="vr-sources"><h3>Source documents${r.sources && r.sources.length ? ` (${r.sources.length})` : ''}</h3>${(r.sources && r.sources.length)
      ? r.sources.map((s) => `<div class="vr-src"><div class="vr-src-head">${s.url ? `<a href="${esc(docHref(s))}" target="_blank" rel="noopener">${esc(s.filename)}</a>` : `<b>${esc(s.filename)}</b>`}${s.contribution ? `<span>${esc(s.contribution)}</span>` : ''}</div><p>${esc(s.summary || '')}</p></div>`).join('')
      : '<p class="vr-none">No source document is attached to this figure.</p>'}</div>`;
    document.getElementById('vrTitle').textContent = `${r.title || ctx.label || 'Figure'} - Reconciliation Detail`;
    const body = document.getElementById('vrBody');
    body.innerHTML = `<div class="vr-status" style="background:${bg};color:${fg}"><b>${esc(head)}</b>${diffLine ? `<div>${diffLine}</div>` : ''}${sub || r.note ? `<div>${esc([r.note, sub].filter(Boolean).join(' '))}</div>` : ''}</div>
      ${r.rows && r.rows.length && r.columns ? '<div class="vr-sec" id="vrRows"></div>' : ''}${inputsHtml}${summaryHtml}${calcHtml}${srcHtml}`;
    if (r.rows && r.rows.length && r.columns) renderRows(body.querySelector('#vrRows'), r, false);
  }

  function exportCsv() {
    if (!current) return;
    const r = current;
    const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [`${r.title || r.label} - Reconciliation Detail`, `On screen,${cell(r.shown)}`];
    if (r.value != null) out.push(`Recalculated,${cell(r.value)}`);
    out.push(`Status,${cell((STATUS[r.status] || [])[2] || r.status)}`, '');
    if (r.rows && r.columns) { out.push(r.columns.map((c) => cell(c.label)).join(',')); r.rows.forEach((x) => out.push(r.columns.map((c) => cell(x[c.key])).join(','))); out.push(''); }
    if (r.inputs) { out.push('Inputs'); r.inputs.forEach((i) => out.push(`${cell(i.label)},${cell(i.value)},${cell(i.origin)}`)); out.push(''); }
    if (r.summary) { out.push('Summary'); Object.entries(r.summary).forEach(([k, v]) => out.push(`${cell(k)},${cell(v)}`)); out.push(''); }
    if (r.calc) { out.push('How this number was calculated'); r.calc.forEach((s, i) => out.push(`${i + 1},${cell(s)}`)); out.push(''); }
    if (r.sources) { out.push('Source documents'); r.sources.forEach((s) => out.push(`${cell(s.filename)},${cell(s.contribution)},${cell(s.summary)}`)); }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8;' }));
    a.download = `recon_${String(r.title || r.label || 'figure').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function openFor(el, cardFn) {
    returnFocus = el;
    jsonCache.clear();
    const m = ensureModal();
    m.hidden = false;
    document.getElementById('vrTitle').textContent = 'Reconciliation Detail';
    document.getElementById('vrBody').innerHTML = '<div class="vr-loading">Checking this figure…</div>';
    m.querySelector('.vr-x').focus();
    try {
      if (cardFn) {
        const ctx = makeCtx(el);
        const r = await finish(ctx, (await cardFn(ctx)) || { status: 'explained' });
        render(ctx, r);
      } else {
        const { ctx, recon } = await resolve(el);
        render(ctx, recon);
      }
    } catch (e) {
      document.getElementById('vrBody').innerHTML = `<div class="vr-status" style="background:#fbe7e2;color:#8e2417"><b>Couldn't check this figure</b><div>${esc(e.message)}. The Veritas server may be offline; nothing has been lost.</div></div>`;
    }
  }

  // ---------- events ----------
  function handle(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const info = t.closest('.vr-info');
    if (info) { e.preventDefault(); e.stopPropagation(); const n = info.previousElementSibling; if (n) openFor(n); return; }
    const card = t.closest('.vr-card-btn');
    if (card) { e.preventDefault(); e.stopPropagation(); const c = defs.cards[Number(card.dataset.vrCard)]; openFor(card.parentElement, c.recon); return; }
    const pill = t.closest('.vr-pill');
    if (pill) { e.preventDefault(); e.stopPropagation(); if (pillFor) openFor(pillFor); return; }
    const num = t.closest('.vr-num:not(.vr-inert)');
    if (num) { e.preventDefault(); e.stopPropagation(); openFor(num); }
  }

  let pill = null;
  let pillFor = null;
  function isFigureInput(el) {
    if (!el.matches || !el.matches('input') || el.closest(SKIP.replace('input,', '').replace(',dialog', ',dialog'))) return false;
    if (/^(checkbox|radio|hidden|date|file|search|button|submit|email|tel|url|password|month|time)$/.test(el.type)) return false;
    return el.type === 'number' || /^\s*[-$(]?[\d,]+(\.\d+)?%?\)?\s*$/.test(el.value);
  }
  function showPill(el) {
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button'; pill.className = 'vr-pill'; pill.textContent = 'View recon'; pill.hidden = true;
      pill.addEventListener('mousedown', (e) => e.preventDefault());
      document.body.appendChild(pill);
    }
    const b = el.getBoundingClientRect();
    pill.style.top = `${Math.max(4, b.top - 24)}px`;
    pill.style.left = `${Math.max(4, Math.min(window.innerWidth - 90, b.left))}px`;
    pill.hidden = false; pillFor = el;
  }

  const CSS_TEXT = `
    .vr-num:not(.vr-inert){cursor:pointer;border-bottom:1px dotted currentColor}
    .vr-num:not(.vr-inert):hover,.vr-num:not(.vr-inert):focus{background:rgba(46,91,138,.12);outline:none;border-radius:2px}
    .vr-info{cursor:pointer;font-size:.72em;color:#2e5b8a;margin-left:3px;vertical-align:super;line-height:1;font-weight:400;font-family:Inter,sans-serif}
    .vr-card-btn,.vr-pill{border:1px solid #cfd8e6;background:#fff;color:#1c3350;border-radius:999px;padding:5px 12px;font:600 12px Inter,sans-serif;cursor:pointer}
    .vr-card-btn{display:inline-block;margin-top:10px}.vr-card-btn:hover,.vr-pill:hover{border-color:#1c3350}
    .vr-pill{position:fixed;z-index:9000;padding:2px 9px;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
    #vrModal[hidden],.vr-pill[hidden]{display:none}
    #vrModal{position:fixed;inset:0;z-index:100000;font-family:Inter,-apple-system,'Segoe UI',sans-serif}
    .vr-back{position:absolute;inset:0;background:rgba(14,27,44,.55)}
    .vr-dlg{position:relative;width:min(1000px,calc(100vw - 32px));max-height:calc(100vh - 48px);margin:24px auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
    .vr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid #e4e8f0}
    .vr-head h2{margin:0;font-size:19px;font-weight:700;color:#14273d;overflow-wrap:anywhere}
    .vr-x{border:0;background:none;font-size:24px;line-height:1;color:#55637a;cursor:pointer}
    .vr-body{padding:18px 24px;overflow:auto;color:#33475b;font-size:13px}
    .vr-loading{padding:30px;text-align:center;color:#8a96aa}
    .vr-status{padding:12px 14px;border-radius:8px;margin-bottom:16px;line-height:1.5}.vr-status b{font-size:14px}
    .vr-body h3{margin:0 0 10px;font-size:14px;color:#14273d}
    .vr-sec{margin-bottom:18px}.vr-tablewrap{overflow:auto;max-height:380px;border:1px solid #eef1f7;border-radius:6px}
    .vr-table{width:100%;border-collapse:collapse;font-size:12.5px}
    .vr-table th{position:sticky;top:0;background:#f0f5fb;border-bottom:2px solid #4b7c99;padding:8px 10px;color:#1c3f66;text-align:left;font-weight:700;white-space:nowrap}
    .vr-table td{padding:7px 10px;border-bottom:1px solid #eef1f7;vertical-align:top;font-variant-numeric:tabular-nums}
    .vr-table a,.vr-src a{color:#2e5b8a;font-weight:600}
    .vr-link{border:0;background:none;color:#2e5b8a;font:600 12px Inter,sans-serif;cursor:pointer;padding:8px 0}
    .vr-summary{padding:14px 16px;background:#f8fafb;border-left:4px solid #4b7c99;border-radius:6px;margin-bottom:16px}
    .vr-sumline{display:flex;justify-content:space-between;gap:16px;margin:5px 0}.vr-sumline strong{color:#1c3f66;text-align:right;overflow-wrap:anywhere}
    .vr-calc{padding:14px 16px;background:#f2f8f4;border-left:4px solid #6b9e88;border-radius:6px;margin-bottom:16px}
    .vr-calc ol{margin:0;padding-left:20px}.vr-calc li{margin:4px 0;line-height:1.5}
    .vr-sources{padding:14px 16px;background:#fbf8f1;border-left:4px solid #b8893b;border-radius:6px}
    .vr-src{padding:8px 0;border-top:1px solid #eee4cf}.vr-src:first-of-type{border-top:0}
    .vr-src-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.vr-src-head span{color:#8a7a55;font-size:12px}
    .vr-src p{margin:4px 0 0;line-height:1.5;font-size:12.5px}.vr-none{margin:0;color:#8a7a55}
    .vr-foot{display:flex;justify-content:flex-end;gap:10px;padding:12px 24px;border-top:1px solid #e4e8f0;background:#f8fafb}
    .vr-btn{padding:8px 16px;border:1px solid #1c3350;background:#fff;color:#1c3350;border-radius:8px;cursor:pointer;font:600 13px Inter,sans-serif}.vr-primary{background:#1c3350;color:#fff}
    @media (max-width:700px){.vr-dlg{margin:8px auto;max-height:calc(100vh - 16px)}.vr-head,.vr-body{padding-left:16px;padding-right:16px}}
    @media print{.vr-info,.vr-card-btn,.vr-pill{display:none!important}.vr-num{border:0!important}}`;

  // ---------- audit (scripts/recon-audit.js) ----------
  // Audit only: put test values in every empty field so calculators actually run.
  async function fillForAudit() {
    await new Promise((ok) => setTimeout(ok, 1500));
    let i = 0;
    document.querySelectorAll('input').forEach((el) => {
      if (el.disabled || el.readOnly || (el.value !== '' && Number(el.value) !== 0) || el.closest('dialog,.sidebar,.topbar')) return;
      if (el.type === 'number') { const max = el.max !== '' ? Number(el.max) : Infinity; el.value = String(Math.min(max, 1000 + 137 * ++i)); }
      else if (el.type === 'date') el.value = '2015-06-15';
      else return;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.querySelectorAll('button').forEach((b) => { if (/\b(re)?calculate\b|\bcompute\b/i.test(b.textContent)) b.click(); });
    lastChange = Date.now();
  }

  async function runAudit() {
    if (/[?&]reconFill=1\b/.test(location.search)) await fillForAudit();
    const start = Date.now();
    await new Promise((ok) => {
      const tick = () => (Date.now() - start > 4000 && Date.now() - lastChange > 1500 ? ok() : setTimeout(tick, 250));
      tick();
    });
    scan();
    const nums = [...document.querySelectorAll('.vr-num')];
    const inputs = [...document.querySelectorAll('input')].filter(isFigureInput).filter((i) => i.value !== '');
    const all = nums.concat(inputs);
    // One lookup for every figure, so the audit doesn't make thousands of requests.
    const prep = all.map((el) => makeCtx(el));
    const needs = prep.map((c) => (c.displayed && c.displayed.kind !== 'percent' && c.displayed.value ? { amount: c.displayed.value, decimals: c.displayed.decimals } : { amount: 0, decimals: 0 }));
    let hits = [];
    try { hits = await lookup(needs); } catch (e) { hits = []; }
    const out = [];
    for (let i = 0; i < all.length; i++) {
      let row;
      try {
        const { ctx, recon } = await resolve(all[i], hits[i]);
        row = { text: ctx.text, label: ctx.label, id: ctx.id, status: recon.status, value: recon.value == null ? null : recon.value, input: all[i].matches('input'), rows: (recon.rows || []).length, sources: (recon.sources || []).length, hasCalc: !!(recon.calc && recon.calc.length) };
      } catch (e) { row = { text: clean(all[i].textContent || all[i].value), label: '', status: 'error', error: e.message }; }
      out.push(row);
    }
    const pre = document.createElement('pre');
    pre.id = 'vrAuditResult'; pre.hidden = true;
    pre.textContent = JSON.stringify({ page: PAGE, count: out.length, numbers: out, cards: document.querySelectorAll('.vr-card-btn').length });
    document.body.appendChild(pre);
  }

  // ---------- public ----------
  window.VeritasRecon = {
    define(d) {
      Object.assign(defs.byId, d.byId || {});
      defs.match.push(...(d.match || []));
      defs.cards.push(...(d.cards || []));
      defs.inert.push(...(d.inert || []));
      if (d.inert && d.inert.length) {
        document.querySelectorAll(d.inert.map((x) => `${x} .vr-num`).join(',')).forEach((n) => {
          const info = n.nextElementSibling;
          if (info && info.classList.contains('vr-info')) info.remove();
          const p = n.parentNode;
          n.replaceWith(document.createTextNode(n.textContent));
          p.normalize();
        });
      }
      if (document.body) scan();
    },
    scan,
    open: openFor,
    money,
  };

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS_TEXT;
    document.head.appendChild(style);
    document.addEventListener('click', handle, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const m = document.getElementById('vrModal'); if (m && !m.hidden) closeModal(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.matches('.vr-num:not(.vr-inert),.vr-info')) handle(e);
    }, true);
    document.addEventListener('focusin', (e) => { if (e.target instanceof Element && isFigureInput(e.target)) showPill(e.target); else if (pill && !(e.target instanceof Element && e.target.closest('.vr-pill'))) pill.hidden = true; });
    document.addEventListener('focusout', () => { setTimeout(() => { if (pill && !(document.activeElement && document.activeElement.matches && document.activeElement.matches('input'))) pill.hidden = true; }, 100); });
    scan();
    const s = document.createElement('script');
    s.src = `recon-providers/${PAGE.replace(/\.html$/, '')}.js`;
    s.onload = () => scan();
    s.onerror = () => {};
    document.head.appendChild(s);
    if (AUDIT) runAudit();
    // Opens one recon on load, for checking the window in a browser: ?reconShow=<element id>
    const show = new URLSearchParams(location.search).get('reconShow');
    if (show) setTimeout(() => { const n = document.querySelector(`#${CSS.escape(show)} .vr-num`); if (n) openFor(n); }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
