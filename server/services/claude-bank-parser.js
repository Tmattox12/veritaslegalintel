const { parseJSONWithClaude } = require('./anthropic-client');

// AFI expense categories from afi.html
const AFI_CATEGORIES = [
  'ChildHealthIns_SelfEmp', 'ChildHealthIns_Emp', 'ChildHealthIns_Share',
  'ChildDentalVision_Dental', 'ChildDentalVision_Vision',
  'ChildUnreimbMed_Drugs', 'ChildUnreimbMed_Other',
  'ChildCare_Daycare', 'ChildCare_School',
  'ChildPretax_Enrollment',
  'ChildSupport_Other',
  'SpousalSupport_Previous',
  'ExtraordinaryExp_Children', 'ExtraordinaryExp_Self',
  'Housing_FirstMortgage', 'Housing_SecondMortgage', 'Housing_HOA', 'Housing_Rent', 'Housing_Repair', 'Housing_YardPool', 'Housing_InsTax', 'Housing_Other',
  'Utilities_Water', 'Utilities_Electric', 'Utilities_Gas', 'Utilities_Phone', 'Utilities_Internet', 'Utilities_Trash', 'Utilities_Other',
  'Groceries', 'DiningOut', 'Alcohol', 'Tobacco',
  'Transportation_CarPayment', 'Transportation_Insurance', 'Transportation_Gas', 'Transportation_Maintenance', 'Transportation_PublicTransit', 'Transportation_Parking',
  'MedicalDental_Insurance', 'MedicalDental_Drugs', 'MedicalDental_Copays', 'MedicalDental_Unreimbursed',
  'Personal_Haircare', 'Personal_Clothing', 'Personal_Other',
  'Entertainment_Subscriptions', 'Entertainment_Hobbies', 'Entertainment_Vacation',
  'Education_Tuition', 'Education_Books', 'Education_Other',
  'Office_Supplies', 'Office_Technology', 'Office_Software',
];

async function parseBankStatement(pdfText) {
  const prompt = `You are a financial statement parsing expert. Extract ALL information from the provided bank or credit card statement text and return it as JSON.

STRICTLY return valid JSON with this structure:
{
  "bankName": "Bank name or 'Unknown'",
  "accountType": "Checking, Savings, Money Market, or Unknown",
  "accountNumberMasked": "Last 4 digits only (e.g., '**** 1234')",
  "statementStart": "YYYY-MM-DD",
  "statementEnd": "YYYY-MM-DD",
  "beginningBalance": 0.00,
  "endingBalance": 0.00,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "exact transaction description",
      "amount": 0.00,
      "type": "debit or credit",
      "runningBalance": 0.00,
      "flowType": "income, expense, transfer, or unknown",
      "suggestedCategory": "AFI category or null"
    }
  ],
  "qualitativeFlags": [
    {
      "description": "What looks suspicious",
      "relatedTransactionDate": "YYYY-MM-DD",
      "severity": "high, medium, or low"
    }
  ]
}

RULES:
- flowType: Classify each transaction as "income" (deposits, paychecks), "expense" (withdrawals for spending), "transfer" (internal transfers), or "unknown"
- suggestedCategory: ONLY use values from this list, or null: ${AFI_CATEGORIES.join(', ')}
- For income transactions, set suggestedCategory to null
- For expense transactions with unclear category, set to null (user will map later)
- For transfers to other accounts, set flowType='transfer' and suggestedCategory=null
- qualitativeFlags: Flag unusual patterns like frequent large transfers, round amounts, multiple accounts, suspicious timing
- Return ONLY valid JSON, no markdown, no extra text

Bank statement text:
${pdfText}`;

  const systemPrompt = 'You are a precise JSON generator. Return ONLY valid JSON, no markdown formatting, no code blocks, no explanation.';

  try {
    const result = await parseJSONWithClaude(prompt, systemPrompt);
    return result;
  } catch (error) {
    console.error('Bank statement parsing error:', error);
    throw new Error(`Failed to parse bank statement: ${error.message}`);
  }
}

module.exports = {
  parseBankStatement,
  AFI_CATEGORIES,
};
