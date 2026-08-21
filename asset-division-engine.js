/**
 * Asset Division Valuation Engine
 * Handles complex calculations for community property division
 * with tax implications and scenario analysis
 */

class AssetDivisionEngine {
  constructor() {
    this.assets = [];
    this.liabilities = [];
    this.scenarios = [];
  }

  /**
   * Calculate net estate value
   */
  calculateNetEstate() {
    const totalAssets = this.assets.reduce((sum, a) => sum + a.value, 0);
    const totalLiabilities = this.liabilities.reduce((sum, l) => sum + l.value, 0);
    return totalAssets - totalLiabilities;
  }

  /**
   * Calculate 50/50 equal split
   */
  calculate50_50Split() {
    const netEstate = this.calculateNetEstate();
    return {
      party1Share: netEstate / 2,
      party2Share: netEstate / 2,
      equalizationNeeded: 0
    };
  }

  /**
   * Calculate custom percentage split
   */
  calculateCustomSplit(party1Percent) {
    const netEstate = this.calculateNetEstate();
    const party1Share = netEstate * (party1Percent / 100);
    const party2Share = netEstate * ((100 - party1Percent) / 100);

    return {
      party1Share: party1Share,
      party2Share: party2Share,
      party1Percent: party1Percent,
      party2Percent: 100 - party1Percent,
      equalizationNeeded: Math.abs(party1Share - party2Share)
    };
  }

  /**
   * Calculate equalization payment
   */
  calculateEqualization(party1NetValue, party2NetValue) {
    const difference = party1NetValue - party2NetValue;
    return {
      amount: Math.abs(difference) / 2,
      payingParty: difference > 0 ? 'Party A' : 'Party B',
      receivingParty: difference > 0 ? 'Party B' : 'Party A'
    };
  }

  /**
   * Categorize assets by type for tax analysis
   */
  categorizeAssets() {
    const categories = {
      realEstate: [],
      retirement: [],
      investments: [],
      business: [],
      bankAccounts: [],
      vehicles: [],
      personal: [],
      other: []
    };

    this.assets.forEach(asset => {
      switch (asset.category) {
        case 'Real Estate':
          categories.realEstate.push(asset);
          break;
        case 'Retirement':
        case 'Pension':
          categories.retirement.push(asset);
          break;
        case 'Investments':
          categories.investments.push(asset);
          break;
        case 'Business Interest':
          categories.business.push(asset);
          break;
        case 'Bank Accounts':
          categories.bankAccounts.push(asset);
          break;
        case 'Vehicles':
          categories.vehicles.push(asset);
          break;
        case 'Personal Property':
          categories.personal.push(asset);
          break;
        default:
          categories.other.push(asset);
      }
    });

    return categories;
  }

  /**
   * Calculate tax implications by asset type
   */
  calculateTaxImplications() {
    const categories = this.categorizeAssets();
    const implications = {
      retirement: {
        type: 'Retirement Accounts (401k, IRA, Pension)',
        taxTreatment: 'QDRO required for 401k/Pension; No immediate tax if done correctly',
        futureImpact: 'Distributions taxed as ordinary income to receiving party',
        planning: 'Use QDRO; Consider Roth conversion; Get actuary for pension value'
      },
      realEstate: {
        type: 'Real Estate',
        taxTreatment: '§1041: No transfer tax; Stepped-up basis for appreciation',
        futureImpact: 'Capital gains tax only on post-divorce appreciation (max $250k single exclusion)',
        planning: 'Primary residence most tax-efficient; Document stepped-up basis'
      },
      investments: {
        type: 'Investment Accounts',
        taxTreatment: '§1041: No transfer tax; Basis carryover (unrealized gains transfer)',
        futureImpact: 'Receiving spouse pays tax on gains when sold; Depends on holding period',
        planning: 'Calculate unrealized gains; Consider tax-loss harvesting; Track cost basis'
      },
      business: {
        type: 'Business Interests',
        taxTreatment: '§1041: No transfer tax; Basis carryover; K-1 reporting if partnership',
        futureImpact: 'Tax on future income from business; Depreciation recapture if applicable',
        planning: 'Professional business valuation; Review operating agreement; QDRO if applicable'
      }
    };

    return implications;
  }

  /**
   * Get tax research resources
   */
  getTaxResources() {
    return {
      retirement: [
        'IRS Publication 575: Pension and Annuity Income',
        'IRC §1041: Exchange of Property in Divorce',
        'QDRO: Qualified Domestic Relations Orders',
        'Spousal IRA Rollover Rules'
      ],
      realEstate: [
        'Section 121: Capital Gains Exclusion ($250k single)',
        'Basis Carry-Over in Divorce',
        'Depreciation Recapture on Rental Property',
        'State Transfer Tax Issues'
      ],
      investments: [
        'Capital Gains Tax Rates (0%, 15%, 20%)',
        'Cost Basis Methods (FIFO, LIFO, Specific ID)',
        'Wash Sale Rules',
        'Dividend & Interest Income'
      ],
      business: [
        'Business Valuation Methods',
        'S-Corp vs. C-Corp Tax Treatment',
        'Partnership K-1 Reporting',
        'Goodwill & Intangible Assets'
      ]
    };
  }

