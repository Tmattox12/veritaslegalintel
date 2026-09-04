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
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
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
