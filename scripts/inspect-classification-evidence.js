const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getOriginal } = require('../server/services/storage');
const { extractText } = require('../server/services/file-extractor');

const targets = ['2024.03 Acct 3063.pdf', '2024.12 Ws Edward Jones Acct..pdf', 'Preliminary Report in Ossandon Matter, Miessner 3.13.26.pdf'];
const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));
db.all(`SELECT filename, s3_key FROM documents WHERE filename IN (${targets.map(() => '?').join(',')})`, targets, async (error, docs) => {
  if (error) throw error;
  for (const doc of docs) {
    const buffer = await getOriginal(doc.s3_key);
    const { text } = await extractText({ originalname: doc.filename, buffer });
    console.log(`\n=== ${doc.filename} ===\n${(text || '').slice(0, 3000)}`);
  }
  db.close();
});
