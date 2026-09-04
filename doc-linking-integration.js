/* ===========================================================
   Document Linking Integration Guide
   Complete examples for integrating document references into modules
   =========================================================== */

// ============================
// QUICK START EXAMPLE
// ============================

/**
 * Example: Initialize document linking in a module (e.g., spousal.html)
 *
 * Place this in your module's initialization code:
 */
function exampleQuickStart() {
  // 1. Initialize the manager
  const caseId = '...'; // from URL params or app state
  const manager = DocumentLinking.initializeDocumentLinking(caseId, 'spousal');

  // 2. Load documents from server
  manager.loadDocumentReferences();

  // 3. Register a calculation with documents
  manager.registerCalculation({
    id: 'income_w2_base',
    displayValue: '$135,200',
    description: 'W-2 Base Income (Petitioner)',
    category: 'income',
    method: 'Recurring W-2 base salary from primary employment',
    breakdown: [
      { k: 'Annual base', v: '$135,200' },
      { k: 'Monthly', v: '$11,267', tot: true }
    ],
    exhibits: [
      {
        name: 'PayStub 41671621',
        kind: 'paystub',
        page: 'Earnings',
        file: '../pay stubs/PayStub 41671621.pdf',
        payer: 'Employer payroll',
        docTitle: 'Earnings Statement',
        period: 'Most recent period',
        rows: [
          { k: 'Base earnings', v: '$9,108.42', hi: true },
          { k: 'YTD gross', v: '$118,409.50' }
        ],
        foot: 'Most recent stub — annualizes to base only.'
      }
    ]
  });

  // 4. Auto-link all numbers with data-calc-id
  DocumentLinking.autoLinkNumbers();
}

// ============================
// SPOUSAL MODULE INTEGRATION
// ============================

/**
 * Integration for spousal.js - Full example
 */
function integrateSpousalModule() {
  // Get the manager
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  // Import all SUPPORT references from spousal.js
  // The SUPPORT object in spousal.js already has all the structure we need
  DocumentLinking.importFromSupportObject(SUPPORT, manager, 'income');

  // Now update the HTML rendering to use linked values:
  // Instead of: <div>${selectedIncome.amount}</div>
  // Use:        <div>${DocumentLinking.displayCalculationWithLink(manager.getCalculation(selectedIncome.id))}</div>

  // Or bind to DOM elements:
  const incomeCells = document.querySelectorAll('[data-income-cell]');
  incomeCells.forEach(cell => {
    const incomeId = cell.getAttribute('data-income-cell');
    const calc = manager.getCalculation(incomeId);
    if (calc && calc.displayValue) {
      cell.innerHTML = DocumentLinking.displayCalculationWithLink(calc);
    }
  });
}

// ============================
// MODULE-BY-MODULE INTEGRATION EXAMPLES
// ============================

/**
 * CHILD SUPPORT MODULE
 * Example: Link child support calculations to documents
 */
function integrateChildSupportModule() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  // Example: Base child support calculation
  manager.registerCalculation({
    id: 'cs_base_combined_income',
    displayValue: '$257,800',
    description: 'Combined Parental Income (Child Support)',
    category: 'income',
    method: 'Sum of both parents\' adjusted gross incomes per [State] §25-320',
    breakdown: [
      { k: 'Petitioner base + bonus', v: '$167,200' },
      { k: 'Respondent 2026 run-rate', v: '$72,400' },
      { k: 'Combined gross', v: '$239,600' },
      { k: 'Less tax/adjustments', v: '~$59,900' },
      { k: 'Adjusted combined income', v: '$257,800', tot: true }
    ],
    exhibits: [
      {
        name: 'Petitioner W-2 (Primary)',
        kind: 'form',
        page: 'Box 1',
        file: '../documents/paystub_sample.pdf',
        payer: 'Employer',
        docTitle: 'Recent Pay Stub',
        period: '2026',
        rows: [
          { k: 'Base + bonus', v: '$167,200', hi: true }
        ]
      },
      {
        name: 'Respondent Check Stubs Report',
        kind: 'paystub',
        page: 'Summary',
        file: '../documents/respondent_stubs_2026.pdf',
        payer: 'Payroll aggregator',
        docTitle: 'Aggregated Income Report',
        period: 'Generated 04/01/2026',
        rows: [
          { k: 'Combined 2026 YTD', v: '$72,400', hi: true }
        ]
      },
      {
        name: 'Respondent 2026 paystubs',
        kind: 'paystub',
        page: 'YTD',
        file: '../documents/respondent_nonprofit_paystubs.pdf',
        payer: 'Global Health Nonprofit + Consulting',
        docTitle: 'Actual paystubs · Jan–Aug 2026',
        period: 'Produced with discovery',
        rows: [
          { k: 'Nonprofit YTD (annualized)', v: '$62,000', hi: true },
          { k: 'Consulting YTD (annualized)', v: '$10,400', hi: true },
          { k: 'Documented combined', v: '$72,400', hi: true }
        ]
      }
    ]
  });

  // Link it to DOM
  const combinedIncomeEl = document.getElementById('csBaseCombinedIncome');
  if (combinedIncomeEl) {
    DocumentLinking.makeNumberClickable(combinedIncomeEl, 'cs_base_combined_income');
  }
}

