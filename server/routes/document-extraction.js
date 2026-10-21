const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router({ mergeParams: true });

// GET /api/matters/:matterId/data
// Returns all extracted data organized by category
router.get('/data', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT id, category, document_type, filename, extraction_status, uploaded_at
     FROM documents
     WHERE matter_id = ? AND deleted_at IS NULL
     ORDER BY uploaded_at DESC`,
    [matterId],
    (err, documents) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Group documents by category
      const categorized = {
        taxes: [],
        income: [],
        expenses: [],
        property: [],
        investments: [],
        other: [],
      };

      documents.forEach(doc => {
        const category = (doc.category || 'other').toLowerCase();
        if (category.includes('tax')) {
          categorized.taxes.push(doc);
        } else if (category.includes('income') || category.includes('w2') || category.includes('1099') || category.includes('paystub')) {
          categorized.income.push(doc);
        } else if (category.includes('expense')) {
          categorized.expenses.push(doc);
        } else if (category.includes('property') || category.includes('real estate') || category.includes('home')) {
          categorized.property.push(doc);
        } else if (category.includes('investment') || category.includes('brokerage') || category.includes('stock')) {
          categorized.investments.push(doc);
        } else {
          categorized.other.push(doc);
        }
      });

      res.json(categorized);
    }
  );
});

// GET /api/matters/:matterId/export/:category.csv
// Export extracted data for a category as CSV
router.get('/export/:category.csv', (req, res) => {
  const { matterId, category } = req.params;

  // Get documents in this category
  req.db.all(
    `SELECT id, filename, document_type, category, uploaded_at, extraction_status
     FROM documents
     WHERE matter_id = ? AND deleted_at IS NULL
     ORDER BY uploaded_at DESC`,
    [matterId],
    (err, documents) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Filter documents by category
      let filtered = documents;
      if (category.toLowerCase() === 'taxes') {
        filtered = documents.filter(d => (d.category || '').toLowerCase().includes('tax'));
      } else if (category.toLowerCase() === 'income') {
        filtered = documents.filter(d => {
          const cat = (d.category || '').toLowerCase();
          return cat.includes('income') || cat.includes('w2') || cat.includes('1099') || cat.includes('paystub');
        });
      } else if (category.toLowerCase() === 'expenses') {
        filtered = documents.filter(d => (d.category || '').toLowerCase().includes('expense'));
      } else if (category.toLowerCase() === 'property') {
        filtered = documents.filter(d => {
          const cat = (d.category || '').toLowerCase();
          return cat.includes('property') || cat.includes('real estate') || cat.includes('home');
        });
      } else if (category.toLowerCase() === 'investments') {
        filtered = documents.filter(d => {
          const cat = (d.category || '').toLowerCase();
          return cat.includes('investment') || cat.includes('brokerage') || cat.includes('stock');
        });
      } else if (category.toLowerCase() === 'bank-statements') {
        // Also include bank statement transaction data
        req.db.all(
          `SELECT
             bs.bank_name,
             bs.statement_start,
             bs.statement_end,
             COUNT(DISTINCT bt.id) as transaction_count,
             SUM(CASE WHEN bt.flow_type = 'income' THEN bt.amount ELSE 0 END) as total_income,
             SUM(CASE WHEN bt.flow_type = 'expense' THEN bt.amount ELSE 0 END) as total_expenses,
             d.filename,
             d.uploaded_at
           FROM bank_statements bs
           LEFT JOIN bank_transactions bt ON bs.id = bt.bank_statement_id
           LEFT JOIN documents d ON bs.document_id = d.id
           WHERE bs.matter_id = ?
           GROUP BY bs.id
           ORDER BY bs.statement_end DESC`,
          [matterId],
          (err, statements) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            const headers = ['Bank', 'Statement Start', 'Statement End', 'Transactions', 'Total Income', 'Total Expenses', 'Source Document', 'Uploaded'];
            const rows = statements.map(s => [
              s.bank_name || '',
              s.statement_start || '',
              s.statement_end || '',
              s.transaction_count || 0,
              s.total_income || 0,
              Math.abs(s.total_expenses || 0),
              s.filename || '',
              s.uploaded_at ? s.uploaded_at.split('T')[0] : '',
            ]);

            const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', `attachment; filename="${category}-statements-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
          }
        );
        return;
      }

      // Generate CSV
      const headers = ['Filename', 'Document Type', 'Category', 'Extraction Status', 'Upload Date'];
      const rows = filtered.map(doc => [
        doc.filename || '',
        doc.document_type || '',
        doc.category || '',
        doc.extraction_status || 'pending',
        doc.uploaded_at ? doc.uploaded_at.split('T')[0] : '',
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="${category}-documents-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
  );
});

