const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { extractText } = require('../services/file-extractor');
const { visionExtractText } = require('../services/claude-vision-ocr');
const { categorizeDocument, CATEGORIES } = require('../services/document-categorizer');
const { classifyDocument } = require('../services/document-classifier');
const { extractIncomeEvidence } = require('../services/income-evidence-extractor');
const { parseStatementText } = require('../services/statement-parser');
const { storeOriginal, MODE: STORAGE_MODE } = require('../services/storage');

const router = express.Router({ mergeParams: true });
const activeUploads = new Set();

// Map UI category labels -> the DOM ids used on discovery-intake.html
const CATEGORY_TO_BUCKET = {
  [CATEGORIES.FINANCIAL_STATEMENTS]: 'financial',
  [CATEGORIES.TAX_RETURNS]: 'income',
  [CATEGORIES.PROPERTY_ASSETS]: 'property',
  [CATEGORIES.COURT_LEGAL]: 'legal',
  [CATEGORIES.AFI_DISCLOSURES]: 'disclosure',
  [CATEGORIES.OTHER]: 'other',
};

// Quick keyword-based classifier (free) used before Claude.
function keywordClassify(filename, text) {
  const f = (filename || '').toLowerCase();
  const t = (text || '').toLowerCase().slice(0, 4000);
  const has = (re) => re.test(f) || re.test(t);

  if (has(/bank statement|statement period|account summary|checking account|savings account|credit card statement|\bacct\.?\s*\d{3,}|chase freedom|chase savings|chase card/)) return CATEGORIES.FINANCIAL_STATEMENTS;
  if (has(/\b1040\b|\bw-?2\b|\bk-?1\b|tax return|schedule c|1099/)) return CATEGORIES.TAX_RETURNS;
  if (has(/\bdeed\b|\btitle\b|appraisal|property tax|closing statement|hud-1|mortgage statement/)) return CATEGORIES.PROPERTY_ASSETS;
  if (has(/affidavit of financial information|\bafi\b|financial disclosure|sworn statement|rule 49/)) return CATEGORIES.AFI_DISCLOSURES;
  if (has(/court order|\border\b|petition|pleading|subpoena|decree|stipulation|minute entry/)) return CATEGORIES.COURT_LEGAL;
  return null;
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.(pdf|csv|txt|xlsx|xls|docx|doc|jpg|jpeg|png|gif)$/i.test(file.originalname);
    cb(null, okExt);
  },
});

