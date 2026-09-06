const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));

db.serialize(() => {
  db.run('DELETE FROM documents WHERE matter_id NOT IN (SELECT id FROM matters)');
  db.run('DELETE FROM bank_statements WHERE matter_id NOT IN (SELECT id FROM matters)');
  db.run('DELETE FROM bank_transactions WHERE bank_statement_id NOT IN (SELECT id FROM bank_statements)');
  db.run('DELETE FROM income_items WHERE matter_id NOT IN (SELECT id FROM matters)');
  db.run('DELETE FROM flags WHERE matter_id NOT IN (SELECT id FROM matters)');
});
db.close(() => console.log('orphans removed'));