  /**
   * Validate asset division for completeness
   */
  validateDivision() {
    const errors = [];
    const warnings = [];

    if (this.assets.length === 0) {
      errors.push('No assets entered');
    }

    if (this.liabilities.length === 0) {
      warnings.push('No liabilities entered - ensure debts are included');
    }

    // Check for retirement accounts without QDRO note
    const retirementAccounts = this.assets.filter(a =>
      a.category === 'Retirement' || a.category === 'Pension'
    );
    if (retirementAccounts.length > 0) {
      const withoutQDRO = retirementAccounts.filter(a =>
        !a.notes || !a.notes.toLowerCase().includes('qdro')
      );
      if (withoutQDRO.length > 0) {
        warnings.push('Retirement accounts need QDRO documentation');
      }
    }

    // Check for real estate valuations
    const realEstate = this.assets.filter(a => a.category === 'Real Estate');
    if (realEstate.length > 0) {
      const withoutAppraisal = realEstate.filter(a =>
        !a.notes || (!a.notes.toLowerCase().includes('appraisal') &&
                     !a.notes.toLowerCase().includes('appraised'))
      );
      if (withoutAppraisal.length > 0) {
        warnings.push('Real estate should include professional appraisals');
      }
    }

    // Check for business interests
    const business = this.assets.filter(a => a.category === 'Business Interest');
    if (business.length > 0) {
      const withoutValuation = business.filter(a =>
        !a.notes || !a.notes.toLowerCase().includes('valuation')
      );
      if (withoutValuation.length > 0) {
        warnings.push('Business interests require professional business valuation');
      }
    }

    return { errors, warnings };
  }

  /**
   * Generate division report summary
   */
  generateReport() {
    const netEstate = this.calculateNetEstate();
    const split50_50 = this.calculate50_50Split();
    const categories = this.categorizeAssets();
    const implications = this.calculateTaxImplications();

    return {
      reportDate: new Date().toISOString(),
      netEstate: netEstate,
      suggested50_50Split: split50_50,
      assetsByCategory: categories,
      taxImplications: implications,
      totalAssets: this.assets.reduce((sum, a) => sum + a.value, 0),
      totalLiabilities: this.liabilities.reduce((sum, l) => sum + l.value, 0),
      assetCount: this.assets.length,
      liabilityCount: this.liabilities.length
    };
  }
}

/**
 * Tax Implication Analyzer
 * Provides detailed tax consequences for different asset types
 */
class TaxImplicationAnalyzer {
  /**
   * Analyze 401(k) division
   */
  static analyze401k(value, isReceivingSpouse = false) {
    return {
      assetType: '401(k) Division',
      transferMethod: 'QDRO (Qualified Domestic Relations Order)',
      immediateConsequences: [
        'No immediate federal income tax if using QDRO',
        'No withholding required',
        'State taxes may vary'
      ],
      futureConsequences: [
        'Receiving spouse: Distributions taxed as ordinary income',
        'Early withdrawal (before 59½): 10% penalty + income tax',
        'QDRO exception: Penalty waived if meets QDRO terms',
        'RMDs: Required at age 73 (SECURE 2.0 Act)'
      ],
      planningStrategy: [
        'Use QDRO to avoid immediate taxation',
        'Rollover options to IRA (defer taxation further)',
        'Consider Roth conversion for tax planning',
        'Track basis for future planning'
      ]
    };
  }

  /**
   * Analyze IRA division
   */
  static analyzeIRA(value) {
    return {
      assetType: 'IRA (Spousal Rollover)',
      transferMethod: 'Direct trustee-to-trustee transfer',
      immediateConsequences: [
        'No immediate federal income tax',
        'No withholding (if direct transfer)',
        'Receiving spouse treats as own IRA'
      ],
      futureConsequences: [
        'Distributions taxed to receiving spouse as ordinary income',
        'No RMDs until age 73 (with SECURE 2.0)',
        'Early withdrawal (before 59½): 10% penalty + tax',
        'Rollover options available for different IRA types'
      ],
      planningStrategy: [
        'Use direct transfer (not 60-day rollover)',
        'Track cost basis for Roth conversions',
        'Consider backdoor Roth if applicable',
        'Consolidate to one custodian for simplicity'
      ]
    };
  }

