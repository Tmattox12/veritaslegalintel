const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));

const tables = ['bank_transactions', 'bank_statements', 'income_items', 'flags', 'documents', 'matter_assignments', 'matters', 'users'];

db.serialize(() => {
  tables.forEach((t) => {
    db.run(`DELETE FROM ${t}`, (err) => {
      if (err) console.error(`Error clearing ${t}:`, err.message);
      else console.log(`cleared ${t}`);
    });
  });
});

db.close(() => console.log('DONE - database is empty'));