// POST /api/matters/:matterId/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const { matterId } = req.params;
  const { userId } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  // Verify the matter exists so uploads never go to a phantom id.
  const matter = await new Promise((resolve) => {
    req.db.get('SELECT id FROM matters WHERE id = ? AND deleted_at IS NULL', [matterId], (err, row) => {
      if (err || !row) resolve(null); else resolve(row);
    });
  });
  if (!matter) {
    return res.status(404).json({ error: 'Matter not found. Create/select a matter first (Case Intake).' });
  }

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const uploadKey = `${matterId}:${fileHash}`;

  // Protect against duplicate browser events while a large file is still parsing.
  if (activeUploads.has(uploadKey)) {
    return res.json({ success: true, duplicate: true, message: 'This file is already processing' });
  }

  // Server-side dedup: same filename OR the same file contents -> skip.
  const dup = await new Promise((resolve) => {
    req.db.get(
      `SELECT id FROM documents
       WHERE matter_id = ? AND deleted_at IS NULL AND (filename = ? OR file_hash = ?)`,
      [matterId, req.file.originalname, fileHash],
      (e, r) => resolve(r)
    );
  });
  if (dup) {
    return res.json({ success: true, duplicate: true, documentId: dup.id, message: 'Already uploaded' });
  }

  activeUploads.add(uploadKey);
  const docId = uuidv4();

  try {
    // Extract text (pdf text layer / csv / xlsx / docx). Bulk intake must not
    // stop on a slow vision-OCR request: store no-text documents immediately
    // and flag them for explicit OCR/parsing review instead.
    let { text, ocrNeeded, ext } = await extractText(req.file);
    let ocrUsed = false;
    if (req.body.processOcr === 'true' && ocrNeeded && process.env.ANTHROPIC_API_KEY && (ext === 'pdf' || ['jpg', 'jpeg', 'png', 'gif'].includes(ext))) {
      try {
        text = await visionExtractText(req.file.buffer, ext);
        ocrUsed = !!text;
        if (ocrUsed) ocrNeeded = false;
      } catch (e) {
        console.error('Vision OCR failed:', e.message);
      }
    }

    // Classify from evidence in the filename/header first, then use Claude only
    // for genuinely ambiguous documents.
    let classification = classifyDocument(req.file.originalname, text);
    let category = classification.category;
    let classificationSource = classification.confidence === 'high' ? 'evidence' : null;
    if (classification.confidence === 'needs_review' && text && process.env.ANTHROPIC_API_KEY) {
      try {
        category = await categorizeDocument(req.file.originalname, text);
        classificationSource = 'claude';
        classification = { ...classification, category, type: 'AI-classified document', confidence: 'review_ai' };
      } catch (e) {
        category = CATEGORIES.OTHER;
      }
    }
    if (!category) category = CATEGORIES.OTHER;

    // If it looks like a financial statement, parse transactions deterministically.
    let parsed = null;
    let statementId = null;
    let transactionCount = 0;
    const looksFinancial =
      category === CATEGORIES.FINANCIAL_STATEMENTS &&
      text &&
      (/\d{1,2}\/\d{1,2}/.test(text) && /\d+\.\d{2}/.test(text));

    if (looksFinancial) {
      parsed = parseStatementText(text, req.file.originalname);

      if (parsed.transactions.length > 0) {
        statementId = uuidv4();
        await run(req, `INSERT INTO bank_statements (id, document_id, matter_id, bank_name, account_type, account_number_masked, statement_start, statement_end, beginning_balance, ending_balance, processing_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [statementId, docId, matterId, parsed.bankName, parsed.accountType, parsed.accountNumberMasked,
           parsed.statementStart, parsed.statementEnd, parsed.beginningBalance, parsed.endingBalance, 'completed']);

        for (const txn of parsed.transactions) {
          await run(req, `INSERT INTO bank_transactions (id, bank_statement_id, transaction_date, description, amount, transaction_type, running_balance, flow_type, suggested_category, mapped_category, mapping_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), statementId, txn.date, txn.description, txn.amount, txn.type, txn.runningBalance,
             txn.flowType, txn.suggestedCategory, txn.suggestedCategory || null,
             txn.suggestedCategory ? 'auto_mapped' : 'unmapped']);
          transactionCount++;
        }
      }
    }

    await run(req, `INSERT INTO documents (id, matter_id, filename, content_type, category, uploaded_by, uploaded_at, file_hash, document_type, classification_confidence)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [docId, matterId, req.file.originalname, req.file.mimetype, category, userId, fileHash, classification.type, classification.confidence]);

    // Persist the original file (local disk or Azure Blob depending on STORAGE_MODE)
    let storageKey = null;
    try {
      const stored = await storeOriginal(matterId, docId, req.file.originalname, req.file.buffer);
      storageKey = stored.key;
      await run(req, `UPDATE documents SET s3_key = ? WHERE id = ?`, [storageKey, docId]).catch(() => {});
    } catch (e) {
      console.error('Storage save failed:', e.message);
    }

    const extractionStatus = looksFinancial
      ? (transactionCount > 0 ? 'parsed' : 'needs_review')
      : (ocrUsed ? 'ocr' : 'uploaded');
    const needsReview = ocrNeeded || extractionStatus === 'needs_review';

    // Best-effort: store extraction metadata columns if they exist.
    await run(req, `UPDATE documents SET extraction_status = ?, ocr_needed = ? WHERE id = ?`,
      [extractionStatus, needsReview ? 1 : 0, docId]).catch(() => {});

    res.json({
      success: true,
      documentId: docId,
      category,
      categoryBucket: CATEGORY_TO_BUCKET[category] || 'other',
      classificationSource: classificationSource || 'keyword-default',
      ocrNeeded: needsReview,
      ocrUsed,
      statementId,
      transactionCount,
      bankName: parsed ? parsed.bankName : null,
      filename: req.file.originalname,
      storageMode: STORAGE_MODE,
      storageKey,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.json({ success: true, duplicate: true, message: 'Already uploaded' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    activeUploads.delete(uploadKey);
  }
});

// GET /api/matters/:matterId/documents/income-evidence
// Reads specifically classified income documents and returns reviewable evidence.
router.get('/income-evidence', async (req, res) => {
  const { matterId } = req.params;
  try {
    const { getOriginal } = require('../services/storage');
    const docs = await new Promise((resolve, reject) => {
      req.db.all(
        `SELECT d.id, d.filename, d.s3_key, d.document_type, d.extraction_status,
          r.party, r.annual_amount, r.status AS review_status
         FROM documents d
         LEFT JOIN income_evidence_reviews r ON r.document_id = d.id
         WHERE d.matter_id = ? AND d.deleted_at IS NULL
           AND d.category = 'Tax Returns & Income'`,
        [matterId],
        (error, rows) => error ? reject(error) : resolve(rows || [])
      );
    });

    const evidence = [];
    for (const doc of docs) {
      let text = '';
      if (doc.s3_key) {
        try {
          const buffer = await getOriginal(doc.s3_key);
          text = (await extractText({ originalname: doc.filename, buffer })).text || '';
        } catch (error) {
          // Keep the document visible even when it needs OCR/manual review.
        }
      }
      evidence.push({
        documentId: doc.id,
        ...extractIncomeEvidence(doc.filename, text, doc.document_type),
        extractionStatus: doc.extraction_status,
        party: doc.party || null,
        annualAmount: doc.annual_amount || null,
        reviewStatus: doc.review_status || 'pending',
      });
    }

    const payStubs = evidence.filter((item) => item.kind === 'pay_stub');
    const grossTotal = payStubs.reduce((total, item) => total + (item.grossPay || 0), 0);
    const netTotal = payStubs.reduce((total, item) => total + (item.netPay || item.paymentAmount || 0), 0);
    res.json({
      matterId,
      evidence,
      summary: {
        documentCount: evidence.length,
        payStubCount: payStubs.length,
        documentedGrossTotal: +grossTotal.toFixed(2),
        documentedNetTotal: +netTotal.toFixed(2),
        reviewRequired: evidence.filter((item) => item.requiresReview).length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/matters/:matterId/documents/income-evidence/:documentId/review
// An approved annual amount is the only document-derived income that downstream
// calculation pages may treat as accepted.
router.post('/income-evidence/:documentId/review', (req, res) => {
  const { matterId, documentId } = req.params;
  const { party, annualAmount, status } = req.body || {};
  if (!['party_a', 'party_b'].includes(party) || !['accepted', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Valid party and review status are required' });
  }
  const amount = annualAmount === '' || annualAmount == null ? null : Number(annualAmount);
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return res.status(400).json({ error: 'Annual amount must be a non-negative number' });
  }
  req.db.run(
    `INSERT INTO income_evidence_reviews (document_id, matter_id, party, annual_amount, status, reviewed_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(document_id) DO UPDATE SET party=excluded.party, annual_amount=excluded.annual_amount,
       status=excluded.status, reviewed_at=CURRENT_TIMESTAMP`,
    [documentId, matterId, party, amount, status],
    (error) => error ? res.status(500).json({ error: error.message }) : res.json({ success: true })
  );
});

// POST /api/matters/:matterId/documents/reprocess - re-extract + re-parse all stored originals
router.post('/reprocess', async (req, res) => {
  const { matterId } = req.params;
  try {
    const { getOriginal } = require('../services/storage');
    const docs = await new Promise((resolve, reject) => {
      req.db.all('SELECT * FROM documents WHERE matter_id = ? AND deleted_at IS NULL AND s3_key IS NOT NULL', [matterId], (e, r) => e ? reject(e) : resolve(r || []));
    });

    let reprocessed = 0, totalTx = 0;
    for (const doc of docs) {
      try {
        const buf = await getOriginal(doc.s3_key);
        const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
        await run(req, 'UPDATE documents SET file_hash = ? WHERE id = ?', [fileHash, doc.id]);
        const fakeFile = { originalname: doc.filename, buffer: buf };
        let { text, ocrNeeded, ext } = await extractText(fakeFile);
        if (ocrNeeded && process.env.ANTHROPIC_API_KEY && (ext === 'pdf' || ['jpg','jpeg','png','gif'].includes(ext))) {
          try { text = await visionExtractText(buf, ext); } catch (e) { /* keep going */ }
        }
        const classification = classifyDocument(doc.filename, text);
        await run(req, 'UPDATE documents SET category = ?, document_type = ?, classification_confidence = ? WHERE id = ?',
          [classification.category, classification.type, classification.confidence, doc.id]);

        if (!text) {
          await run(req, `UPDATE documents SET extraction_status = 'needs_review', ocr_needed = 1 WHERE id = ?`, [doc.id]);
          continue;
        }

        const looksFinancial = /\d{1,2}\/\d{1,2}/.test(text) && /\d+\.\d{2}/.test(text);
        if (!looksFinancial) {
          if (classification.category === CATEGORIES.FINANCIAL_STATEMENTS) {
            await run(req, `UPDATE documents SET extraction_status = 'needs_review', ocr_needed = 1 WHERE id = ?`, [doc.id]);
          }
          continue;
        }

        const parsed = parseStatementText(text, doc.filename);
        if (!parsed.transactions.length) {
          await run(req, `UPDATE documents SET extraction_status = 'needs_review', ocr_needed = 1 WHERE id = ?`, [doc.id]);
          continue;
        }

        // Replace existing statement + transactions for this document
        const existing = await new Promise((resolve) => {
          req.db.get('SELECT id FROM bank_statements WHERE document_id = ?', [doc.id], (e, r) => resolve(r));
        });
        if (existing) {
          await run(req, 'DELETE FROM bank_transactions WHERE bank_statement_id = ?', [existing.id]);
          await run(req, 'UPDATE bank_statements SET bank_name=?, account_type=?, account_number_masked=?, statement_start=?, statement_end=? WHERE id=?',
            [parsed.bankName, parsed.accountType, parsed.accountNumberMasked, parsed.statementStart, parsed.statementEnd, existing.id]);
          var statementId = existing.id;
        } else {
          var statementId = uuidv4();
          await run(req, `INSERT INTO bank_statements (id, document_id, matter_id, bank_name, account_type, account_number_masked, statement_start, statement_end, processing_status) VALUES (?,?,?,?,?,?,?,?,?)`,
            [statementId, doc.id, matterId, parsed.bankName, parsed.accountType, parsed.accountNumberMasked, parsed.statementStart, parsed.statementEnd, 'completed']);
        }
        for (const txn of parsed.transactions) {
          await run(req, `INSERT INTO bank_transactions (id, bank_statement_id, transaction_date, description, amount, transaction_type, running_balance, flow_type, suggested_category, mapped_category, mapping_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [uuidv4(), statementId, txn.date, txn.description, txn.amount, txn.type, txn.runningBalance, txn.flowType, txn.suggestedCategory, txn.suggestedCategory || null, txn.suggestedCategory ? 'auto_mapped' : 'unmapped']);
          totalTx++;
        }
        await run(req, `UPDATE documents SET extraction_status = 'parsed', ocr_needed = 0 WHERE id = ?`, [doc.id]);
        reprocessed++;
      } catch (e) {
        console.error('reprocess failed for', doc.filename, e.message);
      }
    }
    res.json({ success: true, reprocessed, totalTransactions: totalTx });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matters/:matterId/documents/gap-analysis
