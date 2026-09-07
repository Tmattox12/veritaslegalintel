const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getOriginal } = require('../server/services/storage');
const { extractText } = require('../server/services/file-extractor');

const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));
const targets = ['2023.08 Acct 3063.pdf', '2024.01 Acct 3063.pdf', '2025.05 Ws Chase Savings, 1874.pdf'];

db.all(
  `SELECT filename, s3_key FROM documents WHERE filename IN (${targets.map(() => '?').join(',')})`,
  targets,
  async (error, documents) => {
    if (error) throw error;
    for (const document of documents) {
      const buffer = await getOriginal(document.s3_key);
      const result = await extractText({ originalname: document.filename, buffer });
      console.log(`\n=== ${document.filename} ===`);
      console.log((result.text || '[NO TEXT]').slice(0, 2500));
    }
    db.close();
  }
);
