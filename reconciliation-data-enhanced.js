<<<<<<< HEAD
/**
 * Veritas Reconciliation Data - Enhanced
 * Comprehensive data structure for all AFI expense categories
 * Designed to integrate with backend API
 */

// Helper function to calculate YTD
function calculateYTD(items) {
  let ytd = 0;
  return items.map(item => {
    ytd += parseFloat(item.amount) || 0;
    return { ...item, ytd: ytd };
  });
}

const RECONCILIATION_DATA_ENHANCED = {
  // ========== HEALTH INSURANCE CATEGORIES ==========

  ChildHealthIns_SelfEmp: {
    title: "Child Health Insurance - Self Employed - 2026 YTD",
    expenseCategory: "Child Health Insurance (Self Employed)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 1/1-1/31/26",
          status: "doc",
          sourceLink: "/documents/health-insurance-statement-jan-2026.pdf",
          sourceType: "Insurance Statement",
          documentId: "doc-001"
        },
        {
          date: "2026-02-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 2/1-2/29/26",
          status: "doc",
          sourceLink: "/documents/health-insurance-statement-feb-2026.pdf",
          sourceType: "Insurance Statement",
          documentId: "doc-002"
        },
        {
          date: "2026-03-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 3/1-3/31/26",
          status: "doc",
          sourceLink: "/documents/health-insurance-statement-mar-2026.pdf",
          sourceType: "Insurance Statement",
          documentId: "doc-003"
        },
        {
          date: "2026-04-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 4/1-4/30/26",
          status: "doc",
          sourceLink: "/documents/health-insurance-statement-apr-2026.pdf",
          sourceType: "Insurance Statement",
          documentId: "doc-004"
        },
        {
          date: "2026-05-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 5/1-5/31/26 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-06-15",
          description: "Self-Employed Health Insurance Premium",
          amount: 450.00,
          category: "Health Insurance",
          note: "Monthly premium - coverage period 6/1-6/15/26 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Reconciliation based on insurance statements and bank records. Estimated amounts backed by YTD calculation."
    },
    documentLinks: [
      {
        name: "Health Insurance Statement - Jan 2026",
        type: "PDF",
        url: "/documents/health-insurance-statement-jan-2026.pdf",
        uploadDate: "2026-01-20",
        pages: 2
      },
      {
        name: "Health Insurance Statement - Feb 2026",
        type: "PDF",
        url: "/documents/health-insurance-statement-feb-2026.pdf",
        uploadDate: "2026-02-20",
        pages: 2
      },
      {
        name: "Health Insurance Statement - Mar 2026",
        type: "PDF",
        url: "/documents/health-insurance-statement-mar-2026.pdf",
        uploadDate: "2026-03-20",
        pages: 2
      },
      {
        name: "Health Insurance Statement - Apr 2026",
        type: "PDF",
        url: "/documents/health-insurance-statement-apr-2026.pdf",
        uploadDate: "2026-04-20",
        pages: 2
      },
      {
        name: "Bank Statement - June 2026",
        type: "PDF",
        url: "/documents/bank-statement-june-2026.pdf",
        uploadDate: "2026-06-15",
        pages: 5
      }
    ],
    summary: {
      totalItems: 6,
      documentedItems: 4,
      estimatedItems: 2,
      totalAmount: 2700.00,
      averagePerPeriod: 450.00
    }
  },

  ChildHealthIns_Emp: {
    title: "Child Health Insurance - Employer Provided - 2026 YTD",
    expenseCategory: "Child Health Insurance (Employer Provided)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-10",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 1/1-1/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-jan-1-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-005"
        },
        {
          date: "2026-01-24",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 1/16-1/31/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-jan-24-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-006"
        },
        {
          date: "2026-02-10",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 2/1-2/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-feb-10-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-007"
        },
        {
          date: "2026-02-24",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 2/16-2/28/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-feb-24-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-008"
        },
        {
          date: "2026-03-10",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 3/1-3/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-mar-10-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-009"
        },
        {
          date: "2026-03-24",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 3/16-3/31/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-mar-24-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-010"
        },
        {
          date: "2026-04-10",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 4/1-4/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-apr-10-2026.pdf",
          sourceType: "Pay Stub",
          documentId: "doc-011"
        },
        {
          date: "2026-04-24",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 4/16-4/30/26 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-05-10",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 5/1-5/15/26 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-05-24",
          description: "Employer Health Insurance Deduction",
          amount: 285.50,
          category: "Health Insurance",
          note: "Payroll deduction - pay period 5/16-5/31/26 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Employer deduction amounts verified through pay stubs. Consistent deduction across all pay periods."
    },
    documentLinks: [
      {
        name: "Pay Stub - Jan 10, 2026",
        type: "PDF",
        url: "/documents/pay-stub-jan-10-2026.pdf",
        uploadDate: "2026-01-15",
        pages: 1
      },
      {
        name: "Pay Stub - Jan 24, 2026",
        type: "PDF",
        url: "/documents/pay-stub-jan-24-2026.pdf",
        uploadDate: "2026-01-29",
        pages: 1
      },
      {
        name: "Pay Stub - Feb 10, 2026",
        type: "PDF",
        url: "/documents/pay-stub-feb-10-2026.pdf",
        uploadDate: "2026-02-15",
        pages: 1
      },
      {
        name: "Pay Stub - Feb 24, 2026",
        type: "PDF",
        url: "/documents/pay-stub-feb-24-2026.pdf",
        uploadDate: "2026-02-29",
        pages: 1
      },
      {
        name: "Employer Benefits Statement 2026",
        type: "PDF",
        url: "/documents/employer-benefits-2026.pdf",
        uploadDate: "2026-01-10",
        pages: 3
      }
    ],
    summary: {
      totalItems: 10,
      documentedItems: 7,
      estimatedItems: 3,
      totalAmount: 2855.00,
      averagePerPeriod: 285.50
    }
  },

  ChildHealthIns_Share: {
    title: "Child Health Insurance - Shared (50%) - 2026 YTD",
    expenseCategory: "Child Health Insurance (Shared)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        },
        {
          date: "2026-02-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        },
        {
          date: "2026-03-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        },
        {
          date: "2026-04-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        },
        {
          date: "2026-05-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        },
        {
          date: "2026-06-15",
          description: "Respondent's Share of Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          note: "Respondent's 50% share of joint coverage",
          status: "est",
          sourceLink: "/documents/cost-sharing-agreement.pdf",
          sourceType: "Court Order",
          documentId: "doc-012"
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Shared costs per court order. Petitioner contributes the other 50%."
    },
    documentLinks: [
      {
        name: "Cost Sharing Agreement",
        type: "PDF",
        url: "/documents/cost-sharing-agreement.pdf",
        uploadDate: "2025-12-01",
        pages: 4
      },
      {
        name: "Court Order - Custody & Support",
        type: "PDF",
        url: "/documents/court-order-2026.pdf",
        uploadDate: "2025-12-01",
        pages: 8
      }
    ],
    summary: {
      totalItems: 6,
      documentedItems: 0,
      estimatedItems: 6,
      totalAmount: 1350.00,
      averagePerPeriod: 225.00
    }
  }
};

  // ========== CHILDCARE EXPENSES ==========

  Childcare_Daycare: {
    title: "Child Care - Daycare/Preschool - 2026 YTD",
    expenseCategory: "Child Care (Daycare/Preschool)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 1200.00,
          category: "Childcare",
          note: "Full-time daycare for 2 children (ages 3, 5)",
          status: "doc",
          sourceLink: "/documents/daycare-invoice-jan-2026.pdf",
          sourceType: "Invoice",
          documentId: "doc-013"
        },
        {
          date: "2026-02-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 1200.00,
          category: "Childcare",
          note: "Full-time daycare for 2 children (ages 3, 5)",
          status: "doc",
          sourceLink: "/documents/daycare-invoice-feb-2026.pdf",
          sourceType: "Invoice",
          documentId: "doc-014"
        },
        {
          date: "2026-03-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 1200.00,
          category: "Childcare",
          note: "Full-time daycare for 2 children (ages 3, 5)",
          status: "doc",
          sourceLink: "/documents/daycare-invoice-mar-2026.pdf",
          sourceType: "Invoice",
          documentId: "doc-015"
        },
        {
          date: "2026-04-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 1200.00,
          category: "Childcare",
          note: "Full-time daycare for 2 children (ages 3, 5)",
          status: "doc",
          sourceLink: "/documents/daycare-invoice-apr-2026.pdf",
          sourceType: "Invoice",
          documentId: "doc-016"
        },
        {
          date: "2026-05-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 1200.00,
          category: "Childcare",
          note: "Full-time daycare for 2 children (ages 3, 5) (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-06-01",
          description: "Sunshine Daycare Center - Daycare Tuition",
          amount: 600.00,
          category: "Childcare",
          note: "Half-month (6/1-6/15) daycare (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Regular daycare expenses for both children attending full-time."
    },
    documentLinks: [
      {
        name: "Daycare Enrollment & Tuition Agreement",
        type: "PDF",
        url: "/documents/daycare-enrollment-2026.pdf",
        uploadDate: "2026-01-05",
        pages: 3
      },
      {
        name: "Daycare Invoice - Jan-Apr 2026",
        type: "PDF",
        url: "/documents/daycare-invoices-jan-apr-2026.pdf",
        uploadDate: "2026-04-30",
        pages: 4
      }
    ],
    summary: {
      totalItems: 6,
      documentedItems: 4,
      estimatedItems: 2,
      totalAmount: 6600.00,
      averagePerPeriod: 1200.00
    }
  },

  // ========== MEDICAL/DENTAL EXPENSES ==========

  Medical_Uninsured: {
    title: "Medical & Dental - Unreimbursed - 2026 YTD",
    expenseCategory: "Medical/Dental (Unreimbursed)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-20",
          description: "Dr. Sarah Chen, DMD - Dental Cleaning & Exam",
          amount: 150.00,
          category: "Medical/Dental",
          note: "Child 1 - routine cleaning and examination",
          status: "doc",
          sourceLink: "/documents/dental-receipt-jan-2026.pdf",
          sourceType: "Receipt",
          documentId: "doc-017"
        },
        {
          date: "2026-02-15",
          description: "Arizona Children's Hospital - Medical Visit",
          amount: 85.00,
          category: "Medical/Dental",
          note: "Child 2 - urgent care visit (copay)",
          status: "doc",
          sourceLink: "/documents/medical-receipt-feb-2026.pdf",
          sourceType: "Receipt",
          documentId: "doc-018"
        },
        {
          date: "2026-03-10",
          description: "Vail Pharmacy - Prescription Medications",
          amount: 65.00,
          category: "Medical/Dental",
          note: "Antibiotics for child (insurance deductible)",
          status: "doc",
          sourceLink: "/documents/pharmacy-receipt-mar-2026.pdf",
          sourceType: "Receipt",
          documentId: "doc-019"
        },
        {
          date: "2026-04-05",
          description: "Dr. James Rodriguez, MD - Annual Physical",
          amount: 120.00,
          category: "Medical/Dental",
          note: "Petitioner annual physical (insurance copay)",
          status: "doc",
          sourceLink: "/documents/medical-receipt-apr-2026.pdf",
          sourceType: "Receipt",
          documentId: "doc-020"
        },
        {
          date: "2026-05-12",
          description: "Dr. Sarah Chen, DMD - Dental Filling",
          amount: 180.00,
          category: "Medical/Dental",
          note: "Child 1 - cavity filling (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Medical and dental expenses not covered by insurance."
    },
    documentLinks: [
      {
        name: "Medical Receipts - Jan-Apr 2026",
        type: "PDF",
        url: "/documents/medical-receipts-2026.pdf",
        uploadDate: "2026-05-01",
        pages: 5
      },
      {
        name: "Insurance EOB Summary",
        type: "PDF",
        url: "/documents/insurance-eob-2026.pdf",
        uploadDate: "2026-06-01",
        pages: 8
      }
    ],
    summary: {
      totalItems: 5,
      documentedItems: 4,
      estimatedItems: 1,
      totalAmount: 600.00,
      averagePerPeriod: 120.00
    }
  },

  // ========== EDUCATION EXPENSES ==========

  Education_SchoolSupplies: {
    title: "Education - School & Supplies - 2026 YTD",
    expenseCategory: "Education (School & Supplies)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-10",
          description: "Desert Vista Elementary - 2026 Tuition",
          amount: 350.00,
          category: "Education",
          note: "Monthly private school tuition for Child 1",
          status: "doc",
          sourceLink: "/documents/school-invoice-jan-2026.pdf",
          sourceType: "School Invoice",
          documentId: "doc-021"
        },
        {
          date: "2026-02-10",
          description: "Desert Vista Elementary - 2026 Tuition",
          amount: 350.00,
          category: "Education",
          note: "Monthly private school tuition for Child 1",
          status: "doc",
          sourceLink: "/documents/school-invoice-feb-2026.pdf",
          sourceType: "School Invoice",
          documentId: "doc-022"
        },
        {
          date: "2026-03-05",
          description: "Back to School Supplies - Office Depot",
          amount: 125.00,
          category: "Education",
          note: "School supplies and materials for 2026",
          status: "doc",
          sourceLink: "/documents/office-depot-receipt-mar-2026.pdf",
          sourceType: "Receipt",
          documentId: "doc-023"
        },
        {
          date: "2026-04-10",
          description: "Desert Vista Elementary - 2026 Tuition",
          amount: 350.00,
          category: "Education",
          note: "Monthly private school tuition for Child 1",
          status: "doc",
          sourceLink: "/documents/school-invoice-apr-2026.pdf",
          sourceType: "School Invoice",
          documentId: "doc-024"
        },
        {
          date: "2026-05-10",
          description: "Desert Vista Elementary - 2026 Tuition",
          amount: 350.00,
          category: "Education",
          note: "Monthly private school tuition for Child 1 (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-06-10",
          description: "Desert Vista Elementary - 2026 Tuition",
          amount: 175.00,
          category: "Education",
          note: "Half-month (6/1-6/15) tuition (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Private school tuition and necessary school supplies."
    },
    documentLinks: [
      {
        name: "Enrollment Agreement - Desert Vista Elementary",
        type: "PDF",
        url: "/documents/school-enrollment-2026.pdf",
        uploadDate: "2026-01-01",
        pages: 4
      },
      {
        name: "School Invoices - Jan-Apr 2026",
        type: "PDF",
        url: "/documents/school-invoices-2026.pdf",
        uploadDate: "2026-04-30",
        pages: 4
      }
    ],
    summary: {
      totalItems: 6,
      documentedItems: 4,
      estimatedItems: 2,
      totalAmount: 1700.00,
      averagePerPeriod: 283.33
    }
  },

  // ========== HOUSING EXPENSES ==========

  Housing_MortgageAndTaxes: {
    title: "Housing - Mortgage & Property Taxes - 2026 YTD",
    expenseCategory: "Housing (Mortgage & Property Taxes)",
    caseInfo: {
      caseName: "Petitioner v. Respondent",
      caseNumber: "D2024-1669",
      county: "Pima County, AZ",
      reportDate: "2026-06-15"
    },
    data: {
      items: calculateYTD([
        {
          date: "2026-01-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 1850.00,
          category: "Housing",
          note: "Principal, interest, taxes & insurance (PITI)",
          status: "doc",
          sourceLink: "/documents/mortgage-statement-jan-2026.pdf",
          sourceType: "Mortgage Statement",
          documentId: "doc-025"
        },
        {
          date: "2026-02-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 1850.00,
          category: "Housing",
          note: "Principal, interest, taxes & insurance (PITI)",
          status: "doc",
          sourceLink: "/documents/mortgage-statement-feb-2026.pdf",
          sourceType: "Mortgage Statement",
          documentId: "doc-026"
        },
        {
          date: "2026-03-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 1850.00,
          category: "Housing",
          note: "Principal, interest, taxes & insurance (PITI)",
          status: "doc",
          sourceLink: "/documents/mortgage-statement-mar-2026.pdf",
          sourceType: "Mortgage Statement",
          documentId: "doc-027"
        },
        {
          date: "2026-04-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 1850.00,
          category: "Housing",
          note: "Principal, interest, taxes & insurance (PITI)",
          status: "doc",
          sourceLink: "/documents/mortgage-statement-apr-2026.pdf",
          sourceType: "Mortgage Statement",
          documentId: "doc-028"
        },
        {
          date: "2026-05-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 1850.00,
          category: "Housing",
          note: "Principal, interest, taxes & insurance (PITI) (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        },
        {
          date: "2026-06-01",
          description: "First Arizona Bank - Mortgage Payment",
          amount: 925.00,
          category: "Housing",
          note: "Half-month (6/1-6/15) mortgage (estimated)",
          status: "est",
          sourceLink: null,
          sourceType: "Estimate",
          documentId: null
        }
      ]),
      ytdThrough: "2026-06-15",
      status: "Complete",
      notes: "Mortgage includes property taxes and homeowners insurance."
    },
    documentLinks: [
      {
        name: "Mortgage Statement - Jan 2026",
        type: "PDF",
        url: "/documents/mortgage-statement-jan-2026.pdf",
        uploadDate: "2026-01-15",
        pages: 2
      },
      {
        name: "Property Tax Assessment",
        type: "PDF",
        url: "/documents/property-tax-assessment-2026.pdf",
        uploadDate: "2026-01-10",
        pages: 3
      },
      {
        name: "Homeowners Insurance Policy",
        type: "PDF",
        url: "/documents/homeowners-insurance-2026.pdf",
        uploadDate: "2026-01-05",
        pages: 5
      }
    ],
    summary: {
      totalItems: 6,
      documentedItems: 4,
      estimatedItems: 2,
      totalAmount: 11175.00,
      averagePerPeriod: 1862.50
    }
  }
};

// Merge with existing data for backward compatibility
Object.assign(RECONCILIATION_DATA, RECONCILIATION_DATA_ENHANCED);
=======
/* Empty reconciliation template. Populate from uploaded documents for the active matter. */
function calculateYTD(items) {
  let ytd = 0;
  return items.map((item) => {
    ytd += Number(item.amount) || 0;
    return { ...item, ytd };
  });
}
const RECONCILIATION_DATA_ENHANCED = {};
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
