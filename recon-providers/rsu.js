// Recons for RSU / Stock Analysis (rsu.html). Every figure is rebuilt here from the saved grants,
// tranche edits, and settings, using the method described on the page. Nothing is read from the tables.
(function () {
  const METHODS = { hug: 'Hug', nelson: 'Nelson', mix: 'Mix', neither: 'Other basis' };
  const ms = (s) => Date.parse(`${s}T00:00:00Z`);
  const days = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const pct = (p) => `${(p * 100).toFixed(2)}%`;
  const sh = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const addMonths = (s, n) => {
    const d = new Date(`${s}T00:00:00Z`);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
  };

  function loadState(ctx) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('veritas.rsu.v3') || 'null'); } catch (e) { saved = null; }
    saved = saved || {};
    let intake = ctx.matter && ctx.matter.details;
    if (typeof intake === 'string') { try { intake = JSON.parse(intake); } catch (e) { intake = null; } }
    return { settings: saved.settings || {}, grants: Array.isArray(saved.grants) ? saved.grants : [], tranches: saved.tranches || {}, intake: intake || {} };
  }

  // Community share of one tranche, with the day counts behind it.
  function share(grant, vest, method, d) {
    if (!d.dos || !grant.grantDate || !vest) return { pct: null, why: 'A needed date is missing.' };
    if (ms(grant.grantDate) > ms(d.dos)) return { pct: 0, why: 'Granted after the date of service, so separate (0%).' };
    if (d.marriage && ms(vest) <= ms(d.marriage)) return { pct: 0, why: 'Vested before the marriage, so separate (0%).' };
    const start = method === 'hug' ? d.hire : grant.grantDate;
    if (!start) return { pct: null, why: 'The hire date is missing.' };
    const den = days(start, vest);
    if (den <= 0) return { pct: 1, why: 'The start date is on or after the vest date, so 100%.' };
    const from = !d.marriage || ms(start) > ms(d.marriage) ? start : d.marriage;
    const to = ms(d.dos) < ms(vest) ? d.dos : vest;
    const numer = days(from, to);
    const p = clamp01(numer / den);
    return { pct: p, why: `${METHODS[method]}: ${numer} days from ${from} to ${to}, divided by ${den} days from ${start} to ${vest} = ${pct(p)}.` };
  }

  function rebuild(ctx) {
    const s = loadState(ctx);
    const get = (id) => { const v = s.settings[id]; return v !== undefined && v !== '' ? v : ''; };
    const d = { marriage: get('marriageDate') || s.intake.marriageDate || '', dos: get('dosDate') || s.intake.separationDate || '', hire: get('hireDate') };
    const asOf = get('asOf') || new Date().toISOString().slice(0, 10);
    const price = num(get('price'));
    const method = get('method') || 'hug';
    const split = get('split') === '' ? 0.5 : clamp01(num(get('split')) / 100);
    const reserve = get('reserve') === '' ? 0.15 : clamp01(num(get('reserve')) / 100);
    const nelsonShare = get('nelsonPct') === '' ? 0.5 : clamp01(num(get('nelsonPct')) / 100);
    const otherShare = get('otherPct') === '' ? null : clamp01(num(get('otherPct')) / 100);
    const mixName = `${(nelsonShare * 100).toFixed(0)}% Nelson / ${((1 - nelsonShare) * 100).toFixed(0)}% Hug`;
    const label = method === 'mix' ? mixName : METHODS[method];

    const trancheList = (g) => {
      const total = num(g.shares);
      const count = Math.max(1, Math.round(num(g.count)) || 1);
      const months = Math.max(1, Math.round(num(g.months)) || 12);
      if (!g.grantDate || !total) return [];
      const first = g.firstVest || addMonths(g.grantDate, months);
      return Array.from({ length: count }, (_, i) => {
        const key = `${g.id}:${i}`;
        const ov = s.tranches[key] || {};
        const edited = ov.shares !== undefined && ov.shares !== '';
        const date = ov.date || addMonths(first, months * i);
        const hug = share(g, date, 'hug', d);
        const nelson = share(g, date, 'nelson', d);
        const mix = hug.pct == null || nelson.pct == null ? { pct: null, why: 'Mix needs both the Hug and the Nelson share, and one is missing a date.' }
          : { pct: nelsonShare * nelson.pct + (1 - nelsonShare) * hug.pct, why: `${hug.why} ${nelson.why} Mix = ${(nelsonShare * 100).toFixed(2)}% x Nelson ${pct(nelson.pct)} + ${((1 - nelsonShare) * 100).toFixed(2)}% x Hug ${pct(hug.pct)} = ${pct(nelsonShare * nelson.pct + (1 - nelsonShare) * hug.pct)}.` };
        const neither = d.dos && ms(g.grantDate) > ms(d.dos) ? { pct: 0, why: 'Granted after the date of service, so it stays separate (0%) even under an entered share.' }
          : otherShare == null ? { pct: null, why: 'No community share has been entered.' } : { pct: otherShare, why: `Neither formula is used. The community share entered for each tranche = ${pct(otherShare)}.` };
        const byMethod = { hug, nelson, mix, neither };
        return { key, grant: g, index: i + 1, count, date, shares: edited ? num(ov.shares) : total / count, edited, equalShare: total / count, basis: ov.basis === undefined || ov.basis === null ? '' : ov.basis,
          vestPrice: ov.vestPrice === undefined || ov.vestPrice === null ? '' : ov.vestPrice, priceSource: ov.priceSource || '', hug, nelson, mix, neither, used: byMethod[method] || hug };
      });
    };

    const all = [];
    const t1 = s.grants.map((g) => {
      const tr = trancheList(g);
      all.push(...tr);
      const vestedNow = tr.filter((t) => ms(t.date) <= ms(asOf));
      const vested = vestedNow.reduce((a, t) => a + t.shares, 0);
      const atDos = d.dos ? tr.filter((t) => ms(t.date) <= ms(d.dos)).reduce((a, t) => a + t.shares, 0) : null;
      const net = vested - num(g.tax) + num(g.deu) - num(g.sold);
      const blend = vested > 0 ? (vestedNow.every((t) => t.used.pct != null) ? vestedNow.reduce((a, t) => a + t.shares * t.used.pct, 0) / vested : null) : 0;
      const mShares = blend == null ? null : net * blend;
      const gross = mShares == null ? null : mShares * price;
      const gain = mShares == null ? null : mShares * (price - num(g.basis));
      const afterReserve = gross == null ? null : gross - Math.max(0, gain) * reserve;
      return { g, tr, vestedNow, vested, atDos, net, blend, mShares, gross, gain, afterReserve, each: mShares == null ? null : mShares * split };
    });
    const total = (f) => t1.reduce((a, x) => (a == null || x[f] == null ? null : a + x[f]), 0);
    const tot = { granted: s.grants.reduce((a, g) => a + num(g.shares), 0), atDos: total('atDos'), vested: total('vested'), net: total('net'), tax: s.grants.reduce((a, g) => a + num(g.tax), 0), deu: s.grants.reduce((a, g) => a + num(g.deu), 0), sold: s.grants.reduce((a, g) => a + num(g.sold), 0), mShares: total('mShares'), gross: total('gross'), gain: total('gain'), afterReserve: total('afterReserve'), each: total('each') };

    const byDate = (a, b) => ms(a.date) - ms(b.date) || String(a.grant.grantDate).localeCompare(String(b.grant.grantDate));
    const t2 = d.dos ? all.filter((t) => ms(t.date) > ms(d.dos)).sort(byDate) : [];
    t2.forEach((t) => {
      t.post = ms(t.grant.grantDate) > ms(d.dos);
      t.vested = ms(t.date) <= ms(asOf);
      t.mShares = t.used.pct == null ? null : t.shares * t.used.pct;
      t.basisFromPrice = t.basis === '' && t.vested && t.vestPrice !== '';
      t.basisValue = t.basis !== '' ? num(t.basis) : t.vested ? (t.basisFromPrice ? t.shares * num(t.vestPrice) : null) : t.shares * price;
      t.mValue = t.basisValue == null || t.used.pct == null ? null : t.basisValue * t.used.pct;
    });
    const remaining = t2.filter((t) => !t.vested && !t.post);
    const add = (list, fn) => list.reduce((a, t) => { const v = fn(t); return a == null || v == null ? null : a + v; }, 0);
    const rem = { shares: add(remaining, (t) => t.shares), mShares: add(remaining, (t) => t.mShares), hug: add(remaining, (t) => (t.hug.pct == null ? null : t.shares * t.hug.pct)), nelson: add(remaining, (t) => (t.nelson.pct == null ? null : t.shares * t.nelson.pct)), mix: add(remaining, (t) => (t.mix.pct == null ? null : t.shares * t.mix.pct)), mValue: add(remaining, (t) => t.mValue) };

    const t3 = [...all].sort(byDate);
    t3.forEach((t) => { t.vestValue = t.vestPrice === '' ? null : t.shares * num(t.vestPrice); });
    const today = new Date().toISOString().slice(0, 10);
    const unpriced = t3.filter((t) => ms(t.date) <= ms(today) && t.vestPrice === '');
    const t3Tot = { shares: t3.reduce((a, t) => a + t.shares, 0), value: t3.reduce((a, t) => a + (t.vestValue || 0), 0), unpriced };

    const nameOf = (x) => (window.VeritasMatter && window.VeritasMatter.partyNames && window.VeritasMatter.partyNames[x]) || (x === 'a' ? 'Party A' : 'Party B');
    const employee = get('employee') || 'a';
    return { s, d, asOf, price, method, M: label, nelsonShare, otherShare, split, reserve, t1, tot, all, t2, remaining, rem, t3, t3Tot, np: nameOf(employee === 'a' ? 'b' : 'a') };
  }

  const trColumns = [{ key: 'grant', label: 'Grant' }, { key: 'date', label: 'Vest date' }, { key: 'status', label: 'Status' }, { key: 'pct', label: 'Community %', align: 'right' }, { key: 'shares', label: 'Shares', align: 'right' }];
  const trRow = (r, t) => ({ grant: `${t.grant.grantId || 'Grant'} (${t.index}/${t.count})`, date: t.date, status: ms(t.date) <= ms(r.asOf) ? 'Vested' : 'Not vested', pct: t.used.pct == null ? 'Needs a date' : pct(t.used.pct), shares: sh(t.shares) });
  const grantColumns = (label) => [{ key: 'grant', label: 'Grant' }, { key: 'value', label, align: 'right' }];
  const settingInputs = (r) => [
    { label: 'Date of marriage', value: r.d.marriage || 'Not entered', origin: r.s.settings.marriageDate ? 'entered' : 'intake' }, { label: 'Date of service', value: r.d.dos || 'Not entered', origin: r.s.settings.dosDate ? 'entered' : 'intake' },
    { label: 'Hire date', value: r.d.hire || 'Not entered', origin: 'entered' }, { label: 'Ledger as of', value: r.asOf, origin: r.s.settings.asOf ? 'entered' : 'default' }, { label: 'Method', value: r.M, origin: r.s.settings.method ? 'entered' : 'default' },
    ...(r.method === 'mix' ? [{ label: 'Nelson %', value: r.nelsonShare * 100, origin: r.s.settings.nelsonPct ? 'entered' : 'default' }, { label: 'Hug %', value: (1 - r.nelsonShare) * 100, origin: r.s.settings.nelsonPct ? 'entered' : 'default' }] : []),
    ...(r.method === 'neither' ? [{ label: 'Community share of each tranche (%)', value: r.otherShare == null ? 'Not entered' : r.otherShare * 100, origin: 'entered' }, { label: 'Why neither applies', value: r.s.settings.otherBasis || 'Not recorded', origin: 'entered' }] : []),
    { label: 'Share price', value: r.price, origin: 'entered' }, { label: 'Non-employee share (%)', value: r.split * 100, origin: r.s.settings.split ? 'entered' : 'default' }, { label: 'Tax reserve on gain (%)', value: r.reserve * 100, origin: r.s.settings.reserve ? 'entered' : 'default' },
  ];
  const NOTE = 'Grants, dates, and share counts are typed from the award notices and statements. Nothing on this page links them to a document.';

  // ---------- Table 1 ----------
  function grantCell(ctx, r, row, col) {
    const m = ctx.money;
    const g = row.g;
    const name = g.grantId || 'Grant';
    const base = { columns: trColumns, rows: row.tr.map((t) => trRow(r, t)), inputs: settingInputs(r), note: NOTE };
    const netLine = `Net held = vested ${sh(row.vested)} - tax withheld ${sh(num(g.tax))} + dividend shares ${sh(num(g.deu))} - sold ${sh(num(g.sold))} = ${sh(row.net)}.`;
    const blendLine = row.blend == null ? 'A vested tranche is missing a date, so no blended percentage can be built.' : `${r.M} % = each vested tranche's percentage weighted by its shares = ${pct(row.blend)}.`;
    const mLine = `Marital shares = ${sh(row.net)} x ${row.blend == null ? '?' : pct(row.blend)} = ${sh(row.mShares)}.`;
    switch (col) {
      case 4: return { ...base, title: `${name}: vested at date of service`, value: row.atDos, calc: [`Add the shares of tranches vesting on or before ${r.d.dos || 'the date of service'} = ${sh(row.atDos)}.`] };
      case 5: return { ...base, title: `${name}: vested to date`, value: row.vested, calc: [`Add the shares of tranches vesting on or before ${r.asOf} = ${sh(row.vested)}.`] };
      case 9: return { ...base, title: `${name}: net held`, value: row.net, calc: [netLine] };
      case 10: return { ...base, title: `${name}: ${r.M} %`, value: row.blend == null ? null : row.blend * 100, calc: [...row.vestedNow.map((t) => t.used.why), blendLine] };
      case 11: return { ...base, title: `${name}: marital shares`, value: row.mShares, calc: [netLine, blendLine, mLine] };
      case 12: return { ...base, title: `${name}: gross marital value`, value: row.gross, calc: [mLine, `Gross = ${sh(row.mShares)} x ${m(r.price)} = ${m(row.gross)}.`] };
      case 14: return { ...base, title: `${name}: unrealized gain`, value: row.gain, calc: [mLine, `Gain = ${sh(row.mShares)} x (${m(r.price)} - basis ${m(num(g.basis))}) = ${m(row.gain)}.`] };
      case 15: return { ...base, title: `${name}: after gain reserve`, value: row.afterReserve, calc: [`Gross ${m(row.gross)} less ${(r.reserve * 100).toFixed(1)}% of a gain of ${m(Math.max(0, row.gain))} = ${m(row.afterReserve)}.`] };
      case 16: return { ...base, title: `${name}: split in shares`, value: row.each, calc: [mLine, `Split = ${sh(row.mShares)} x ${(r.split * 100).toFixed(0)}% = ${sh(row.each)}.`] };
      default: return null;
    }
  }
  const T1_TOTALS = { 1: ['granted', 'Shares granted', (x) => num(x.g.shares)], 2: ['atDos', 'Vested at date of service', (x) => x.atDos], 3: ['vested', 'Vested to date', (x) => x.vested], 4: ['tax', 'Tax withheld', (x) => num(x.g.tax)], 5: ['deu', 'Dividend shares', (x) => num(x.g.deu)], 6: ['sold', 'Sold', (x) => num(x.g.sold)], 7: ['net', 'Net held', (x) => x.net], 9: ['mShares', 'Marital shares', (x) => x.mShares], 10: ['gross', 'Gross marital value', (x) => x.gross, true], 12: ['gain', 'Unrealized gain', (x) => x.gain, true], 13: ['afterReserve', 'After gain reserve', (x) => x.afterReserve, true], 14: ['each', 'Split in shares', (x) => x.each] };
  function t1Total(ctx, r, col) {
    const spec = T1_TOTALS[col];
    if (!spec) return null;
    const [key, label, fn, isMoney] = spec;
    const fmt = isMoney ? ctx.money : sh;
    return { title: `Table 1 total: ${label}`, value: r.tot[key], columns: grantColumns(label), rows: r.t1.map((x) => ({ grant: x.g.grantId || 'Grant', value: fn(x) == null ? 'Not available' : fmt(fn(x)) })), inputs: settingInputs(r), note: NOTE,
      calc: [`Add the ${label.toLowerCase()} of all ${r.t1.length} grants = ${r.tot[key] == null ? 'not available' : fmt(r.tot[key])}.`] };
  }

  // ---------- Table 2 ----------
  function t2Cell(ctx, r, t, col) {
    const m = ctx.money;
    const name = `${t.grant.grantId || 'Grant'}, vesting ${t.date}`;
    const base = { inputs: settingInputs(r), note: NOTE };
    const basisLine = t.basis !== '' ? `Basis = the W-2 / FMV figure typed for this tranche = ${m(num(t.basis))}.`
      : t.basisFromPrice ? `Basis = ${sh(t.shares)} shares x vesting-date price ${m(num(t.vestPrice))} from Table 3 = ${m(t.basisValue)}. No W-2 figure was entered.`
        : t.vested ? 'No W-2 figure or vesting-date price is entered, so this tranche has no basis.' : `Basis = ${sh(t.shares)} shares x current price ${m(r.price)} = ${m(t.basisValue)}.`;
    switch (col) {
      case 3: return { ...base, title: `${name}: Hug %`, value: t.hug.pct == null ? null : t.hug.pct * 100, calc: [t.hug.why] };
      case 4: return { ...base, title: `${name}: Nelson %`, value: t.nelson.pct == null ? null : t.nelson.pct * 100, calc: [t.nelson.why] };
      case 5: return { ...base, title: `${name}: marital shares`, value: t.mShares, calc: [t.used.why, `Marital shares = ${sh(t.shares)} x ${t.used.pct == null ? '?' : pct(t.used.pct)} = ${sh(t.mShares)}.`] };
      case 7: return { ...base, title: `${name}: value used`, value: t.mValue, calc: [t.used.why, basisLine, `Value used = ${m(t.basisValue)} x ${t.used.pct == null ? '?' : pct(t.used.pct)} = ${m(t.mValue)}.`] };
      default: return null;
    }
  }
  const t2Rows = (r, list) => ({ columns: trColumns, rows: list.map((t) => trRow(r, t)), inputs: settingInputs(r), note: NOTE });
  function t2Subtotal(ctx, r, year, col) {
    const m = ctx.money;
    const rows = r.t2.filter((t) => t.vested && t.date.startsWith(year));
    const pre = rows.filter((t) => !t.post);
    if (col === 1) { const v = pre.reduce((a, t) => a + t.shares, 0); return { ...t2Rows(r, pre), title: `${year} subtotal: shares`, value: v, calc: [`Add the ${pre.length} tranches vesting in ${year} from grants made before the date of service = ${sh(v)}.`] }; }
    if (col === 3) { const v = pre.reduce((a, t) => (a == null || t.mShares == null ? null : a + t.mShares), 0); return { ...t2Rows(r, pre), title: `${year} subtotal: marital shares`, value: v, calc: [`Add each tranche's shares x its ${r.M} % = ${sh(v)}.`] }; }
    if (col === 4) { const v = rows.reduce((a, t) => a + (t.basisValue || 0), 0); return { ...t2Rows(r, rows), title: `${year} subtotal: payroll gross`, value: v, calc: [`Add the W-2 / FMV basis of all ${rows.length} tranches vesting in ${year}, including any from grants made after the date of service = ${m(v)}.`], note: `${NOTE} A tranche with no W-2 figure uses shares x vesting-date price here, which is not a payroll amount.` }; }
    if (col === 5) { const v = pre.reduce((a, t) => (a == null || t.mValue == null ? null : a + t.mValue), 0); return { ...t2Rows(r, pre), title: `${year} subtotal: value used`, value: v, calc: [`Add each tranche's basis x its ${r.M} % = ${m(v)}.`] }; }
    return null;
  }
  function t2PostRow(ctx, r, col) {
    const list = r.t2.filter((t) => !t.vested && t.post);
    if (col === 1) { const v = list.reduce((a, t) => a + t.shares, 0); return { ...t2Rows(r, list), title: 'Unvested shares from grants after the date of service', value: v, calc: [`Add the ${list.length} unvested tranches from those grants = ${sh(v)}. They are separate and not counted.`] }; }
    return { ...t2Rows(r, list), title: 'Grants after the date of service', value: 0, calc: ['A grant made after the date of service is treated as separate, so its community share is 0.'] };
  }
  function t2Split(ctx, r, col) {
    const m = ctx.money;
    const base = t2Rows(r, r.remaining);
    const small = !!ctx.el.closest('small');
    const need = (v) => (v == null ? 'not available' : v);
    if (col === 1) return { ...base, title: 'Unvested shares counted for split', value: r.rem.shares, calc: [`Add the ${r.remaining.length} unvested tranches from grants made before the date of service = ${sh(r.rem.shares)}.`] };
    if (col === 2) return { ...base, title: 'Unvested marital shares under Hug', value: r.rem.hug, calc: [...r.remaining.map((t) => t.hug.why), `Add shares x Hug % = ${r.rem.hug == null ? 'not available' : sh(r.rem.hug)}.`] };
    if (col === 3) return { ...base, title: 'Unvested marital shares under Nelson', value: r.rem.nelson, calc: [...r.remaining.map((t) => t.nelson.why), `Add shares x Nelson % = ${r.rem.nelson == null ? 'not available' : sh(r.rem.nelson)}.`] };
    if (col === 4 && small && ctx.displayed.kind === 'percent') return { ...base, title: 'Non-employee share', value: r.split * 100, calc: [`The non-employee share is ${(r.split * 100).toFixed(0)}%${r.s.settings.split ? '' : ', the default when the field is blank'}.`] };
    if (col === 4 && small) return { ...base, title: `Unvested shares to ${r.np}`, value: r.rem.mShares == null ? null : r.rem.mShares * r.split, calc: [`${sh(r.rem.mShares)} marital shares x ${(r.split * 100).toFixed(0)}% = ${sh((r.rem.mShares || 0) * r.split)}.`] };
    if (col === 4) return { ...base, title: 'Unvested marital shares', value: r.rem.mShares, calc: [`Add shares x ${r.M} % for the tranches listed = ${need(r.rem.mShares == null ? null : sh(r.rem.mShares))}.`] };
    if (col === 6 && small) return { ...base, title: `Future value to ${r.np} (reference)`, value: r.rem.mValue == null ? null : r.rem.mValue * r.split, calc: [`${m(r.rem.mValue)} x ${(r.split * 100).toFixed(0)}% = ${m((r.rem.mValue || 0) * r.split)}. Reference only: unvested shares are divided in shares.`] };
    if (col === 6) return { ...base, title: 'Future value of unvested marital shares', value: r.rem.mValue, calc: [`Add each tranche's shares x current price ${m(r.price)} x its ${r.M} % = ${m(r.rem.mValue)}.`] };
    return null;
  }

  // ---------- Table 3 ----------
  const priceInput = (t) => ({ label: `Price on ${t.date}`, value: t.vestPrice === '' ? 'Not entered' : num(t.vestPrice), origin: t.priceSource || 'Typed in; no price source recorded' });
  const t3Columns = (ctx) => [{ key: 'date', label: 'Vest date' }, { key: 'grant', label: 'Grant' }, { key: 'shares', label: 'Shares', align: 'right' }, { key: 'price', label: 'Vest price', align: 'right' }, { key: 'source', label: 'Price source' }, { key: 'value', label: 'Value at vest', money: true, align: 'right' }];
  const t3Row = (t, m) => ({ date: t.date, grant: `${t.grant.grantId || 'Grant'} (${t.index}/${t.count})`, shares: sh(t.shares), price: t.vestPrice === '' ? 'Not entered' : m(num(t.vestPrice)), source: t.priceSource, value: t.vestValue });
  const PRICE_NOTE = 'Vest prices are typed by hand. Where each came from is whatever the Price source field says; Veritas does not look them up.';
  function t3Cell(ctx, r, t, col) {
    const m = ctx.money;
    const name = `${t.grant.grantId || 'Grant'} (${t.index}/${t.count}), vesting ${t.date}`;
    if (col === 4) return { title: `${name}: shares`, value: t.shares, calc: [t.edited ? `Share count typed in Table 2 for this tranche = ${sh(t.shares)}.` : `${sh(num(t.grant.shares))} shares granted / ${t.count} installments = ${sh(t.shares)}.`], note: NOTE };
    if (col === 5) return { title: `${name}: value at vest`, value: t.vestValue, inputs: [{ label: 'Shares', value: t.shares, origin: t.edited ? 'entered' : 'Grant shares / installments' }, priceInput(t)], calc: [`Value at vest = ${sh(t.shares)} shares x ${m(num(t.vestPrice))} = ${m(t.vestValue)}.`], note: PRICE_NOTE };
    if (col === 6 && ctx.displayed.kind === 'percent') {
      if (t.used.pct === 0 && ctx.displayed.value === 0) return { title: `${name}: community %`, value: 0, calc: [t.used.why], status: 'calculated', inputs: settingInputs(r) };
      return { title: `${name}: community %`, value: t.used.pct == null ? null : t.used.pct * 100, calc: [t.used.why], inputs: settingInputs(r) };
    }
    return null;
  }
  function t3Total(ctx, r, col) {
    const m = ctx.money;
    const rows = r.t3.map((t) => t3Row(t, m));
    if (col === 1) return { title: 'Table 3 total: shares', value: r.t3Tot.shares, columns: t3Columns(ctx), rows, calc: [`Add the shares of all ${r.t3.length} tranches = ${sh(r.t3Tot.shares)}. This covers every tranche, priced or not.`], note: NOTE };
    if (col === 2) { const priced = r.t3.filter((t) => t.vestValue != null); return { title: 'Table 3 total: value at vest', value: r.t3Tot.value, columns: t3Columns(ctx), rows, inputs: priced.map(priceInput), calc: [`Add shares x vest price for the ${priced.length} tranches with a price entered = ${m(r.t3Tot.value)}.`, `${r.t3.length - priced.length} tranches have no price and are left out.`], note: PRICE_NOTE }; }
    return null;
  }

  // ---------- summary, narrative, checks ----------
  const tableOneMarital = (ctx, r) => ({ title: 'Table 1: marital shares held', value: r.tot.mShares, columns: grantColumns('Marital shares'), rows: r.t1.map((x) => ({ grant: x.g.grantId || 'Grant', value: x.mShares == null ? 'Not available' : sh(x.mShares) })), inputs: settingInputs(r), note: NOTE, calc: [`Add net held x ${r.M} % for each grant = ${sh(r.tot.mShares)}.`] });
  const tableTwoMarital = (ctx, r) => ({ ...t2Rows(r, r.remaining), title: 'Table 2: unvested marital shares', value: r.rem.mShares, calc: [`Add shares x ${r.M} % for the ${r.remaining.length} unvested tranches from grants made before the date of service = ${r.rem.mShares == null ? 'not available' : sh(r.rem.mShares)}.`] });
  const toNow = (ctx, r) => ({ title: `Shares to ${r.np} from the account now`, value: r.tot.each, inputs: settingInputs(r), note: NOTE, columns: grantColumns('Shares'), rows: r.t1.map((x) => ({ grant: x.g.grantId || 'Grant', value: x.each == null ? 'Not available' : sh(x.each) })), calc: [`Table 1 marital shares ${sh(r.tot.mShares)} x ${(r.split * 100).toFixed(0)}% = ${sh(r.tot.each)}.`] });
  const toLater = (ctx, r) => ({ ...t2Rows(r, r.remaining), title: `Shares to ${r.np} as they vest`, value: r.rem.mShares == null ? null : r.rem.mShares * r.split, calc: [`Table 2 unvested marital shares ${sh(r.rem.mShares)} x ${(r.split * 100).toFixed(0)}% = ${sh((r.rem.mShares || 0) * r.split)}.`] });
  const toTotal = (ctx, r) => {
    const later = r.rem.mShares == null ? null : r.rem.mShares * r.split;
    const value = r.tot.each == null || later == null ? null : r.tot.each + later;
    return { title: `Total shares to ${r.np}`, value, inputs: settingInputs(r), note: NOTE, calc: [`From the account now ${sh(r.tot.each)} + unvested as they vest ${sh(later)} = ${sh(value)}.`] };
  };
  const otherMethod = (ctx, r) => {
    const named = /(Hug|Nelson) would give\s*$/.exec(ctx.before);
    const other = named ? named[1].toLowerCase() : (r.method === 'hug' ? 'nelson' : 'hug');
    const v = r.rem[other];
    return { ...t2Rows(r, r.remaining), title: `Unvested shares to ${r.np} under ${METHODS[other]}`, value: v == null ? null : v * r.split, calc: [`${METHODS[other]} unvested marital shares ${sh(v)} x ${(r.split * 100).toFixed(0)}% = ${sh((v || 0) * r.split)}.`] };
  };

  function summary(ctx, r) {
    const card = ctx.el.closest('.kpi');
    const label = (card.querySelector('.kpi-label') || {}).textContent || '';
    const delta = !!ctx.el.closest('.kpi-delta');
    if (/^Table 1/.test(label)) {
      if (!delta) return tableOneMarital(ctx, r);
      if (/^gross/.test(ctx.after)) return t1Total(ctx, r, 10);
      return t1Total(ctx, r, 13);
    }
    if (/^Table 2/.test(label)) return delta ? t2Split(ctx, r, 1) : tableTwoMarital(ctx, r);
    if (/^Method/.test(label)) return { title: 'Share of community to the non-employee spouse', value: r.split * 100, inputs: settingInputs(r), calc: [`The non-employee share is ${(r.split * 100).toFixed(0)}%${r.s.settings.split ? ', as typed in the field' : ', the default used when the field is blank'}.`] };
    if (delta) return /^now/.test(ctx.after) ? toNow(ctx, r) : toLater(ctx, r);
    return toTotal(ctx, r);
  }
  function narrative(ctx, r) {
    if (/receives\s*$/.test(ctx.before)) return toNow(ctx, r);
    if (/shares of the unvested|Table 1\) and\s*$/.test(ctx.before) && !/\(Table 2\),\s*$/.test(ctx.before)) return toLater(ctx, r);
    if (/\(Table 2\),\s*$/.test(ctx.before)) return toTotal(ctx, r);
    if (/would give\s*$/.test(ctx.before)) return otherMethod(ctx, r);
    if (/instead of\s*$/.test(ctx.before)) return toLater(ctx, r);
    return null;
  }
  function checks(ctx, r) {
    const issue = r.t1.find((x) => ctx.before.includes(`${x.g.grantId || 'A grant'}:`));
    if (!issue) return null;
    if (ctx.displayed.kind === 'percent') { const v = issue.vested ? num(issue.g.tax) / issue.vested * 100 : 0; return { title: 'Share of vested shares withheld for tax', value: v, calc: [`${sh(num(issue.g.tax))} withheld / ${sh(issue.vested)} vested = ${v.toFixed(0)}%. The page raises this check above 60%.`], note: NOTE }; }
    return { title: 'Shares vested by the ledger date', value: issue.vested, columns: trColumns, rows: issue.vestedNow.map((t) => trRow(r, t)), calc: [`Add the tranches vesting on or before ${r.asOf} = ${sh(issue.vested)}.`], note: NOTE };
  }

  const inTable = (ctx, sel) => ctx.el.closest(sel);
  const cell = (ctx) => { const td = ctx.el.closest('td'); return td ? td.cellIndex : -1; };
  const find = (r, key) => r.all.find((t) => t.key === key);

  // The "Mix" name itself holds the two entered percentages, wherever it appears.
  const mixName = (ctx) => {
    if (!ctx.displayed || ctx.displayed.kind !== 'percent') return null;
    const m = /^(Nelson|Hug)\b/.exec(ctx.after);
    if (!m) return null;
    const r = rebuild(ctx);
    if (r.method !== 'mix') return null;
    const value = (m[1] === 'Nelson' ? r.nelsonShare : 1 - r.nelsonShare) * 100;
    return { title: `${m[1]} % of the mix`, value, inputs: settingInputs(r), calc: [r.s.settings.nelsonPct ? `Nelson % typed = ${(r.nelsonShare * 100).toFixed(2)}%. Hug % = 100% - Nelson % = ${((1 - r.nelsonShare) * 100).toFixed(2)}%.` : 'No percentage was typed, so the page uses its default of 50% each.'] };
  };
  const compareCard = (ctx) => {
    if (!ctx.el.closest('b')) return null;
    const r = rebuild(ctx);
    const name = (ctx.el.closest('.m-card').querySelector('span') || {}).textContent || '';
    if (/^Hug$/.test(name)) return t2Split(ctx, r, 2);
    if (/^Nelson$/.test(name)) return t2Split(ctx, r, 3);
    if (/^Other basis/.test(name)) return tableTwoMarital(ctx, r);
    return { ...t2Rows(r, r.remaining), title: 'Unvested marital shares under the mix', value: r.rem.mix, calc: [...r.remaining.map((t) => t.mix.why), `Add shares x mixed share = ${r.rem.mix == null ? 'not available' : sh(r.rem.mix)}.`] };
  };
  // When neither formula applies, every calculated recon says why, as entered.
  const withBasis = (fn) => (ctx) => {
    const out = fn(ctx);
    if (!out || out.status === 'text') return out;
    const state = loadState(ctx);
    if (ctx.displayed && ctx.displayed.value === 0 && !state.grants.length) return { ...out, status: 'nodata', calc: ['No grants have been entered yet.'] };
    const s = state.settings;
    if (s.method !== 'neither') return out;
    return { ...out, note: `${out.note ? `${out.note} ` : ''}Why neither formula applies: ${s.otherBasis || 'not recorded'}.` };
  };

  const WORDING = () => ({ status: 'text', calc: ['Part of the method wording written on this page. It does not come from this client\'s records.'] });
  const MATCHES = [
      { recon: mixName },
      { selector: '#methodCompare .m-card', recon: compareCard },
      { selector: '#summary .kpi', recon: (ctx) => summary(ctx, rebuild(ctx)) },
      { selector: '#narrative', recon: (ctx) => narrative(ctx, rebuild(ctx)) },
      { selector: '#t1Sub', recon: (ctx) => { const r = rebuild(ctx); return { title: 'Share price', status: 'entered', inputs: [{ label: 'Share price', value: r.price, origin: 'entered' }], calc: ['Typed in the Share price field.'] }; } },
      { selector: '#t1Check', recon: (ctx) => checks(ctx, rebuild(ctx)) },
      { selector: '#t3Check', recon: (ctx) => { const r = rebuild(ctx); const m = ctx.money; return { title: 'Vested tranches with no price', value: r.t3Tot.unpriced.length, format: 'count', columns: t3Columns(ctx), rows: r.t3Tot.unpriced.map((t) => t3Row(t, m)), calc: [`Tranches vesting on or before today with no vest price = ${r.t3Tot.unpriced.length}.`] }; } },
      { selector: '#t3Example', recon: (ctx) => {
        const r = rebuild(ctx);
        const dates = ctx.before.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
        const shown = dates[dates.length - 1];
        const t = shown && r.t3.find((x) => x.vestPrice !== '' && new Date(`${x.date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' }) === shown);
        if (!t) return null;
        return { title: `Vest price on ${t.date}`, status: 'entered', inputs: [priceInput(t)], calc: ['Typed in Table 3 for this vesting date.'], note: PRICE_NOTE };
      } },
      // Entry fields. Table 1 fields fall through to the standard "entered" recon.
      { selector: '#t3 input[data-t="vestPrice"]', recon: (ctx) => { const r = rebuild(ctx); const t = find(r, ctx.el.closest('tr').dataset.key); if (!t) return null; return { title: `Vest price on ${t.date}`, status: 'entered', inputs: [priceInput(t)], calc: [`Typed for ${t.grant.grantId || 'this grant'} (${t.index}/${t.count}).`], note: t.priceSource ? `Price source recorded: ${t.priceSource}.` : 'No price source has been recorded for this price.' }; } },
      { selector: '#t2 input[data-t="shares"]', recon: (ctx) => { const r = rebuild(ctx); const t = find(r, ctx.el.closest('tr').dataset.key); if (!t) return null; if (t.edited) return { title: 'Tranche shares', status: 'entered', calc: ['Typed for this tranche to match what was delivered.'], note: NOTE }; return { title: 'Tranche shares', value: Math.round(t.equalShare * 100) / 100, calc: [`${sh(num(t.grant.shares))} shares granted / ${t.count} installments = ${sh(t.equalShare)}.`], note: NOTE }; } },
      { selector: '#t2 .treat, .law', recon: WORDING },
      { selector: '#t1 tr[data-id] td', recon: (ctx) => { if (ctx.el.matches('input')) return null; const r = rebuild(ctx); const row = r.t1.find((x) => x.g.id === ctx.el.closest('tr').dataset.id); return row ? grantCell(ctx, r, row, cell(ctx)) : null; } },
      { selector: '#t1 tr.tot td', recon: (ctx) => t1Total(ctx, rebuild(ctx), cell(ctx)) },
      { selector: '#t2 tr[data-key] td', recon: (ctx) => { if (ctx.el.matches('input')) return null; const r = rebuild(ctx); const t = find(r, ctx.el.closest('tr').dataset.key); return t && r.t2.includes(t) ? t2Cell(ctx, r, t, cell(ctx)) : null; } },
      { selector: '#t2 tr.grp td', recon: (ctx) => { const m = (ctx.el.closest('tr').cells[0].textContent || '').match(/^\s*(\d{4})/); return m ? t2Subtotal(ctx, rebuild(ctx), m[1], cell(ctx)) : null; } },
      { selector: '#t2 tr.sep:not([data-key]) td', recon: (ctx) => t2PostRow(ctx, rebuild(ctx), cell(ctx)) },
      { selector: '#t2 tr.split td', recon: (ctx) => t2Split(ctx, rebuild(ctx), cell(ctx)) },
      { selector: '#t3 tr[data-key] td', recon: (ctx) => { if (ctx.el.matches('input')) return null; const r = rebuild(ctx); const t = r.t3.find((x) => x.key === ctx.el.closest('tr').dataset.key); return t ? t3Cell(ctx, r, t, cell(ctx)) : null; } },
      { selector: '#t3 tr.tot td', recon: (ctx) => t3Total(ctx, rebuild(ctx), cell(ctx)) },
  ];
  VeritasRecon.define({
    byId: { hugPct: (ctx) => { const r = rebuild(ctx); if (!r.s.settings.nelsonPct) return null; return { title: 'Hug %', value: (1 - r.nelsonShare) * 100, inputs: settingInputs(r), calc: [`Hug % = 100% - Nelson % ${(r.nelsonShare * 100).toFixed(2)}% = ${((1 - r.nelsonShare) * 100).toFixed(2)}%.`] }; } },
    match: MATCHES.map((m) => ({ ...m, recon: withBasis(m.recon) })),
  });
})();
