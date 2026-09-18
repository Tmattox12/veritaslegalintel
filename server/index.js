const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { initializeDatabase, getDatabase } = require('./db/schema');
const AFITaxonomy = require('../afi-taxonomy');
const bankStatementsRouter = require('./routes/bank-statements');
const documentsRouter = require('./routes/documents');
const { requireAuth, authEnabled, MODE } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Report whether auth is enforced (frontend uses this to decide whether to show login)
app.get('/api/auth-status', (req, res) => {
  res.json({ authMode: MODE, authEnabled: authEnabled() });
});

// Public (non-secret) client config the frontend needs to sign in via Entra.
app.get('/api/auth-config', (req, res) => {
  if (!authEnabled()) return res.json({ authEnabled: false });
  res.json({
    authEnabled: true,
    clientId: process.env.ENTRA_CLIENT_ID,
    tenantId: process.env.ENTRA_TENANT_ID,
    apiScope: process.env.ENTRA_API_SCOPE || `api://${process.env.ENTRA_CLIENT_ID}/access_as_user`,
  });
});

// Enforce Entra sign-in on all /api routes when AUTH_MODE=entra.
// (auth-status stays open so the frontend can detect the requirement.)
app.use('/api', (req, res, next) => {
  if (req.path === '/auth-status' || req.path === '/auth-config' || req.path === '/health') return next();
  return requireAuth(req, res, next);
});

