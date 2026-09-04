/**
 * Calculations Registry for Veritas Template
<<<<<<< HEAD
 * Sample Anderson v. Anderson case data
=======
 * Sample [Case Name] case data
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
 */

const CalculationsRegistry = {
  // Respondent (Sarah) 2026 Income
  respondentIncome2026: {
    title: "Sarah 2026 Income (run-rate)",
    value: 72400,
    unit: "/yr",
    calculation: {
      type: "sum_with_components",
      formula: "Base salary + Part-time consulting",
      steps: [
        {
          name: "Global Health nonprofit base salary",
          value: 62000,
          source: "Paystubs Jan–Aug 2026",
          exhibits: [
            { date: "2026-01-15", amount: 5167, type: "paystub", desc: "Paystub 1/15/26" },
            { date: "2026-02-15", amount: 5167, type: "paystub", desc: "Paystub 2/15/26" },
            { date: "2026-03-15", amount: 5167, type: "paystub", desc: "Paystub 3/15/26" },
            { date: "2026-04-15", amount: 5167, type: "paystub", desc: "Paystub 4/15/26" },
            { date: "2026-05-15", amount: 5167, type: "paystub", desc: "Paystub 5/15/26" },
            { date: "2026-06-15", amount: 5167, type: "paystub", desc: "Paystub 6/15/26" },
            { date: "2026-07-15", amount: 5167, type: "paystub", desc: "Paystub 7/15/26" },
            { date: "2026-08-15", amount: 5167, type: "paystub", desc: "Paystub 8/15/26" }
          ],
          subtotal: 62000,
          note: "Consistent monthly salary from nonprofit employer"
        },
        {
          name: "Freelance consulting income",
          value: 10400,
          source: "1099-NEC 2025 (YTD 2026 trend)",
          exhibits: [
            { date: "2026-01-20", amount: 1850, type: "consulting", desc: "Project completion" },
            { date: "2026-03-15", amount: 2100, type: "consulting", desc: "Quarterly project" },
            { date: "2026-06-30", amount: 2250, type: "consulting", desc: "Mid-year engagement" },
            { date: "2026-07-28", amount: 4200, type: "consulting", desc: "Major project (6-month run)" }
          ],
          subtotal: 10400,
          note: "Occasional consulting for former clients; varies by quarter"
        }
      ],
      total: 72400,
      notes: [
        "Nonprofit salary is stable and documented",
        "Consulting income is secondary and variable",
        "YTD 2026 suggests annual run-rate ~$72.4k"
      ]
    }
  },

  // Petitioner (Michael) 2026 Income
  petitionerIncome2026: {
    title: "Michael 2026 Income (run-rate, tax-adjusted)",
    value: 185400,
    unit: "/yr",
    calculation: {
      type: "sum_with_components",
      formula: "Base salary + Bonus + Investment income",
      steps: [
        {
          name: "TechCore Inc. base salary + benefits",
          value: 135200,
          source: "Paystubs Jan–Aug 2026 + W-2 2025",
          exhibits: [
            { date: "2026-01-15", amount: 8950, type: "paystub", desc: "Paystub 1/15/26" },
            { date: "2026-02-15", amount: 8950, type: "paystub", desc: "Paystub 2/15/26" },
            { date: "2026-03-15", amount: 8950, type: "paystub", desc: "Paystub 3/15/26" },
            { date: "2026-04-15", amount: 8950, type: "paystub", desc: "Paystub 4/15/26" },
            { date: "2026-05-15", amount: 8950, type: "paystub", desc: "Paystub 5/15/26" },
            { date: "2026-06-15", amount: 8950, type: "paystub", desc: "Paystub 6/15/26" },
            { date: "2026-07-15", amount: 8950, type: "paystub", desc: "Paystub 7/15/26" },
            { date: "2026-08-15", amount: 8950, type: "paystub", desc: "Paystub 8/15/26" }
          ],
          subtotal: 135200,
          note: "Software engineer at tech firm; consistent monthly compensation"
        },
        {
          name: "Performance bonus (2025 awarded)",
          value: 32000,
          source: "Bonus payment records and 2025 W-2",
          exhibits: [
            { date: "2026-01-31", amount: 32000, type: "bonus", desc: "2025 annual performance bonus" }
          ],
          subtotal: 32000,
          note: "Annual bonus paid in January 2026; employer indicates recurring annual bonus"
        },
        {
          name: "Investment income (dividends/interest)",
          value: 18200,
          source: "Brokerage statements 2026",
          exhibits: [
            { date: "2026-03-31", amount: 4550, type: "dividend", desc: "Q1 2026 dividends" },
            { date: "2026-06-30", amount: 4600, type: "dividend", desc: "Q2 2026 dividends" },
            { date: "2026-09-30", amount: 4550, type: "dividend", desc: "Q3 2026 dividends" },
            { date: "2026-12-31", amount: 4500, type: "dividend", desc: "Q4 2026 (estimated)" }
          ],
          subtotal: 18200,
          note: "Quarterly dividends from diversified portfolio (held separately)"
        }
      ],
      total: 185400,
      notes: [
        "All income documented via paystubs or statements",
        "Bonus is recurring annual (confirmed by HR)",
        "Investment income is passive; portfolio value ~$250k"
      ]
    }
  },

  // Household expenses from AFI
  householdExpenses: {
    petitionerMonthly: 5400,
    respondentMonthly: 4240,
    notes: "Based on 12-month bank/card statement analysis Sep 2025 – Nov 2025 (expanded to annual estimate)"
  },

  // Estate summary at date of service (June 2024)
  estateAtDOS: {
    totalMariralEstate: 1235000,
    petitionerAssets: 847000,
    respondentAssets: 141000,
    mariralLiabilities: 443000,
    petitionerLiabilities: 443000,
    respondentLiabilities: 14500,
    notes: "Date of service: June 15, 2024. Net marital estate ~$1.235M."
  },

  // Household composition
  children: [
    { name: "Emma", age: 8, dob: "2016-03-20" },
    { name: "Liam", age: 6, dob: "2018-07-10" }
  ],
  childrenCount: 2,

  // Support calculations (simple guidelines)
  spousalMaintenanceSample: {
    formula: "[State] §25-319",
    petitionerIncome: 185400,
    respondentIncome: 72400,
    combinedIncome: 257800,
    guideline: 2850,
    duration: "11 years (long-term marriage, guideline duration for 20-yr marriage range)",
    notes: "Based on Arizona spousal maintenance statute"
  },

  childSupportSample: {
    formula: "[State] Child Support Worksheet",
    numChildren: 2,
    combinedParentalIncome: 257800,
    guideline: 1620,
    perChild: 810,
    duration: "Until age 18 or graduation (age 20 at latest)",
    notes: "Arizona income shares model per worksheet"
  }
};

// Export constants for use in module pages
const RESPONDENT_NAME = "Sarah";
const PETITIONER_NAME = "Michael";
const RESPONDENT_INCOME = 72400;
const PETITIONER_INCOME = 185400;
<<<<<<< HEAD
const CASE_TITLE = "Anderson v. Anderson";
=======
const CASE_TITLE = "[Case Name]";
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
