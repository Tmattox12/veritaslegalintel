// Recons for Owes-To Analysis (owes.html). The page's script does nothing yet: no list is
// built and nothing adds up, so these recons say that rather than presenting a total.
(function () {
  const typed = () => ['petitioner', 'respondent'].map((p) => document.getElementById(`${p}Amount`)).filter((i) => i && Number(i.value));
  const placeholder = (title) => (ctx) => {
    if (!ctx.displayed || ctx.displayed.value !== 0) return null;
    const amounts = typed();
    const calc = ['No calculation runs on this page: its script is empty, so this $0.00 is the starting text written into the page, not a total.', 'The Add Obligation buttons do not build a list, and nothing is saved.'];
    if (!amounts.length) return { title, status: 'nodata', calc };
    return { title, status: 'nottied', calc, inputs: amounts.map((i) => ({ label: `${i.id === 'petitionerAmount' ? 'Petitioner' : 'Respondent'} amount owed`, value: Number(i.value), origin: 'entered' })),
      note: 'An amount has been typed above, but it does not flow to this figure.' };
  };
  VeritasRecon.define({
    byId: { petitionerTotal: placeholder('Petitioner total owes'), respondentTotal: placeholder('Respondent total owes'), netDifference: placeholder('Net difference') },
  });
})();
