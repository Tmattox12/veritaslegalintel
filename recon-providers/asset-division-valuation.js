// Recons for Asset Division Valuation (asset-division-valuation.html).
// Assets and debts are typed on this page and saved in the browser for the active
// matter, so every total is recomputed from that saved list. Each item is counted
// once in estate totals. Nothing here links to a source document because the page
// has no link between an item and a document.
(function () {
  const OWNER = { party1: 'Party A', party2: 'Party B', joint: 'Joint/Community' };

  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem('assetDivisionData')); } catch (e) { d = null; }
    return { assets: (d && d.assets) || [], liabilities: (d && d.liabilities) || [] };
  }
  const sum = (list) => list.reduce((a, x) => a + (Number(x.value) || 0), 0);
  const owned = (list, who) => list.filter((x) => x.owner === who);
  const heldBy = (list, who) => list.filter((x) => x.owner === who || x.owner === 'joint');

  const COLUMNS = [{ key: 'name', label: 'Item' }, { key: 'kind', label: 'Type' }, { key: 'category', label: 'Category' }, { key: 'owner', label: 'Assigned to' }, { key: 'notes', label: 'Notes typed' }, { key: 'amount', label: 'Amount', money: true, align: 'right' }];
  const toRows = (list, kind) => list.map((x) => ({ name: x.name, kind, category: x.category, owner: OWNER[x.owner] || x.owner || '', notes: x.notes || '', amount: Number(x.value) || 0 }));
  const ORIGIN = 'Each line was typed on this page with Add Asset or Add Liability. No source document is linked to it.';

  function jointWarning(d) {
    const joint = owned(d.assets, 'joint').length + owned(d.liabilities, 'joint').length;
    if (!joint) return null;
    return `This total counts each of the ${joint} joint item${joint === 1 ? '' : 's'} once. The page adds its Party A and Party B columns, and both columns include joint items, so the page counts them twice.`;
  }

  const estate = {
    assets: (ctx, title) => {
      const d = load();
      const v = sum(d.assets);
      return { title, value: v, columns: COLUMNS, rows: toRows(d.assets, 'Asset'), summary: { Items: d.assets.length }, note: jointWarning(d),
        calc: [`Total assets = sum of ${d.assets.length} asset line${d.assets.length === 1 ? '' : 's'} = ${ctx.money(v)}.`, ORIGIN] };
    },
    debts: (ctx, title) => {
      const d = load();
      const v = sum(d.liabilities);
      return { title, value: v, columns: COLUMNS, rows: toRows(d.liabilities, 'Liability'), summary: { Items: d.liabilities.length }, note: jointWarning(d),
        calc: [`Total debts = sum of ${d.liabilities.length} liability line${d.liabilities.length === 1 ? '' : 's'} = ${ctx.money(v)}.`, ORIGIN] };
    },
    net: (ctx, title) => {
      const d = load();
      const a = sum(d.assets), l = sum(d.liabilities);
      return { title, value: a - l, columns: COLUMNS, rows: toRows(d.assets, 'Asset').concat(toRows(d.liabilities, 'Liability')), summary: { 'Total assets': ctx.money(a), 'Total debts': ctx.money(l) }, note: jointWarning(d),
        calc: [`Net estate = assets ${ctx.money(a)} - debts ${ctx.money(l)} = ${ctx.money(a - l)}.`, ORIGIN] };
    },
    half: (ctx, title) => {
      const d = load();
      const a = sum(d.assets), l = sum(d.liabilities);
      return { title, value: (a - l) / 2, columns: COLUMNS, rows: toRows(d.assets, 'Asset').concat(toRows(d.liabilities, 'Liability')), summary: { 'Net estate': ctx.money(a - l) }, note: jointWarning(d),
        calc: [`Net estate = assets ${ctx.money(a)} - debts ${ctx.money(l)} = ${ctx.money(a - l)}.`, `Equal share = ${ctx.money(a - l)} / 2 = ${ctx.money((a - l) / 2)}.`] };
    },
  };

  const JOINT_FULL = 'Joint items appear here at full value, and also at full value under the other party. This column is not that party\'s half of joint items.';
  const party = {
    assets: (ctx, who) => {
      const list = heldBy(load().assets, who);
      const v = sum(list);
      return { title: `${OWNER[who]} total assets`, value: v, columns: COLUMNS, rows: toRows(list, 'Asset'), note: JOINT_FULL,
        calc: [`Assets assigned to ${OWNER[who]} or joint: ${list.length} line${list.length === 1 ? '' : 's'} = ${ctx.money(v)}.`, ORIGIN] };
    },
    debts: (ctx, who) => {
      const list = heldBy(load().liabilities, who);
      const v = sum(list);
      return { title: `${OWNER[who]} total debts`, value: v, columns: COLUMNS, rows: toRows(list, 'Liability'), note: JOINT_FULL,
        calc: [`Debts assigned to ${OWNER[who]} or joint: ${list.length} line${list.length === 1 ? '' : 's'} = ${ctx.money(v)}.`, ORIGIN] };
    },
    net: (ctx, who) => {
      const d = load();
      const a = heldBy(d.assets, who), l = heldBy(d.liabilities, who);
      return { title: `${OWNER[who]} net value`, value: sum(a) - sum(l), columns: COLUMNS, rows: toRows(a, 'Asset').concat(toRows(l, 'Liability')), note: JOINT_FULL,
        calc: [`Net = assets ${ctx.money(sum(a))} - debts ${ctx.money(sum(l))} = ${ctx.money(sum(a) - sum(l))}.`] };
    },
  };

  // A joint item is in both columns and cancels, so only solely held items move the result.
  function balance(ctx) {
    const d = load();
    const sole = (who) => sum(owned(d.assets, who)) - sum(owned(d.liabilities, who));
    const a = sole('party1'), b = sole('party2');
    const v = Math.abs(a - b) / 2;
    const rows = toRows(d.assets.filter((x) => x.owner !== 'joint'), 'Asset').concat(toRows(d.liabilities.filter((x) => x.owner !== 'joint'), 'Liability'));
    return { title: 'Equalization payment', value: v, columns: COLUMNS, rows, summary: { 'Party A solely held net': ctx.money(a), 'Party B solely held net': ctx.money(b) },
      calc: ['Joint items are in both parties\' columns, so they cancel and are left out here.', `Party A solely held assets less debts = ${ctx.money(a)}.`, `Party B solely held assets less debts = ${ctx.money(b)}.`, `Equalizing payment = |${ctx.money(a)} - ${ctx.money(b)}| / 2 = ${ctx.money(v)}.`] };
  }

  // One line on a party's list. It was typed, so it is an entered figure.
  function itemLine(ctx) {
    const card = ctx.el.closest('.asset-card');
    if (!card) return null;
    const name = (card.querySelector('.asset-name') || {}).textContent || '';
    if (!ctx.displayed || ctx.el.closest('.asset-name')) return { status: 'text', calc: ['This number is part of the item name typed on this page.'] };
    const d = load();
    const isDebt = ctx.text.startsWith('-');
    const found = (isDebt ? d.liabilities : d.assets).find((x) => x.name === name && Math.abs(Number(x.value) - ctx.displayed.value) < 0.005);
    return { title: name, status: 'entered', value: found ? Number(found.value) : null,
      inputs: found ? [{ label: found.name, value: Number(found.value), origin: 'entered' }] : [],
      summary: found ? { Type: isDebt ? 'Liability' : 'Asset', Category: found.category || '', 'Assigned to': OWNER[found.owner] || '', 'Notes typed': found.notes || 'None' } : {},
      note: found ? '' : 'This line was not found in the list saved for this matter.',
      calc: ['This amount was typed on this page with Add Asset or Add Liability. Veritas did not calculate it.'] };
  }

  // Tax-rule figures. The only sources named are the page's own Research Resources links.
  const rule = (title, cited) => () => ({ title, status: 'reference',
    note: `This page lists "${cited}" under Research Resources. That link is not connected to anything yet, so check the current rule before relying on it.`,
    calc: ['General tax rule written on this page. It is not calculated and not from this client\'s records.'] });
  const taxOther = (ctx) => {
    if (ctx.text === '28%' || (ctx.text === '20%' && /15-$/.test(ctx.before))) return rule('Collectibles tax rate', 'Collectible Tax Rate (28% vs. 15-20%)')(ctx);
    return null;
  };

  VeritasRecon.define({
    byId: {
      totalAssetsKPI: (ctx) => estate.assets(ctx, 'Total community assets'),
      summaryAssets: (ctx) => estate.assets(ctx, 'Total community assets'),
      totalDebtsKPI: (ctx) => estate.debts(ctx, 'Total community debts'),
      summaryDebts: (ctx) => estate.debts(ctx, 'Total community debts'),
      netAssetsKPI: (ctx) => estate.net(ctx, 'Net community estate'),
      summaryNet: (ctx) => estate.net(ctx, 'Net estate'),
      equalShareKPI: (ctx) => estate.half(ctx, '50/50 equal share'),
      party1AssetTotal: (ctx) => party.assets(ctx, 'party1'),
      party2AssetTotal: (ctx) => party.assets(ctx, 'party2'),
      party1DebtTotal: (ctx) => party.debts(ctx, 'party1'),
      party2DebtTotal: (ctx) => party.debts(ctx, 'party2'),
      party1NetValue: (ctx) => party.net(ctx, 'party1'),
      party2NetValue: (ctx) => party.net(ctx, 'party2'),
      balanceAmount: balance,
      party1Assets: itemLine,
      party2Assets: itemLine,
      party1Percent: () => ({ title: 'Party A percent', status: 'entered', note: 'The custom split is not built yet on this page, so this percent does not change any figure.',
        calc: ['This value is what is in the field. It starts at 50.'] }),
      retirement: (ctx) => (ctx.text === '10%' ? rule('Early withdrawal penalty', 'Early Withdrawal Penalties & Exceptions (IRS.gov)')(ctx) : null),
      realestate: (ctx) => (ctx.text === '25%' ? rule('Depreciation recapture rate', 'Depreciation Recapture on Rental Property')(ctx) : null),
      investments: (ctx) => (ctx.text === '$0' ? { title: 'Unvested options', status: 'text', calc: ['General guidance written on this page about how unvested options are usually valued. It is not a figure for this case.'] } : null),
      other: taxOther,
    },
  });
})();
