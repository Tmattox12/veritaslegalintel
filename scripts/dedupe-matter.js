const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../.data/veritas.sqlite'));

const KEEP_MATTER = '6cdff522-2dac-4731-926e-f159da6e29e9'; // the one with docs

function all(sql, p = []) { return new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r))); }
function run(sql, p = []) { return new Promise((res, rej) => db.run(sql, p, (e) => e ? rej(e) : res())); }

(async () => {
  // 1. Remove the empty duplicate matter
  const matters = await all('SELECT id, name FROM matters');
  console.log('matters before:', matters.map(m => m.id.slice(0, 8)).join(', '));
  for (const m of matters) {
    if (m.id !== KEEP_MATTER) {
      await run('DELETE FROM matters WHERE id = ?', [m.id]);
      console.log('deleted duplicate matter', m.id.slice(0, 8));
    }
  }

  // 2. Dedupe documents within the kept matter by filename (keep the first of each)
  const docs = await all('SELECT id, filename FROM documents WHERE matter_id = ? ORDER BY uploaded_at ASC', [KEEP_MATTER]);
  const seen = new Map();
  const dupDocIds = [];
  for (const d of docs) {
    if (seen.has(d.filename)) dupDocIds.push(d.id);
    else seen.set(d.filename, d.id);
  }
  console.log('duplicate docs to remove:', dupDocIds.length);

  // 3. For each duplicate document, delete its bank_statements (+ their transactions) and the doc
  for (const docId of dupDocIds) {
    const stmts = await all('SELECT id FROM bank_statements WHERE document_id = ?', [docId]);
    for (const s of stmts) {
      await run('DELETE FROM bank_transactions WHERE bank_statement_id = ?', [s.id]);
      await run('DELETE FROM income_items WHERE bank_transaction_id NOT IN (SELECT id FROM bank_transactions)');
    }
    await run('DELETE FROM bank_statements WHERE document_id = ?', [docId]);
    await run('DELETE FROM documents WHERE id = ?', [docId]);
  }

  const finalDocs = await all('SELECT COUNT(*) c FROM documents WHERE matter_id = ?', [KEEP_MATTER]);
  const finalStmts = await all('SELECT COUNT(*) c FROM bank_statements WHERE matter_id = ?', [KEEP_MATTER]);
  const finalTx = await all('SELECT COUNT(*) c FROM bank_transactions WHERE bank_statement_id IN (SELECT id FROM bank_statements WHERE matter_id = ?)', [KEEP_MATTER]);
  console.log(`AFTER: docs=${finalDocs[0].c} statements=${finalStmts[0].c} transactions=${finalTx[0].c}`);
  db.close();
})().catch((e) => { console.error(e); db.close(); });
