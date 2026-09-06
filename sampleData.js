/*
 * Empty template data for a new matter.
 * Populate these fields only from documents uploaded for the active matter.
 */

const SAMPLE_CASE = {
  title: '[Case Name]',
  caseNumber: '',
  court: '',
  county: '',
  state: '',
  dateOfService: '',
  parties: {
    petitioner: { name: 'Parent A', alias: 'Parent A', role: 'Petitioner' },
    respondent: { name: 'Parent B', alias: 'Parent B', role: 'Respondent' }
  },
  petitionerIncome2026: { title: 'Parent A income', value: 0, unit: '/yr', calculation: { type: 'sum_with_components', formula: '', steps: [], total: 0 } },
  respondentIncome2026: { title: 'Parent B income', value: 0, unit: '/yr', calculation: { type: 'sum_with_components', formula: '', steps: [], total: 0 } },
  householdExpenses: { petitioner: {}, respondent: {} },
  estateAtDateOfService: {
    petitioner: { assets: {}, liabilities: {} },
    respondent: { assets: {}, liabilities: {} }
  },
  children: [],
  supportCalculations: {
    spousalSupport: { guideline: 0, duration: '', notes: '' },
    childSupport: { guideline: 0, perChild: 0, notes: '' }
  }
};

const SAMPLE_CASE_PETITIONER_NAME = SAMPLE_CASE.parties.petitioner.name;
const SAMPLE_CASE_RESPONDENT_NAME = SAMPLE_CASE.parties.respondent.name;
const SAMPLE_CASE_PETITIONER_INCOME = SAMPLE_CASE.petitionerIncome2026.value;
const SAMPLE_CASE_RESPONDENT_INCOME = SAMPLE_CASE.respondentIncome2026.value;
