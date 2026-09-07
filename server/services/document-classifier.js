/*
 * Evidence-first discovery document classifier.
 * Returns a broad intake category plus a specific document type. The rules use
 * document headers and filenames; ambiguous records deliberately stay Other.
 */

const CATEGORIES = {
  FINANCIAL: 'Financial Statements',
  INCOME: 'Tax Returns & Income',
  PROPERTY: 'Property & Assets',
  LEGAL: 'Court & Legal Documents',
  DISCLOSURE: 'AFI & Disclosures',
  OTHER: 'Other',
};

function matches(text, filename, expression) {
  return expression.test(`${filename || ''}\n${text || ''}`);
}

function classifyDocument(filename, text = '') {
  const header = text.slice(0, 5000);
  const file = filename || '';

  // AFI must be checked before broad legal/disclosure wording.
  if (matches(header, file, /affidavit of financial information|\bafi\b/i)) {
    return { category: CATEGORIES.DISCLOSURE, type: 'Affidavit of Financial Information', confidence: 'high' };
  }

  // A true pay stub has payroll-form fields together. Do not use a lone
  // "payroll" transaction description found inside an account statement.
  const hasPayStubFields = /statement of earnings|employee pay details|pay\s*stub/i.test(header) ||
    (/gross pay/i.test(header) && /net pay/i.test(header) && /pay (?:period|date)/i.test(header));
  if (hasPayStubFields) {
    return { category: CATEGORIES.INCOME, type: 'Pay Stub / Earnings Statement', confidence: 'high' };
  }

  // Financial accounts: distinguish statements from income docs that merely
  // mention an account number for direct deposit.
  if (matches(header, file, /chase (?:premier )?savings|chase (?:sapphire )?checking|savings summary|checking summary|statement period|beginning balance|ending balance|transaction detail|credit card statement|chase freedom|edward jones|brokerage statement|investment statement/i)) {
    const type = matches(header, file, /edward jones|brokerage|investment/i)
      ? 'Brokerage / Investment Statement'
      : matches(header, file, /credit card|chase freedom|\bcc\s*\d{3,}/i)
        ? 'Credit Card Statement'
        : matches(header, file, /savings/i)
          ? 'Savings Account Statement'
          : 'Bank Account Statement';
    return { category: CATEGORIES.FINANCIAL, type, confidence: 'high' };
  }

  // Legal reports/disclosures can cite tax schedules; recognize their nature
  // before looking for tax-document wording.
  if (matches(header, file, /expert\W+witness\W+disclosure|supplemental\W+disclosure|preliminary\W+report|court\W+order|\bpetition\b|pleading|subpoena|decree|stipulation|minute\W+entry|disclosure\W+statement/i)) {
    const type = matches(header, file, /expert witness|preliminary report/i) ? 'Expert Report / Expert Disclosure' : 'Court / Legal Disclosure';
    return { category: CATEGORIES.LEGAL, type, confidence: 'high' };
  }

  if (matches(header, file, /your social security statement|social security administration|\bss income\b|ssa\.gov/i)) {
    return { category: CATEGORIES.INCOME, type: 'Social Security Income / Benefits Statement', confidence: 'high' };
  }
  if (matches(header, file, /\b1040\b|tax return|schedule [a-z]|\bw-?2\b|\b1099\b|\bk-?1\b|form 1065|form 1120/i)) {
    return { category: CATEGORIES.INCOME, type: 'Tax Return / Tax Income Record', confidence: 'high' };
  }

  if (matches(header, file, /\bdeed\b|\btitle\b|appraisal|property tax|closing statement|hud-1|mortgage statement/i)) {
    return { category: CATEGORIES.PROPERTY, type: 'Property / Asset Record', confidence: 'high' };
  }

  if (matches(header, file, /\biep\b|individualized education program|progress report|school district/i)) {
    return { category: CATEGORIES.OTHER, type: 'Child / Education Record', confidence: 'high' };
  }

  return { category: CATEGORIES.OTHER, type: 'Unclassified Document', confidence: 'needs_review' };
}

module.exports = { classifyDocument, CATEGORIES };
