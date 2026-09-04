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
