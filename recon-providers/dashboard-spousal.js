// Recons for the Spousal Maintenance dashboard (dashboard-spousal.html).
// The dashboard's scripts are empty, so its three headline figures stay at the written $0.
// A nonzero figure falls through to "no calculation on record".
(function () {
  const notBuilt = (title) => (ctx) => {
    if (ctx.displayed && ctx.displayed.value) return null;
    return { title, status: 'nodata', note: 'The script for this dashboard is empty, so this figure is the written starting value. Nothing has calculated it.', calc: ['Nothing has calculated this figure.'] };
  };
  VeritasRecon.define({
    byId: {
      highestMaint: notBuilt('Highest maintenance (AFI-based)'),
      masterMaint: notBuilt('Master position (income gap)'),
      lowestMaint: notBuilt('Lowest maintenance (with property income)'),
    },
  });
})();
