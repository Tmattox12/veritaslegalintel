<<<<<<< HEAD
/**
 * Sample Reconciliation Data for Veritas Template
 * Based on Anderson v. Anderson sample case
 */

const reconData = {
  "Groceries": {
    label: "Groceries",
    transactions: [
      {'date': '2025-09-03', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 87.25},
      {'date': '2025-09-10', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 62.50},
      {'date': '2025-09-17', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 104.33},
      {'date': '2025-09-24', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 71.20},
      {'date': '2025-10-01', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 91.75},
      {'date': '2025-10-08', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 68.90},
      {'date': '2025-10-15', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 83.45},
      {'date': '2025-10-22', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 75.12},
      {'date': '2025-11-05', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 96.33},
      {'date': '2025-11-12', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 73.88},
      {'date': '2025-11-19', 'merchant': 'WHOLE FOODS MARKET #10456', 'amount': 88.50},
      {'date': '2025-11-26', 'merchant': 'SAFEWAY #0847 PHOENIX AZ', 'amount': 79.65}
    ],
    months: 3,
    totalTransactions: 12,
    total: 982.06,
    monthly_avg: 327.35
  },

  "Restaurants & Dining": {
    label: "Restaurants & Dining",
    transactions: [
      {'date': '2025-09-04', 'merchant': 'CHIPOTLE #2847 PHOENIX', 'amount': 14.50},
      {'date': '2025-09-08', 'merchant': 'PANERA BREAD #0482', 'amount': 12.75},
      {'date': '2025-09-15', 'merchant': 'OLIVE GARDEN #1234 PHOENIX', 'amount': 38.90},
      {'date': '2025-09-22', 'merchant': 'CHIPOTLE #2847 PHOENIX', 'amount': 14.50},
      {'date': '2025-10-02', 'merchant': 'PANERA BREAD #0482', 'amount': 13.25},
      {'date': '2025-10-09', 'merchant': 'THE CHEESECAKE FACTORY', 'amount': 52.40},
      {'date': '2025-10-16', 'merchant': 'CHIPOTLE #2847 PHOENIX', 'amount': 14.50},
      {'date': '2025-10-23', 'merchant': 'PANERA BREAD #0482', 'amount': 12.75},
      {'date': '2025-11-02', 'merchant': 'OLIVE GARDEN #1234 PHOENIX', 'amount': 39.50},
      {'date': '2025-11-09', 'merchant': 'CHIPOTLE #2847 PHOENIX', 'amount': 14.50},
      {'date': '2025-11-16', 'merchant': 'PANERA BREAD #0482', 'amount': 13.25},
      {'date': '2025-11-23', 'merchant': 'THE CHEESECAKE FACTORY', 'amount': 51.80}
    ],
    months: 3,
    totalTransactions: 12,
    total: 396.50,
    monthly_avg: 132.17
  },

  "Auto Fuel": {
    label: "Auto Fuel",
    transactions: [
      {'date': '2025-09-02', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 42.50},
      {'date': '2025-09-09', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 45.75},
      {'date': '2025-09-16', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 43.25},
      {'date': '2025-09-23', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 46.00},
      {'date': '2025-09-30', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 41.75},
      {'date': '2025-10-07', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 47.50},
      {'date': '2025-10-14', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 44.25},
      {'date': '2025-10-21', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 45.00},
      {'date': '2025-10-28', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 43.75},
      {'date': '2025-11-04', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 48.00},
      {'date': '2025-11-11', 'merchant': 'SHELL #3847 PHOENIX AZ', 'amount': 42.50},
      {'date': '2025-11-18', 'merchant': 'CHEVRON #0284 PHOENIX AZ', 'amount': 46.75}
    ],
    months: 3,
    totalTransactions: 12,
    total: 537.00,
    monthly_avg: 179.00
  },

  "Childcare & School": {
    label: "Childcare & School",
    transactions: [
      {'date': '2025-09-01', 'merchant': 'PHOENIX PRESCHOOL INC', 'amount': 1200.00},
      {'date': '2025-10-01', 'merchant': 'PHOENIX PRESCHOOL INC', 'amount': 1200.00},
      {'date': '2025-11-01', 'merchant': 'PHOENIX PRESCHOOL INC', 'amount': 1200.00},
      {'date': '2025-09-05', 'merchant': 'SOCCER LEAGUE REGISTRATION', 'amount': 65.00},
      {'date': '2025-10-10', 'merchant': 'PIANO LESSONS - SMITH STUDIO', 'amount': 85.00},
      {'date': '2025-11-07', 'merchant': 'SOCCER LEAGUE REGISTRATION', 'amount': 65.00}
    ],
    months: 3,
    totalTransactions: 6,
    total: 3815.00,
    monthly_avg: 1271.67
  },

  "Healthcare": {
    label: "Healthcare",
    transactions: [
      {'date': '2025-09-06', 'merchant': 'CVS PHARMACY #3847 PHOENIX', 'amount': 28.50},
      {'date': '2025-09-12', 'merchant': 'BEST HEALTH CLINIC', 'amount': 35.00},
      {'date': '2025-10-03', 'merchant': 'CVS PHARMACY #3847 PHOENIX', 'amount': 31.75},
      {'date': '2025-10-18', 'merchant': 'DENTAL CLEANING - SMILE DDS', 'amount': 125.00},
      {'date': '2025-11-02', 'merchant': 'CVS PHARMACY #3847 PHOENIX', 'amount': 27.50},
      {'date': '2025-11-14', 'merchant': 'BEST HEALTH CLINIC', 'amount': 40.00}
    ],
    months: 3,
    totalTransactions: 6,
    total: 287.75,
    monthly_avg: 95.92
  },

  "Utilities & Services": {
    label: "Utilities & Services",
    transactions: [
      {'date': '2025-09-01', 'merchant': 'APS ELECTRIC COMPANY', 'amount': 142.50},
      {'date': '2025-09-02', 'merchant': 'SOUTHWEST GAS CORP', 'amount': 45.75},
      {'date': '2025-09-05', 'merchant': 'COMCAST INTERNET', 'amount': 89.99},
      {'date': '2025-10-01', 'merchant': 'APS ELECTRIC COMPANY', 'amount': 156.75},
      {'date': '2025-10-02', 'merchant': 'SOUTHWEST GAS CORP', 'amount': 38.50},
      {'date': '2025-10-05', 'merchant': 'COMCAST INTERNET', 'amount': 89.99},
      {'date': '2025-11-01', 'merchant': 'APS ELECTRIC COMPANY', 'amount': 168.25},
      {'date': '2025-11-02', 'merchant': 'SOUTHWEST GAS CORP', 'amount': 52.00},
      {'date': '2025-11-05', 'merchant': 'COMCAST INTERNET', 'amount': 89.99}
    ],
    months: 3,
    totalTransactions: 9,
    total: 873.72,
    monthly_avg: 291.24
  },

  "Clothing & Personal": {
    label: "Clothing & Personal",
    transactions: [
      {'date': '2025-09-07', 'merchant': 'TARGET #1847 PHOENIX', 'amount': 34.50},
      {'date': '2025-09-14', 'merchant': 'GAP STORES #0284', 'amount': 42.75},
      {'date': '2025-09-21', 'merchant': 'SALON CUTS & COLOR', 'amount': 65.00},
      {'date': '2025-10-05', 'merchant': 'TARGET #1847 PHOENIX', 'amount': 28.90},
      {'date': '2025-10-12', 'merchant': 'BANANA REPUBLIC #0157', 'amount': 38.50},
      {'date': '2025-10-19', 'merchant': 'SALON CUTS & COLOR', 'amount': 65.00},
      {'date': '2025-11-03', 'merchant': 'TARGET #1847 PHOENIX', 'amount': 31.25},
      {'date': '2025-11-10', 'merchant': 'NORDSTROM #0847', 'amount': 52.75},
      {'date': '2025-11-17', 'merchant': 'SALON CUTS & COLOR', 'amount': 65.00}
    ],
    months: 3,
    totalTransactions: 9,
    total: 423.65,
    monthly_avg: 141.22
  },

  "Entertainment": {
    label: "Entertainment",
    transactions: [
      {'date': '2025-09-06', 'merchant': 'NETFLIX SUBSCRIPTION', 'amount': 15.99},
      {'date': '2025-09-15', 'merchant': 'AMC THEATERS #1234', 'amount': 36.50},
      {'date': '2025-09-20', 'merchant': 'SPOTIFY PREMIUM', 'amount': 11.99},
      {'date': '2025-10-05', 'merchant': 'NETFLIX SUBSCRIPTION', 'amount': 15.99},
      {'date': '2025-10-12', 'merchant': 'REGAL CINEMA #0847', 'amount': 38.75},
      {'date': '2025-10-20', 'merchant': 'SPOTIFY PREMIUM', 'amount': 11.99},
      {'date': '2025-11-01', 'merchant': 'NETFLIX SUBSCRIPTION', 'amount': 15.99},
      {'date': '2025-11-08', 'merchant': 'AMC THEATERS #1234', 'amount': 36.50},
      {'date': '2025-11-15', 'merchant': 'SPOTIFY PREMIUM', 'amount': 11.99}
    ],
    months: 3,
    totalTransactions: 9,
    total: 214.68,
    monthly_avg: 71.56
  },

  "Insurance": {
    label: "Insurance",
    transactions: [
      {'date': '2025-09-01', 'merchant': 'GEICO AUTO INSURANCE', 'amount': 185.00},
      {'date': '2025-10-01', 'merchant': 'GEICO AUTO INSURANCE', 'amount': 185.00},
      {'date': '2025-11-01', 'merchant': 'GEICO AUTO INSURANCE', 'amount': 185.00}
    ],
    months: 3,
    totalTransactions: 3,
    total: 555.00,
    monthly_avg: 185.00
  },

  "Household & Maintenance": {
    label: "Household & Maintenance",
    transactions: [
      {'date': '2025-09-08', 'merchant': 'HOME DEPOT #0847 PHOENIX', 'amount': 42.75},
      {'date': '2025-09-18', 'merchant': 'LOWES #1234 PHOENIX', 'amount': 68.50},
      {'date': '2025-10-04', 'merchant': 'HOME DEPOT #0847 PHOENIX', 'amount': 35.25},
      {'date': '2025-10-14', 'merchant': 'AUTO MAINTENANCE SHOP', 'amount': 165.00},
      {'date': '2025-11-02', 'merchant': 'LOWES #1234 PHOENIX', 'amount': 54.75},
      {'date': '2025-11-12', 'merchant': 'HOME DEPOT #0847 PHOENIX', 'amount': 38.50}
    ],
    months: 3,
    totalTransactions: 6,
    total: 404.75,
    monthly_avg: 134.92
  }
};

// Calculate aggregate totals
function calculateReconTotals() {
  const totals = {};
  for (const [category, data] of Object.entries(reconData)) {
    totals[category] = {
      monthly: (data.total / data.months).toFixed(2),
      total: data.total.toFixed(2),
      transactions: data.totalTransactions
    };
  }
  return totals;
}

const RECON_SUMMARY = calculateReconTotals();
=======
/* Empty transaction-reconciliation template. Populate from uploaded documents. */
const reconData = {};
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
