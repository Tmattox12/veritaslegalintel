// Recons for the older Income Engine template (income-imputation-template.html).
// On this page a person types each basis directly and presses Select. The page copies
// that amount to the card and never updates the totals at the top, so the totals are
// rebuilt here from the cards and show a difference once any basis is selected.
(function () {
  const INPUTS = { '3yr': '.basis-3yr', '2yr': '.basis-2yr', ytd: '.basis-ytd', imputed: '.basis-imputed' };
  const LABELS = { '3yr': 'Last 3 years', '2yr': 'Last 2 years', ytd: 'YTD run-rate', imputed: 'Imputed' };
  const PARTY_METRIC = { partyA: 'party_a', partyB: 'party_b' };

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

  // The card remembers the choice only through the wording of its "selected" line.
  function basisOf(card) {
    const t = (card.querySelector('.selected-basis') || {}).textContent || '';
    if (/^Last 3 Years/.test(t)) return '3yr';
    if (/^Last 2 Years/.test(t)) return '2yr';
    if (/^YTD/.test(t)) return 'ytd';
    if (/^Imputed/.test(t)) return 'imputed';
    return null;
  }
  function readCard(card) {
    const sections = card.closest('.income-sections');
    const party = sections && sections.id.startsWith('partyB') ? 'partyB' : 'partyA';
    const amounts = {};
    Object.keys(INPUTS).forEach((b) => { const el = card.querySelector(INPUTS[b]); const v = el ? parseFloat(el.value) : NaN; amounts[b] = Number.isNaN(v) ? null : v; });
    const basis = basisOf(card);
    const head = card.querySelector('.income-card-header span');
    return { card, party, name: head ? head.textContent.trim() : 'Income source', amounts, basis, selected: basis ? (amounts[basis] || 0) : 0 };
  }
  const cards = (party) => [...document.querySelectorAll(`#${party}-income-sections .income-card`)].map(readCard);
  const sum = (list) => list.reduce((a, c) => a + c.selected, 0);
  const inputsOf = (c) => Object.keys(INPUTS).map((b) => ({ label: LABELS[b], value: c.amounts[b] == null ? 'not entered' : c.amounts[b], origin: 'entered' }));
  const fieldValue = (card, i) => { const el = card.querySelectorAll('.source-input')[i]; return el ? el.value : ''; };

  async function onFile(ctx, parties) {
    const lists = await Promise.all([...parties.map((p) => ctx.metric(['accepted-income', { party: PARTY_METRIC[p] }])), ctx.metric(['documents', { category: 'Tax Returns & Income' }])]);
    const seen = new Set(); const sources = [];
    lists.forEach((l) => (l.sources || []).forEach((s) => { if (!seen.has(s.documentId)) { seen.add(s.documentId); sources.push({ ...s, contribution: 'On file. Not linked to this figure.' }); } }));
    return { sources, accepted: lists.slice(0, parties.length).reduce((a, l) => a + (Number(l.value) || 0), 0) };
  }
  const NOT_LINKED = 'These amounts are typed on the card. Any documents listed are this matter\'s income documents on file, to compare by hand.';
  async function withDocs(ctx, r, parties) {
    const f = await onFile(ctx, parties);
    r.sources = f.sources;
    r.summary = { ...(r.summary || {}), 'Accepted in the Income Hub': ctx.money(f.accepted) };
    r.note = [r.note, NOT_LINKED].filter(Boolean).join(' ');
    return settle(ctx, r);
  }

  const COLS = [{ key: 'source', label: 'Income source' }, { key: 'basis', label: 'Selected basis' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }];
  const rowsOf = (list) => list.map((c) => ({ source: c.name, basis: c.basis ? LABELS[c.basis] : 'No basis selected', amount: c.selected }));

  function partyTotal(party, monthly) {
    return (ctx) => {
      const list = cards(party); const total = sum(list);
      const who = ctx.names[party === 'partyA' ? 'a' : 'b'];
      const calc = [`Total annual income = the selected amount on each of ${who}'s ${list.length} card${list.length === 1 ? '' : 's'} = ${ctx.money(total)}.`];
      if (monthly) calc.push(`Monthly = ${ctx.money(total)} / 12 = ${ctx.money(total / 12)}.`);
      return withDocs(ctx, { title: `${who}: ${monthly ? 'monthly income' : 'total annual income'}`, value: monthly ? total / 12 : total, columns: COLS, rows: rowsOf(list), calc }, [party]);
    };
  }
  function combined(monthly) {
    return (ctx) => {
      const a = cards('partyA'); const b = cards('partyB'); const total = sum(a) + sum(b);
      const calc = [`Combined annual income = ${ctx.money(sum(a))} + ${ctx.money(sum(b))} = ${ctx.money(total)}.`];
      if (monthly) calc.push(`Monthly = ${ctx.money(total)} / 12 = ${ctx.money(total / 12)}.`);
      return withDocs(ctx, { title: monthly ? 'Combined monthly income' : 'Combined annual income', value: monthly ? total / 12 : total, columns: COLS, rows: rowsOf(a.concat(b)), calc }, ['partyA', 'partyB']);
    };
  }

  function selectedRecon(ctx) {
    const c = readCard(ctx.el.closest('.income-card'));
    const calc = c.basis ? [`${LABELS[c.basis]} typed on this card = ${ctx.money(c.selected)}.`] : ['No basis has been selected on this card, so it counts as $0.'];
    return withDocs(ctx, { title: `${c.name}: selected for calculations`, value: c.selected, inputs: inputsOf(c), summary: { 'Selected basis': c.basis ? LABELS[c.basis] : 'None' }, calc }, [c.party]);
  }

  // This page's older window cannot open (its button stops on an error), so these stay at the written $0.
  const modalRecon = (ctx) => {
    if (ctx.displayed && ctx.displayed.value) return null;
    return { status: 'nodata', calc: ['This window is not filled in because the card\'s own View Recon button stops on an error before it opens. Use the "View recon" button at the foot of the card.'] };
  };

  async function cardRecon(ctx) {
    const c = readCard(ctx.el);
    const shown = ctx.el.querySelector('.selected-amount');
    showFigure(ctx, shown ? shown.textContent.trim() : '$0', c.name);
    const monthly = c.selected / 12;
    const rows = Object.keys(INPUTS).map((b) => ({ line: `Basis: ${LABELS[b]}${c.basis === b ? ' (selected)' : ''}`, amount: c.amounts[b], detail: c.amounts[b] == null ? 'Not entered' : 'Typed' }));
    rows.push({ line: 'Selected for calculations', amount: c.selected, detail: c.basis ? LABELS[c.basis] : 'No basis selected' });
    const calc = c.basis ? [`${LABELS[c.basis]} typed on this card = ${ctx.money(c.selected)}.`] : ['No basis has been selected on this card, so it counts as $0.'];
    calc.push(`Monthly average = ${ctx.money(c.selected)} / 12 = ${ctx.money(monthly)}.`, `Annualized = ${ctx.money(monthly)} x 12 = ${ctx.money(monthly * 12)}.`);
    const out = await withDocs(ctx, { title: `${c.name} - ${ctx.names[c.party === 'partyA' ? 'a' : 'b']}`, value: c.selected,
      columns: [{ key: 'line', label: 'Line' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }, { key: 'detail', label: 'Detail' }], rows,
      summary: { 'Selected basis': c.basis ? LABELS[c.basis] : 'None', 'Annual amount': ctx.money(c.selected), 'Monthly average': ctx.money(monthly), Status: fieldValue(c.card, 0) || 'Not set', 'Tax treatment': fieldValue(c.card, 1) || 'Not set', 'Supporting documents (typed)': fieldValue(c.card, 2) || 'None', 'Data sources (typed)': fieldValue(c.card, 3) || 'None', 'Why this basis': fieldValue(c.card, 4) || 'Not stated' },
      calc }, [c.party]);
    if (!c.basis) { const any = Object.values(c.amounts).some((v) => v != null); out.status = any ? 'explained' : 'nodata'; out.note = any ? `Amounts are entered but no basis is selected, so this source counts as $0. ${NOT_LINKED}` : 'Nothing has been entered on this card yet.'; }
    return out;
  }

  // The card has no padding of its own, so the button needs a little room.
  const style = document.createElement('style');
  style.textContent = '.income-card > .vr-card-btn{margin:0 0 12px 16px}.income-card:not(.open) > .vr-card-btn{margin-top:12px}';
  document.head.appendChild(style);

  VeritasRecon.define({
    byId: {
      'partyA-total': partyTotal('partyA', false), 'partyB-total': partyTotal('partyB', false),
      'partyA-detail': partyTotal('partyA', true), 'partyB-detail': partyTotal('partyB', true),
      'combined-total': combined(false), 'combined-detail': combined(true),
      'recon-monthly': modalRecon, 'recon-annual': modalRecon, 'recon-paychecks': modalRecon,
    },
    match: [{ selector: '.selected-amount', recon: selectedRecon }],
    cards: [{ selector: '.income-card', recon: cardRecon }],
  });
})();
