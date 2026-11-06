// Recons for Case Intake (case-intake.html). Every number here is typed in, except that
// Marriage Length fills itself in when a marriage date is chosen.
(function () {
  const DAY_MS = 1000 * 60 * 60 * 24;

  function marriageLength(ctx) {
    const start = ctx.txt('#marriageDate');
    const end = ctx.txt('#separationDate');
    if (!start) return { title: 'Marriage length (years)', status: 'entered', calc: ['No marriage date is entered, so this is the number typed in the field.'] };
    const a = new Date(start);
    const b = end ? new Date(end) : new Date();
    const years = (b - a) / (DAY_MS * 365.25);
    const inputs = [{ label: 'Marriage date', value: start, origin: 'intake' }, { label: 'Separation date', value: end || 'None entered', origin: 'intake' }];
    if (!end) {
      return { title: 'Marriage length (years)', status: 'entered', inputs,
        note: 'With no separation date, the page measures up to the day the date was chosen, so this field can fall behind as time passes.',
        calc: [`Measured to today, the length would be ${years.toFixed(1)} years.`] };
    }
    return { title: 'Marriage length (years)', value: years, format: 'count', inputs,
      calc: [`Days from ${start} to ${end} = ${Math.round((b - a) / DAY_MS).toLocaleString()}.`, `Years = days / 365.25 = ${years.toFixed(1)}.`],
      note: 'This field can also be typed over. If it does not tie, the number typed differs from the two dates.' };
  }

  VeritasRecon.define({ byId: { marriageLength } });
})();
