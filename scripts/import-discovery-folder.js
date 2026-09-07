/*
 * Reliable local importer for a discovery source folder.
 *
 * Usage:
 *   node scripts/import-discovery-folder.js
 *
 * Optional env overrides:
 *   DISCOVERY_FOLDER="C:\\path\\to\\folder"
 *   MATTER_ID="matter-id"
 *   API_BASE="http://localhost:3000/api"
 *
 * It reads source PDFs from the local disk, skips existing filenames, lets the
 * server enforce filename + SHA-256 content deduplication, retries failures,
 * and writes a local reconciliation report under .data/ (gitignored).
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const SOURCE_FOLDER = process.env.DISCOVERY_FOLDER || 'C:\\Users\\tamar\\OneDrive\\Documents\\Constanza\\discovery\\Bank Statemetns';
const REPORT_FILE = path.join(__dirname, '../.data/discovery-import-report.json');
const ALLOWED = new Set(['.pdf', '.csv', '.txt', '.xlsx', '.xls', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif']);

function allFiles(folder) {
  const result = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...allFiles(full));
    else if (ALLOWED.has(path.extname(entry.name).toLowerCase())) result.push(full);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`);
  return body;
}

async function findMatterId() {
  if (process.env.MATTER_ID) return process.env.MATTER_ID;
  const matters = await json(`${API_BASE}/matters`);
  if (!matters.length) throw new Error('No active matter exists. Complete Case Intake first or set MATTER_ID.');
  return matters[0].id;
}

async function upload(filePath, matterId) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), path.basename(filePath));
  form.append('userId', 'local-import');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    return await json(`${API_BASE}/matters/${matterId}/documents/upload`, {
      method: 'POST', body: form, signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadWithRetry(filePath, matterId) {
  let failure;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await upload(filePath, matterId);
    } catch (error) {
      failure = error;
      if (attempt === 1) console.log(`  retrying: ${path.basename(filePath)} (${error.message})`);
    }
  }
  throw failure;
}

(async () => {
  if (!fs.existsSync(SOURCE_FOLDER)) throw new Error(`Source folder does not exist: ${SOURCE_FOLDER}`);

  const matterId = await findMatterId();
  const files = allFiles(SOURCE_FOLDER);
  const existing = await json(`${API_BASE}/matters/${matterId}/documents`);
  const existingNames = new Set(existing.map((d) => d.filename.toLowerCase()));
  const missing = files.filter((file) => !existingNames.has(path.basename(file).toLowerCase()));

  console.log(`Source files: ${files.length}`);
  console.log(`Already stored: ${files.length - missing.length}`);
  console.log(`To import: ${missing.length}`);

  const report = {
    startedAt: new Date().toISOString(), sourceFolder: SOURCE_FOLDER, matterId,
    sourceCount: files.length, alreadyStored: files.length - missing.length,
    uploaded: [], duplicates: [], failed: [],
  };

  for (let index = 0; index < missing.length; index++) {
    const file = missing[index];
    const name = path.basename(file);
    process.stdout.write(`[${index + 1}/${missing.length}] ${name} ... `);
    try {
      const result = await uploadWithRetry(file, matterId);
      if (result.duplicate) {
        report.duplicates.push(name);
        console.log('already present');
      } else {
        report.uploaded.push({ name, category: result.category, transactionCount: result.transactionCount || 0, ocrNeeded: !!result.ocrNeeded });
        console.log(`${result.category || 'Other'}${result.ocrNeeded ? ' (review required)' : ''}`);
      }
    } catch (error) {
      report.failed.push({ name, error: error.message });
      console.log(`FAILED: ${error.message}`);
    }
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  }

  const finalDocs = await json(`${API_BASE}/matters/${matterId}/documents`);
  const finalNames = new Set(finalDocs.map((d) => d.filename.toLowerCase()));
  const stillMissing = files.map((f) => path.basename(f)).filter((name) => !finalNames.has(name.toLowerCase()));
  report.completedAt = new Date().toISOString();
  report.finalStoredCount = finalDocs.length;
  report.stillMissing = stillMissing;
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log('\n--- Reconciliation ---');
  console.log(`Source: ${files.length}`);
  console.log(`Stored: ${finalDocs.length}`);
  console.log(`Uploaded this run: ${report.uploaded.length}`);
  console.log(`Already present: ${report.duplicates.length + report.alreadyStored}`);
  console.log(`Failed: ${report.failed.length}`);
  console.log(`Still missing: ${stillMissing.length}`);
  console.log(`Report: ${REPORT_FILE}`);
  if (stillMissing.length) console.log(stillMissing.join('\n'));
})();
