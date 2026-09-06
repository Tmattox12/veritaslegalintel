const { PDFParse } = require('pdf-parse');

async function extractTextFromPDF(pdfBuffer) {
  try {
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    return result.text || '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

module.exports = {
  extractTextFromPDF,
};
