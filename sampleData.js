<<<<<<< HEAD
/**
 * Sample Dataset for Veritas Template
 * Fictional divorce case used for demo and testing
 * All names, figures, and exhibits are generated for illustration purposes only
 */

const SAMPLE_CASE = {
  title: "Sample Case: Anderson v. Anderson",
  caseNumber: "DV-2024-12345",
  court: "Superior Court, Maricopa County",
  county: "Maricopa",
  state: "AZ",
  dateOfService: "2024-06-15",

  parties: {
    petitioner: {
      name: "Michael Anderson",
      alias: "Michael",
      role: "Husband (Petitioner)"
    },
    respondent: {
      name: "Sarah Anderson",
      alias: "Sarah",
      role: "Wife (Respondent)"
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
          source: "Paystubs Jan–Aug 2026",
          subtotal: 135200,
          note: "Software engineer, documented on recent W-2"
        },
        {
          name: "Performance bonus (2025 awarded)",
          value: 32000,
          source: "Bonus payment records",
          subtotal: 32000,
          note: "Annual bonus paid in January; projected to recur"
        },
        {
          name: "Investment income (dividends/interest)",
          value: 18200,
          source: "Brokerage statements 2026",
          subtotal: 18200,
          note: "From portfolio held separately"
        }
      ],
      total: 185400
    }
  },

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
          subtotal: 62000,
          note: "Program manager, documented on recent W-2"
        },
        {
          name: "Freelance consulting income",
          value: 10400,
          source: "1099-NEC 2025 (YTD 2026 trend)",
          subtotal: 10400,
          note: "Occasional consulting for former clients"
        }
      ],
      total: 72400
    }
  },

  // Household expenses (AFI-style)
  householdExpenses: {
    petitioner: {
      "Housing": { monthly: 2100, category: "Shelter", notes: "Mortgage, insurance, property tax" },
      "Utilities": { monthly: 280, category: "Utilities", notes: "Electric, gas, water, internet" },
      "Groceries": { monthly: 850, category: "Food", notes: "Household groceries" },
      "Dining Out": { monthly: 420, category: "Food", notes: "Restaurants, coffee, casual meals" },
      "Auto Payment": { monthly: 480, category: "Transportation", notes: "Car loan (Toyota)" },
      "Auto Insurance": { monthly: 185, category: "Transportation", notes: "Vehicle insurance" },
      "Fuel": { monthly: 320, category: "Transportation", notes: "Gasoline" },
      "Auto Maintenance": { monthly: 150, category: "Transportation", notes: "Maintenance, repairs" },
      "Childcare": { monthly: 1200, category: "Child Expenses", notes: "Preschool + after-school" },
      "Child Activities": { monthly: 250, category: "Child Expenses", notes: "Sports, music lessons" },
      "Child Clothing": { monthly: 120, category: "Child Expenses", notes: "Children's clothing" },
      "Health Insurance": { monthly: 420, category: "Healthcare", notes: "Family plan premium" },
      "Medical/Dental": { monthly: 200, category: "Healthcare", notes: "Copays, prescriptions, dental" },
      "Clothing": { monthly: 280, category: "Personal", notes: "Clothing for adults" },
      "Personal Care": { monthly: 140, category: "Personal", notes: "Hair, grooming, hygiene" },
      "Entertainment": { monthly: 300, category: "Entertainment", notes: "Movies, streaming, outings" },
      "Gym": { monthly: 80, category: "Entertainment", notes: "Fitness membership" },
      "Phone": { monthly: 160, category: "Utilities", notes: "Cell phone service" },
      "Subscriptions": { monthly: 75, category: "Entertainment", notes: "Streaming services, apps" },
      "Pets": { monthly: 120, category: "Personal", notes: "Dog food, vet, pet care" },
      "Household": { monthly: 180, category: "Household", notes: "Cleaning supplies, repairs" },
      "Insurance (Other)": { monthly: 95, category: "Insurance", notes: "Renters, umbrella" },
      "Childcare Clothing": { monthly: 60, category: "Child Expenses", notes: "Daycare uniforms" }
    },
    respondent: {
      "Housing": { monthly: 1800, category: "Shelter", notes: "Rent, utilities included" },
      "Groceries": { monthly: 550, category: "Food", notes: "Food shopping" },
      "Dining Out": { monthly: 280, category: "Food", notes: "Restaurants" },
      "Car Payment": { monthly: 320, category: "Transportation", notes: "Vehicle loan" },
      "Auto Insurance": { monthly: 140, category: "Transportation", notes: "Vehicle insurance" },
      "Fuel": { monthly: 220, category: "Transportation", notes: "Gasoline" },
      "Auto Maintenance": { monthly: 100, category: "Transportation", notes: "Maintenance, repairs" },
      "Childcare": { monthly: 800, category: "Child Expenses", notes: "After-school care" },
      "Child Activities": { monthly: 180, category: "Child Expenses", notes: "Sports, activities" },
      "Child Clothing": { monthly: 90, category: "Child Expenses", notes: "Children's clothing" },
      "Health Insurance": { monthly: 250, category: "Healthcare", notes: "Health plan" },
      "Medical/Dental": { monthly: 150, category: "Healthcare", notes: "Medical expenses" },
      "Clothing": { monthly: 200, category: "Personal", notes: "Clothing" },
      "Personal Care": { monthly: 100, category: "Personal", notes: "Personal grooming" },
      "Entertainment": { monthly: 180, category: "Entertainment", notes: "Entertainment" },
      "Gym": { monthly: 60, category: "Entertainment", notes: "Gym membership" },
      "Phone": { monthly: 80, category: "Utilities", notes: "Cell phone" },
      "Subscriptions": { monthly: 40, category: "Entertainment", notes: "Subscriptions" },
      "Household": { monthly: 120, category: "Household", notes: "Household items" },
      "Insurance (Other)": { monthly: 65, category: "Insurance", notes: "Other insurance" }
    }
  },

  // Estate snapshot (simplified)
  estateAtDateOfService: {
    petitioner: {
      assets: {
        "Primary Residence": { value: 580000, notes: "Family home (appraised 6/2024)" },
        "Brokerage Account": { value: 145000, notes: "Investments held in his name" },
        "401(k) - TechCore": { value: 185000, notes: "Retirement account balance" },
        "Toyota Camry (2019)": { value: 18000, notes: "Personal vehicle" },
        "Business Interest": { value: 50000, notes: "Side consulting venture" }
      },
      liabilities: {
        "Mortgage": { value: 420000, notes: "Home loan" },
        "Car Loan (Toyota)": { value: 8000, notes: "Vehicle financing" },
        "Personal Loan": { value: 15000, notes: "Business startup loan" }
      }
    },
    respondent: {
      assets: {
        "Savings Account": { value: 35000, notes: "Emergency fund" },
        "IRA - Traditional": { value: 92000, notes: "Retirement account" },
        "Honda Civic (2018)": { value: 14000, notes: "Personal vehicle" }
      },
      liabilities: {
        "Car Loan (Honda)": { value: 6000, notes: "Vehicle financing" },
        "Credit Card Debt": { value: 8500, notes: "Revolving debt" }
      }
    }
  },

  // Children (custody-related)
  children: [
    { name: "Emma Anderson", age: 8, dateOfBirth: "2016-03-20" },
    { name: "Liam Anderson", age: 6, dateOfBirth: "2018-07-10" }
  ],

  // Support calculations (sample)
  supportCalculations: {
    spousalSupport: {
      guideline: 2850,
      duration: "11 years (long-term marriage)",
      notes: "Calculated per AZ §25-319 using combined parental income method"
    },
    childSupport: {
      guideline: 1620,
      perChild: 810,
      notes: "Calculated per AZ child support worksheetfor 2 children"
    }
  }
};

// Export for use in module pages
=======
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

>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
const SAMPLE_CASE_PETITIONER_NAME = SAMPLE_CASE.parties.petitioner.name;
const SAMPLE_CASE_RESPONDENT_NAME = SAMPLE_CASE.parties.respondent.name;
const SAMPLE_CASE_PETITIONER_INCOME = SAMPLE_CASE.petitionerIncome2026.value;
const SAMPLE_CASE_RESPONDENT_INCOME = SAMPLE_CASE.respondentIncome2026.value;
