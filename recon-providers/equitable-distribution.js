// Recons for Equitable Distribution (equitable-distribution.html).
// This page has no working calculation: its script is empty and the sliders call a
// function that does not exist. The recons say so rather than supply numbers.
(function () {
  const NOT_BUILT = 'The calculation behind this part of the page has not been built, so moving a slider changes nothing.';

  const presumption = () => ({ title: 'Presumed equal share', status: 'reference',
    note: 'This page cites [State] §25-318 for the 50/50 presumption. The state placeholder has not been filled in.',
    calc: ['Written on this page as the starting presumption. It is not calculated from this client\'s records.'] });

  const recommended = (ctx) => ({ title: 'Recommended split', status: 'nottied', note: NOT_BUILT,
    calc: [`${ctx.text} is written directly into this page and never changes. It is not a recommendation.`] });

  const slider = (ctx) => ({ title: ctx.label, status: 'entered', note: NOT_BUILT,
    calc: [`Slider position on a 0 to 100 scale. It starts at 50. Current position: ${ctx.text}.`] });

  VeritasRecon.define({
    byId: {
      partyABar: recommended,
      partyBBar: recommended,
      durationSlider: slider, educationSlider: slider, separateSlider: slider, custodySlider: slider,
      healthSlider: slider, contributionSlider: slider, goodwillSlider: slider,
    },
    match: [
      { selector: '.split-paying, .split-supported', recon: presumption },
      { selector: '.slider-label', recon: () => ({ status: 'text', calc: ['This number is part of the wording on the slider scale.'] }) },
      { selector: '.asset-table td', label: /Presumption/, recon: () => ({
        title: 'Deviation at the baseline', value: Math.abs(50 - 50),
        inputs: [{ label: 'Presumed share for each party (percent)', value: 50, origin: 'reference' }],
        calc: ['Deviation = |50% - 50%| = 0%. The baseline row is the equal split, so it has no deviation by definition.', 'The page cites [State] §25-318 for the presumption.'],
      }) },
    ],
  });
})();
