const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../.data/veritas.sqlite');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('partner', 'associate', 'paralegal', 'admin')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Matters table
        db.run(`
          CREATE TABLE IF NOT EXISTS matters (
            id TEXT PRIMARY KEY,
            firm_id TEXT NOT NULL,
            name TEXT NOT NULL,
            client_name TEXT,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'closed')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT
          )
        `);

        // Matter assignments (join table)
        db.run(`
          CREATE TABLE IF NOT EXISTS matter_assignments (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('partner', 'associate', 'paralegal', 'admin')),
            assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(matter_id, user_id)
          )
        `);

        // Documents table
        db.run(`
          CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            s3_key TEXT,
            filename TEXT NOT NULL,
            content_type TEXT,
            category TEXT,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
          )
        `);

        // Extraction metadata columns (added for discovery intake pipeline)
        db.run(`ALTER TABLE documents ADD COLUMN category TEXT`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN extraction_status TEXT`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN ocr_needed INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN file_hash TEXT`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN document_type TEXT`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN classification_confidence TEXT`, () => {});
        db.run(`ALTER TABLE documents ADD COLUMN manual_notes TEXT`, () => {});
        // NULL hashes on legacy rows are allowed; new uploads get a SHA-256 hash.
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_documents_matter_hash
          ON documents(matter_id, file_hash) WHERE file_hash IS NOT NULL`, () => {});

        // Matter case-detail columns (added for case intake)
        db.run(`ALTER TABLE matters ADD COLUMN case_no TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN county TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN state TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN court TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN petitioner TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN respondent TEXT`, () => {});
        db.run(`ALTER TABLE matters ADD COLUMN details TEXT`, () => {});

        // Bank statements table
        db.run(`
          CREATE TABLE IF NOT EXISTS bank_statements (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            matter_id TEXT NOT NULL,
            bank_name TEXT,
            account_type TEXT,
            account_number_masked TEXT,
            statement_start TEXT,
            statement_end TEXT,
            beginning_balance REAL,
            ending_balance REAL,
            processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'error')),
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents(id),
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);

        // Bank transactions table
        db.run(`
          CREATE TABLE IF NOT EXISTS bank_transactions (
            id TEXT PRIMARY KEY,
            bank_statement_id TEXT NOT NULL,
            transaction_date TEXT,
            description TEXT,
            amount REAL,
            transaction_type TEXT,
            running_balance REAL,
            flow_type TEXT CHECK(flow_type IN ('income', 'expense', 'transfer', 'unknown')),
            suggested_category TEXT,
            mapped_category TEXT,
            mapping_status TEXT DEFAULT 'unmapped' CHECK(mapping_status IN ('auto_mapped', 'unmapped', 'confirmed')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bank_statement_id) REFERENCES bank_statements(id)
          )
        `);

        // Income items table
        db.run(`
          CREATE TABLE IF NOT EXISTS income_items (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            bank_transaction_id TEXT,
            party TEXT,
            source_description TEXT,
            amount REAL,
            frequency TEXT,
            transaction_date TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)
          )
        `);

        // Attorney-reviewed income evidence from pay stubs, benefits, and tax records.
        db.run(`
          CREATE TABLE IF NOT EXISTS income_evidence_reviews (
            document_id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            party TEXT CHECK(party IN ('party_a', 'party_b')),
            annual_amount REAL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
            reviewed_at TEXT,
            FOREIGN KEY (document_id) REFERENCES documents(id),
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);

        // ===== Billing: time capture, retainer / trust, statements =====
        // One row per heartbeat (about a minute) of active work on a matter.
        // entry_id links the activity to the draft time entry built from it;
        // 'below_minimum' marks a session too short to bill.
        db.run(`
          CREATE TABLE IF NOT EXISTS time_activity (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT,
            page TEXT,
            page_label TEXT,
            local_date TEXT,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            active_seconds INTEGER NOT NULL DEFAULT 0,
            actions TEXT,
            entry_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS ix_time_activity_matter ON time_activity(matter_id, started_at)`);

        // Billable time entries. Auto entries start as drafts built from
        // time_activity; nothing is billed until an attorney approves it.
        db.run(`
          CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            user_id TEXT,
            timekeeper TEXT,
            role TEXT NOT NULL DEFAULT 'attorney' CHECK(role IN ('attorney', 'paralegal')),
            work_date TEXT NOT NULL,
            started_at TEXT,
            ended_at TEXT,
            active_seconds INTEGER DEFAULT 0,
            hours REAL NOT NULL,
            rate REAL NOT NULL,
            task_code TEXT,
            narrative TEXT,
            status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'written_off', 'billed')),
            source TEXT NOT NULL DEFAULT 'auto' CHECK(source IN ('auto', 'manual')),
            invoice_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            approved_at TEXT,
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);

        // Per-matter fee agreement terms.
        db.run(`
          CREATE TABLE IF NOT EXISTS matter_billing (
            matter_id TEXT PRIMARY KEY,
            attorney_rate REAL NOT NULL DEFAULT 350,
            paralegal_rate REAL NOT NULL DEFAULT 150,
            retainer_amount REAL NOT NULL DEFAULT 5000,
            evergreen_min REAL NOT NULL DEFAULT 2500,
            rounding TEXT NOT NULL DEFAULT 'up' CHECK(rounding IN ('up', 'nearest')),
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);

        // Firm's own "manual estimate" minutes per unit of work, for the efficiency report (JSON).
        db.run(`ALTER TABLE matter_billing ADD COLUMN baselines TEXT`, () => {});

        // Client trust (IOLTA) ledger. Amounts are positive; kind gives direction.
        db.run(`
          CREATE TABLE IF NOT EXISTS trust_transactions (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            txn_date TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind IN ('deposit', 'applied', 'refund')),
            amount REAL NOT NULL CHECK(amount > 0),
            memo TEXT,
            invoice_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id)
          )
        `);

        // Monthly statements. Totals are frozen at issue time.
        db.run(`
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            number INTEGER NOT NULL,
            period_start TEXT,
            period_end TEXT,
            hours_total REAL NOT NULL,
            fees_total REAL NOT NULL,
            trust_applied REAL NOT NULL,
            amount_due REAL NOT NULL,
            trust_balance_after REAL NOT NULL,
            replenish_requested REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            UNIQUE(matter_id, number)
          )
        `);

        // Flags table
        db.run(`
          CREATE TABLE IF NOT EXISTS flags (
            id TEXT PRIMARY KEY,
            matter_id TEXT NOT NULL,
            bank_transaction_id TEXT,
            rule_type TEXT CHECK(rule_type IN ('large_transfer', 'undisclosed_account', 'round_trip', 'claude_qualitative')),
            severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),
            title TEXT,
            description TEXT,
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'reviewed', 'dismissed')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });
    });
  });
}

function getDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  DB_PATH
};