  /**
   * Analyze pension division
   */
  static analyzePension(monthlyBenefit, years) {
    const annualBenefit = monthlyBenefit * 12;
    return {
      assetType: 'Pension (QDRO)',
      value: annualBenefit * (years || 25), // Rough actuarial estimate
      transferMethod: 'QDRO - Creates separate payee for alternate payee',
      immediateConsequences: [
        'No immediate tax on transfer',
        'QDRO creates alternate payee status',
        'Division does not trigger vesting issues'
      ],
      futureConsequences: [
        'Distributions taxed to receiving spouse as ordinary income',
        'No early withdrawal penalty with QDRO',
        'Survivor benefits: Must address separately',
        'COLA adjustments: Depends on plan terms'
      ],
      planningStrategy: [
        'Obtain actuarial valuation (present value)',
        'Decide: Lump sum vs. payment stream',
        'Address survivor benefits',
        'Get professional QDRO drafter'
      ]
    };
  }

  /**
   * Analyze real estate division
   */
  static analyzeRealEstate(value, type = 'primary') {
    const isPrimary = type.toLowerCase() === 'primary';
    return {
      assetType: `Real Estate (${type})`,
      transferMethod: '§1041: No tax on transfer',
      immediateConsequences: [
        'No capital gains tax on transfer',
        'Receiving spouse receives stepped-up basis',
        'No "due on sale" clause triggered (divorce exception)',
        'Title transfer is separate from tax treatment'
      ],
      futureConsequences: [
        isPrimary ?
          'Capital gains exclusion: Up to $250k single / $500k if still joint' :
          'Depreciation recapture: 25% rate on recaptured depreciation',
        'Capital gains on appreciation after divorce: 15-20% rate',
        'Mortgage interest: Deductible if primary or one other home',
        'State transfer taxes: Vary by state'
      ],
      planningStrategy: [
        'Get current appraisal for stepped-up basis documentation',
        'Transfer property via quit claim deed (simple transfer)',
        'File Form 8949 if later sold (document basis)',
        isPrimary ?
          'Primary residence = most tax-efficient asset' :
          'Calculate depreciation recapture liability for fair division'
      ]
    };
  }

  /**
   * Analyze investment accounts
   */
  static analyzeInvestments(value) {
    return {
      assetType: 'Investment Account / Brokerage',
      transferMethod: '§1041: Transfer to new owner',
      immediateConsequences: [
        'No capital gains tax on transfer',
        'Basis carries over (no stepped-up)',
        'Receiving spouse inherits unrealized gain liability',
        'Timing critical: Avoid mid-year dividend distributions'
      ],
      futureConsequences: [
        'Receiving spouse pays tax on gains when sold',
        'Capital gains rate: 0% (long-term), 15%, or 20%',
        'Dividend income: Taxed to receiving spouse',
        'Wash sale rules: Apply to receiving spouse going forward'
      ],
      planningStrategy: [
        'Calculate unrealized gains (add to debt owed)',
        'Consider tax-loss harvesting timing',
        'Identify securities with large unrealized losses',
        'Document cost basis of all securities',
        'Consider who should get volatile stocks'
      ]
    };
  }

  /**
   * Analyze S-Corp / Business Interest
   */
  static analyzeBusinessInterest(value, type = 'S-Corp') {
    return {
      assetType: `Business Interest (${type})`,
      transferMethod: '§1041: Transfer to new owner',
      immediateConsequences: [
        'No tax on transfer of ownership',
        'Basis carries over',
        'Receiving spouse becomes shareholder',
        'K-1 reporting transfers to receiving spouse'
      ],
      futureConsequences: [
        'Receiving spouse reports income on K-1',
        'Self-employment tax: Applicable to S-Corp',
        'Built-in gain tax: C-Corp specific issue',
        'Depreciation recapture: For depreciable assets'
      ],
      planningStrategy: [
        'Professional business valuation required',
        'Review operating/partnership agreement',
        'Determine if receiving spouse can operate',
        'Consider buyout option instead of transfer',
        'Update tax IDs and EINs',
        'Consider cash flow impact on both parties'
      ]
    };
  }

  /**
   * Summary: Key Tax Rules
   */
  static getSummaryRules() {
    return [
      '§1041: All transfers in divorce are non-taxable events',
      '§1041 applies to all property (no gain/loss recognized)',
      'Basis carryover: Receiving spouse takes original basis (except real estate stepped-up)',
      'Retirement accounts: QDRO required for 401k/Pension',
      'IRAs: Spousal rollover available (no tax)',
      'Primary residence: Most tax-efficient division',
      'Investments: Unrealized gains transfer to receiving spouse',
      'Business interests: §1041 applies but valuation critical',
      'Spousal support: Can be tax-deductible (depends on amount)',
      'Alimony: Fully deductible by payor / included in payee income (post-2018)'
    ];
  }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AssetDivisionEngine, TaxImplicationAnalyzer };
}
