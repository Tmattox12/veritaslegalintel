// Recons for the AFI Expenses template (afi-expenses-template.html). No script runs on this
// page, so its $0 figures are starting text. They say so instead of passing as results.
(function () {
  const typed = () => [...document.querySelectorAll('.main-content input[type=number]')].filter((i) => Number(i.value));
  const placeholder = (ctx) => {
    if (!ctx.displayed || ctx.displayed.value !== 0) return null;
    const entered = typed();
    const calc = ['No calculation runs on this page: this $0 is the starting text written into the page, not a result.'];
    if (!entered.length) return { status: 'nodata', calc };
    const inputs = entered.slice(0, 12).map((i) => { const c = i.closest('.expense-card'); const l = c && c.querySelector('.expense-label'); return { label: l ? l.textContent.trim() : 'Field', value: Number(i.value), origin: 'entered' }; });
    return { status: 'nottied', calc, inputs, note: `${entered.length} field${entered.length === 1 ? ' has' : 's have'} been filled in above, but nothing on this page adds them up, so this figure did not change. Don't rely on it.` };
  };
  VeritasRecon.define({ match: [{ selector: '.summary-row, .comparison-table td.amount', recon: placeholder }] });
})();
