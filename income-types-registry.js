/**
 * Comprehensive Income Types Registry
 * Defines all possible income types for spousal/child support calculations
 * Organized by category with upload document type specifications
 */

const INCOME_CATEGORIES = {
  employment: {
    label: 'Employment Income',
    icon: '💼',
    description: 'W-2 wages, 1099 self-employment, bonuses, commissions',
    types: [
      {
        id: 'w2-salary',
        label: 'W-2 Salary/Wages',
        description: 'Base salary and regular wages',
        unit: '/yr',
        docs: ['W-2 forms', 'Pay stubs', 'Earnings statements']
      },
      {
        id: 'bonus',
        label: 'Annual Bonus',
        description: 'Bonus, performance pay',
        unit: '/yr',
        docs: ['Bonus documentation', 'Bonus history', 'Offer letter']
      },
      {
        id: 'commission',
        label: 'Commissions',
        description: 'Commission income',
        unit: '/yr',
        docs: ['Commission statements', 'Sales records', 'Payment history']
      },
      {
        id: 'overtime',
        label: 'Overtime Pay',
        description: 'Overtime compensation',
        unit: '/yr',
        docs: ['Pay stubs showing OT', 'Timesheets', 'Earnings statements']
      },
      {
        id: 'tips',
        label: 'Tips',
        description: 'Tip income',
        unit: '/yr',
        docs: ['Tax returns (Schedule C)', 'Tip reports', 'Bank deposits']
      },
      {
        id: '1099-self',
        label: '1099 Self-Employment',
        description: 'Contractor/self-employed income',
        unit: '/yr',
        docs: ['1099-NEC/MISC forms', 'Business tax return (Schedule C)', 'Invoices']
      }
    ]
  },

  social_security: {
    label: 'Social Security & Government Benefits',
    icon: '🏛️',
    description: 'SSA, SSDI, SSI, veterans benefits',
    types: [
      {
        id: 'ssa-retirement',
        label: 'Social Security Retirement',
        description: 'SSA retirement benefits',
        unit: '/mo',
        docs: ['SSA benefit letter', 'Award notice', 'Payment statement']
      },
      {
        id: 'ssdi',
        label: 'Social Security Disability (SSDI)',
        description: 'SSDI benefits',
        unit: '/mo',
        docs: ['SSA benefit letter', 'Award notice', 'Payment statement']
      },
      {
        id: 'ssi',
        label: 'Supplemental Security Income (SSI)',
        description: 'SSI benefits',
        unit: '/mo',
        docs: ['SSI benefit letter', 'Award notice', 'Payment statement']
      },
      {
        id: 'ssa-child',
        label: 'Child Social Security Benefits',
        description: 'Benefits for dependent children',
        unit: '/mo',
        docs: ['SSA benefit letter', 'Award notice', 'Payment statement']
      },
      {
        id: 'ssa-survivor',
        label: 'Survivor/Widow Benefits',
        description: 'Widow/widower or survivor benefits',
        unit: '/mo',
        docs: ['SSA benefit letter', 'Award notice', 'Payment statement']
      },
      {
        id: 'va-benefits',
        label: 'Veterans Benefits (VA)',
        description: 'VA disability, military retirement',
        unit: '/mo',
        docs: ['VA award letter', 'LES (military)', 'Payment statement']
      },
      {
        id: 'unemployment',
        label: 'Unemployment Benefits',
        description: 'State unemployment insurance',
        unit: '/mo',
        docs: ['Unemployment determination', 'Payment history', '1099-G form']
      },
      {
        id: 'workers-comp',
        label: 'Workers\' Compensation',
        description: 'Work injury/disability benefits',
        unit: '/mo',
        docs: ['Award letter', 'Benefit statement', 'Payment records']
      },
      {
        id: 'disability-other',
        label: 'Other Disability Benefits',
        description: 'Non-SSA disability income',
        unit: '/mo',
        docs: ['Award letter', 'Benefit statement', 'Payment records']
      }
    ]
  },

  investment: {
    label: 'Investment & Property Income',
    icon: '📈',
    description: 'Dividends, interest, rental income, capital gains',
    types: [
      {
        id: 'dividends',
        label: 'Dividends',
        description: 'Stock/mutual fund dividends',
        unit: '/yr',
        docs: ['1099-DIV forms', 'Brokerage statements', 'Investment account statements']
      },
      {
        id: 'interest',
        label: 'Interest Income (Savings, CD, Bonds)',
        description: 'Interest from savings, CDs, bonds, bank accounts',
        unit: '/yr',
        docs: ['1099-INT forms', 'CD statements', 'Bank statements', 'Bond statements']
      },
      {
        id: 'capital-gains',
        label: 'Capital Gains',
        description: 'Realized gains from investments',
        unit: '/yr',
        docs: ['1099-B forms', 'Brokerage statements', 'Sale confirmations']
      },
      {
        id: 'rental-income',
        label: 'Rental Income',
        description: 'Income from rental real estate',
        unit: '/yr',
        docs: ['Tax return Schedule E', 'Rental agreements', 'Lease documents', 'Payment records']
      },
      {
        id: 'royalties',
        label: 'Royalties',
        description: 'Royalty income (minerals, intellectual property, etc.)',
        unit: '/yr',
        docs: ['1099-NEC/MISC forms', 'Royalty statements', 'Payment records']
      },
      {
        id: 'annuity',
        label: 'Annuity Payments',
        description: 'Income from annuity contracts',
        unit: '/yr',
        docs: ['Annuity statements', 'Payment records', 'Contract']
      }
    ]
  },

  retirement: {
    label: 'Retirement Distributions & Pensions',
    icon: '🎯',
    description: 'Pension, IRA, 401(k), deferred compensation',
    types: [
      {
        id: 'pension',
        label: 'Pension (Defined Benefit)',
        description: 'Pension payments from employer or government',
        unit: '/mo',
        docs: ['Pension award letter', 'Payment statements', 'Plan documents']
      },
      {
        id: 'ira-dist',
        label: 'IRA Distributions',
        description: 'Traditional, Roth, or SEP IRA distributions',
        unit: '/yr',
        docs: ['1099-R forms', 'IRA statements', 'Withdrawal records']
      },
      {
        id: '401k-dist',
        label: '401(k) Distributions',
        description: '401(k) withdrawal or rollover income',
        unit: '/yr',
        docs: ['1099-R forms', '401(k) statements', 'Withdrawal records']
      },
      {
        id: '403b-dist',
        label: '403(b) Distributions',
        description: '403(b) tax-sheltered annuity distributions',
        unit: '/yr',
        docs: ['1099-R forms', '403(b) statements', 'Withdrawal records']
      },
      {
        id: 'deferred-comp',
        label: 'Deferred Compensation',
        description: 'Deferred compensation plan distributions',
        unit: '/yr',
        docs: ['Plan statements', 'Payment records', 'Award letters']
      },
      {
        id: 'federal-pension',
        label: 'FERS/CSRS (Federal Pension)',
        description: 'Federal employee retirement pension',
        unit: '/mo',
        docs: ['FERS/CSRS letter', 'LES statement', 'Payment records']
      }
    ]
  },

  support: {
    label: 'Spousal & Family Support',
    icon: '👥',
    description: 'Spousal maintenance, alimony, child support received',
    types: [
      {
        id: 'spousal-maint',
        label: 'Spousal Maintenance Received',
        description: 'Alimony or spousal support from another party',
        unit: '/mo',
        docs: ['Settlement agreement', 'Divorce decree', 'Court order', 'Payment records']
      },
      {
        id: 'child-support-recv',
        label: 'Child Support Received',
        description: 'Child support from another relationship',
        unit: '/mo',
        docs: ['Child support order', 'Court decree', 'Payment records']
      },
      {
        id: 'alimony-gross',
        label: 'Alimony in Gross',
        description: 'One-time or fixed alimony payment',
        unit: '/yr',
        docs: ['Settlement agreement', 'Divorce decree', 'Court order']
      }
    ]
  },

  business: {
    label: 'Business & Entity Income',
    icon: '🏢',
    description: 'Business ownership, partnerships, S-corp, LLC',
    types: [
      {
        id: 'proprietor',
        label: 'Proprietorship/Self-Employed',
        description: 'Sole proprietor net business income',
        unit: '/yr',
        docs: ['Tax return (Schedule C)', 'Profit & loss statement', 'Business bank statements']
      },
      {
        id: 'partnership',
        label: 'Partnership Distributions',
        description: 'Income from partnership distributions/draws',
        unit: '/yr',
        docs: ['K-1 form', 'Partnership agreement', 'Distribution statements']
      },
      {
        id: 's-corp',
        label: 'S-Corporation Dividends',
        description: 'Dividends from S-corp ownership',
        unit: '/yr',
        docs: ['K-1 form', 'Corporate tax return', 'Shareholder statements']
      },
      {
        id: 'c-corp',
        label: 'C-Corporation Distributions',
        description: 'Distributions from C-corp ownership',
        unit: '/yr',
        docs: ['1099-DIV form', 'Corporate tax return', 'Distribution statements']
      },
      {
        id: 'llc',
        label: 'LLC Member Distributions',
        description: 'Income from LLC membership distributions',
        unit: '/yr',
        docs: ['K-1 form (if taxed as partnership)', 'Operating agreement', 'Distribution statements']
      }
    ]
  },

  other: {
    label: 'Other Income',
    icon: '💰',
    description: 'Gifts, trusts, insurance, consulting, gambling',
    types: [
      {
        id: 'consulting',
        label: 'Consulting Fees',
        description: 'Income from consulting work',
        unit: '/yr',
        docs: ['1099-NEC form', 'Consulting contracts', 'Invoice records']
      },
      {
        id: 'contract-labor',
        label: 'Contract Labor',
        description: 'Contract or temporary work income',
        unit: '/yr',
        docs: ['1099 forms', 'Contract agreements', 'Payment records']
      },
      {
        id: 'trust-dist',
        label: 'Trust Distributions',
        description: 'Income from trust distributions',
        unit: '/yr',
        docs: ['Trust documents', 'Trustee statement', 'K-1 form (if applicable)']
      },
      {
        id: 'inheritance',
        label: 'Inheritance/Gifts (Recurring)',
        description: 'Regular recurring gifts or inheritance income',
        unit: '/yr',
        docs: ['Bank statements', 'Gift letters', 'Will/estate documents']
      },
      {
        id: 'insurance',
        label: 'Insurance Proceeds (Recurring)',
        description: 'Ongoing insurance income (if not one-time)',
        unit: '/yr',
        docs: ['Insurance statements', 'Award letters', 'Payment records']
      },
      {
        id: 'loan-forgive',
        label: 'Loan Forgiveness (Taxable)',
        description: 'Taxable income from forgiven loans',
        unit: '/yr',
        docs: ['1099-C form', 'Lender statement', 'Settlement agreement']
      },
      {
        id: 'gambling',
        label: 'Gambling Winnings (Regular)',
        description: 'Regular gambling income',
        unit: '/yr',
        docs: ['1099-MISC form', 'Gambling records', 'Tax return']
      }
    ]
  }
};

