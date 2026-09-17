/**
 * Deterministic bank/credit-card statement parser.
 * Parses extracted plain text into normalized transactions without calling any
 * paid AI API. Used as the first (free) pass; Claude parser is the fallback.
 */

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const BANK_PATTERNS = [
  { name: 'Chase', re: /\bjpmorgan\s+chase\b|\bchase\b/i },
  { name: 'Bank of America', re: /bank of america/i },
  { name: 'Wells Fargo', re: /wells\s+fargo/i },
  { name: 'Citi', re: /\bcitibank\b|\bciti(card|bank)\b/i },
  { name: 'Capital One', re: /capital\s+one/i },
  { name: 'American Express', re: /american\s+express|\bamex\b/i },
  { name: 'US Bank', re: /\bu\.?s\.?\s+bank\b/i },
  { name: 'PNC', re: /\bpnc\s+bank\b/i },
  { name: 'TD Bank', re: /\btd\s+bank\b/i },
  { name: 'Discover', re: /\bdiscover\b/i },
];

function detectBankName(text) {
  for (const { name, re } of BANK_PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

function detectAccountType(text, filename = '') {
  const filenameText = filename.toLowerCase();
  const header = text.slice(0, 2500);

  // Filename/product names are the strongest evidence. Do not treat a bank
  // transaction description such as "payment to credit card" as account type.
  if (/\b(?:cc|credit[ _-]?card)\b|freedom|sapphire|slate|unlimited/i.test(filenameText)) return 'credit_card';
  // Deposit account headings on the statement itself are explicit evidence and
  // take precedence over a generic filename such as "Acct 3063.pdf".
  if (/chase\s+(?:premier\s+)?savings|\bsavings\s+(?:summary|account)\b/i.test(header)) return 'savings';
  if (/chase\s+(?:sapphire\s+)?checking|\bchecking\s+(?:summary|account)\b/i.test(header)) return 'checking';
  // A generic account filename is deliberately not guessed from transaction
  // wording; it remains review-required unless the header identifies it.
  if (/\bacct\.?\s*\d{3,}\b/i.test(filenameText)) return 'unknown';
  if (/credit\s*card|card\s*ending|\bvisa\b|\bmastercard\b|\bamex\b|american\s+express|\bdiscover\b/i.test(header)) return 'credit_card';
  // These are statement-section headings, not ordinary transaction wording.
  if (/payments\s+and\s+credits|minimum\s+payment\s+due|new\s+balance/i.test(header)) return 'credit_card';
  if (/money\s+market/i.test(header)) return 'money_market';
  return 'unknown';
}

function maskAccountNumber(text) {
  const m = text.match(/(?:account|acct|card)[#\s:]*(?:ending\s+in\s+)?(?:x+|\*+|#+)?\s*(\d{4})\b/i);
  return m ? `****${m[1]}` : null;
}

function detectStatementPeriod(text) {
  // "Statement Period: 01/01/2024 - 01/31/2024" or "January 1 - January 31, 2024"
  let m = text.match(/statement\s*(?:period|cycle|dates?)?[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) return { start: normDate(m[1]), end: normDate(m[2]) };

  m = text.match(/statement\s*(?:period|cycle|dates?)?[:\s]*([A-Za-z]+\s+\d{1,2})\s*(?:to|-|through)\s*([A-Za-z]+\s+\d{1,2}),?\s*(\d{4})/i);
  if (m) {
    const y = m[3];
    return { start: normDate(`${m[1]}, ${y}`), end: normDate(`${m[2]}, ${y}`) };
  }
  return null;
}

function normDate(s) {
  const d = new Date(s);
  if (isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseAmount(s) {
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s.trim()) || /-/.test(s)) neg = true;
  const cleaned = s.replace(/[(),$\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

// Statement transaction amounts nearly always include cents. Require a decimal
// amount, unless a whole-dollar value has an explicit $ marker, so OCR'd ACH,
// Zelle, and Web IDs cannot be mistaken for dollar amounts.
const CURRENCY_AMOUNT = '-?\\$?\\(?[\\d,]+\\.\\d{2}\\)?|-?\\$\\(?[\\d,]+\\)?';

function suggestCategory(description) {
  const d = (description || '').toLowerCase();
  const map = [
    [/payroll|direct\s*dep|salary|employer|\bpaycheck\b/, 'employment_income'],
    [/irs|tax\s*refund|\btax\b/, 'tax'],
    [/safeway|kroger|trader\s*joe|whole\s*foods|grocery|market/, 'groceries'],
    [/shell|chevron|exxon|bp|gas\s+station|\bfuel\b/, 'fuel'],
    [/pg&e|electric|water\s+dept|\butility\b|comcast|verizon|at&t/, 'utilities'],
    [/mortgage|\brent\b|hoa/, 'housing'],
    [/walgreens|cvs|pharmacy|\bdr\s|medical|dental|hospital/, 'medical'],
    [/daycare|child\s*care|preschool/, 'childcare'],
    [/transfer|zelle|venmo|paypal|wire/, 'transfer'],
    [/restaurant|dining|doordash|uber\s*eats|grubhub/, 'dining'],
    [/amazon|walmart|target|costco/, 'shopping'],
    [/insurance|geico|progressive|state\s*farm/, 'insurance'],
  ];
  for (const [re, cat] of map) {
    if (re.test(d)) return cat;
  }
  return null;
}

function determineFlow(amount, accountType, description) {
  const d = (description || '').toLowerCase();
  if (accountType === 'credit_card') {
    // On a credit card: negative amounts / "payment thank you" / credits reduce the balance (payments IN).
    // Positive amounts are purchases = expenses.
    if (/payment|thank you|credit|refund|adjustment/.test(d) || amount < 0) return 'income';
    return 'expense';
  }
  if (accountType === 'unknown') return 'unknown';
  // A withdrawal is money leaving the account whatever sign the statement
  // column carried, and counting one as a deposit inflates imputed income.
  // "ATM cash deposit" and surcharge refunds are inflows despite the wording.
  if (/\bwithdraw(?:al|n|s)?\b|\bcash advance\b/.test(d) && !/\bdeposit\b|\brefund\b|\breversal\b/.test(d)) {
    return 'expense';
  }
  // Bank account: positive = deposit (income), negative = withdrawal (expense).
  return amount >= 0 ? 'income' : 'expense';
}

// Chase-style lines omit the year ("08/17"). Use the statement period's year,
// rolling back a year for Dec lines when the statement period starts in January, etc.
function withInferredYear(dateStr, period, fallbackYear) {
  if (!dateStr) return dateStr;
  // Already has a 4-digit year
  if (/\d{4}/.test(dateStr)) return dateStr;
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}))?$/);
  if (!m) {
    // "Jan 15" style
    return dateStr;
  }
  const month = parseInt(m[1], 10);
  let year = null;
  if (period && period.end) {
    year = new Date(period.end).getFullYear();
    const endMonth = new Date(period.end).getMonth() + 1;
    // If the line month is after the period's end month, it belongs to the prior year
    // (e.g., statement period Jan 2023 covers Dec 2022 lines).
    if (month > endMonth) year -= 1;
  } else if (fallbackYear) {
    year = fallbackYear;
  } else {
    year = new Date().getFullYear();
  }
  return `${m[1]}/${m[2]}/${year}`;
}

// Pull a year/month out of a filename like "2023.08 ..." or "... 2023 ..."
function yearFromFilename(filename) {
  if (!filename) return null;
  const m = filename.match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

// "2023.08 ..." -> { year: 2023, month: 8 }; also "Aug 2023", "08-2023", etc.
function periodFromFilename(filename) {
  if (!filename) return null;
  let m = filename.match(/((?:19|20)\d{2})[.\-_/](\d{1,2})/); // 2023.08 or 2023-08
  if (m) return { year: +m[1], month: +m[2] };
  m = filename.match(/\b(\d{1,2})[.\-_]((?:19|20)\d{2})\b/); // 08.2023
  if (m) return { year: +m[2], month: +m[1] };
  const mon = filename.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*,?\s*((?:19|20)\d{2})/i);
  if (mon) return { year: +mon[2], month: MONTHS[mon[1].toLowerCase()] || null };
  return null;
}

// Last-4 account digits or a short nickname from the filename for labeling.
function accountLabelFromFilename(filename) {
  if (!filename) return null;
  // Prefer digits right after account-ish words: "Acct 3063", "CC 5013", "account ... 1234"
  let d = filename.match(/(?:acct|account|cc|card|ck|sv)\s*#?\s*(\d{3,})/i);
  if (d) return `****${d[1].slice(-4)}`;
  // Otherwise the last 3+ digit group that is NOT a 4-digit year (19xx/20xx)
  const groups = filename.match(/\d{3,}/g) || [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!/^(19|20)\d{2}$/.test(g)) return `****${g.slice(-4)}`;
  }
  const base = filename.replace(/\.(pdf|csv|txt|xlsx|xls|docx|doc|jpg|jpeg|png|gif)$/i, '');
  return base.length > 3 ? base : null;
}

/**
 * Parse statement text into { bankName, accountType, statementStart, statementEnd, transactions[] }
 * @param {string} text extracted statement text
 * @param {string} [filename] original filename (used as a date fallback)
 */
function parseStatementText(text, filename) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const accountType = detectAccountType(text, filename);
  const period = detectStatementPeriod(text);
  const fallbackYear = yearFromFilename(filename);
  const fnPeriod = periodFromFilename(filename);
  const fnAccount = accountLabelFromFilename(filename);

  const transactions = [];
  // Date patterns: 01/15, 01/15/2024, Jan 15 2024
  const reMDY = new RegExp(`^(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)[,\\s]+(.+?)[,\\s]+(${CURRENCY_AMOUNT})(?:[,\\s]+(${CURRENCY_AMOUNT}))?$`);
  const reText = new RegExp(`^([A-Za-z]{3,9})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?[,\\s]+(.+?)[,\\s]+(${CURRENCY_AMOUNT})(?:[,\\s]+(${CURRENCY_AMOUNT}))?$`);

  for (const line of lines) {
    let m = line.match(reMDY);
    let dateStr = null, desc = null, amtStr = null, balStr = null;

    if (m) {
      dateStr = m[1];
      desc = m[2];
      amtStr = m[3];
      balStr = m[4] || null;
    } else {
      m = line.match(reText);
      if (m) {
        const mon = MONTHS[m[1].toLowerCase()];
        if (!mon) continue;
        dateStr = `${m[1]} ${m[2]}${m[3] ? ' ' + m[3] : ''}`;
        desc = m[4];
        amtStr = m[5];
        balStr = m[6] || null;
      } else {
        continue;
      }
    }

    const amount = parseAmount(amtStr);
    if (amount === null) continue;

    // Skip header/summary/total lines
    if (/^(description|details|memo|total|subtotal|balance|ending|beginning|payments?\s+and\s+credits)/i.test(desc.trim())) continue;

    const date = normDate(withInferredYear(dateStr, period, fallbackYear));
    const flowType = determineFlow(amount, accountType, desc);
    const suggestedCategory = suggestCategory(desc);

    transactions.push({
      date: date || dateStr,
      description: desc.replace(/\s{2,}/g, ' ').trim(),
      amount: Math.abs(amount),
      type: flowType === 'income' ? 'credit' : 'debit',
      runningBalance: parseAmount(balStr),
      flowType,
      suggestedCategory,
    });
  }

  // Fall back to filename-derived period/account when the text didn't yield them.
  let statementStart = period ? period.start : null;
  let statementEnd = period ? period.end : null;
  if (!statementStart && fnPeriod && fnPeriod.month) {
    const y = fnPeriod.year, mo = String(fnPeriod.month).padStart(2, '0');
    const lastDay = new Date(y, fnPeriod.month, 0).getDate();
    statementStart = `${y}-${mo}-01`;
    statementEnd = `${y}-${mo}-${String(lastDay).padStart(2, '0')}`;
  }
  const accountNumberMasked = maskAccountNumber(text) || fnAccount;

  return {
    bankName: detectBankName(text),
    accountType,
    accountNumberMasked,
    statementStart,
    statementEnd,
    beginningBalance: null,
    endingBalance: null,
    transactions,
  };
}

module.exports = { parseStatementText };
