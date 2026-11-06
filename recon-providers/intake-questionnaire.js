// AFI Intake Questionnaire (intake-questionnaire.html). Typed answers fall through to the
// standard "entered" recon. Numbers in the question labels are wording about what to provide.
VeritasRecon.define({
  match: [
    { selector: 'label', recon: () => ({ status: 'text', calc: ['This number is part of the question wording: how far back to report or how many documents to provide. It is not a figure from this client\'s records.'] }) },
  ],
});
