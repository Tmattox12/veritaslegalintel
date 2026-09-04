const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { initializeDatabase, getDatabase } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
  const { id, firmId, name, clientName, status } = req.body;
  const matterId = id || uuidv4();
  req.db.run(
    `INSERT INTO matters (id, firm_id, name, client_name, status)
     VALUES (?, ?, ?, ?, ?)`,
    [matterId, firmId, name, clientName, status || 'active'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: matterId, firmId, name, clientName, status });
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

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Veritas server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
