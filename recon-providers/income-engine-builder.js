// Recons for the Income Engine, Builder Mode (income-engine-builder.html).
// Everything is rebuilt from the fields on each income card. The amounts are typed by
// a person and nothing on this page links them to a document, so income documents are
// listed as "on file" to compare by hand, and the figures stay "calculated", not "tied".
(function () {
  const THIS_YEAR = new Date().getFullYear();
  const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const LABELS = { '3yr': 'Last 3 years average', '2yr': 'Last 2 years average', ytd: 'YTD run-rate', imputed: 'Imputed / vocational', excluded: 'Excluded from income' };
  const PARTIES = { partyA: 'party_a', partyB: 'party_b' };

  const ties = (d, v) => { const f = Math.pow(10, d.decimals); return Math.abs(Math.round((Math.abs(Number(v)) / d.scale) * f) / f - d.raw) < 0.5 / f + 1e-9; };
  // Rows and inputs here are typed, so a figure that ties is calculated rather than tied to a document.
  function settle(ctx, r) {
    const d = ctx.displayed;
    if (r.value == null || !d || !ties(d, r.value)) return r;
    const any = (r.inputs || []).some((i) => Number(i.value)) || (r.rows || []).some((x) => Number(x.amount));
    r.status = d.value === 0 && !any ? 'nodata' : 'calculated';
    return r;
  }
  // Makes a card's recon compare against one figure instead of the card's whole text.
  function showFigure(ctx, text, label) {
    const m = String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    const raw = m ? Number(m[0]) : 0;
    ctx.text = text; ctx.label = label;
    ctx.displayed = { kind: 'money', value: raw, raw, scale: 1, decimals: m ? (m[0].split('.')[1] || '').length : 0, negative: false };
  }

  const fieldText = (card, name) => { const el = card.querySelector(`[data-field="${name}"]`); return el ? el.value : ''; };
  const fieldNum = (card, name) => { const v = parseFloat(fieldText(card, name)); return Number.isNaN(v) ? null : Math.max(0, v); };
  const average = (vals) => { const got = vals.filter((v) => v != null); return got.length ? { value: got.reduce((a, b) => a + b, 0) / got.length, n: got.length, of: vals.length, used: got } : null; };

  function readCard(card) {
    const sections = card.closest('.income-sections');
    const party = sections && sections.id.startsWith('partyB') ? 'partyB' : 'partyA';
    const head = card.querySelector('.income-card-header span');
    const y3 = fieldNum(card, 'y3'); const y2 = fieldNum(card, 'y2'); const y1 = fieldNum(card, 'y1');
    const ytd = fieldNum(card, 'ytd'); const imputed = fieldNum(card, 'imputed');
    const months = Math.min(12, fieldNum(card, 'ytdMonths') || Math.max(1, new Date().getMonth()));
    const bases = {
      '3yr': average([y3, y2, y1]), '2yr': average([y2, y1]),
      ytd: ytd != null ? { value: (ytd / months) * 12, months } : null,
      imputed: imputed != null ? { value: imputed } : null,
      excluded: { value: 0 },
    };
    const basis = card.dataset.basis || null;
    const picked = basis ? bases[basis] : null;
    return { card, party, name: head ? head.textContent.trim() : 'Income source', y3, y2, y1, ytd, months, imputed, bases, basis, selected: picked ? picked.value : 0, entered: [y3, y2, y1, ytd, imputed].some((v) => v != null) };
  }

  const allCards = (party) => [...document.querySelectorAll(`#${party}-income-sections .income-card`)].map(readCard);

  function basisSteps(c, b, money) {
    const r = c.bases[b];
    if (b === 'excluded') return ['This source is excluded from income, so it counts as $0.'];
    if (!r) return [`${LABELS[b]} has no amounts entered, so it counts as $0.`];
    if (b === 'ytd') return [`YTD run-rate = ${money(c.ytd)} / ${r.months} month${r.months === 1 ? '' : 's'} x 12 = ${money(r.value)}.`];
    if (b === 'imputed') return [`Imputed amount typed on this card = ${money(r.value)}.`];
    return [`Average = (${r.used.map(money).join(' + ')}) / ${r.n} year${r.n === 1 ? '' : 's'} entered = ${money(r.value)}. A blank year is left out, not counted as $0.`];
  }

  const enteredInputs = (c) => [
    { label: `${THIS_YEAR - 3} total`, value: c.y3 == null ? 'not provided' : c.y3, origin: 'entered' },
    { label: `${THIS_YEAR - 2} total`, value: c.y2 == null ? 'not provided' : c.y2, origin: 'entered' },
    { label: `${THIS_YEAR - 1} total`, value: c.y1 == null ? 'not provided' : c.y1, origin: 'entered' },
    { label: `${THIS_YEAR} year-to-date`, value: c.ytd == null ? 'not provided' : c.ytd, origin: 'entered' },
    { label: 'YTD covers (months)', value: c.months, origin: fieldNum(c.card, 'ytdMonths') ? 'entered' : 'default' },
    { label: 'Imputed', value: c.imputed == null ? 'not provided' : c.imputed, origin: 'entered' },
  ];

  // Income documents on file. They are listed to compare by hand, not as proof of the figure.
  async function onFile(ctx, parties) {
    const lists = await Promise.all([
      ...parties.map((p) => ctx.metric(['accepted-income', { party: PARTIES[p] }])),
      ctx.metric(['documents', { category: 'Tax Returns & Income' }]),
    ]);
    const seen = new Set();
    const sources = [];
    lists.forEach((l) => (l.sources || []).forEach((s) => {
      if (seen.has(s.documentId)) return;
      seen.add(s.documentId);
      sources.push({ ...s, contribution: 'On file. Not linked to this figure.' });
    }));
    const accepted = lists.slice(0, parties.length).reduce((a, l) => a + (Number(l.value) || 0), 0);
    return { sources, accepted };
  }
  const NOT_LINKED = 'These amounts are typed on the card. Any documents listed are this matter\'s income documents on file, to compare by hand.';

  async function withDocs(ctx, r, parties) {
    const f = await onFile(ctx, parties);
    r.sources = f.sources;
    r.summary = { ...(r.summary || {}), 'Accepted in the Income Hub': ctx.money(f.accepted) };
    r.note = [r.note, NOT_LINKED].filter(Boolean).join(' ');
    return settle(ctx, r);
  }

  async function basisRecon(ctx) {
    const el = ctx.el.closest('[data-basis-val]');
    const c = readCard(el.closest('.income-card'));
    const b = el.dataset.basisVal;
    const r = c.bases[b];
    if (!r) return null;
    return withDocs(ctx, { title: `${c.name}: ${LABELS[b]}`, value: r.value, inputs: enteredInputs(c), calc: basisSteps(c, b, ctx.money) }, [c.party]);
  }

  async function selectedRecon(ctx) {
    const c = readCard(ctx.el.closest('.income-card'));
    const calc = c.basis ? basisSteps(c, c.basis, ctx.money) : ['No basis has been selected on this card, so it counts as $0.'];
    return withDocs(ctx, { title: `${c.name}: selected for calculations`, value: c.selected, inputs: enteredInputs(c), summary: { 'Selected basis': c.basis ? LABELS[c.basis] : 'None' }, calc }, [c.party]);
  }

  const totalRows = (cards, ctx) => cards.map((c) => ({ source: c.name, party: ctx.names[c.party === 'partyA' ? 'a' : 'b'], basis: c.basis ? LABELS[c.basis] : 'No basis selected', amount: c.selected }));
  const TOTAL_COLS = [{ key: 'source', label: 'Income source' }, { key: 'party', label: 'Party' }, { key: 'basis', label: 'Selected basis' }, { key: 'amount', label: 'Annual amount', money: true, align: 'right' }];
  const sum = (cards) => cards.reduce((a, c) => a + c.selected, 0);
  const counted = (cards) => cards.filter((c) => c.basis && c.basis !== 'excluded').length;

  function partyTotal(party, monthly) {
    return async (ctx) => {
      const cards = allCards(party);
      const total = sum(cards);
      const who = ctx.names[party === 'partyA' ? 'a' : 'b'];
      const calc = [`Total annual income = the selected amount on each of ${who}'s ${cards.length} card${cards.length === 1 ? '' : 's'} = ${ctx.money(total)}.`];
      if (monthly) calc.push(`Monthly = ${ctx.money(total)} / 12 = ${ctx.money(total / 12)}.`);
      return withDocs(ctx, { title: `${who}: ${monthly ? 'monthly income' : 'total annual income'}`, value: monthly ? total / 12 : total, columns: TOTAL_COLS, rows: totalRows(cards, ctx), summary: { 'Sources counted': counted(cards), 'Annual total': ctx.money(total), 'Monthly average': ctx.money(total / 12) }, calc }, [party]);
    };
  }

  async function combinedRecon(ctx, kind) {
    const a = allCards('partyA'); const b = allCards('partyB');
    const ta = sum(a); const tb = sum(b); const all = ta + tb;
    const pct = (n) => (all ? Math.round((n / all) * 100) : 0);
    const calc = [`Combined annual income = ${ctx.money(ta)} + ${ctx.money(tb)} = ${ctx.money(all)}.`];
    let value = all; let title = 'Combined annual income';
    if (kind === 'monthly') { value = all / 12; title = 'Combined monthly income'; calc.push(`Monthly = ${ctx.money(all)} / 12 = ${ctx.money(all / 12)}.`); }
    if (kind === 'a') { value = pct(ta); title = `${ctx.names.a}: share of combined income`; calc.push(`Share = ${ctx.money(ta)} / ${ctx.money(all)}, rounded to a whole percent = ${value}%.`); }
    if (kind === 'b') { value = pct(tb); title = `${ctx.names.b}: share of combined income`; calc.push(`Share = ${ctx.money(tb)} / ${ctx.money(all)}, rounded to a whole percent = ${value}%.`); }
    return withDocs(ctx, { title, value, columns: TOTAL_COLS, rows: totalRows(a.concat(b), ctx), summary: { [ctx.names.a]: ctx.money(ta), [ctx.names.b]: ctx.money(tb), Combined: ctx.money(all) }, calc }, ['partyA', 'partyB']);
  }

  function combinedDetail(ctx) {
    const nums = [...document.querySelectorAll('#combined-detail .vr-num')];
    return combinedRecon(ctx, ['monthly', 'a', 'b'][Math.max(0, nums.indexOf(ctx.el))]);
  }

  // The page's own older window shows whichever card last pressed its button; its title names the card.
  function modalCard(ctx) {
    const title = ctx.txt('#recon-title');
    for (const party of Object.keys(PARTIES)) {
      const who = ctx.names[party === 'partyA' ? 'a' : 'b'];
      const hit = allCards(party).find((c) => title === `${c.name} — ${who} — Reconciliation`);
      if (hit) return hit;
    }
    return null;
  }
  function modalRecon(kind) {
    return async (ctx) => {
      const c = modalCard(ctx);
      if (!c) {
        if (ctx.displayed && ctx.displayed.value) return null;
        return { status: 'nodata', calc: ['This window fills in when a card\'s own View Recon button is pressed. None has been pressed.'] };
      }
      const value = kind === 'monthly' ? c.selected / 12 : c.selected;
      const calc = [`Selected annual amount on the ${c.name} card = ${ctx.money(c.selected)}.`];
      if (kind === 'monthly') calc.push(`Monthly = ${ctx.money(c.selected)} / 12 = ${ctx.money(value)}.`);
      if (kind === 'gross') calc.push('This window reports the amount once per year, so the gross for the period is the annual amount.');
      return withDocs(ctx, { title: `${c.name}: ${{ monthly: 'monthly amount', annual: 'annualized', gross: 'gross' }[kind]}`, value, inputs: enteredInputs(c), calc }, [c.party]);
    };
  }

  // The older window's "How Calculated" text repeats the annual amount twice; the rest is typed wording.
  function methodologyRecon(ctx) {
    const label = ctx.el.closest('div') ? (ctx.el.closest('div').querySelector('strong') || {}).textContent || '' : '';
    if (/Amount|Calculated Annual/.test(label)) return modalRecon('annual')(ctx);
    return { status: 'text', calc: ['This number is part of the wording in this window.'] };
  }

  // The bonus recommendation quotes one average; the rest of its numbers are guidance wording.
  function bonusRecoRecon(ctx) {
    const c = readCard(ctx.el.closest('.income-card'));
    const b3 = c.bases['3yr'];
    const avg = b3 && b3.n === 3 ? b3 : (c.bases['2yr'] || b3);
    const isCount = /^-year average\)/.test(ctx.after) && /\($/.test(ctx.before);
    const isMoney = ctx.displayed && ctx.displayed.kind === 'money';
    if (!avg || (!isCount && !isMoney)) return { status: 'text', calc: ['This number is part of the guidance wording on this card. It does not come from this client\'s records.'] };
    const which = avg === b3 ? '3yr' : '2yr';
    return withDocs(ctx, { title: `${c.name}: average quoted in the recommendation`, value: isCount ? avg.n : avg.value, format: isCount ? 'count' : undefined, inputs: enteredInputs(c), calc: basisSteps(c, which, ctx.money) }, [c.party]);
  }

  function noteRecon(ctx) {
    const box = ctx.el.closest('[data-basis-note]');
    const c = readCard(ctx.el.closest('.income-card'));
    const b = box.dataset.basisNote;
    const r = c.bases[b];
    if (!r) return null;
    if (b === 'ytd') return { title: `${c.name}: months annualized`, value: r.months, format: 'count', inputs: enteredInputs(c).slice(4, 5), calc: [`Months = the "YTD covers" field, or the months finished this year if it is blank, up to 12 = ${r.months}.`] };
    return { title: `${c.name}: years in this average`, value: r.of, format: 'count', calc: [`This average looks at ${r.of} years. ${r.n} of them have an amount entered.`] };
  }

  // The "View recon" button on each income source card.
  async function cardRecon(ctx) {
    const c = readCard(ctx.el);
    const shown = ctx.el.querySelector('.selected-amount');
    showFigure(ctx, shown ? shown.textContent.trim() : fmt(c.selected), c.name);
    const money = ctx.money;
    const row = (line, amount, detail) => ({ line, amount, detail });
    const basisNote = (b, r) => (!r ? 'Nothing entered' : b === 'ytd' ? `${r.months} month(s) annualized` : r.n ? `${r.n} of ${r.of} years entered` : 'Typed amount');
    const rows = [
      row(`${THIS_YEAR - 3} total`, c.y3, c.y3 == null ? 'Not provided' : 'Entered'),
      row(`${THIS_YEAR - 2} total`, c.y2, c.y2 == null ? 'Not provided' : 'Entered'),
      row(`${THIS_YEAR - 1} total`, c.y1, c.y1 == null ? 'Not provided' : 'Entered'),
      row(`${THIS_YEAR} year-to-date`, c.ytd, c.ytd == null ? 'Not provided' : `Covers ${c.months} month(s)`),
    ];
    ['3yr', '2yr', 'ytd', 'imputed'].forEach((b) => {
      const r = c.bases[b];
      rows.push(row(`Basis: ${LABELS[b]}${c.basis === b ? ' (selected)' : ''}`, r ? r.value : null, basisNote(b, r)));
    });
    if (c.basis === 'excluded') rows.push(row(`Basis: ${LABELS.excluded} (selected)`, 0, 'Counted as $0'));
    rows.push(row('Selected for calculations', c.selected, c.basis ? LABELS[c.basis] : 'No basis selected'));

    const monthly = c.selected / 12;
    const calc = c.basis ? basisSteps(c, c.basis, money) : ['No basis has been selected on this card, so it counts as $0.'];
    calc.push(`Annual amount used = ${money(c.selected)}.`, `Monthly average = ${money(c.selected)} / 12 = ${money(monthly)}.`, `Annualized = ${money(monthly)} x 12 = ${money(monthly * 12)}.`);
    const summary = {
      'Selected basis': c.basis ? LABELS[c.basis] : 'None', 'Annual amount': money(c.selected), 'Monthly average': money(monthly),
      Status: fieldText(c.card, 'status') || 'Not set', 'Tax treatment': fieldText(c.card, 'tax') || 'Not set',
      'Supporting documents (typed)': fieldText(c.card, 'docs') || 'None', 'Data sources (typed)': fieldText(c.card, 'evidence') || 'None', 'Why this basis': fieldText(c.card, 'why') || 'Not stated',
    };
    const out = await withDocs(ctx, { title: `${c.name} - ${ctx.names[c.party === 'partyA' ? 'a' : 'b']}`, value: c.selected,
      columns: [{ key: 'line', label: 'Line' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }, { key: 'detail', label: 'Detail' }], rows, summary, calc }, [c.party]);
    if (!c.basis) { out.status = c.entered ? 'explained' : 'nodata'; out.note = c.entered ? `Amounts are entered but no basis is selected, so this source adds $0 to the totals. ${NOT_LINKED}` : 'Nothing has been entered on this card yet.'; }
    return out;
  }

  // The card has no padding of its own, so the button needs a little room.
  const style = document.createElement('style');
  style.textContent = '.income-card > .vr-card-btn{margin:0 0 12px 16px}.income-card:not(.open) > .vr-card-btn{margin-top:12px}';
  document.head.appendChild(style);

  // "2026 year-to-date" is a field name. Cards restored before this file loaded were already
  // scanned as a figure, so that is undone here; the inert rule below covers later cards.
  document.querySelectorAll('.income-card .source-label').forEach((label) => {
    label.querySelectorAll('.vr-info').forEach((i) => i.remove());
    label.querySelectorAll('.vr-num').forEach((n) => n.replaceWith(document.createTextNode(n.textContent)));
    label.normalize();
  });

  VeritasRecon.define({
    byId: {
      'partyA-total': partyTotal('partyA', false),
      'partyB-total': partyTotal('partyB', false),
      'partyA-detail': partyTotal('partyA', true),
      'partyB-detail': partyTotal('partyB', true),
      'combined-total': (ctx) => combinedRecon(ctx, 'total'),
      'combined-detail': combinedDetail,
      'recon-monthly': modalRecon('monthly'),
      'recon-annual': modalRecon('annual'),
      'recon-paychecks': modalRecon('gross'),
      'recon-methodology': methodologyRecon,
    },
    match: [
      { selector: '[data-basis-val]', recon: basisRecon },
      { selector: '[data-basis-note]', recon: noteRecon },
      { selector: '.selected-amount', recon: selectedRecon },
      { selector: '.bonus-reco', recon: bonusRecoRecon },
      { selector: 'button[data-basis="excluded"]', recon: () => ({ status: 'text', calc: ['This button counts the bonus as $0. The amount is part of the button\'s wording.'] }) },
      { selector: '[data-field="imputed"]', recon: (ctx) => { ctx.label = `${readCard(ctx.el.closest('.income-card')).name}: imputed amount`; return null; } },
    ],
    cards: [{ selector: '.income-card', recon: cardRecon }],
    inert: ['.income-card .source-label'],
  });
})();
