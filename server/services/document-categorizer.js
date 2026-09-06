const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const CATEGORIES = {
  FINANCIAL_STATEMENTS: "Financial Statements",
  TAX_RETURNS: "Tax Returns & Income",
  PROPERTY_ASSETS: "Property & Assets",
  COURT_LEGAL: "Court & Legal Documents",
  AFI_DISCLOSURES: "AFI & Disclosures",
  OTHER: "Other",
};

async function categorizeDocument(filename, pdfText) {
  try {
    const prompt = `Analyze this document and categorize it into ONE of these categories:

Categories:
1. "Financial Statements" - Bank statements, account statements, balance sheets, income statements
2. "Tax Returns & Income" - 1040s, tax returns, W2s, K1s, schedules
3. "Property & Assets" - Property appraisals, deeds, titles, valuations
4. "Court & Legal Documents" - Court orders, agreements, contracts, court filings
5. "AFI & Disclosures" - Affidavits, financial disclosures, sworn statements
6. "Other" - Anything else

Filename: ${filename}

Document excerpt (first 500 chars):
${pdfText.substring(0, 500)}

Respond with ONLY the category name from the list above. No explanation.`;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Claude may return thinking blocks before the text block.
    const textBlock = (message.content || []).find((c) => c.type === 'text');
    if (!textBlock || !textBlock.text) {
      return CATEGORIES.OTHER;
    }
    const categoryText = textBlock.text.trim();

    // Validate and return category
    for (const cat of Object.values(CATEGORIES)) {
      if (categoryText.includes(cat)) {
        return cat;
      }
    }

    return CATEGORIES.OTHER;
  } catch (error) {
    console.error("Error categorizing document:", error);
    return CATEGORIES.OTHER; // Default to Other on error
  }
}

module.exports = { categorizeDocument, CATEGORIES };
