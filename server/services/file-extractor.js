/**
 * Unified text extraction for uploaded discovery files.
 * - pdf: pdf-parse (text layer); if empty -> caller should use vision OCR
 * - csv/txt: direct
 * - xlsx/xls: xlsx -> sheet rows as text lines
 * - docx: mammoth -> raw text
 * - images (jpg/png/gif) + scanned pdf: vision OCR (Claude)
 */

const { extractTextFromPDF } = require('./pdf-extractor');

function extOf(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

async function extractXlsx(buffer) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const out = [];
  wb.SheetNames.forEach((sn) => {
    const rows = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
    out.push(`# Sheet: ${sn}\n${rows}`);
  });
  return out.join('\n\n');
}

async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ buffer });
  return value || '';
}

/**
 * Returns { text, ocrNeeded, isImage, ext }
 * ocrNeeded=true means no text layer -> use vision OCR.
 */
async function extractText(file) {
  const ext = extOf(file.originalname);
  const buf = file.buffer;

  if (ext === 'pdf') {
    let text = '';
    try {
      text = await extractTextFromPDF(buf);
    } catch (e) {
      text = '';
    }
    const hasText = text && text.replace(/\s/g, '').length >= 40;
    return { text: hasText ? text : '', ocrNeeded: !hasText, isImage: false, ext };
  }

  if (ext === 'csv' || ext === 'txt') {
    return { text: buf.toString('utf8'), ocrNeeded: false, isImage: false, ext };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const text = await extractXlsx(buf);
      return { text, ocrNeeded: false, isImage: false, ext };
    } catch (e) {
      return { text: '', ocrNeeded: true, isImage: false, ext };
    }
  }

  if (ext === 'docx') {
    try {
      const text = await extractDocx(buf);
      return { text, ocrNeeded: false, isImage: false, ext };
    } catch (e) {
      return { text: '', ocrNeeded: true, isImage: false, ext };
    }
  }

  if (ext === 'doc') {
    // legacy .doc: no clean JS extractor; flag for OCR/manual
    return { text: '', ocrNeeded: true, isImage: false, ext };
  }

  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    return { text: '', ocrNeeded: true, isImage: true, ext };
  }

  return { text: '', ocrNeeded: true, isImage: false, ext };
}

module.exports = { extractText, extOf };
