const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router({ mergeParams: true });

// GET /api/matters/:matterId/merchants/review
// Get merchants with "suggested — review" status
router.get('/review', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT
       bt.description,
       bt.suggested_category,
       COUNT(*) as count,
       SUM(ABS(bt.amount)) as total,
       MIN(bt.transaction_date) as date_start,
       MAX(bt.transaction_date) as date_end
     FROM bank_transactions bt
     JOIN bank_statements bs ON bt.bank_statement_id = bs.id
     WHERE bs.matter_id = ?
       AND bt.mapped_category IS NULL
       AND bt.suggested_category IS NOT NULL
       AND bt.flow_type = 'expense'
     GROUP BY bt.description, bt.suggested_category
     ORDER BY count DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const merchants = (rows || []).map(row => ({
        description: row.description,
        suggested_category: row.suggested_category,
        count: row.count,
        total: row.total,
        date_range: `${row.date_start} to ${row.date_end}`,
      }));

      res.json({ review: merchants });
    }
  );
});

// GET /api/matters/:matterId/merchants/reclassify
// Get merchants that are mapped but could be more specific
router.get('/reclassify', (req, res) => {
  const { matterId } = req.params;

  req.db.all(
    `SELECT
       bt.description,
       bt.mapped_category,
       COUNT(*) as count,
       SUM(ABS(bt.amount)) as total,
       MIN(bt.transaction_date) as date_start,
       MAX(bt.transaction_date) as date_end
     FROM bank_transactions bt
     JOIN bank_statements bs ON bt.bank_statement_id = bs.id
     WHERE bs.matter_id = ?
       AND bt.mapped_category IN ('disc_shopping', 'disc_entertainment', 'disc_subscription_other')
       AND bt.flow_type = 'expense'
     GROUP BY bt.description, bt.mapped_category
     HAVING count > 2
     ORDER BY total DESC`,
    [matterId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const merchants = (rows || []).map(row => {
        // Suggest more specific categories based on mapped category
        let suggestedOptions = [];
        if (row.mapped_category === 'disc_shopping') {
          suggestedOptions = ['clothing', 'disc_pets', 'household_supplies', 'disc_beauty'];
        } else if (row.mapped_category === 'disc_entertainment') {
          suggestedOptions = ['disc_gym', 'disc_travel', 'child_activities'];
        } else if (row.mapped_category === 'disc_subscription_other') {
          suggestedOptions = ['disc_streaming', 'disc_gym', 'utilities_phone'];
        }

        return {
          description: row.description,
          current_category: row.mapped_category,
          suggested_options: suggestedOptions,
          count: row.count,
          total: row.total,
          date_range: `${row.date_start} to ${row.date_end}`,
        };
      });

      res.json({ reclassify: merchants });
    }
  );
});

// POST /api/matters/:matterId/merchants/:description/confirm
// Confirm a suggested mapping
router.post('/:description/confirm', (req, res) => {
  const { matterId, description } = req.params;
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }

  req.db.run(
    `UPDATE bank_transactions
     SET mapped_category = ?, mapping_status = 'confirmed'
     WHERE description = ?
       AND bank_statement_id IN (
         SELECT id FROM bank_statements WHERE matter_id = ?
       )`,
    [category, decodeURIComponent(description), matterId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, updated: this.changes });
    }
  );
});

// POST /api/matters/:matterId/merchants/:description/remap
// Change/reclassify a merchant mapping
router.post('/:description/remap', (req, res) => {
  const { matterId, description } = req.params;
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }

  req.db.run(
    `UPDATE bank_transactions
     SET mapped_category = ?, mapping_status = 'confirmed'
     WHERE description = ?
       AND bank_statement_id IN (
         SELECT id FROM bank_statements WHERE matter_id = ?
       )`,
    [category, decodeURIComponent(description), matterId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, updated: this.changes });
    }
  );
});

module.exports = router;