/**
 * Flatten all income types into a simple lookup
 */
function getAllIncomeTypes() {
  const types = {};
  Object.values(INCOME_CATEGORIES).forEach(category => {
    category.types.forEach(type => {
      types[type.id] = {
        ...type,
        category: category.label
      };
    });
  });
  return types;
}

/**
 * Get income type by ID
 */
function getIncomeType(id) {
  return getAllIncomeTypes()[id];
}

/**
 * Match document to income type based on filename/content
 */
function matchDocumentToIncomeType(filename) {
  const lower = filename.toLowerCase();

  // W-2 forms
  if (lower.includes('w-2') || lower.includes('w2') || lower.includes('wage')) return 'w2-salary';

  // 1099 forms
  if (lower.includes('1099-div')) return 'dividends';
  if (lower.includes('1099-int')) return 'interest';
  if (lower.includes('1099-b')) return 'capital-gains';
  if (lower.includes('1099-r')) return 'ira-dist';
  if (lower.includes('1099-nec') || lower.includes('1099-misc')) return '1099-self';
  if (lower.includes('1099-c')) return 'loan-forgive';
  if (lower.includes('1099')) return '1099-self';

  // Pay stubs
  if (lower.includes('paystub') || lower.includes('pay stub') || lower.includes('earnings')) return 'w2-salary';
  if (lower.includes('bonus')) return 'bonus';
  if (lower.includes('commission')) return 'commission';

  // CD & savings
  if (lower.includes('cd') || lower.includes('certificate') || lower.includes('savings')) return 'interest';

  // Social Security
  if (lower.includes('ssa') || lower.includes('social security') || lower.includes('benefit letter')) return 'ssa-retirement';
  if (lower.includes('ssdi') || lower.includes('disability')) return 'ssdi';
  if (lower.includes('ssi')) return 'ssi';

  // Pension & Retirement
  if (lower.includes('pension') || lower.includes('fers') || lower.includes('csrs')) return 'pension';
  if (lower.includes('401k') || lower.includes('401(k)')) return '401k-dist';
  if (lower.includes('ira')) return 'ira-dist';

  // Rental
  if (lower.includes('rental') || lower.includes('lease') || lower.includes('property')) return 'rental-income';

  // Spousal/Child support
  if (lower.includes('spousal') || lower.includes('alimony')) return 'spousal-maint';
  if (lower.includes('child support')) return 'child-support-recv';

  // Default: unknown
  return null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INCOME_CATEGORIES, getAllIncomeTypes, getIncomeType, matchDocumentToIncomeType };
}
