// Recons for the Child Support template (child-support-template.html). No calculation runs
// on this page, so its $0 figures are starting text. They say so instead of passing as results.
(function () {
  const typed = () => [...document.querySelectorAll('.main-content input[type=number]')].filter((i) => Number(i.value));
  const placeholder = (ctx) => {
    if (!ctx.displayed || ctx.displayed.value !== 0) return null;
    const entered = typed();
    const calc = ['No calculation runs on this page: this $0 is the starting text written into the page, not a result.'];
    if (!entered.length) return { status: 'nodata', calc };
    const inputs = entered.slice(0, 12).map((i) => { const b = i.closest('.input-row, label'); const l = b && b.querySelector('label, strong'); return { label: l ? l.textContent.trim() : 'Field', value: Number(i.value), origin: 'entered' }; });
    return { status: 'nottied', calc, inputs, note: `${entered.length} field${entered.length === 1 ? ' has' : 's have'} been filled in, but nothing on this page calculates from them, so this figure did not change. Don't rely on it.` };
  };
  const stated = (section) => (ctx) => {
    if (!ctx.displayed || ctx.displayed.kind !== 'percent') return null;
    return { status: 'reference', calc: [`Stated on this page under "${section}", which this page ties to A.R.S. § 25-320. No code on this page applies it.`], note: 'This page gives no pinpoint citation. Confirm against the current published guidelines before relying on it.' };
  };
  VeritasRecon.define({
    byId: {
      childCount: (ctx) => {
        let d = ctx.matter.details;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        d = d || {};
        const value = d.childrenCount || (Array.isArray(d.children) ? d.children.length : 0);
        if (!value) return null;
        return { title: 'Number of children', value, format: 'count', inputs: [{ label: 'Children on Case Intake', value, origin: 'intake' }], calc: [`Case Intake lists ${value} child${value === 1 ? '' : 'ren'}.`], note: 'The field can be edited, so a different number here means it was changed by hand.' };
      },
    },
    match: [
      { selector: '.calc-value, .scenario-value, .scenario-detail, .table td.amount', recon: placeholder },
      { selector: '.scenario-title', recon: () => ({ status: 'reference', calc: ['Part of the heading for the guideline scenario. No code on this page applies it.'], note: 'This heading does not match this page\'s own table, which starts at 17% for one child.' }) },
      { selector: '.note', recon: (ctx) => stated('Guideline Percentages by Children')(ctx) || { status: 'text', calc: ['The number of children that a guideline percentage applies to.'] } },
      { selector: '.table td', recon: stated('Parenting Time Impact on Support') },
    ],
  });
})();