// Middleware to attach database to requests
app.use(async (req, res, next) => {
  try {
    req.db = await getDatabase();
    next();
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Mount routes
app.use('/api/matters/:matterId/bank-statements', bankStatementsRouter);
app.use('/api/matters/:matterId/documents', documentsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all users
app.get('/api/users', (req, res) => {
  req.db.all('SELECT * FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// Get all matters
app.get('/api/matters', (req, res) => {
  req.db.all('SELECT * FROM matters WHERE deleted_at IS NULL', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// Get matter details with assignments
app.get('/api/matters/:id', (req, res) => {
  const { id } = req.params;
  req.db.get(
    'SELECT * FROM matters WHERE id = ? AND deleted_at IS NULL',
    [id],
    (err, matter) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!matter) {
        return res.status(404).json({ error: 'Matter not found' });
      }

      // Get assignments for this matter
      req.db.all(
        `SELECT ma.*, u.name, u.email FROM matter_assignments ma
         JOIN users u ON ma.user_id = u.id
         WHERE ma.matter_id = ?`,
        [id],
        (err, assignments) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ ...matter, assignments });
        }
      );
    }
  );
});

  // Source-backed totals for AFI, spousal maintenance, and child support pages.
  app.get('/api/matters/:id/analysis-summary', (req, res) => {
    const { id } = req.params;
    const all = (sql, params) => new Promise((resolve, reject) => {
      req.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    Promise.all([
      all('SELECT COUNT(*) AS count FROM documents WHERE matter_id = ? AND deleted_at IS NULL', [id]),
      all(`SELECT id, account_type, statement_start, statement_end
           FROM bank_statements WHERE matter_id = ? AND processing_status = 'completed'`, [id]),
      all(`SELECT bt.amount, bt.description, bt.suggested_category, bt.mapped_category, bt.mapping_status, bt.flow_type, bs.account_type
           FROM bank_transactions bt
           JOIN bank_statements bs ON bs.id = bt.bank_statement_id
           WHERE bs.matter_id = ?`, [id]),
      all(`SELECT ier.document_id AS documentId, ier.party, ier.annual_amount AS annualAmount,
                  d.filename AS filename, d.document_type AS documentType
           FROM income_evidence_reviews ier
           JOIN documents d ON d.id = ier.document_id
           WHERE ier.matter_id = ?
             AND ier.status = 'accepted'
             AND ier.annual_amount > 0
             AND d.deleted_at IS NULL`, [id]),
    ]).then(([docRows, statements, transactions, acceptedIncomeEvidence]) => {
      const coverage = new Set(statements.map((s) => (s.statement_start || '').slice(0, 7)).filter(Boolean));
      const monthCount = Math.max(1, coverage.size);
      const monthlyExpenses = {};
      let incomeCandidateTotal = 0;

      transactions.forEach((txn) => {
        const amount = Math.abs(Number(txn.amount) || 0);
        const category = txn.mapped_category || txn.suggested_category;
        const description = (txn.description || '').toLowerCase();
        const isAccountMovement =
          AFITaxonomy.isAccountMovement(category) || category === 'employment_income' || category === 'tax' ||
          /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bdeposit\b/.test(description);

        if (txn.flow_type === 'expense' && category && !isAccountMovement && amount <= 100000) {
          monthlyExpenses[category] = (monthlyExpenses[category] || 0) + amount;
        }
        // Only non-credit-card deposits are income candidates. Card payments/refunds
        // are deliberately excluded; a lawyer must review/confirm candidate income.
        if (txn.flow_type === 'income' && txn.account_type !== 'credit_card' &&
            !AFITaxonomy.excludedFromIncome(category, txn.description, txn.mapping_status)) {
          incomeCandidateTotal += amount;
        }
      });

      Object.keys(monthlyExpenses).forEach((key) => {
        monthlyExpenses[key] = +(monthlyExpenses[key] / monthCount).toFixed(2);
      });

      const acceptedIncomeByParty = { party_a: 0, party_b: 0 };
      acceptedIncomeEvidence.forEach((item) => {
        if (Object.hasOwn(acceptedIncomeByParty, item.party)) {
          acceptedIncomeByParty[item.party] += Number(item.annualAmount) || 0;
        }
      });
      Object.keys(acceptedIncomeByParty).forEach((party) => {
        acceptedIncomeByParty[party] = +acceptedIncomeByParty[party].toFixed(2);
      });

      res.json({
        matterId: id,
        documentCount: docRows[0]?.count || 0,
        statementCount: statements.length,
        transactionCount: transactions.length,
        coverageMonths: coverage.size,
        monthlyIncomeCandidate: +(incomeCandidateTotal / monthCount).toFixed(2),
        annualIncomeCandidate: +(incomeCandidateTotal / monthCount * 12).toFixed(2),
        acceptedIncomeAnnual: +(acceptedIncomeByParty.party_a + acceptedIncomeByParty.party_b).toFixed(2),
        acceptedIncomeByParty,
        acceptedIncomeEvidence,
        monthlyExpenses,
        generatedAt: new Date().toISOString(),
      });
    }).catch((err) => res.status(500).json({ error: err.message }));
  });

  // Income analysis across multiple bases for the Income Engine cards.
  // Computes 12-month average, 6-month average, last-month run-rate, and
  // trailing-3-month average from non-card deposits, plus accepted document
  // evidence. Deposit-derived bases are review-only and stay separate from
  // attorney-accepted figures.
  app.get('/api/matters/:id/income-analysis', (req, res) => {
    const { id } = req.params;
    const all = (sql, params) => new Promise((resolve, reject) => {
      req.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    Promise.all([
      all(`SELECT bt.amount, bt.description, bt.transaction_date, bt.flow_type,
                  bt.suggested_category, bt.mapped_category, bt.mapping_status, bs.account_type
           FROM bank_transactions bt
           JOIN bank_statements bs ON bs.id = bt.bank_statement_id
           WHERE bs.matter_id = ?`, [id]),
      all(`SELECT ier.party, ier.annual_amount AS annualAmount, d.document_type AS documentType, d.filename
           FROM income_evidence_reviews ier
           JOIN documents d ON d.id = ier.document_id
           WHERE ier.matter_id = ? AND ier.status = 'accepted' AND ier.annual_amount > 0 AND d.deleted_at IS NULL`, [id]),
    ]).then(([transactions, acceptedEvidence]) => {
      const movement = /\bpayment\s+to\s+(?:chase|credit|card)|\bpayment thank you|\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\brefund\b|\bcredit\b/i;

      // Employment income deposits only (non-card, categorized as income, not a transfer).
      const incomeDeposits = transactions.filter((t) => {
        const cat = t.mapped_category || t.suggested_category;
        const desc = (t.description || '').toLowerCase();
        return t.flow_type === 'income'
          && t.account_type !== 'credit_card'
          && !AFITaxonomy.excludedFromIncome(cat, t.description, t.mapping_status)
          && !movement.test(desc);
      });

      // Group deposits by YYYY-MM month. Fill calendar gaps with zero so a
      // trailing-period average cannot overstate income by skipping months.
      const byMonth = {};
      incomeDeposits.forEach((t) => {
        const m = (t.transaction_date || '').slice(0, 7);
        if (!m) return;
        byMonth[m] = (byMonth[m] || 0) + Math.abs(Number(t.amount) || 0);
      });
      const observedMonths = Object.keys(byMonth).sort();
      const monthSequence = [];
      if (observedMonths.length) {
        const cursor = new Date(`${observedMonths[0]}-01T00:00:00Z`);
        const end = new Date(`${observedMonths[observedMonths.length - 1]}-01T00:00:00Z`);
        while (cursor <= end) {
          const month = cursor.toISOString().slice(0, 7);
          monthSequence.push(month);
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      }
      const months = monthSequence;
      const monthValues = months.map((m) => byMonth[m] || 0);

      const sum = (arr) => arr.reduce((a, b) => a + b, 0);
      const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
      const annualize = (monthly) => +(monthly * 12).toFixed(2);

      const last12 = monthValues.slice(-12);
      const last6 = monthValues.slice(-6);
      const last3 = monthValues.slice(-3);
      const last1 = monthValues.slice(-1);

      const depositBases = {
        avg12Month: annualize(avg(last12)),
        avg6Month: annualize(avg(last6)),
        avg3Month: annualize(avg(last3)),
        lastMonthRunRate: annualize(avg(last1)),
        monthsCovered: months.length,
        firstMonth: months[0] || null,
        lastMonth: months[months.length - 1] || null,
      };

      // Accepted document evidence by party
      const acceptedByParty = { party_a: 0, party_b: 0 };
      acceptedEvidence.forEach((item) => {
        if (Object.hasOwn(acceptedByParty, item.party)) {
          acceptedByParty[item.party] += Number(item.annualAmount) || 0;
        }
      });

      res.json({
        matterId: id,
        // Deposit-derived candidates (review only — NOT calculation-ready)
        depositCandidates: depositBases,
        // Attorney-accepted document income (calculation-ready)
        accepted: {
          party_a: +acceptedByParty.party_a.toFixed(2),
          party_b: +acceptedByParty.party_b.toFixed(2),
          combined: +(acceptedByParty.party_a + acceptedByParty.party_b).toFixed(2),
          sources: acceptedEvidence.map((e) => ({ filename: e.filename, type: e.documentType, party: e.party, annualAmount: e.annualAmount })),
        },
        generatedAt: new Date().toISOString(),
      });
    }).catch((err) => res.status(500).json({ error: err.message }));
  });

// Get documents for a matter
app.get('/api/matters/:id/documents', (req, res) => {
  const { id } = req.params;
  req.db.all(
    `SELECT d.*, u.name as uploaded_by_name FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     WHERE d.matter_id = ? AND d.deleted_at IS NULL`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    }
  );
});

// Create a new matter
app.post('/api/matters', (req, res) => {
  const { id, firmId, name, clientName, status, caseNo, county, state, court, petitioner, respondent, details } = req.body;
  const matterId = id || uuidv4();
  req.db.run(
    `INSERT INTO matters (id, firm_id, name, client_name, status, case_no, county, state, court, petitioner, respondent, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [matterId, firmId || 'firm-default', name, clientName, status || 'active',
     caseNo || null, county || null, state || null, court || null,
     petitioner || null, respondent || null, details ? JSON.stringify(details) : null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: matterId, firmId, name, clientName, status, caseNo, county, state, court, petitioner, respondent });
    }
  );
});

// Update an existing matter (re-submitting the intake form for an active case).
app.put('/api/matters/:id', (req, res) => {
  const { id } = req.params;
  const { name, clientName, status, caseNo, county, state, court, petitioner, respondent, details } = req.body;
  req.db.run(
    `UPDATE matters SET name = ?, client_name = ?, status = ?, case_no = ?, county = ?, state = ?,
       court = ?, petitioner = ?, respondent = ?, details = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [name, clientName, status || 'active', caseNo || null, county || null, state || null,
     court || null, petitioner || null, respondent || null, details ? JSON.stringify(details) : null, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Matter not found' });
      res.json({ id, name, clientName, status, caseNo, county, state, court, petitioner, respondent });
    }
  );
});

// Assign user to matter
app.post('/api/matter-assignments', (req, res) => {
  const { id, matterId, userId, role } = req.body;
  const assignmentId = id || uuidv4();
  req.db.run(
    `INSERT INTO matter_assignments (id, matter_id, user_id, role)
     VALUES (?, ?, ?, ?)`,
    [assignmentId, matterId, userId, role],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: assignmentId, matterId, userId, role });
    }
  );
});

// Add document to matter
app.post('/api/documents', (req, res) => {
  const { id, matterId, filename, contentType, uploadedBy } = req.body;
  const docId = id || uuidv4();
  req.db.run(
    `INSERT INTO documents (id, matter_id, filename, content_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [docId, matterId, filename, contentType, uploadedBy],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: docId, matterId, filename, contentType, uploadedBy });
    }
  );
});

// Soft-delete a matter
app.delete('/api/matters/:id', (req, res) => {
  const { id } = req.params;
  req.db.run(
    `UPDATE matters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Matter deleted' });
    }
  );
});

// Mark a document's OCR review as complete
app.post('/api/documents/:id/review', (req, res) => {
  const { id } = req.params;
  req.db.run(
    `UPDATE documents SET ocr_needed = 0 WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// Allow an attorney/paralegal to correct an automatic document classification.
app.patch('/api/documents/:id/category', (req, res) => {
  const { id } = req.params;
  const allowed = [
    'Financial Statements',
    'Tax Returns & Income',
    'Property & Assets',
    'Court & Legal Documents',
    'AFI & Disclosures',
    'Other',
  ];
  const allowedTypes = [
    'Pay Stub / Earnings Statement',
    'Social Security Income / Benefits Statement',
    'Tax Return / Tax Income Record',
    'Brokerage / Investment Statement',
    'Credit Card Statement',
    'Savings Account Statement',
    'Bank Account Statement',
    'Expert Report / Expert Disclosure',
    'Court / Legal Disclosure',
    'Child / Education Record',
    'Unclassified Document',
  ];
  const category = req.body?.category;
  const documentType = req.body?.documentType;
  if (!allowed.includes(category)) {
    return res.status(400).json({ error: 'Invalid document category' });
  }
  if (documentType != null && !allowedTypes.includes(documentType)) {
    return res.status(400).json({ error: 'Invalid document type' });
  }
  const sql = documentType != null
    ? 'UPDATE documents SET category = ?, document_type = ? WHERE id = ? AND deleted_at IS NULL'
    : 'UPDATE documents SET category = ? WHERE id = ? AND deleted_at IS NULL';
  const params = documentType != null ? [category, documentType, id] : [category, id];
  req.db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Document not found' });
      res.json({ success: true, id, category, documentType: documentType || undefined });
    }
  );
});

// Apply a classification to every statement for the same account.
// The account is inferred from the account/card token in the filename
// (e.g. "3063", "5013", "8531"), so monthly statements for one account update together.
app.post('/api/matters/:matterId/documents/classify-account', (req, res) => {
  const { matterId } = req.params;
  const { documentId, category, documentType } = req.body || {};
  if (!documentId || !category) {
    return res.status(400).json({ error: 'documentId and category are required' });
  }

  req.db.get(
    'SELECT filename FROM documents WHERE id = ? AND matter_id = ? AND deleted_at IS NULL',
    [documentId, matterId],
    (err, doc) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      const m = (doc.filename || '').match(/(?:acct|account|cc|card)\s*(\d{3,})/i);
      if (!m) {
        return res.status(422).json({ error: 'No account number could be detected in the filename' });
      }
      const account = m[1];
      const sql = documentType != null
        ? 'UPDATE documents SET category = ?, document_type = ? WHERE matter_id = ? AND deleted_at IS NULL AND filename LIKE ?'
        : 'UPDATE documents SET category = ? WHERE matter_id = ? AND deleted_at IS NULL AND filename LIKE ?';
      const params = documentType != null
        ? [category, documentType, matterId, `%${account}%`]
        : [category, matterId, `%${account}%`];
      req.db.run(sql, params, function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, account, updated: this.changes, category, documentType: documentType || undefined });
      });
    }
  );
});

// POST /api/documents/:id/manual-entry
// For files that could not be parsed or OCR'd: an attorney/paralegal records
// what the document is and its key detail as plain text. Marks the document
// reviewed so it drops out of the needs-review queue.
app.post('/api/documents/:id/manual-entry', (req, res) => {
  const { id } = req.params;
  const notes = (req.body?.notes || '').toString().trim();
  const documentType = req.body?.documentType || null;
  const category = req.body?.category || null;
  if (!notes) {
    return res.status(400).json({ error: 'notes is required' });
  }
  req.db.run(
    `UPDATE documents SET manual_notes = ?, extraction_status = 'manual', ocr_needed = 0,
       classification_confidence = 'manual'
       ${documentType ? ', document_type = ?' : ''}
       ${category ? ', category = ?' : ''}
     WHERE id = ? AND deleted_at IS NULL`,
    [notes, ...(documentType ? [documentType] : []), ...(category ? [category] : []), id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Document not found' });
      res.json({ success: true, id, notes, documentType, category });
    }
  );
});

// POST /api/documents/:id/retry-extraction
// Re-runs text extraction (and optionally vision OCR) for a single document,
// without touching every other document in the matter.
app.post('/api/documents/:id/retry-extraction', async (req, res) => {
  const { id } = req.params;
  const useOcr = req.body?.useOcr === true;
  try {
    const { getOriginal } = require('./services/storage');
    const { extractText } = require('./services/file-extractor');
    const { visionExtractText } = require('./services/claude-vision-ocr');
    const { classifyDocument } = require('./services/document-classifier');
    const { parseStatementText } = require('./services/statement-parser');
    const crypto = require('crypto');

    const doc = await new Promise((resolve, reject) => {
      req.db.get('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id], (e, r) => e ? reject(e) : resolve(r));
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.s3_key) return res.status(404).json({ error: 'No stored original file for this document' });

    const buffer = await getOriginal(doc.s3_key);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    await new Promise((resolve, reject) => req.db.run('UPDATE documents SET file_hash = ? WHERE id = ?', [fileHash, id], (e) => e ? reject(e) : resolve()));

    let { text, ocrNeeded, ext } = await extractText({ originalname: doc.filename, buffer });
    let usedOcr = false;
    if (useOcr && ocrNeeded && process.env.ANTHROPIC_API_KEY && (ext === 'pdf' || ['jpg', 'jpeg', 'png', 'gif'].includes(ext))) {
      try { text = await visionExtractText(buffer, ext); usedOcr = true; } catch (e) { /* fall through, still report failure below */ }
    }

    if (!text) {
      await new Promise((resolve, reject) => req.db.run(
        `UPDATE documents SET extraction_status = 'needs_review', ocr_needed = 1 WHERE id = ?`, [id], (e) => e ? reject(e) : resolve()
      ));
      return res.json({ success: true, extracted: false, usedOcr, message: 'Still unreadable. Try OCR or enter details manually.' });
    }

    const classification = classifyDocument(doc.filename, text);
    await new Promise((resolve, reject) => req.db.run(
      'UPDATE documents SET category = ?, document_type = ?, classification_confidence = ? WHERE id = ?',
      [classification.category, classification.type, classification.confidence, id], (e) => e ? reject(e) : resolve()
    ));

    const looksFinancial = /\d{1,2}\/\d{1,2}/.test(text) && /\d+\.\d{2}/.test(text);
    let transactionCount = 0;
    if (looksFinancial) {
      const parsed = parseStatementText(text, doc.filename);
      transactionCount = parsed.transactions.length;
      if (transactionCount) {
        const existing = await new Promise((resolve) => req.db.get('SELECT id FROM bank_statements WHERE document_id = ?', [id], (e, r) => resolve(r)));
        let statementId = existing?.id;
        if (existing) {
          await new Promise((resolve, reject) => req.db.run('DELETE FROM bank_transactions WHERE bank_statement_id = ?', [existing.id], (e) => e ? reject(e) : resolve()));
          await new Promise((resolve, reject) => req.db.run(
            'UPDATE bank_statements SET bank_name=?, account_type=?, account_number_masked=?, statement_start=?, statement_end=? WHERE id=?',
            [parsed.bankName, parsed.accountType, parsed.accountNumberMasked, parsed.statementStart, parsed.statementEnd, existing.id], (e) => e ? reject(e) : resolve()
          ));
        } else {
          statementId = uuidv4();
          await new Promise((resolve, reject) => req.db.run(
            `INSERT INTO bank_statements (id, document_id, matter_id, bank_name, account_type, account_number_masked, statement_start, statement_end, processing_status) VALUES (?,?,?,?,?,?,?,?,?)`,
            [statementId, id, doc.matter_id, parsed.bankName, parsed.accountType, parsed.accountNumberMasked, parsed.statementStart, parsed.statementEnd, 'completed'], (e) => e ? reject(e) : resolve()
          ));
        }
        for (const txn of parsed.transactions) {
          await new Promise((resolve, reject) => req.db.run(
            `INSERT INTO bank_transactions (id, bank_statement_id, transaction_date, description, amount, transaction_type, running_balance, flow_type, suggested_category, mapped_category, mapping_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [uuidv4(), statementId, txn.date, txn.description, txn.amount, txn.type, txn.runningBalance, txn.flowType, txn.suggestedCategory, txn.suggestedCategory || null, txn.suggestedCategory ? 'auto_mapped' : 'unmapped'],
            (e) => e ? reject(e) : resolve()
          ));
        }
      }
    }

    const stillNeedsReview = !looksFinancial && classification.category === 'Financial Statements';
    await new Promise((resolve, reject) => req.db.run(
      `UPDATE documents SET extraction_status = ?, ocr_needed = ? WHERE id = ?`,
      [stillNeedsReview ? 'needs_review' : 'parsed', stillNeedsReview ? 1 : 0, id], (e) => e ? reject(e) : resolve()
    ));

    res.json({ success: true, extracted: true, usedOcr, transactionCount, category: classification.category, documentType: classification.type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download the original uploaded file for a document
app.get('/api/documents/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const { getOriginal } = require('./services/storage');
    req.db.get('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id], async (err, doc) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      if (!doc.s3_key) return res.status(404).json({ error: 'No stored file for this document' });
      try {
        const buf = await getOriginal(doc.s3_key);
        res.header('Content-Type', doc.content_type || 'application/octet-stream');
        res.header('Content-Disposition', `attachment; filename="${(doc.filename || 'document').replace(/"/g, '')}"`);
        res.send(buf);
      } catch (e) {
        res.status(500).json({ error: 'Could not read stored file: ' + e.message });
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Soft-delete a document
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  req.db.run(
    `UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Document deleted' });
    }
  );
});

// Admin reset endpoint (development only)
app.post('/api/admin/reset', (req, res) => {
  const fs = require('fs');

  try {
    // Delete all database records
    req.db.run('DELETE FROM users');
    req.db.run('DELETE FROM matters');
    req.db.run('DELETE FROM documents');

    // Delete uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }

    console.log('✓ Backend reset complete');
    res.json({ success: true, message: 'Template reset successfully' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Veritas server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);

      // Optional: expose this local API to Azure via an outbound-only tunnel.
      // Active only when TUNNEL_MODE=relay in .env (no inbound firewall changes).
      try {
        const { startTunnel } = require('./tunnel');
        startTunnel(PORT);
      } catch (e) {
        console.warn('Tunnel not started:', e.message);
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
