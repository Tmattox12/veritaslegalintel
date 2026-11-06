// Recons for Settlement Modeling (settlement.html).
// The page's script is empty: calculateSettlement and setHorizon do not exist, so the
// display never follows the inputs. Each share display is compared with its own slider,
// which shows a difference as soon as a slider moves.
(function () {
  const NOT_BUILT = 'The calculation behind this page has not been built, so changing a term does not change any figure.';

  const share = (title, slider) => (ctx) => {
    const v = ctx.num(slider);
    return { title, value: v, note: NOT_BUILT,
      inputs: [{ label: `${title} slider`, value: v, origin: 'entered' }],
      calc: [`The display should match its slider, which is at ${v}%.`] };
  };
  const field = (what) => (ctx) => ({ title: what, status: 'entered', note: NOT_BUILT,
    calc: [`This value is what is in the field, currently ${ctx.text}. Its starting position is set by the page and it is not linked to a source document.`] });

  VeritasRecon.define({
    byId: {
      partyAAssetPercentDisplay: share('Party A share of assets', '#partyAAssetPercent'),
      partyBAssetPercentDisplay: share('Party B share of assets', '#partyBAssetPercent'),
      partyASpousal: field('Party A spousal maintenance (monthly)'),
      partyAChildSupport: field('Party A child support (monthly)'),
      partyACashAdj: field('Cash adjustment to supported spouse'),
      partyASpousalDuration: field('Spousal maintenance duration (months)'),
      partyAAssetPercent: field('Party A share of assets (percent)'),
      partyBAssetPercent: field('Party B share of assets (percent)'),
    },
    match: [
      { selector: '.scenario-controls', recon: (ctx) => ({ title: 'Time horizon button', status: 'text', note: NOT_BUILT,
        calc: [`"${ctx.text} years" is the caption on a button that chooses a time horizon. It is not a figure.`] }) },
    ],
  });
})();
