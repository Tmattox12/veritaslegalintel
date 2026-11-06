// Recons for Spousal Maintenance (spousal-maintenance.html, spousal-maintenance.js).
// Income figures are rebuilt from the source and option fields on the page. The guideline
// range comes from the official court calculator: a recon never asks it again, so those
// figures show what was sent and are marked as the calculator's answer. The variable-income
// percentage is rebuilt from the two calculator results and the variable income.
(function () {
  const HUB_SOURCE = 'Accepted income (Income Hub)';
  const HUB_OPTION = 'Accepted documents';
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const fmt0 = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const moneyIn = (text) => { const n = parseFloat(String(text).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

  const ties = (d, v) => { const f = Math.pow(10, d.decimals); return Math.abs(Math.round((Math.abs(Number(v)) / d.scale) * f) / f - d.raw) < 0.5 / f + 1e-9; };
  function settle(ctx, r) {
    const d = ctx.displayed;
    if (r.value == null || !d || !ties(d, r.value)) return r;
    const any = (r.inputs || []).some((i) => Number(i.value)) || (r.rows || []).some((x) => Number(x.amount));
    r.status = d.value === 0 && !any ? 'nodata' : 'calculated';
    return r;
  }
  function showFigure(ctx, text, label) {
    const m = String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    const raw = m ? Number(m[0]) : 0;
    ctx.text = text; ctx.label = label;
    ctx.displayed = { kind: 'money', value: raw, raw, scale: 1, decimals: m ? (m[0].split('.')[1] || '').length : 0, negative: false };
  }

  function readBox(box) {
    const on = box.querySelector('.opt.on');
    const options = [...box.querySelectorAll('.opt')].map((o) => ({ label: (o.querySelector('[data-f="label"]') || {}).value || '', amount: num((o.querySelector('[data-f="amount"]') || {}).value), selected: o.classList.contains('on') }));
    const box2 = (f) => box.querySelector(`[data-f="${f}"]`);
    return {
      box, p: box.dataset.p, name: (box2('name') || {}).value || '',
      include: !!(box2('include') || {}).checked, variable: !!(box2('variable') || {}).checked,
      optLabel: on ? (on.querySelector('[data-f="label"]') || {}).value || '' : '',
      amount: on ? num((on.querySelector('[data-f="amount"]') || {}).value) : 0, options,
    };
  }
  const sourcesOf = (p) => [...document.querySelectorAll(`.src[data-p="${p}"]`)].map(readBox);
  const adjOf = (p) => { const el = document.querySelector(`input[data-adj="${p}"]`); return el ? num(el.value) : 0; };
  const incomeOf = (p, skipVariable) => sourcesOf(p).filter((s) => s.include && !(skipVariable && s.variable)).reduce((a, s) => a + s.amount, 0) + adjOf(p);
  const variableOf = (p) => sourcesOf(p).filter((s) => s.include && s.variable).reduce((a, s) => a + s.amount, 0);
  const requesting = () => { const el = document.getElementById('requesting'); return el && el.value === 'b' ? 'b' : 'a'; };
  const payer = () => (requesting() === 'a' ? 'b' : 'a');
  const isHub = (s) => s.name === HUB_SOURCE && s.optLabel === HUB_OPTION;
  const metricParty = (p) => (p === 'a' ? 'party_a' : 'party_b');

  async function onFile(ctx, parties) {
    const lists = await Promise.all([...parties.map((p) => ctx.metric(['accepted-income', { party: metricParty(p) }])), ctx.metric(['documents', { category: 'Tax Returns & Income' }])]);
    const seen = new Set(); const sources = [];
    lists.forEach((l) => (l.sources || []).forEach((s) => { if (!seen.has(s.documentId)) { seen.add(s.documentId); sources.push({ ...s, contribution: 'On file. Not linked to this figure.' }); } }));
    return { sources, accepted: lists.slice(0, parties.length).reduce((a, l) => a + (Number(l.value) || 0), 0) };
  }
  const NOT_LINKED = 'These amounts are typed on this page. Any documents listed are this matter\'s income documents on file, to compare by hand.';
  async function withDocs(ctx, r, parties) {
    const f = await onFile(ctx, parties);
    r.sources = f.sources;
    r.summary = { ...(r.summary || {}), 'Accepted in the Income Hub': ctx.money(f.accepted) };
    r.note = [r.note, NOT_LINKED].filter(Boolean).join(' ');
    return settle(ctx, r);
  }

  // A source added with "+ From Income Hub" is the accepted amount for that party, rounded to the dollar.
  async function hubLinked(ctx, s) {
    const m = await ctx.metric(['accepted-income', { party: metricParty(s.p) }]);
    return { title: `${s.name}: ${ctx.names[s.p]}`, value: Math.round(Number(m.value) || 0), columns: m.columns, rows: m.rows, sources: m.sources,
      summary: m.summary, calc: [...m.calc, `Rounded to the dollar when it was added here = ${fmt0(m.value)}.`] };
  }

  const SOURCE_COLS = [{ key: 'source', label: 'Income source' }, { key: 'basis', label: 'Selected figure' }, { key: 'counted', label: 'Counted?' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }];
  const sourceRows = (p, ctx) => sourcesOf(p).map((s) => ({ source: s.name || 'Unnamed source', party: ctx.names[p], basis: s.optLabel, counted: s.include ? (s.variable ? 'Yes, variable' : 'Yes') : 'No', amount: s.amount }));

  const partyOfSummary = (ctx) => { const card = ctx.el.closest('.party-sum'); return [...document.querySelectorAll('#summary .party-sum')].indexOf(card) === 1 ? 'b' : 'a'; };

  async function summaryLine(ctx) {
    const p = partyOfSummary(ctx);
    const lines = [...ctx.el.closest('.party-sum').querySelectorAll('.sum-line')];
    const idx = lines.indexOf(ctx.el.closest('.sum-line'));
    const list = sourcesOf(p);
    if (idx >= list.length) {
      const adj = adjOf(p);
      return withDocs(ctx, { title: `Adjustment: ${ctx.names[p]}`, value: adj, inputs: [{ label: 'Other annual adjustment', value: adj, origin: 'entered' }], calc: [`The adjustment typed for ${ctx.names[p]} = ${ctx.money(adj)}.`] }, [p]);
    }
    const s = list[idx];
    if (isHub(s) && s.include) return hubLinked(ctx, s);
    return withDocs(ctx, { title: `${s.name || 'Unnamed source'}: ${ctx.names[p]}`, value: s.amount,
      columns: [{ key: 'label', label: 'Option' }, { key: 'used', label: 'Selected' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }],
      rows: s.options.map((o) => ({ label: o.label, used: o.selected ? 'Yes' : '', amount: o.amount })),
      summary: { 'Selected option': s.optLabel || 'None', Included: s.include ? 'Yes' : 'No', Variable: s.variable ? 'Yes' : 'No' },
      calc: [`The selected option on this source is "${s.optLabel}" = ${ctx.money(s.amount)}.`, ...(s.include ? [] : ['This source is not ticked "Include", so it is shown struck through and not added to annual income.'])] }, [p]);
  }

  async function partyTotal(ctx) {
    const p = partyOfSummary(ctx);
    const total = incomeOf(p); const adj = adjOf(p);
    const counted = sourcesOf(p).filter((s) => s.include);
    return withDocs(ctx, { title: `Annual income: ${ctx.names[p]}`, value: total, columns: SOURCE_COLS, rows: sourceRows(p, ctx),
      summary: { 'Sources counted': counted.length, Adjustment: ctx.money(adj), 'Annual income': ctx.money(total), 'Monthly average': ctx.money(total / 12) },
      calc: [`Annual income = the selected figure on each included source (${counted.map((s) => ctx.money(s.amount)).join(' + ') || '$0.00'}) + adjustment ${ctx.money(adj)} = ${ctx.money(total)}.`] }, [p]);
  }
  async function combinedTotal(ctx) {
    const a = incomeOf('a'); const b = incomeOf('b');
    const cols = [{ key: 'party', label: 'Party' }, ...SOURCE_COLS];
    return withDocs(ctx, { title: 'Combined annual income', value: a + b, columns: cols, rows: sourceRows('a', ctx).concat(sourceRows('b', ctx)),
      summary: { [ctx.names.a]: ctx.money(a), [ctx.names.b]: ctx.money(b), Combined: ctx.money(a + b) },
      calc: [`Combined = ${ctx.money(a)} + ${ctx.money(b)} = ${ctx.money(a + b)}.`] }, ['a', 'b']);
  }

  // What the page sends to the official calculator, read from the fields as the page reads them.
  function sentInputs(ctx, shownAs) {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    // A date or county left blank here is filled from Case Intake, or the hearing date from today.
    let typed = {};
    try { typed = (JSON.parse(localStorage.getItem('veritas.spousal.v1') || '{}') || {}).settings || {}; } catch (e) { typed = {}; }
    const from = (id, otherwise) => (typed[id] ? 'entered' : otherwise);
    const out = [];
    if (shownAs) out.push({ label: 'Official calculator answer', value: shownAs, origin: 'court' });
    out.push(
      { label: 'Party requesting maintenance', value: ctx.names[requesting()], origin: 'entered' },
      { label: `Income sent, ${ctx.names.a}`, value: Math.max(0, Math.round(incomeOf('a'))), origin: 'module' },
      { label: `Income sent, ${ctx.names.b}`, value: Math.max(0, Math.round(incomeOf('b'))), origin: 'module' },
      { label: `Attributed income sent, ${ctx.names.a}`, value: num(v('attrA')), origin: 'entered' },
      { label: `Attributed income sent, ${ctx.names.b}`, value: num(v('attrB')), origin: 'entered' },
      { label: 'Family size', value: v('familySize') || 'blank', origin: 'entered' },
      { label: 'Family mortgage principal', value: num(v('mortgage')), origin: 'entered' },
      { label: 'Date of marriage', value: v('marriageDate') || 'blank', origin: from('marriageDate', 'intake') },
      { label: 'Date of service of process', value: v('serviceDate') || 'blank', origin: from('serviceDate', 'intake') },
      { label: 'Hearing / calculation date', value: v('hearingDate') || 'blank', origin: from('hearingDate', 'default') },
      { label: `Date of birth, ${ctx.names.a}`, value: v('dobA') || 'blank', origin: 'entered' },
      { label: `Date of birth, ${ctx.names.b}`, value: v('dobB') || 'blank', origin: 'entered' },
      { label: 'County', value: v('county') || 'blank', origin: from('county', 'intake') },
    );
    return out;
  }
  const COURT_NOTE = 'This figure is the official court calculator\'s answer. Veritas cannot recalculate it and a recon does not ask the calculator again. The inputs below are what the page sends it. Names and the case number are not sent.';
  function courtRecon(title) {
    return (ctx) => ({ title: typeof title === 'function' ? title(ctx) : title, status: 'explained', note: COURT_NOTE, inputs: sentInputs(ctx, ctx.text),
      summary: { 'Reported by': ctx.txt('#sourceTag') || 'Official calculator' }, calc: ['The page sends the inputs below to the official calculator and shows the amount it returns.'] });
  }

  const LEVEL = { low: '#gLow', mid: '#gMid', high: '#gHigh' };
  function calcStatusRecon(ctx) {
    const on = document.querySelector('.g-card.on');
    const level = on ? on.dataset.level : 'mid';
    if (/^\/yr/.test(ctx.after)) {
      const monthly = moneyIn(ctx.txt(LEVEL[level]));
      return { title: `Selected ${level}, annual`, value: monthly * 12, inputs: [{ label: `Guideline ${level}, monthly`, value: monthly, origin: 'court' }], calc: [`Annual = ${ctx.money(monthly)} x 12 = ${ctx.money(monthly * 12)}.`] };
    }
    return courtRecon(`Selected guideline ${level}`)(ctx);
  }

  // The three blocks in the variable-income grid: all income, variable left out, equivalent share.
  const varMid = (n) => moneyIn(document.querySelector(`#varGrid .party-sum:nth-child(${n}) .val`).textContent);
  function shareParts(ctx) {
    const full = varMid(1); const base = varMid(2); const p = payer();
    const variable = variableOf(p);
    const diffYr = (full - base) * 12;
    const pct = variable > 0 ? (diffYr / variable) * 100 : null;
    const inputs = [
      { label: 'Guideline mid, all income', value: full, origin: 'court' },
      { label: 'Guideline mid, variable income left out', value: base, origin: 'court' },
      { label: `Variable income, ${ctx.names[p]}`, value: variable, origin: 'entered' },
    ];
    return { full, base, p, variable, diffYr, pct, inputs };
  }
  function shareSteps(ctx, s) {
    return [`Monthly difference = ${ctx.money(s.full)} - ${ctx.money(s.base)} = ${ctx.money(s.full - s.base)}.`, `Annual difference = ${ctx.money(s.full - s.base)} x 12 = ${ctx.money(s.diffYr)}.`,
      `Share = ${ctx.money(s.diffYr)} / ${ctx.money(s.variable)} variable income = ${s.pct == null ? 'not available' : `${s.pct.toFixed(1)}%`}.`];
  }
  function variableRows(p, ctx) {
    return sourcesOf(p).filter((s) => s.include && s.variable).map((s) => ({ source: s.name || 'Unnamed source', basis: s.optLabel, amount: s.amount }));
  }
  const VAR_COLS = [{ key: 'source', label: 'Variable source' }, { key: 'basis', label: 'Selected figure' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }];

  function varGridRecon(ctx) {
    const block = ctx.el.closest('.party-sum');
    const n = [...block.parentElement.children].indexOf(block) + 1;
    if (n === 1 || n === 2) {
      const title = n === 1 ? 'Guideline mid, all income' : 'Guideline mid, variable income left out';
      if (ctx.el.closest('.val')) return courtRecon(title)(ctx);
      const mid = varMid(n);
      return { title: `${title}, annual`, value: mid * 12, inputs: [{ label: title, value: mid, origin: 'court' }], calc: [`Annual = ${ctx.money(mid)} x 12 = ${ctx.money(mid * 12)}.`] };
    }
    const s = shareParts(ctx);
    if (ctx.el.closest('.val')) return { title: 'Equivalent share of variable income', value: s.pct, inputs: s.inputs, columns: VAR_COLS, rows: variableRows(s.p, ctx), calc: shareSteps(ctx, s) };
    if (/^variable/.test(ctx.after)) return { title: 'Variable income', value: s.variable, columns: VAR_COLS, rows: variableRows(s.p, ctx), inputs: [{ label: `Variable income, ${ctx.names[s.p]}`, value: s.variable, origin: 'entered' }], calc: [`The selected figure on each of ${ctx.names[s.p]}'s included sources marked variable, added = ${ctx.money(s.variable)}.`] };
    return { title: 'Annual amount at the equivalent share', value: s.diffYr, inputs: s.inputs, calc: shareSteps(ctx, s).slice(0, 2) };
  }
  function varStatusRecon(ctx) {
    if (ctx.displayed && ctx.displayed.kind === 'percent') {
      const s = shareParts(ctx);
      return { title: 'Equivalent share of variable income', value: s.pct, inputs: s.inputs, columns: VAR_COLS, rows: variableRows(s.p, ctx), calc: shareSteps(ctx, s) };
    }
    return courtRecon('Guideline mid, variable income left out')(ctx);
  }

  function optionRecon(ctx) {
    const s = readBox(ctx.el.closest('.src'));
    const row = ctx.el.closest('.opt');
    const label = (row.querySelector('[data-f="label"]') || {}).value;
    if (s.name !== HUB_SOURCE || label !== HUB_OPTION) { ctx.label = `${s.name || 'Unnamed source'}: ${label || 'option'}`; return null; }
    return hubLinked(ctx, { ...s, optLabel: label });
  }

  // The "View recon" button on each income source.
  async function cardRecon(ctx) {
    const s = readBox(ctx.el);
    const lines = [...document.querySelectorAll('#summary .party-sum')][s.p === 'b' ? 1 : 0].querySelectorAll('.sum-line');
    const idx = [...document.querySelectorAll(`.src[data-p="${s.p}"]`)].indexOf(ctx.el);
    const figure = lines[idx] && lines[idx].querySelector('b');
    showFigure(ctx, figure ? figure.textContent.trim() : fmt0(s.amount), s.name || 'Income source');
    const monthly = s.amount / 12;
    const base = {
      title: `${s.name || 'Unnamed source'} - ${ctx.names[s.p]}`, value: s.amount,
      columns: [{ key: 'label', label: 'Option' }, { key: 'used', label: 'Selected' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }],
      rows: s.options.map((o) => ({ label: o.label, used: o.selected ? 'Yes' : '', amount: o.amount })),
      summary: { 'Selected option': s.optLabel || 'None', Included: s.include ? 'Yes' : 'No', Variable: s.variable ? 'Yes' : 'No', 'Annual amount': ctx.money(s.amount), 'Monthly average': ctx.money(monthly) },
      calc: [`Selected option "${s.optLabel}" = ${ctx.money(s.amount)} a year.`, `Monthly average = ${ctx.money(s.amount)} / 12 = ${ctx.money(monthly)}.`, `Annualized = ${ctx.money(monthly)} x 12 = ${ctx.money(monthly * 12)}.`,
        s.include ? 'This source is included in annual income.' : 'This source is not ticked "Include", so it is not added to annual income.'],
    };
    if (isHub(s)) {
      const hub = await hubLinked(ctx, s);
      return { ...base, value: hub.value, sources: hub.sources, columns: hub.columns, rows: hub.rows, summary: { ...base.summary, ...hub.summary }, calc: [...hub.calc, ...base.calc.slice(1)] };
    }
    const out = await withDocs(ctx, base, [s.p]);
    if (!s.options.some((o) => o.amount)) { out.status = 'nodata'; out.note = 'Nothing has been entered on this source yet.'; }
    return out;
  }

  VeritasRecon.define({
    byId: {
      gLow: courtRecon('Guideline low'), gMid: courtRecon('Guideline mid'), gHigh: courtRecon('Guideline high'),
      facts: courtRecon('Official calculator result'), selNote: courtRecon('Official calculator message'),
      calcStatus: calcStatusRecon, varGrid: varGridRecon, varStatus: varStatusRecon,
    },
    match: [
      { selector: '#summary .sum-line small', recon: () => ({ status: 'text', calc: ['This number is part of the option\'s name, which a person typed.'] }) },
      { selector: '#summary .sum-total', recon: partyTotal },
      { selector: '#summary .combined', recon: combinedTotal },
      { selector: '#summary .sum-line b', recon: summaryLine },
      { selector: '#summary .sum-line span', recon: () => ({ status: 'text', calc: ['This number is part of the source\'s name, which a person typed.'] }) },
      { selector: '.opt input[data-f="amount"]', recon: optionRecon },
      { selector: 'input[data-adj]', recon: (ctx) => { ctx.label = `Other annual adjustment: ${ctx.names[ctx.el.dataset.adj]}`; return null; } },
    ],
    cards: [{ selector: '.src', recon: cardRecon }],
  });
})();
