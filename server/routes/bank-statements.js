const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { extractTextFromPDF } = require('../services/pdf-extractor');
const { parseBankStatement } = require('../services/claude-bank-parser');
const { detectFlags, insertFlags } = require('../services/flag-detector');
const AFITaxonomy = require('../../afi-taxonomy');

function categoryReviewNote(r) {
  if (r.mapping_status === 'confirmed') return 'confirmed';
  const hit = AFITaxonomy.classifyDetailed(r.description);
  if (!hit) return 'unmatched';
  return hit.confidence === 'review' ? 'suggested - needs review' : '';
}

const router = express.Router({ mergeParams: true });

// Quote every field: descriptions, filenames and bank names all contain commas.
function csvCell(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

// One column set for both transaction exports. Account and source file are what
// let a figure on a schedule be traced back to the statement it came from.
// Columns marked `statement` are filled on the beginning/ending balance rows too.
const TRANSACTION_CSV_COLUMNS = [
  { header: 'Account', statement: true, value: (r) => r.account_number_masked },
  { header: 'Account Type', statement: true, value: (r) => (r.account_type || '').replace(/_/g, ' ') },
  { header: 'Bank', statement: true, value: (r) => r.bank_name },
  { header: 'Statement Start', statement: true, value: (r) => r.statement_start },
  { header: 'Statement End', statement: true, value: (r) => r.statement_end },
  { header: 'Date', value: (r) => r.transaction_date },
  { header: 'Description', value: (r) => r.description },
  { header: 'Amount', value: (r) => r.amount },
  { header: 'Balance', value: (r) => r.running_balance },
  { header: 'Type', value: (r) => r.transaction_type },
  { header: 'Flow', value: (r) => r.flow_type },
  { header: 'Category', value: (r) => AFITaxonomy.displayLabel(r.mapped_category || r.suggested_category) || r.mapped_category || r.suggested_category },
  { header: 'AFI Section', value: (r) => { const s = AFITaxonomy.sectionFor(r.mapped_category || r.suggested_category); return s ? s.label : ''; } },
  { header: 'Category Review', value: categoryReviewNote },
  { header: 'Source File', statement: true, value: (r) => r.source_file },
];

// Does beginning balance + the parsed rows land on the ending balance? Card
// credits (payments, refunds) reduce what is owed, so they run the other way.
function balanceCheck(stmt, txns) {
  if (stmt.beginning_balance == null || stmt.ending_balance == null) return 'balance not found on statement';
  const sign = stmt.account_type === 'credit_card' ? -1 : 1;
  const net = txns.reduce((s, t) => s + (t.transaction_type === 'credit' ? sign : -sign) * t.amount, 0);
  const diff = Math.round((stmt.beginning_balance + net - stmt.ending_balance) * 100) / 100;
  return diff === 0 ? 'transactions tie' : `transactions off by ${diff.toFixed(2)} - check against original`;
}

function balanceRow(stmt, date, description, balance) {
  return TRANSACTION_CSV_COLUMNS.map((col) => {
    if (col.statement) return csvCell(col.value(stmt));
    if (col.header === 'Date') return csvCell(date);
    if (col.header === 'Description') return csvCell(description);
    if (col.header === 'Balance') return csvCell(balance);
    if (col.header === 'Type') return csvCell('balance');
    return csvCell('');
  });
}

// Each statement: beginning balance row, its transactions, ending balance row.
function sendStatementsCsv(req, res, where, params, filename) {
  req.db.all(
    `SELECT bs.id, bs.bank_name, bs.account_number_masked, bs.account_type, bs.statement_start, bs.statement_end,
            bs.beginning_balance, bs.ending_balance, d.filename AS source_file
     FROM bank_statements bs
     LEFT JOIN documents d ON d.id = bs.document_id
     WHERE ${where} AND bs.processing_status = 'completed'
     ORDER BY bs.account_number_masked, bs.statement_start`,
    params,
    (err, stmts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!stmts || stmts.length === 0) return res.status(404).json({ error: 'No statements found' });
      req.db.all(
        `SELECT bt.bank_statement_id, bt.transaction_date, bt.description, bt.amount, bt.running_balance,
                bt.transaction_type, bt.flow_type, bt.suggested_category, bt.mapped_category, bt.mapping_status
         FROM bank_transactions bt
         WHERE bt.bank_statement_id IN (${stmts.map(() => '?').join(',')})
         ORDER BY bt.transaction_date ASC`,
        stmts.map((s) => s.id),
        (err2, txns) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const lines = [TRANSACTION_CSV_COLUMNS.map((c) => csvCell(c.header))];
          for (const st of stmts) {
            const mine = txns.filter((t) => t.bank_statement_id === st.id);
            lines.push(balanceRow(st, st.statement_start, 'Beginning Balance', st.beginning_balance));
            mine.forEach((t) => lines.push(TRANSACTION_CSV_COLUMNS.map((col) => csvCell(col.value({ ...st, ...t })))));
            lines.push(balanceRow(st, st.statement_end, `Ending Balance (${balanceCheck(st, mine)})`, st.ending_balance));
          }
          res.header('Content-Type', 'text/csv');
          res.header('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(lines.map((r) => r.join(',')).join('\n'));
        }
      );
    }
  );
}

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// POST /api/matters/:matterId/bank-statements/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const { matterId } = req.params;
  const { userId } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const statementId = uuidv4();
  const docId = uuidv4();

  try {
    // Step 1: Extract text from PDF
    const pdfText = await extractTextFromPDF(req.file.buffer);

    // Step 2: Parse with Claude
    const parsed = await parseBankStatement(pdfText);

    // Step 3: Insert document record
    await new Promise((resolve, reject) => {
      req.db.run(
        `INSERT INTO documents (id, matter_id, filename, content_type, category, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [docId, matterId, req.file.originalname, 'application/pdf', 'financial_statement', userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Step 4: Insert bank_statements record
    await new Promise((resolve, reject) => {
      req.db.run(
        `INSERT INTO bank_statements (id, document_id, matter_id, bank_name, account_type, account_number_masked, statement_start, statement_end, beginning_balance, ending_balance, processing_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          statementId,
          docId,
          matterId,
          parsed.bankName,
          parsed.accountType,
          parsed.accountNumberMasked,
          parsed.statementStart,
          parsed.statementEnd,
          parsed.beginningBalance,
          parsed.endingBalance,
          'completed',
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Step 5: Insert transactions
    const transactionIds = [];
    const incomeTransactions = [];

    for (const txn of parsed.transactions) {
      const txnId = uuidv4();
      transactionIds.push(txnId);

      await new Promise((resolve, reject) => {
        req.db.run(
          `INSERT INTO bank_transactions (id, bank_statement_id, transaction_date, description, amount, transaction_type, running_balance, flow_type, suggested_category, mapped_category, mapping_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txnId,
            statementId,
            txn.date,
            txn.description,
            txn.amount,
            txn.type,
            txn.runningBalance,
            txn.flowType,
            txn.suggestedCategory,
            txn.suggestedCategory ? txn.suggestedCategory : null, // Auto-map if Claude suggested
            txn.suggestedCategory ? 'auto_mapped' : 'unmapped',
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Track income transactions for income_items
      if (txn.flowType === 'income') {
        incomeTransactions.push({ id: txnId, ...txn });
      }
    }

    // Step 6: Create income_items for income transactions
    const incomeItemIds = [];
    for (const incomeTxn of incomeTransactions) {
      const incomeItemId = uuidv4();
      incomeItemIds.push(incomeItemId);

      await new Promise((resolve, reject) => {
        req.db.run(
          `INSERT INTO income_items (id, matter_id, bank_transaction_id, party, source_description, amount, frequency, transaction_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            incomeItemId,
            matterId,
            incomeTxn.id,
            'unknown', // Will be set by user
            incomeTxn.description,
            incomeTxn.amount,
            'one-time', // User can adjust frequency
            incomeTxn.date,
            'pending',
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Step 7: Detect flags
    const flagList = await detectFlags(req.db, matterId, statementId, parsed.transactions);

    // Add Claude qualitative flags
    if (parsed.qualitativeFlags && parsed.qualitativeFlags.length > 0) {
      for (const qFlag of parsed.qualitativeFlags) {
        const matchingTxn = parsed.transactions.find(t => t.date === qFlag.relatedTransactionDate);
        flagList.push({
          id: uuidv4(),
          matter_id: matterId,
          bank_transaction_id: matchingTxn ? transactionIds[parsed.transactions.indexOf(matchingTxn)] : null,
          rule_type: 'claude_qualitative',
          severity: qFlag.severity,
          title: 'Qualitative Alert',
          description: qFlag.description,
        });
      }
    }

    // Insert all flags
    await insertFlags(req.db, flagList);

    // Return summary with extracted data
    res.json({
      success: true,
      statementId,
      documentId: docId,
      summary: {
        bankName: parsed.bankName,
        accountType: parsed.accountType,
        statementStart: parsed.statementStart,
        statementEnd: parsed.statementEnd,
        transactionCount: parsed.transactions.length,
        incomeItemsCreated: incomeItemIds.length,
        flagsRaised: flagList.length,
      },
      extracted: {
        incomeItems: incomeItemIds,
        flags: flagList,
        transactions: parsed.transactions,
      },
    });
  } catch (error) {
    console.error('Bank statement upload error:', error);

    // Mark as error
    await new Promise((resolve) => {
      req.db.run(
        `UPDATE bank_statements SET processing_status = 'error', error_message = ? WHERE id = ?`,
        [error.message, statementId],
        () => resolve()
      );
    });

    res.status(500).json({ error: error.message });
  }
});

// GET /api/matters/:matterId/bank-statements/coverage - per-account/month reconciliation
router.get('/coverage', (req, res) => {
  const { matterId } = req.params;
  req.db.all(
    `SELECT bs.id, bs.bank_name, bs.account_number_masked, bs.account_type, bs.statement_start, bs.statement_end, d.filename,
            (SELECT COUNT(*) FROM bank_transactions WHERE bank_statement_id = bs.id) as transaction_count
     FROM bank_statements bs
     LEFT JOIN documents d ON bs.document_id = d.id
     WHERE bs.matter_id = ? AND bs.processing_status = 'completed'
     ORDER BY bs.statement_start ASC`,
    [matterId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const byAccount = {};
      (rows || []).forEach((r) => {
        const key = r.account_number_masked || r.bank_name || 'unknown';
        if (!byAccount[key]) byAccount[key] = { account: key, type: r.account_type, months: [], totalTx: 0 };
        byAccount[key].months.push({ start: r.statement_start, end: r.statement_end, tx: r.transaction_count, file: r.filename });
        byAccount[key].totalTx += r.transaction_count || 0;
      });
      res.json({
        totalStatements: (rows || []).length,
        totalTransactions: (rows || []).reduce((s, r) => s + (r.transaction_count || 0), 0),
        accounts: Object.values(byAccount),
      });
    }
  );
});

// GET /api/matters/:matterId/bank-statements/export.csv (must come before generic GET)
router.get('/export.csv', (req, res) => {
  sendStatementsCsv(req, res, 'bs.matter_id = ?', [req.params.matterId], 'bank-statements-export.csv');
});

// GET /api/matters/:matterId/bank-statements/transactions - all transactions for matter (must come before generic GET)
router.get('/transactions', (req, res) => {
  const { matterId } = req.params;
  const { limit = 500, offset = 0 } = req.query;

  req.db.all(
    `SELECT bt.*, bs.bank_name, bs.statement_start, bs.statement_end, bs.account_number_masked
     FROM bank_transactions bt
     JOIN bank_statements bs ON bt.bank_statement_id = bs.id
     WHERE bs.matter_id = ?
     ORDER BY bt.transaction_date DESC
     LIMIT ? OFFSET ?`,
    [matterId, parseInt(limit), parseInt(offset)],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    }
  );
});

// GET /api/matters/:matterId/bank-statements/:statementId/export.csv - one statement's transactions
router.get('/:statementId/export.csv', (req, res) => {
  const { matterId, statementId } = req.params;
  sendStatementsCsv(req, res, 'bs.matter_id = ? AND bs.id = ?', [matterId, statementId], `statement-${statementId}.csv`);
});

// POST /api/matters/:matterId/bank-statements/refresh-headers
// Re-reads period and balances from each stored original without touching
// transactions, so confirmed category mappings are kept.
router.post('/refresh-headers', async (req, res) => {
  const { matterId } = req.params;
  const { getOriginal } = require('../services/storage');
  const { extractText } = require('../services/file-extractor');
  const { parseStatementText } = require('../services/statement-parser');
  const all = (sql, p) => new Promise((ok, no) => req.db.all(sql, p, (e, r) => (e ? no(e) : ok(r || []))));
  const run = (sql, p) => new Promise((ok, no) => req.db.run(sql, p, (e) => (e ? no(e) : ok())));
  try {
    const stmts = await all(
      `SELECT bs.id, d.filename, d.s3_key FROM bank_statements bs JOIN documents d ON d.id = bs.document_id
       WHERE bs.matter_id = ? AND d.s3_key IS NOT NULL`, [matterId]);
    let updated = 0, failed = 0;
    for (const st of stmts) {
      try {
        const buf = await getOriginal(st.s3_key);
        const { text } = await extractText({ originalname: st.filename, buffer: buf });
        if (!text) { failed++; continue; }
        const p = parseStatementText(text, st.filename);
        await run(
          `UPDATE bank_statements SET statement_start = COALESCE(?, statement_start), statement_end = COALESCE(?, statement_end),
             beginning_balance = ?, ending_balance = ? WHERE id = ?`,
          [p.statementStart, p.statementEnd, p.beginningBalance, p.endingBalance, st.id]);
        updated++;
      } catch (e) {
        failed++;
      }
    }
    res.json({ success: true, statements: stmts.length, updated, failed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matters/:matterId/bank-statements - list all statements
router.get('/', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT bs.*, d.filename,
            (SELECT COUNT(*) FROM bank_transactions WHERE bank_statement_id = bs.id) as transaction_count
     FROM bank_statements bs
     LEFT JOIN documents d ON bs.document_id = d.id
     WHERE bs.matter_id = ? AND bs.processing_status IN ('completed', 'error')
     ORDER BY bs.created_at DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    }
  );
});


module.exports = router;