/**
 * SPOUSAL SUPPORT MODULE - Method 1: Use existing SUPPORT object
 */
function integrateSpousalWithExistingStructure() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  // The SUPPORT object in spousal.js has exactly this structure already!
  // Just convert it:
  Object.entries(SUPPORT).forEach(([key, support]) => {
    if (!support.breakdown || support.breakdown.length === 0) return;

    // Find the primary calculation value
    const primary = support.breakdown.find(b => b.tot) || support.breakdown[support.breakdown.length - 1];
    if (!primary) return;

    manager.registerCalculation({
      id: key,
      displayValue: primary.v,
      description: support.method || key,
      category: 'income',
      method: support.method,
      breakdown: support.breakdown,
      exhibits: support.exhibits || []
    });
  });
}

/**
 * SETTLEMENT MODULE
 * Example: Settlement split calculations
 */
function integrateSettlementModule() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'settlement_house_proceeds',
    displayValue: '$878,661',
    description: 'Total Marital House Sale Proceeds',
    category: 'asset',
    method: 'House sale closing statement less realtor commission and liens',
    breakdown: [
      { k: 'Sale price', v: '$1,200,000' },
      { k: 'Realtor commission (6%)', v: '-$72,000' },
      { k: 'Closing costs', v: '-$15,340' },
      { k: 'Payoff remaining mortgage', v: '-$234,000' },
      { k: 'Net proceeds', v: '$878,660.36', tot: true }
    ],
    exhibits: [
      {
        name: 'Closing Statement (HUD-1)',
        kind: 'form',
        page: 'Summary of Borrower\'s Transaction',
        file: null,
        payer: 'Escrow Agent',
        docTitle: 'Real Estate Closing Disclosure',
        period: '04/29/2025',
        highlights: [
          { label: 'Gross sale price', value: '$1,200,000', ref: 'Line 120', pg: 1 },
          { label: 'Realtor commission', value: '$72,000', ref: 'Line 800', pg: 2 },
          { label: 'Net to seller', value: '$878,660.36', ref: 'Final settlement', pg: 3 }
        ],
        foot: 'Escrow statement showing the house sale proceeds and settlement.'
      }
    ]
  });
}

/**
 * FORENSIC TRACING MODULE
 * Example: Traced funds with document chain
 */
function integrateForensicTracingModule() {
  const manager = DocumentLinkManager.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'trace_401k_separate_property',
    displayValue: '$342,000',
    description: 'Traced 401(k) Pre-Marriage Contributions',
    category: 'asset',
    method: 'Contribution tracing from 401(k) statements 1997-2005 (pre-marriage)',
    breakdown: [
      { k: 'Employee contributions (pre-marriage)', v: '$342,000' },
      { k: 'Earnings on same (marital)', v: '$180,000' },
      { k: 'Status', v: 'Separate property if properly traced', tot: true }
    ],
    exhibits: [
      {
        name: '401(k) Annual Statements 1997-2005',
        kind: 'form',
        page: 'Contribution summary',
        file: null, // Not yet in workspace
        payer: 'Fidelity Investments',
        docTitle: '401(k) Statement Archive',
        period: '1997-2005',
        rows: [
          { k: 'Years covered', v: '9 years' },
          { k: 'Pre-marriage employee contributions', v: '$342,000', hi: true },
          { k: 'Status', v: 'Separate property' }
        ],
        foot: 'Historical statements needed to establish pre-marriage contribution trail.'
      },
      {
        name: 'Marriage Certificate',
        kind: 'filing',
        page: 'Certificate',
        file: null,
        payer: 'Arizona Vital Records',
        docTitle: 'Marriage Certificate',
        period: '06/15/2005',
        rows: [
          { k: 'Marriage date', v: '06/15/2005' }
        ],
        foot: 'Establishes the demarcation date for separate vs. marital property.'
      }
    ]
  });
}

/**
 * DISCOVERY INTAKE MODULE
 * Example: Missing documents and deadlines
 */
