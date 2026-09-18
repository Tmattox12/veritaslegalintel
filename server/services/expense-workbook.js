/* Builds a multi-tab expense workbook: a lead sheet of AFI-line totals,
 * one tab per vendor with every transaction and a per-tab total, and an
 * "Unmatched" tab for anything the mapper could not resolve. Vendor totals
 * roll up to the lead sheet. Mirrors the merchant logic in
 * discovery-intake-afi.js so the export matches what's shown on screen. */

const XLSX = require('xlsx');
const AFITaxonomy = require('../../afi-taxonomy');

const { AFI_LINES } = AFITaxonomy;

function detectMerchantLine(description) {
  return AFITaxonomy.afiLineFor(AFITaxonomy.classify(description));
}

function isShopping(category, description) {
  const code = AFITaxonomy.normalize(category) || AFITaxonomy.classify(description);
  return AFITaxonomy.treatmentFor(code) === 'discretionary';
}

// Only spending a court would read as a "need" belongs in the eight AFI lines.
// Transfers and card payments move money between accounts rather than spend it.
function isMappableExpense(txn) {
  const description = (txn.description || '').toLowerCase();
  const code = AFITaxonomy.normalize(txn.mapped_category || txn.suggested_category) ||
    AFITaxonomy.classify(txn.description);
  const amount = Math.abs(parseFloat(txn.amount) || 0);
  if (AFITaxonomy.treatmentFor(code) === 'none' ||
      /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/.test(description)) {
    return false;
  }
  return amount > 0 && amount <= 100000;
}

function merchantKey(desc) {
  return (desc || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).slice(0, 3).join(' ').trim() || 'UNKNOWN';
}

// Excel sheet names: <=31 chars, no : \ / ? * [ ]
function sheetName(name, used) {
  let base = (name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toUpperCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toUpperCase());
  return candidate;
}

/**
 * transactions: rows from bank_transactions (amount, description, transaction_date,
 *   suggested_category, mapped_category, flow_type)
 * overrides: { merchantKey: afiLine|null } — the same userMappings from the AFI mapper UI
 */
function buildExpenseWorkbook(transactions, overrides = {}) {
  const expenses = (transactions || []).filter((t) => t.flow_type === 'expense' && isMappableExpense(t));

  const vendors = {}; // merchantKey -> { rows: [], total, line, label }
  const unmatched = [];
  const lineTotals = {}; // line -> total
  let shoppingTotal = 0;
  let grandTotal = 0;

  expenses.forEach((t) => {
    const amt = Math.abs(parseFloat(t.amount) || 0);
    grandTotal += amt;
    const mk = merchantKey(t.description);
    const category = t.mapped_category || t.suggested_category;

    let line = category != null ? AFITaxonomy.afiLineFor(category) : undefined;
    if (line == null || line === undefined) line = detectMerchantLine(t.description);
    if (Object.prototype.hasOwnProperty.call(overrides, mk)) line = overrides[mk];

    const shopping = line == null && isShopping(category, t.description);
    if (shopping) shoppingTotal += amt;

    if (!vendors[mk]) vendors[mk] = { rows: [], total: 0, line: null };
    vendors[mk].rows.push(t);
    vendors[mk].total += amt;
    if (line != null) vendors[mk].line = line;

    if (line != null) {
      lineTotals[line] = (lineTotals[line] || 0) + amt;
    } else if (!shopping) {
      unmatched.push(t);
    }
  });

  const wb = XLSX.utils.book_new();
  const used = new Set();

  // Lead sheet
  const leadRows = [
    ['Veritas — Expense Lead Sheet'],
    ['Generated', new Date().toISOString()],
    [],
    ['AFI Line', 'Category', 'Total'],
  ];
  AFI_LINES.forEach(({ line, label }) => {
    leadRows.push([line, label, +(lineTotals[line] || 0).toFixed(2)]);
  });
  leadRows.push(['—', 'Shopping / Discretionary (review)', +shoppingTotal.toFixed(2)]);
  leadRows.push(['—', 'Unmatched (needs mapping)', +unmatched.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0).toFixed(2)]);
  leadRows.push([]);
  leadRows.push(['Grand Total', '', +grandTotal.toFixed(2)]);
  leadRows.push([]);
  leadRows.push(['Vendor', 'Rows', 'Total', 'Assigned AFI Line']);
  const vendorNames = Object.keys(vendors).sort((a, b) => vendors[b].total - vendors[a].total);
  vendorNames.forEach((mk) => {
    const v = vendors[mk];
    leadRows.push([mk, v.rows.length, +v.total.toFixed(2), v.line != null ? `Line ${v.line}` : 'Unmatched']);
  });
  const leadSheet = XLSX.utils.aoa_to_sheet(leadRows);
  XLSX.utils.book_append_sheet(wb, leadSheet, sheetName('Lead Sheet', used));

  // One tab per vendor
  vendorNames.forEach((mk) => {
    const v = vendors[mk];
    const rows = [
      [mk],
      ['AFI Line', v.line != null ? `Line ${v.line} — ${(AFI_LINES.find((l) => l.line === v.line) || {}).label || ''}` : 'Unmatched / review'],
      [],
      ['Date', 'Description', 'Amount', 'Category'],
    ];
    v.rows
      .slice()
      .sort((a, b) => (a.transaction_date || '').localeCompare(b.transaction_date || ''))
      .forEach((t) => {
        rows.push([t.transaction_date || '', t.description || '', +(Math.abs(parseFloat(t.amount) || 0)).toFixed(2), t.mapped_category || t.suggested_category || '']);
      });
    rows.push([]);
    rows.push(['', 'Vendor Total', +v.total.toFixed(2), '']);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, sheetName(mk, used));
  });

  // Unmatched tab — can be mapped in the app or annotated here and re-uploaded
  const unmatchedRows = [
    ['Unmatched transactions — map in the AFI mapper, or fill "Assign AFI Line" and re-import.'],
    [],
    ['Date', 'Description', 'Amount', 'Assign AFI Line (1-8, or leave blank)'],
  ];
  unmatched
    .slice()
    .sort((a, b) => Math.abs(parseFloat(b.amount) || 0) - Math.abs(parseFloat(a.amount) || 0))
    .forEach((t) => {
      unmatchedRows.push([t.transaction_date || '', t.description || '', +(Math.abs(parseFloat(t.amount) || 0)).toFixed(2), '']);
    });
  unmatchedRows.push([]);
  unmatchedRows.push(['', 'Unmatched Total', +unmatched.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0).toFixed(2), '']);
  const unmatchedSheet = XLSX.utils.aoa_to_sheet(unmatchedRows);
  XLSX.utils.book_append_sheet(wb, unmatchedSheet, sheetName('Unmatched', used));

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildExpenseWorkbook };
