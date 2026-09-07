/* Extract reviewable income evidence from non-bank discovery documents. */

function money(value) {
  if (!value) return null;
  const normalized = value.replace(/[$,\s]/g, '');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function firstMoneyAfter(text, label) {
  const match = text.match(new RegExp(`${label}\\s*[:]?\\s*\\$?([\\d,]+\\.\\d{2})`, 'i'));
  return match ? money(match[1]) : null;
}

function extractIncomeEvidence(filename, text, documentType) {
  const evidence = {
    filename,
    documentType,
    kind: 'other_income_document',
    grossPay: null,
    netPay: null,
    paymentAmount: null,
    payPeriod: null,
    payDate: null,
    requiresReview: true,
  };

  if (documentType === 'Pay Stub / Earnings Statement') {
    evidence.kind = 'pay_stub';
    evidence.grossPay = firstMoneyAfter(text, 'Gross Pay');
    evidence.netPay = firstMoneyAfter(text, 'Net Pay');
    evidence.paymentAmount = firstMoneyAfter(text, '(?:Total Net Pay|Deposit Amount|Check Amount)');

    const period = text.match(/(?:For\s+Pay\s+Period|Period\s+Begin)\s*[:]?\s*([\d/\- ]+)\s*(?:-|through|to)\s*([\d/\- ]+)/i);
    if (period) evidence.payPeriod = `${period[1].trim()} - ${period[2].trim()}`;
    const date = text.match(/(?:Pay\s+Date|Check\s+Date)\s*[:]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (date) evidence.payDate = date[1];
  } else if (documentType === 'Social Security Income / Benefits Statement') {
    evidence.kind = 'social_security_statement';
    evidence.paymentAmount = firstMoneyAfter(text, '(?:Monthly Benefit|Benefit Amount|Retirement Benefit)');
  } else if (documentType === 'Tax Return / Tax Income Record') {
    evidence.kind = 'tax_income_record';
  }

  return evidence;
}

module.exports = { extractIncomeEvidence };