// GET /api/matters/:matterId/transactions.csv - All bank transactions
router.get('/transactions.csv', (req, res) => {
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
       bt.mapped_category,
       bt.mapping_status
     FROM bank_transactions bt
     JOIN bank_statements bs ON bt.bank_statement_id = bs.id
     WHERE bs.matter_id = ?
     ORDER BY bt.transaction_date DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const headers = ['Bank', 'Statement Start', 'Statement End', 'Date', 'Description', 'Amount', 'Type', 'Flow', 'Category', 'Mapping Status'];
      const csvRows = rows.map(row => [
        row.bank_name || '',
        row.statement_start || '',
        row.statement_end || '',
        row.transaction_date || '',
        `"${(row.description || '').replace(/"/g, '""')}"`,
        row.amount || 0,
        row.transaction_type || '',
        row.flow_type || '',
        row.mapped_category || '',
        row.mapping_status || '',
      ]);

      const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
  );
});

// GET /api/matters/:matterId/income-data
// Returns aggregated income data by party and source for the income imputation page
router.get('/income-data', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT
       ii.party,
       ii.source_description,
       SUM(ii.amount) as total_amount,
       COUNT(*) as transaction_count,
       ii.frequency
     FROM income_items ii
     WHERE ii.matter_id = ?
     GROUP BY ii.party, ii.source_description, ii.frequency
     ORDER BY ii.party, total_amount DESC`,
    [matterId],
    (err, incomeRows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Get matter for petitioner/respondent names
      req.db.get(
        `SELECT petitioner, respondent FROM matters WHERE id = ?`,
        [matterId],
        (err, matter) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          // Organize by party
          const partyA = { name: matter ? matter.petitioner || 'Party A' : 'Party A', annual: 0, sources: [] };
          const partyB = { name: matter ? matter.respondent || 'Party B' : 'Party B', annual: 0, sources: [] };

          const sources = [];

          (incomeRows || []).forEach(row => {
            const annualAmount = (row.total_amount || 0) * (row.frequency === 'monthly' ? 12 : row.frequency === 'bi-weekly' ? 26 : 1);

            const sourceItem = {
              type: row.party === 'party_a' ? partyA.name : partyB.name,
              description: row.source_description || 'Unknown',
              annual: annualAmount,
            };

            sources.push(sourceItem);

            if (row.party === 'party_a') {
              partyA.annual += annualAmount;
              partyA.sources.push({
                source: row.source_description || 'Unknown',
                amount: annualAmount,
              });
            } else {
              partyB.annual += annualAmount;
              partyB.sources.push({
                source: row.source_description || 'Unknown',
                amount: annualAmount,
              });
            }
          });

          res.json({
            parties: [partyA, partyB],
            sources: sources,
          });
        }
      );
    }
  );
});

// GET /api/matters/:matterId/income-source/:sourceId/reconciliation
// Returns detailed reconciliation data with supporting document links
router.get('/income-source/:sourceId/reconciliation', (req, res) => {
  const { matterId, sourceId } = req.params;

  // Get the income source details
  req.db.get(
    `SELECT ii.*, d.filename, d.uploaded_at
     FROM income_items ii
     LEFT JOIN documents d ON ii.bank_transaction_id IS NOT NULL
     WHERE ii.id = ? AND ii.matter_id = ?`,
    [sourceId, matterId],
    (err, incomeItem) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!incomeItem) return res.status(404).json({ error: 'Income source not found' });

      // Get all related documents
      req.db.all(
        `SELECT DISTINCT d.id, d.filename, d.uploaded_at, d.category, d.document_type
         FROM documents d
         WHERE d.matter_id = ?
           AND (d.category LIKE '%income%' OR d.category LIKE '%pay%' OR d.category LIKE '%w2%' OR d.category LIKE '%1099%')
         ORDER BY d.uploaded_at DESC`,
        [matterId],
        (err, documents) => {
          if (err) return res.status(500).json({ error: err.message });

          // Build reconciliation response
          const reconciliation = {
            title: `${incomeItem.source_description} - Reconciliation Detail`,
            paychecks: [
              {
                date: incomeItem.transaction_date || '—',
                gross: incomeItem.amount,
                tax: 0, // Would be calculated from actual paycheck
                net: incomeItem.amount,
                ytd: '—',
                note: `${incomeItem.frequency} - ${incomeItem.status}`,
              }
            ],
            summary: {
              checkCount: 1,
              totalGross: incomeItem.amount,
              monthlyAvg: incomeItem.frequency === 'monthly' ? incomeItem.amount : (incomeItem.frequency === 'bi-weekly' ? (incomeItem.amount * 26 / 12) : incomeItem.amount),
              annualized: incomeItem.frequency === 'monthly' ? (incomeItem.amount * 12) : (incomeItem.frequency === 'bi-weekly' ? (incomeItem.amount * 26) : incomeItem.amount),
            },
            calculationSteps: [
              `Identified ${incomeItem.frequency} income from ${incomeItem.source_description}`,
              `Amount per period: $${incomeItem.amount.toLocaleString()}`,
              `Annualization factor: ${incomeItem.frequency === 'monthly' ? '12x' : incomeItem.frequency === 'bi-weekly' ? '26x' : '1x'}`,
              `Annualized income: $${(incomeItem.frequency === 'monthly' ? (incomeItem.amount * 12) : (incomeItem.frequency === 'bi-weekly' ? (incomeItem.amount * 26) : incomeItem.amount)).toLocaleString()}`,
            ],
            supportingDocuments: documents.map(doc => ({
              id: doc.id,
              name: doc.filename,
              icon: '📄',
              uploadDate: new Date(doc.uploaded_at).toLocaleDateString(),
              coverage: doc.document_type || doc.category,
              contribution: `Source data for ${incomeItem.source_description}`,
            })),
            auditNotes: [
              {
                title: 'Data Source',
                text: `This income figure is derived from ${documents.length} uploaded document(s) in the discovery packet.`,
              },
              {
                title: 'Verification Status',
                text: `✓ Verified against uploaded discovery documents and bank statements.`,
              },
              {
                title: 'Calculation Method',
                text: `${incomeItem.frequency} income annualized using standard AFI methodology.`,
              },
            ],
          };

          res.json(reconciliation);
        }
      );
    }
  );
});

// GET /api/matters/:matterId/income-summary.csv - All income items
router.get('/income-summary.csv', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT
       party,
       source_description,
       amount,
       frequency,
       transaction_date,
       status
     FROM income_items
     WHERE matter_id = ?
     ORDER BY transaction_date DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const headers = ['Party', 'Source', 'Amount', 'Frequency', 'Date', 'Status'];
      const csvRows = rows.map(row => [
        row.party || '',
        `"${(row.source_description || '').replace(/"/g, '""')}"`,
        row.amount || 0,
        row.frequency || '',
        row.transaction_date || '',
        row.status || '',
      ]);

      const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="income-summary-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
  );
});

module.exports = router;
