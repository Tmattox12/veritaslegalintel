/**
 * Veritas Reconciliation Backend API
 * Node.js/Express endpoints for reconciliation data management
 *
 * Install: npm install express sqlite3 cors dotenv
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database Setup
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Database initialized');
});

// Create tables
function initializeDatabase() {
  db.serialize(() => {
    // Cases table
    db.run(`
      CREATE TABLE IF NOT EXISTS cases (
        id VARCHAR(50) PRIMARY KEY,
        case_name VARCHAR(255),
        case_number VARCHAR(50),
        county VARCHAR(100),
        report_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reconciliations table
    db.run(`
      CREATE TABLE IF NOT EXISTS reconciliations (
        id TEXT PRIMARY KEY,
        case_id VARCHAR(50),
        category VARCHAR(100),
        title VARCHAR(255),
        status VARCHAR(20),
        total_amount DECIMAL(10,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(id)
      )
    `);

    // Reconciliation items table
    db.run(`
      CREATE TABLE IF NOT EXISTS reconciliation_items (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT,
        date DATE,
        description VARCHAR(255),
        amount DECIMAL(10,2),
        ytd DECIMAL(10,2),
        category VARCHAR(100),
        status VARCHAR(20),
        note TEXT,
        source_link VARCHAR(500),
        document_id VARCHAR(100),
        FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
      )
    `);

    // Document links table
    db.run(`
      CREATE TABLE IF NOT EXISTS document_links (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT,
        document_name VARCHAR(255),
        document_type VARCHAR(50),
        document_url VARCHAR(500),
        upload_date DATE,
        pages INT,
        FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
      )
    `);

    console.log('Database tables initialized');
  });
}

// Initialize database
initializeDatabase();

// ===================== API ENDPOINTS =====================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'reconciliation-api' });
});

/**
 * GET /api/cases/:caseId
 * Get case details
 */
app.get('/api/cases/:caseId', (req, res) => {
  const { caseId } = req.params;

  db.get('SELECT * FROM cases WHERE id = ?', [caseId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Case not found' });
    }
  });
});

/**
 * GET /api/cases/:caseId/reconciliations
 * List all reconciliations for a case
 */
app.get('/api/cases/:caseId/reconciliations', (req, res) => {
  const { caseId } = req.params;

  db.all(
    'SELECT id, category, title, status, total_amount, updated_at FROM reconciliations WHERE case_id = ?',
    [caseId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          caseId,
          reconciliations: rows || []
        });
      }
    }
  );
});

/**
 * GET /api/reconciliations/:reconId
 * Get full reconciliation details
 */
app.get('/api/reconciliations/:reconId', (req, res) => {
  const { reconId } = req.params;

  db.get('SELECT * FROM reconciliations WHERE id = ?', [reconId], (err, recon) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!recon) {
      res.status(404).json({ error: 'Reconciliation not found' });
    } else {
      // Get items
      db.all(
        'SELECT * FROM reconciliation_items WHERE reconciliation_id = ? ORDER BY date',
        [reconId],
        (err, items) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            // Get documents
            db.all(
              'SELECT * FROM document_links WHERE reconciliation_id = ?',
              [reconId],
              (err, docs) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                } else {
                  res.json({
                    ...recon,
                    items: items || [],
                    documents: docs || []
                  });
                }
              }
            );
          }
        }
      );
    }
  });
});

/**
 * POST /api/reconciliations
 * Create new reconciliation
 */
