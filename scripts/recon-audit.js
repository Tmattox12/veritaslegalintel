// Opens every page in headless Chrome for one matter and reports, for each figure,
// whether its recon ties. Read-only: audit mode blocks the page from saving anything
// and turns off billing time capture.
//
//   node scripts/recon-audit.js --base http://localhost:3001 --matter <id> [--pages a.html,b.html] [--out file.json] [--fill]
//   --fill puts test values in empty fields so calculators run. Nothing is saved to the server.
//
// Output can contain client figures. Keep --out outside the repository.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const BASE = arg('base', 'http://localhost:3001');
const MATTER = arg('matter');
const OUT = arg('out');
const ROOT = path.join(__dirname, '..');
if (!MATTER) { console.error('--matter is required'); process.exit(1); }

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found'); process.exit(1); }

// Not pages a person reads figures on: a review checklist, an included fragment, a redirect.
const SKIP = new Set(['_page-review.html', 'sidebar.html', 'doc-link-modal.html', 'document-reconciliation-hub.html']);
const pages = arg('pages') ? arg('pages').split(',') : fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !SKIP.has(f)).sort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-audit-'));

const BAD = new Set(['difference', 'unexplained', 'nottied', 'error']);
const totals = {};
const results = [];

function auditPage(page) {
  const url = `${BASE}/${page}?matter=${encodeURIComponent(MATTER)}&reconAudit=1${process.argv.includes('--fill') ? '&reconFill=1' : ''}`;
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--virtual-time-budget=45000', '--timeout=90000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
  const m = (r.stdout || '').match(/<pre id="vrAuditResult"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) return { page, count: 0, numbers: [], failed: 'no audit result (page did not load recon.js or did not finish)' };
  const decoded = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return JSON.parse(decoded);
}

for (const page of pages) {
  const res = auditPage(page);
  const counts = {};
  (res.numbers || []).forEach((n) => { counts[n.status] = (counts[n.status] || 0) + 1; totals[n.status] = (totals[n.status] || 0) + 1; });
  results.push({ ...res, counts });
  const bad = Object.keys(counts).filter((k) => BAD.has(k)).reduce((a, k) => a + counts[k], 0);
  console.log(`${res.failed ? 'FAIL' : bad ? 'OPEN' : 'ok  '} ${page.padEnd(38)} ${String(res.count).padStart(5)} figures  ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')}${res.failed ? ` ${res.failed}` : ''}`);
}
console.log('\nTOTAL', JSON.stringify(totals));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
fs.rmSync(profile, { recursive: true, force: true });
