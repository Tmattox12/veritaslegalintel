const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { extractTextFromPDF } = require('../services/pdf-extractor');
const { parseBankStatement } = require('../services/claude-bank-parser');
const { detectFlags, insertFlags } = require('../services/flag-detector');

const router = express.Router();

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
router.post('/:matterId/upload', upload.single('file'), async (req, res) => {
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
        incomeItems: incomeList,
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

// GET /api/matters/:matterId/bank-statements/export.csv (must come before generic GET)
router.get('/export.csv', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT
       bs.bank_name,
       bs.statement_start,
       bs.statement_end,
       bt.transaction_date,
       bt.description,
       bt.amount,
       bt.transaction_type,
       bt.flow_type,
       bt.mapped_category
     FROM bank_transactions bt
     JOIN bank_statements bs ON bt.bank_statement_id = bs.id
     WHERE bs.matter_id = ?
     ORDER BY bt.transaction_date DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Generate CSV
      const headers = ['Bank', 'Statement Start', 'Statement End', 'Date', 'Description', 'Amount', 'Type', 'Flow', 'Category'];
      const csvRows = rows.map(row => [
        row.bank_name,
        row.statement_start,
        row.statement_end,
        row.transaction_date,
        `"${row.description.replace(/"/g, '""')}"`, // Escape quotes
        row.amount,
        row.transaction_type,
        row.flow_type,
        row.mapped_category || '',
      ]);

      const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename="bank-statements-export.csv"');
      res.send(csv);
    }
  );
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