// Detects statement coverage gaps per account + missing Rule 49 document types.
router.get('/gap-analysis', async (req, res) => {
  const { matterId } = req.params;
  try {
    const docs = await new Promise((resolve, reject) => {
      req.db.all('SELECT id, filename, category FROM documents WHERE matter_id = ? AND deleted_at IS NULL', [matterId], (e, r) => e ? reject(e) : resolve(r || []));
    });
    const stmts = await new Promise((resolve, reject) => {
      req.db.all(`SELECT bs.*, d.filename FROM bank_statements bs LEFT JOIN documents d ON bs.document_id = d.id
                  WHERE bs.matter_id = ? AND bs.processing_status = 'completed' ORDER BY bs.statement_start ASC`,
        [matterId], (e, r) => e ? reject(e) : resolve(r || []));
    });

    // ---- Statement coverage gaps per account ----
    const byAccount = {};
    stmts.forEach((s) => {
      if (!s.statement_start) return;
      const key = s.account_number_masked || s.bank_name || 'unknown';
      if (!byAccount[key]) byAccount[key] = [];
      byAccount[key].push(s.statement_start);
    });

    const gaps = [];
    const thinCoverage = [];
    const monthKey = (iso) => { const d = new Date(iso); return d.getFullYear() * 12 + d.getMonth(); };
    const monthName = (ym) => { const y = Math.floor(ym / 12); const m = ym % 12; return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };

    for (const [acct, starts] of Object.entries(byAccount)) {
      const keys = [...new Set(starts.map(monthKey))].sort((a, b) => a - b);
      // Single-statement accounts = thin coverage (likely missing history)
      if (keys.length === 1) {
        thinCoverage.push({ account: acct, onlyMonth: monthName(keys[0]) });
        continue;
      }
      for (let i = 1; i < keys.length; i++) {
        const diff = keys[i] - keys[i - 1];
        if (diff > 1) {
          const missing = [];
          for (let k = keys[i - 1] + 1; k < keys[i]; k++) missing.push(monthName(k));
          gaps.push({ account: acct, after: monthName(keys[i - 1]), before: monthName(keys[i]), missingMonths: missing });
        }
      }
    }

    // ---- Missing Rule 49 document types ----
    const text = docs.map((d) => `${(d.category || '').toLowerCase()} ${(d.filename || '').toLowerCase()}`).join(' ');
    const has = (re) => re.test(text);
    const required = [
      { key: 'afi', label: 'Affidavit of Financial Information (AFI)', present: has(/affidavit|\bafi\b|financial information/) },
      { key: 'tax-returns', label: 'Federal & State Tax Returns', present: has(/1040|tax return|schedule c/) },
      { key: 'w2-k1', label: 'W-2s, 1099s & K-1s', present: has(/w-?2|1099|k-?1/) },
      { key: 'pay-stubs', label: 'Pay Stubs / Payroll Records', present: has(/pay\s?stub|payroll|earnings statement/) },
      { key: 'bank-statements', label: 'Bank Statements', present: stmts.length > 0 },
      { key: 'credit-cards', label: 'Credit Card Statements', present: has(/credit card|freedom|sapphire|\bvisa\b|mastercard/) },
      { key: 'retirement', label: 'Retirement / Investment Statements', present: has(/401\(?k\)?|ira\b|retirement|brokerage|pension/) },
      { key: 'real-property', label: 'Real Property (deed/appraisal/mortgage)', present: has(/deed|appraisal|mortgage|title|hud-1/) },
      { key: 'insurance', label: 'Insurance Policies', present: has(/insurance|declaration/) },
      { key: 'debts', label: 'Loan / Debt Statements', present: has(/loan|line of credit|student loan/) },
    ];
    const missingDocs = required.filter((r) => !r.present);

    res.json({
      statementGaps: gaps,
      thinCoverage,
      missingRequiredDocs: missingDocs,
      requiredDocsPresent: required.filter((r) => r.present).length,
      requiredDocsTotal: required.length,
      accounts: Object.keys(byAccount).length,
      totalStatements: stmts.length,
    });
  } catch (error) {
    console.error('Gap analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Shared: build the RFP text + metadata for a matter.
async function buildRfp(req, matterId) {
  const matter = await new Promise((resolve) => {
    req.db.get('SELECT * FROM matters WHERE id = ?', [matterId], (e, r) => resolve(r));
  });
  const docs = await new Promise((resolve) => {
    req.db.all('SELECT id, filename, category FROM documents WHERE matter_id = ? AND deleted_at IS NULL', [matterId], (e, r) => resolve(r || []));
  });
  const stmts = await new Promise((resolve) => {
    req.db.all(`SELECT bs.*, d.filename FROM bank_statements bs LEFT JOIN documents d ON bs.document_id = d.id WHERE bs.matter_id = ? AND bs.processing_status='completed' ORDER BY bs.statement_start ASC`, [matterId], (e, r) => resolve(r || []));
  });

  const text = docs.map((d) => `${(d.category || '').toLowerCase()} ${(d.filename || '').toLowerCase()}`).join(' ');
  const has = (re) => re.test(text);
  const required = [
    { label: 'Affidavit of Financial Information (AFI), fully completed and signed', present: has(/affidavit|\bafi\b|financial information/) },
    { label: 'Federal and State income tax returns, with all schedules, for the last three (3) years', present: has(/1040|tax return|schedule c/) },
    { label: 'All W-2s, 1099s, and K-1s for the last three (3) years', present: has(/w-?2|1099|k-?1/) },
    { label: 'Pay stubs / payroll records for the most recent six (6) months for both parties', present: has(/pay\s?stub|payroll|earnings statement/) },
    { label: 'Complete bank statements for all checking and savings accounts for the period of the marriage through present', present: stmts.length > 0 },
    { label: 'Complete credit card statements for all accounts for the period of the marriage through present', present: has(/credit card|freedom|sapphire|\bvisa\b|mastercard/) },
    { label: 'Retirement, investment, and brokerage account statements', present: has(/401\(?k\)?|ira\b|retirement|brokerage|pension/) },
    { label: 'Real property deeds, appraisals, and mortgage statements', present: has(/deed|appraisal|mortgage|title|hud-1/) },
    { label: 'All insurance policies and declarations pages (health, life, home, auto)', present: has(/insurance|declaration/) },
    { label: 'All loan and debt account statements', present: has(/loan|line of credit|student loan/) },
  ];
  const missing = required.filter((r) => !r.present);

  const byAccount = {};
  stmts.forEach((s) => { if (!s.statement_start) return; const k = s.account_number_masked || s.bank_name || 'unknown'; (byAccount[k] = byAccount[k] || []).push(s.statement_start); });
  const monthKey = (iso) => { const d = new Date(iso); return d.getFullYear() * 12 + d.getMonth(); };
  const monthName = (ym) => new Date(Math.floor(ym / 12), ym % 12, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const gapLines = [];
  for (const [acct, starts] of Object.entries(byAccount)) {
    const keys = [...new Set(starts.map(monthKey))].sort((a, b) => a - b);
    if (keys.length === 1) {
      gapLines.push(`complete and continuous monthly statements for account ${acct} for the entire period of the marriage (only ${monthName(keys[0])} is currently on file)`);
      continue;
    }
    for (let i = 1; i < keys.length; i++) {
      if (keys[i] - keys[i - 1] > 1) {
        const miss = [];
        for (let k = keys[i - 1] + 1; k < keys[i]; k++) miss.push(monthName(k));
        gapLines.push(`complete monthly statements for account ${acct} for: ${miss.join(', ')}`);
      }
    }
  }

  const capCase = matter ? (matter.name || 'Petitioner v. Respondent') : 'Petitioner v. Respondent';
  const caseNo = matter?.case_no || '[Case No.]';
  const county = matter?.county || '[County]';
  const state = matter?.state || '[State]';

  let n = 0;
  const items = [];
  missing.forEach((m2) => { n++; items.push(`${n}. ${m2.label}.`); });
  gapLines.forEach((g2) => { n++; items.push(`${n}. Complete and continuous ${g2}.`); });

  const body = `IN THE SUPERIOR COURT OF ${state.toUpperCase()}
IN AND FOR THE COUNTY OF ${county.toUpperCase()}

${capCase}
Case No. ${caseNo}

REQUEST FOR PRODUCTION OF DOCUMENTS

Pursuant to Rule 49 of the Arizona Rules of Family Law Procedure, the requesting party
requests that the responding party produce the following documents within forty (40) days.

DOCUMENTS REQUESTED

${items.length ? items.join('\n\n') : 'None — the discovery record appears complete.'}


Dated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Respectfully submitted,

_____________________________
[Attorney / Party]
`;

  return { caseName: capCase, itemCount: n, rfp: body };
}

// GET /api/matters/:matterId/documents/rfp - generate a Request for Production draft
router.get('/rfp', async (req, res) => {
  try {
    const result = await buildRfp(req, req.params.matterId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('RFP generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matters/:matterId/documents/rfp.docx - RFP as a Word document
router.get('/rfp.docx', async (req, res) => {
  try {
    const result = await buildRfp(req, req.params.matterId);
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
    const lines = (result.rfp || '').split('\n');
    const paragraphs = lines.map((ln) => {
      const t = ln.trim();
      const isHead = /SUPERIOR COURT|REQUEST FOR PRODUCTION|DOCUMENTS REQUESTED/.test(t);
      return new Paragraph({
        spacing: { after: 120 },
        alignment: isHead ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: ln, bold: isHead, font: 'Times New Roman', size: 24 })],
      });
    });
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const buf = await Packer.toBuffer(doc);
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.header('Content-Disposition', `attachment; filename="RFP-${(result.caseName || 'draft').replace(/\s+/g, '-')}.docx"`);
    res.send(buf);
  } catch (error) {
    console.error('RFP docx error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/matters/:matterId/documents/reconcile
// Body: { filenames: string[], files?: [{ name, hash }] } — a source folder manifest.
// A file with the same SHA-256 content is accounted for even if it has a renamed copy.
router.post('/reconcile', async (req, res) => {
  const { matterId } = req.params;
  const suppliedFiles = Array.isArray(req.body.files) ? req.body.files : [];
  const sourceFiles = Array.isArray(req.body.filenames) && req.body.filenames.length
    ? req.body.filenames
    : suppliedFiles.map((file) => file?.name);
  const normalizeFilename = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9.]+/gi, '')
    .toLowerCase();
  try {
    const docs = await new Promise((resolve) => {
      req.db.all('SELECT filename, file_hash, category, extraction_status FROM documents WHERE matter_id = ? AND deleted_at IS NULL', [matterId], (e, r) => resolve(r || []));
    });
    const storedNames = new Set(docs.map((d) => normalizeFilename(d.filename)));
    const storedHashes = new Set(docs.map((d) => d.file_hash).filter(Boolean));
    const srcNorm = sourceFiles.map((f) => (f || '').trim()).filter(Boolean);
    const sourceByName = new Map(suppliedFiles.map((file) => [normalizeFilename(file?.name), file?.hash]));
    const srcSet = new Set(srcNorm.map(normalizeFilename));
    const sourceHashes = new Set(suppliedFiles.map((file) => file?.hash).filter(Boolean));

    const contentDuplicates = [];
    const missing = srcNorm.filter((name) => {
      const normalized = normalizeFilename(name);
      if (storedNames.has(normalized)) return false;
      const hash = sourceByName.get(normalized);
      if (hash && storedHashes.has(hash)) {
        contentDuplicates.push(name);
        return false;
      }
      return true;
    });
    const presentCount = srcNorm.length - missing.length - contentDuplicates.length;
    const extra = docs
      .filter((d) => !srcSet.has(normalizeFilename(d.filename)) && !sourceHashes.has(d.file_hash))
      .map((d) => d.filename);

    res.json({
      sourceCount: srcNorm.length,
      storedCount: docs.length,
      presentCount,
      contentDuplicateCount: contentDuplicates.length,
      contentDuplicates,
      missingCount: missing.length,
      extraCount: extra.length,
      missing,
      extra,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matters/:matterId/documents/categories/summary
router.get('/categories/summary', (req, res) => {
  const { matterId } = req.params;
  req.db.all(
    `SELECT category, COUNT(*) as count FROM documents
     WHERE matter_id = ? AND deleted_at IS NULL
     GROUP BY category`,
    [matterId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const counts = {};
      let total = 0;
      (rows || []).forEach((r) => {
        const bucket = CATEGORY_TO_BUCKET[r.category] || 'other';
        counts[bucket] = (counts[bucket] || 0) + r.count;
        total += r.count;
      });
      res.json({ total, counts });
    }
  );
});

function run(req, sql, params) {
  return new Promise((resolve, reject) => {
    req.db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

module.exports = router;
