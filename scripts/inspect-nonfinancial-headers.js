const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getOriginal } = require('../server/services/storage');
const { extractText } = require('../server/services/file-extractor');

const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));
const patterns = ['Fleet Feet', 'Helping Hearts', 'SS ', 'Disclosure', 'IEP', 'Preliminary Report', 'Screenshot'];

db.all('SELECT filename, s3_key FROM documents WHERE s3_key IS NOT NULL', async (error, documents) => {
  if (error) throw error;
  for (const document of documents.filter((doc) => patterns.some((p) => doc.filename.includes(p)))) {
    const buffer = await getOriginal(document.s3_key);
    const result = await extractText({ originalname: document.filename, buffer });
    console.log(`\n=== ${document.filename} ===`);
    console.log((result.text || '[NO TEXT LAYER]').slice(0, 1800));
  }
  db.close();
});