function integrateDiscoveryIntakeModule() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'discovery_missing_tax_returns',
    displayValue: '5 years',
    description: 'Tax Returns Not Yet Produced',
    category: 'disclosure',
    method: 'Scheduled for production by court order (Temp Orders §4)',
    breakdown: [
      { k: 'Years requested', v: '2021-2025' },
      { k: 'Years received', v: '2021-2023' },
      { k: 'Years outstanding', v: '2024-2025', tot: true },
      { k: 'Due date', v: '07/31/2026' }
    ],
    exhibits: [
      {
        name: 'Temporary Orders (§4 - Discovery)',
        kind: 'filing',
        page: '§4 - Discovery',
        file: null,
        payer: 'Superior Court of Arizona',
        docTitle: 'Court Order - Temporary Orders',
        period: '05/15/2026',
        rows: [
          { k: 'Document demand', v: 'All tax returns 2021-present' },
          { k: 'Due date', v: '07/31/2026', hi: true }
        ],
        foot: 'Court order requiring production of tax returns.'
      }
    ]
  });
}

/**
 * INCOME IMPUTATION MODULE
 * Example: Potential earning capacity calculation
 */
function integrateIncomeImputationModule() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'imputation_respondent_capacity',
    displayValue: '$68,000',
    description: 'Respondent: Earning Capacity (Open Market)',
    category: 'income',
    method: 'Vocational expert determination (hypothetical)',
    breakdown: [
      { k: 'Vocational expert assessment', v: 'Full-time employment capacity' },
      { k: 'Recommended position', v: 'Senior Program Management' },
      { k: 'Annual salary', v: '$68,000', tot: true },
      { k: 'Monthly equivalent', v: '$5,667' }
    ],
    exhibits: [
      {
        name: 'Vocational Expert Report',
        kind: 'report',
        page: 'Executive Summary',
        file: null, // Sample - would be uploaded
        payer: 'Vocational Expert',
        docTitle: 'Vocational Expert Report',
        period: '03/13/2026',
        flag: 'Sample data - in production this would reference the actual vocational expert report.',
        rows: [
          { k: 'Vocational expert', v: 'Brad H. Taft' },
          { k: 'Open-market earning capacity', v: '$45,480', hi: true },
          { k: 'Monthly equivalent', v: '$3,750' }
        ]
      }
    ]
  });
}

/**
 * AFI (AFFIDAVIT OF FINANCIAL INFORMATION) MODULE
 * Example: Monthly expense items
 */
function integrateAFIModule() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'afi_housing_expense',
    displayValue: '$1,850',
    description: 'Primary Housing Expense (Respondent)',
    category: 'expense',
    method: 'Actual rent payment per lease agreement',
    breakdown: [
      { k: 'Rental property address', v: '123 Main St, Tucson' },
      { k: 'Monthly rent', v: '$1,850' },
      { k: 'Lease term', v: '12 months' },
      { k: 'Current total', v: '$1,850/mo', tot: true }
    ],
    exhibits: [
      {
        name: 'Residential Lease Agreement',
        kind: 'form',
        page: 'Term & Rent Section',
        file: null,
        payer: 'Property management',
        docTitle: 'Residential Lease - 123 Main St',
        period: 'Effective 01/01/2025',
        highlights: [
          { label: 'Monthly rent', value: '$1,850', ref: 'Section 2.1 - Rental Payment', pg: 1 },
          { label: 'Lease start date', value: '01/01/2025', ref: 'Section 1 - Term', pg: 1 }
        ],
        rows: [
          { k: 'Property', v: '123 Main St, Tucson, [State]' },
          { k: 'Monthly rent', v: '$1,850', hi: true },
<<<<<<< HEAD
          { k: 'Tenant', v: 'Sarah Anderson' }
=======
          { k: 'Tenant', v: 'Sarah Template Matter' }
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
        ]
      },
      {
        name: 'Recent Rent Check (proof of payment)',
        kind: 'paystub', // using for lack of better type
        page: 'Cancelled Check',
        file: null,
        payer: 'Bank statement excerpt',
        docTitle: 'Cancelled Check - Rent Payment',
        period: '01/15/2026',
        rows: [
          { k: 'Payee', v: 'Property Management Co.' },
          { k: 'Amount', v: '$1,850', hi: true },
          { k: 'Date cleared', v: '01/15/2026' }
        ]
      }
    ]
  });
}

// ============================
// RENDERING WITH LINKED VALUES
// ============================

/**
 * Example: Render a calculation with link
 * Usage in HTML generation:
 */
function exampleRenderWithLink(calc) {
  if (!calc) return '';

  return `
    <div class="calculation-item">
      <label>${calc.description}</label>
      <div class="calculation-value">
        ${DocumentLinking.displayCalculationWithLink(calc.displayValue, calc.id, 'value-large')}
      </div>
      <div class="calculation-note">
        ${calc.documentIds.length > 0 ? `(${calc.documentIds.length} documents linked)` : '(no documents)'}
      </div>
    </div>
  `;
}

