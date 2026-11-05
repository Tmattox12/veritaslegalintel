// Spousal maintenance: relays a calculation to the Arizona courts' official
// Spousal Maintenance Guidelines calculator (the one the AZ courts' online form
// uses). Only incomes, family size, mortgage principal, the requesting party
// and the four dates leave Veritas: names and the case number are sent blank.
const express = require('express');

const router = express.Router({ mergeParams: true });

const OFFICIAL_URL = 'https://jbazmc.azure-api.net/SelfSufficiencyCalculator/CalculateSelfSufficiency';
const TIMEOUT_MS = 15000;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const toUs = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
const dollars = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? String(Math.round(n)) : null;
};
const money = (s) => { const n = parseFloat(String(s || '').replace(/[$,%]/g, '')); return Number.isFinite(n) ? n : null; };

// POST /api/matters/:matterId/spousal/official
router.post('/official', async (req, res) => {
  const b = req.body || {};
  const dates = { hearingDate: b.hearingDate, marriageDate: b.marriageDate, serviceDate: b.serviceDate, dobA: b.dobA, dobB: b.dobB };
  const badDate = Object.entries(dates).find(([, v]) => !isoDate.test(String(v || '')));
  if (badDate) return res.status(400).json({ error: `Missing or invalid date: ${badDate[0]}` });

  const incomes = {
    a: dollars(b.incomeA), b: dollars(b.incomeB),
    attrA: dollars(b.attributedA || 0), attrB: dollars(b.attributedB || 0),
    mortgage: dollars(b.mortgagePrincipal || 0),
  };
  const badMoney = Object.entries(incomes).find(([, v]) => v === null);
  if (badMoney) return res.status(400).json({ error: `Invalid amount: ${badMoney[0]}` });

  const familySize = parseInt(b.familySize, 10);
  if (!(familySize >= 2 && familySize <= 20)) return res.status(400).json({ error: 'Family size must be 2-20' });
  if (!['a', 'b'].includes(b.requesting)) return res.status(400).json({ error: 'requesting must be a or b' });

  const payload = {
    headingDate: toUs(b.hearingDate),
    caseNumber: '',
    county: String(b.county || '').slice(0, 40),
    petitioner: '',
    respondent: '',
    petitionerActualIncome: incomes.a,
    respondentActualIncome: incomes.b,
    petitionerAttributedIncome: incomes.attrA,
    respondentAttributedIncome: incomes.attrB,
    familySize: String(familySize),
    familyMortgagePrincipal: incomes.mortgage,
    partyRequestingMaintenance: b.requesting === 'a' ? 'Petitioner' : 'Respondent',
    petitionerDOB: toUs(b.dobA),
    respondentDOB: toUs(b.dobB),
    dateOfMarriage: toUs(b.marriageDate),
    dateOfServiceOfProcess: toUs(b.serviceDate),
  };

  try {
    const r = await fetch(OFFICIAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return res.status(502).json({ error: `Official calculator returned ${r.status}` });
    const d = await r.json();
    res.json({
      low: money(d.MonthlyTargetLow),
      mid: money(d.MonthlyTargetAverage),
      high: money(d.MonthlyTargetHigh),
      durationLow: d.LowStandardRange || null,
      durationHigh: d.HighStandardRange || null,
      ruleOf65: !!d.RuleOf65Eligible,
      shareA: money(d.PetitionerProportion),
      shareB: money(d.RespondentProportion),
      message: d.AmountSubjectToGuidelinesMessage || '',
      requestorMismatched: !!d.IsRequestorMismatched,
      source: `Arizona Spousal Maintenance Guidelines calculator v${d.Version || '?'}`,
      calculatedAt: d.CalculationDate || new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: e.name === 'TimeoutError' ? 'Official calculator timed out' : `Official calculator unreachable: ${e.message}` });
  }
});

module.exports = router;
