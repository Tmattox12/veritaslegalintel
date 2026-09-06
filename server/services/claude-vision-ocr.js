/**
 * Vision OCR via Claude for scanned PDFs and images.
 * Sends the raw file to Claude (which supports PDF and image inputs)
 * and asks for extracted text / transaction lines. No native deps needed.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MEDIA = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

/**
 * Extract text from a scanned PDF or image buffer.
 * @param {Buffer} buffer
 * @param {string} ext - pdf | jpg | jpeg | png | gif
 * @returns {Promise<string>} extracted plain text
 */
async function visionExtractText(buffer, ext) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured for vision OCR');
  }

  const mediaType = MEDIA[ext] || 'application/pdf';
  const block =
    ext === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } };

  const resp = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          block,
          {
            type: 'text',
            text:
              'Extract ALL text from this document exactly as it appears, preserving line breaks. ' +
              'If it is a bank or credit card statement, output each transaction on its own line as: ' +
              'DATE<TAB>DESCRIPTION<TAB>AMOUNT (use MM/DD/YYYY; negative for withdrawals). ' +
              'Do not add commentary. Return only the extracted text.',
          },
        ],
      },
    ],
  });

  const textBlock = (resp.content || []).find((c) => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

module.exports = { visionExtractText };