/**
 * Example: HTML with clickable values
 */
function exampleHTMLStructure() {
  return `
    <div id="spousalCalculation" class="calculation-panel">
      <h2>Spousal Support Calculation</h2>

      <div class="income-section">
        <h3>Petitioner Income</h3>
<<<<<<< HEAD
        <div id="luisW2Base" class="income-cell" data-calc-id="[Party A]:w2">
          $236,819
        </div>
        <div id="luisWithBonus" class="income-cell" data-calc-id="[Party A]:bonus">
=======
        <div id="partyAW2Base" class="income-cell" data-calc-id="Parent A:w2">
          $236,819
        </div>
        <div id="partyAWithBonus" class="income-cell" data-calc-id="Parent A:bonus">
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
          $336,819
        </div>
      </div>

      <div class="income-section">
        <h3>Respondent Income</h3>
<<<<<<< HEAD
        <div id="coniRunrate" class="income-cell" data-calc-id="[Party B]:runrate">
          $78,169
        </div>
        <div id="coniCapacity" class="income-cell" data-calc-id="[Party B]:capacity">
=======
        <div id="partyBRunrate" class="income-cell" data-calc-id="Parent B:runrate">
          $78,169
        </div>
        <div id="partyBCapacity" class="income-cell" data-calc-id="Parent B:capacity">
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
          $45,480
        </div>
      </div>

      <div class="property-section">
        <h3>Property Income (Optional)</h3>
        <div id="propCD" class="property-cell" data-calc-id="prop:cd">
          $657.58/mo
        </div>
      </div>

      <div class="result-section">
        <h3>Monthly Spousal Obligation</h3>
        <div id="monthlyObligation" class="result-value" data-calc-id="spousal:monthly_result">
          $2,450
        </div>
      </div>
    </div>
  `;
}

// ============================
// ADVANCED: CUSTOM DOCUMENT TYPES
// ============================

/**
 * Add a custom exhibit type
 */
function exampleCustomExhibit() {
  const manager = DocumentLinking.getDocumentLinkManager();
  if (!manager) return;

  manager.registerCalculation({
    id: 'custom_example',
    displayValue: '$999,999',
    description: 'Example with Custom Exhibit Type',
    category: 'calculation',
    exhibits: [
      {
        name: 'Custom Bank Statement',
        kind: 'custom-bank-statement', // Custom kind
        page: '1-5',
        file: '../court records/Screenshot.pdf',
        payer: 'Bank Name',
        docTitle: 'Bank Statement',
        period: 'Month/Year',
        highlights: [
          {
            label: 'Important transaction',
            value: '$999,999',
            ref: 'Page 3, line 15'
          }
        ]
      }
    ]
  });
}

// ============================
// WORKING WITH CALCULATIONS IN HTML
// ============================

/**
 * Example: Making numbers clickable after dynamic rendering
 */
function exampleDynamicRendering() {
  // After rendering new content to DOM:
  const newContent = document.getElementById('dynamicContent');

  // Auto-link all elements with data-calc-id
  DocumentLinking.autoLinkNumbers();

  // Or manually link specific elements:
  const manager = DocumentLinking.getDocumentLinkManager();
  if (manager) {
    newContent.querySelectorAll('[data-calc-id]').forEach(el => {
      const calcId = el.getAttribute('data-calc-id');
      DocumentLinking.makeNumberClickable(el, calcId);
    });
  }
}

/**
 * Example: Initialize a module with full setup
 */
function completeModuleInitialization(moduleName, caseId) {
  // Step 1: Initialize document linking
  const manager = DocumentLinking.initializeDocumentLinking(caseId, moduleName);

  // Step 2: Load documents from server
  manager.loadDocumentReferences().then(() => {
    // Step 3: Import calculation references
    // (module-specific, see examples above)

    // Step 4: Auto-link all clickable numbers
    DocumentLinking.autoLinkNumbers();

    // Step 5: Optional: Set up event listeners
    document.addEventListener('DOMContentLoaded', () => {
      DocumentLinking.autoLinkNumbers(); // Re-link after any dynamic updates
    });
  });
}

// ============================
// EXPORT
// ============================

// Make examples available
window.DocLinkingIntegration = {
  exampleQuickStart,
  integrateSpousalModule,
  integrateChildSupportModule,
  integrateSpousalWithExistingStructure,
  integrateSettlementModule,
  integrateForensicTracingModule,
  integrateDiscoveryIntakeModule,
  integrateIncomeImputationModule,
  integrateAFIModule,
  exampleRenderWithLink,
  exampleHTMLStructure,
  exampleCustomExhibit,
  exampleDynamicRendering,
  completeModuleInitialization
};