app.post('/api/reconciliations', (req, res) => {
  const { caseId, category, title, items, documentLinks, status } = req.body;

  if (!caseId || !category || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const reconId = `recon-${Date.now()}`;
  const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  db.run(
    `INSERT INTO reconciliations (id, case_id, category, title, status, total_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reconId, caseId, category, title, status || 'Complete', totalAmount],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Insert items
      items.forEach((item) => {
        const itemId = `item-${Date.now()}-${Math.random()}`;
        db.run(
          `INSERT INTO reconciliation_items
           (id, reconciliation_id, date, description, amount, ytd, category, status, note, source_link, document_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            reconId,
            item.date,
            item.description,
            item.amount,
            item.ytd,
            item.category,
            item.status,
            item.note,
            item.sourceLink,
            item.documentId
          ]
        );
      });

      // Insert documents
      if (documentLinks) {
        documentLinks.forEach((doc) => {
          const docId = `doc-${Date.now()}-${Math.random()}`;
          db.run(
            `INSERT INTO document_links
             (id, reconciliation_id, document_name, document_type, document_url, upload_date, pages)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [docId, reconId, doc.name, doc.type, doc.url, new Date(), doc.pages || 1]
          );
        });
      }

      res.status(201).json({
        id: reconId,
        caseId,
        category,
        title,
        status,
        totalAmount,
        message: 'Reconciliation created successfully'
      });
    }
  );
});

/**
 * PUT /api/reconciliations/:reconId
 * Update reconciliation
 */
app.put('/api/reconciliations/:reconId', (req, res) => {
  const { reconId } = req.params;
  const { title, status, items } = req.body;

  if (!title && !status && !items) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  let updates = [];
  let params = [];

  if (title) {
    updates.push('title = ?');
    params.push(title);
  }
  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(reconId);

  db.run(
    `UPDATE reconciliations SET ${updates.join(', ')} WHERE id = ?`,
    params,
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Reconciliation updated successfully' });
      }
    }
  );
});

/**
 * DELETE /api/reconciliations/:reconId
 * Delete reconciliation
 */
app.delete('/api/reconciliations/:reconId', (req, res) => {
  const { reconId } = req.params;

  db.run('DELETE FROM reconciliation_items WHERE reconciliation_id = ?', [reconId], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run('DELETE FROM document_links WHERE reconciliation_id = ?', [reconId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run('DELETE FROM reconciliations WHERE id = ?', [reconId], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Reconciliation deleted successfully' });
        }
      });
    });
  });
});

/**
 * POST /api/cases
 * Create new case
 */
app.post('/api/cases', (req, res) => {
  const { id, caseName, caseNumber, county, reportDate } = req.body;

  if (!id || !caseName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `INSERT INTO cases (id, case_name, case_number, county, report_date)
     VALUES (?, ?, ?, ?, ?)`,
    [id, caseName, caseNumber, county, reportDate],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ message: 'Case created successfully' });
      }
    }
  );
});

/**
 * POST /api/imports
 * Store imported expense data
 */
app.post('/api/imports', (req, res) => {
  const { caseId, fileName, items, mappingRate } = req.body;

  if (!caseId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const importId = `import-${Date.now()}`;
  const importDate = new Date().toISOString();

  db.run(
    `CREATE TABLE IF NOT EXISTS imported_expenses (
      id TEXT PRIMARY KEY,
      case_id VARCHAR(50),
      file_name VARCHAR(255),
      import_date DATETIME,
      item_count INT,
      mapping_rate INT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.run(
        `INSERT INTO imported_expenses (id, case_id, file_name, import_date, item_count, mapping_rate, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [importId, caseId, fileName, importDate, items.length, mappingRate, JSON.stringify(items)],
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            res.status(201).json({
              id: importId,
              caseId,
              fileName,
              itemCount: items.length,
              mappingRate,
              message: 'Import stored successfully'
            });
          }
        }
      );
    }
  );
});

/**
 * GET /api/imports/:caseId
 * Get all imports for a case
 */
app.get('/api/imports/:caseId', (req, res) => {
  const { caseId } = req.params;

  db.all(
    'SELECT id, file_name, import_date, item_count, mapping_rate FROM imported_expenses WHERE case_id = ? ORDER BY import_date DESC',
    [caseId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          caseId,
          imports: rows || []
        });
      }
    }
  );
});

/**
 * GET /api/imports/:importId/items
 * Get imported items for manual review
 */
app.get('/api/imports/:importId/items', (req, res) => {
  const { importId } = req.params;

  db.get(
    'SELECT data FROM imported_expenses WHERE id = ?',
    [importId],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (row) {
        try {
          const items = JSON.parse(row.data);
          const unmapped = items.filter(i => i.status === 'unmapped');
          res.json({
            importId,
            totalItems: items.length,
            unmappedItems: unmapped,
            mappedCount: items.length - unmapped.length
          });
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse import data' });
        }
      } else {
        res.status(404).json({ error: 'Import not found' });
      }
    }
  );
});

/**
 * PUT /api/imports/:importId/map-item
 * Manually map imported item
 */
app.put('/api/imports/:importId/map-item', (req, res) => {
  const { importId } = req.params;
  const { itemId, category } = req.body;

  if (!itemId || !category) {
    return res.status(400).json({ error: 'Missing itemId or category' });
  }

  db.get(
    'SELECT data FROM imported_expenses WHERE id = ?',
    [importId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Import not found' });
      }

      try {
        const items = JSON.parse(row.data);
        const item = items.find(i => i.id === itemId);

        if (item) {
          item.mappedCategory = category;
          item.status = 'manually_mapped';

          db.run(
            `UPDATE imported_expenses SET data = ? WHERE id = ?`,
            [JSON.stringify(items), importId],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
              } else {
                res.json({ message: 'Item mapped successfully' });
              }
            }
          );
        } else {
          res.status(404).json({ error: 'Item not found' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse import data' });
      }
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Reconciliation API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
