/**
 * Veritas Reconciliation Data
 * Sample data for different expense categories
 * Update with actual data from your financial records
 */

const RECONCILIATION_DATA = {
  // Child Health Insurance - Self Employed
  ChildHealthIns_SelfEmp: {
    title: "Child Health Insurance - Self Employed - 2026 YTD",
    expenseCategory: "Child Health Insurance (Self Employed)",
    data: {
      items: [
        {
          date: "2026-01-30",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 450.00,
          note: "Period 1/1-1/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-jan-2026.pdf"
        },
        {
          date: "2026-02-13",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 900.00,
          note: "Period 1/16-1/31/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-feb-2026.pdf"
        },
        {
          date: "2026-02-27",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 1350.00,
          note: "Period 2/1-2/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-feb-2026.pdf"
        },
        {
          date: "2026-03-13",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 1800.00,
          note: "Period 2/16-2/28/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-mar-2026.pdf"
        },
        {
          date: "2026-04-01",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 2250.00,
          note: "Period 3/1-3/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-apr-2026.pdf"
        },
        {
          date: "2026-04-15",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 2700.00,
          note: "Period 3/16-3/31/26 — estimated (YTD-backed)",
          status: "est",
          sourceLink: "/documents/pay-stub-apr-2026.pdf"
        },
        {
          date: "2026-05-01",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 3150.00,
          note: "Period 4/1-4/15/26 — estimated (YTD-backed)",
          status: "est",
          sourceLink: null
        },
        {
          date: "2026-05-15",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 3600.00,
          note: "Period 4/16-4/30/26 — estimated (YTD-backed)",
          status: "est",
          sourceLink: null
        },
        {
          date: "2026-06-01",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 4050.00,
          note: "Period 5/1-5/15/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-jun-2026.pdf"
        },
        {
          date: "2026-06-15",
          description: "Self-Employed Health Insurance",
          amount: 450.00,
          category: "Health Insurance",
          ytd: 4500.00,
          note: "Period 5/16-5/31/26",
          status: "doc",
          sourceLink: "/documents/pay-stub-jun-2026.pdf"
        }
      ],
      ytdThrough: "2026-06-15",
      status: "Complete"
    },
    documentLinks: [
      {
        name: "Pay Stub - January 2026",
        type: "PDF",
        url: "/documents/pay-stub-jan-2026.pdf"
      },
      {
        name: "Pay Stub - February 2026",
        type: "PDF",
        url: "/documents/pay-stub-feb-2026.pdf"
      },
      {
        name: "Pay Stub - March 2026",
        type: "PDF",
        url: "/documents/pay-stub-mar-2026.pdf"
      },
      {
        name: "Pay Stub - April 2026",
        type: "PDF",
        url: "/documents/pay-stub-apr-2026.pdf"
      },
      {
        name: "Pay Stub - May 2026",
        type: "PDF",
        url: "/documents/pay-stub-may-2026.pdf"
      },
      {
        name: "Pay Stub - June 2026",
        type: "PDF",
        url: "/documents/pay-stub-jun-2026.pdf"
      },
      {
        name: "Health Insurance Statement 2026",
        type: "PDF",
        url: "/documents/insurance-statement-2026.pdf"
      },
      {
        name: "Bank Statement - June 2026",
        type: "PDF",
        url: "/documents/bank-statement-june-2026.pdf"
      }
    ]
  },

  // Child Health Insurance - Employer Provided
  ChildHealthIns_Emp: {
    title: "Child Health Insurance - Employer Provided - 2026 YTD",
    expenseCategory: "Child Health Insurance (Employer Provided)",
    data: {
      items: [
        {
          date: "2026-01-15",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 320.00,
          note: "Payroll Deduction - Jan 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-jan-2026.pdf"
        },
        {
          date: "2026-01-30",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 640.00,
          note: "Payroll Deduction - Jan 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-jan-2026.pdf"
        },
        {
          date: "2026-02-13",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 960.00,
          note: "Payroll Deduction - Feb 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-feb-2026.pdf"
        },
        {
          date: "2026-02-27",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 1280.00,
          note: "Payroll Deduction - Feb 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-feb-2026.pdf"
        },
        {
          date: "2026-03-13",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 1600.00,
          note: "Payroll Deduction - Mar 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-mar-2026.pdf"
        },
        {
          date: "2026-04-01",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 1920.00,
          note: "Payroll Deduction - Apr 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-apr-2026.pdf"
        },
        {
          date: "2026-05-01",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 2240.00,
          note: "Payroll Deduction - May 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-may-2026.pdf"
        },
        {
          date: "2026-06-01",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 2560.00,
          note: "Payroll Deduction - Jun 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-jun-2026.pdf"
        },
        {
          date: "2026-06-15",
          description: "Employer-Provided Health Insurance",
          amount: 320.00,
          category: "Health Insurance",
          ytd: 2880.00,
          note: "Payroll Deduction - Jun 2026",
          status: "doc",
          sourceLink: "/documents/employer-statement-jun-2026.pdf"
        }
      ],
      ytdThrough: "2026-06-15",
      status: "Complete"
    },
    documentLinks: [
      {
        name: "Employer Payroll Statement - Jan 2026",
        type: "PDF",
        url: "/documents/employer-statement-jan-2026.pdf"
      },
      {
        name: "Employer Payroll Statement - Feb 2026",
        type: "PDF",
        url: "/documents/employer-statement-feb-2026.pdf"
      },
      {
        name: "Employer Payroll Statement - Mar 2026",
        type: "PDF",
        url: "/documents/employer-statement-mar-2026.pdf"
      },
      {
        name: "Employer Payroll Statement - Apr 2026",
        type: "PDF",
        url: "/documents/employer-statement-apr-2026.pdf"
      },
      {
        name: "Employer Payroll Statement - May 2026",
        type: "PDF",
        url: "/documents/employer-statement-may-2026.pdf"
      },
      {
        name: "Employer Payroll Statement - Jun 2026",
        type: "PDF",
        url: "/documents/employer-statement-jun-2026.pdf"
      },
      {
        name: "Employer Benefit Statement 2026",
        type: "PDF",
        url: "/documents/employer-benefit-statement-2026.pdf"
      }
    ]
  },

  // Child Health Insurance - Shared
  ChildHealthIns_Share: {
    title: "Child Health Insurance - Shared - 2026 YTD",
    expenseCategory: "Child Health Insurance (Shared)",
    data: {
      items: [
        {
          date: "2026-01-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 225.00,
          note: "Respondent's 50% share - Jan 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        },
        {
          date: "2026-02-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 450.00,
          note: "Respondent's 50% share - Feb 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        },
        {
          date: "2026-03-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 675.00,
          note: "Respondent's 50% share - Mar 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        },
        {
          date: "2026-04-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 900.00,
          note: "Respondent's 50% share - Apr 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        },
        {
          date: "2026-05-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 1125.00,
          note: "Respondent's 50% share - May 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        },
        {
          date: "2026-06-01",
          description: "Shared Health Insurance (50%)",
          amount: 225.00,
          category: "Health Insurance",
          ytd: 1350.00,
          note: "Respondent's 50% share - Jun 2026",
          status: "est",
          sourceLink: "/documents/insurance-statement-2026.pdf"
        }
      ],
      ytdThrough: "2026-06-15",
      status: "Estimated"
    },
    documentLinks: [
      {
        name: "Health Insurance Statement 2026",
        type: "PDF",
        url: "/documents/insurance-statement-2026.pdf"
      },
      {
        name: "Shared Cost Agreement",
        type: "PDF",
        url: "/documents/shared-cost-agreement-2026.pdf"
      }
    ]
  }
};
