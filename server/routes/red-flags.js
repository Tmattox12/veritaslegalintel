// Red flags for one matter: findings the legal team writes up (each with the
// facts, impact, and what to request), plus the report wording used for the
// judge summary. Findings detected automatically from the documents (missing
// required documents, statement gaps) come from /documents/gap-analysis instead.
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router({ mergeParams: true });

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'on_file'];
const CATEGORIES = ['disclosure', 'income', 'spending', 'expert', 'conduct', 'other'];
const STATUSES = ['open', 'resolved'];
const TEXT_MAX = 20000;
const SHORT_MAX = 300;

function q(req) {
  req.db.configure('busyTimeout', 3000);
  return {
    run: (sql, p = []) => new Promise((ok, no) => req.db.run(sql, p, function (e) { e ? no(e) : ok(this); })),
    get: (sql, p = []) => new Promise((ok, no) => req.db.get(sql, p, (e, r) => e ? no(e) : ok(r))),
    all: (sql, p = []) => new Promise((ok, no) => req.db.all(sql, p, (e, r) => e ? no(e) : ok(r || []))),
  };
}

let tablesReady = null;
function ensureTables(db) {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.run(`CREATE TABLE IF NOT EXISTS red_flag_findings (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'high',
        category TEXT NOT NULL DEFAULT 'disclosure',
        title TEXT NOT NULL,
        headline TEXT,
        detail TEXT,
        facts TEXT,
        impact TEXT,
        action TEXT,
        request TEXT,
        source TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        in_summary INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (matter_id) REFERENCES matters(id)
      )`);
      await db.run('CREATE INDEX IF NOT EXISTS ix_red_flag_findings_matter ON red_flag_findings(matter_id, sort_order)');
      await db.run(`CREATE TABLE IF NOT EXISTS red_flag_reports (
        matter_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (matter_id) REFERENCES matters(id)
      )`);
    })().catch((e) => { tablesReady = null; throw e; });
  }
  return tablesReady;
}

const str = (v, max) => String(v == null ? '' : v).slice(0, max);

// Facts are short label/value pairs shown under a finding.
function cleanFacts(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 12)
    .map((f) => ({ label: str(f && f.label, SHORT_MAX).trim(), value: str(f && f.value, SHORT_MAX).trim() }))
    .filter((f) => f.label || f.value);
}

// Returns { row } with only valid fields, or { error }.
function cleanFinding(body, partial) {
  const b = body || {};
  const row = {};
  if (!partial || 'title' in b) {
    row.title = str(b.title, SHORT_MAX).trim();
    if (!row.title) return { error: 'Title is required' };
  }
  if (!partial || 'severity' in b) {
    row.severity = SEVERITIES.includes(b.severity) ? b.severity : null;
    if (!row.severity) return { error: 'Invalid severity' };
  }
  if (!partial || 'category' in b) {
    row.category = CATEGORIES.includes(b.category) ? b.category : null;
    if (!row.category) return { error: 'Invalid category' };
  }
  if (!partial || 'status' in b) {
    row.status = STATUSES.includes(b.status || 'open') ? (b.status || 'open') : null;
    if (!row.status) return { error: 'Invalid status' };
  }
  for (const k of ['headline', 'source']) if (!partial || k in b) row[k] = str(b[k], SHORT_MAX).trim();
  for (const k of ['detail', 'impact', 'action', 'request']) if (!partial || k in b) row[k] = str(b[k], TEXT_MAX).trim();
  if (!partial || 'facts' in b) row.facts = JSON.stringify(cleanFacts(b.facts));
  if (!partial || 'inSummary' in b) row.in_summary = b.inSummary === false ? 0 : 1;
  if ('sortOrder' in b) {
    const n = Number(b.sortOrder);
    if (!Number.isInteger(n)) return { error: 'Invalid sort order' };
    row.sort_order = n;
  }
  return { row };
}

function toApi(r) {
  let facts = [];
  try { facts = JSON.parse(r.facts || '[]'); } catch (e) { facts = []; }
  return {
    id: r.id, severity: r.severity, category: r.category, title: r.title, headline: r.headline || '',
    detail: r.detail || '', facts, impact: r.impact || '', action: r.action || '', request: r.request || '',
    source: r.source || '', status: r.status, inSummary: !!r.in_summary, sortOrder: r.sort_order,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function cleanReport(b) {
  const r = b || {};
  return {
    intro: str(r.intro, TEXT_MAX).trim(),
    subjectParty: ['a', 'b', ''].includes(r.subjectParty) ? r.subjectParty : '',
    reportDate: /^\d{4}-\d{2}-\d{2}$/.test(r.reportDate || '') ? r.reportDate : '',
    periodReviewed: str(r.periodReviewed, SHORT_MAX).trim(),
    conclusionLabel: str(r.conclusionLabel, SHORT_MAX).trim(),
    conclusionTitle: str(r.conclusionTitle, SHORT_MAX).trim(),
    conclusionText: str(r.conclusionText, TEXT_MAX).trim(),
    recommendations: (Array.isArray(r.recommendations) ? r.recommendations : []).slice(0, 30)
      .map((x) => ({ title: str(x && x.title, SHORT_MAX).trim(), text: str(x && x.text, TEXT_MAX).trim() }))
      .filter((x) => x.title || x.text),
  };
}

async function setup(req, res) {
  const db = q(req);
  await ensureTables(db);
  const m = await db.get('SELECT id FROM matters WHERE id = ? AND deleted_at IS NULL', [req.params.matterId]);
  if (!m) { res.status(404).json({ error: 'Matter not found' }); return null; }
  return db;
}

const fail = (res) => (e) => res.status(500).json({ error: e.message });

// GET /api/matters/:matterId/red-flags
router.get('/', (req, res) => (async () => {
  const db = await setup(req, res); if (!db) return;
  const rows = await db.all('SELECT * FROM red_flag_findings WHERE matter_id = ? ORDER BY sort_order, created_at', [req.params.matterId]);
  const rep = await db.get('SELECT data FROM red_flag_reports WHERE matter_id = ?', [req.params.matterId]);
  let report = cleanReport({});
  if (rep) { try { report = cleanReport(JSON.parse(rep.data)); } catch (e) { /* keep default */ } }
  res.json({ findings: rows.map(toApi), report });
})().catch(fail(res)));

// POST /api/matters/:matterId/red-flags/findings
router.post('/findings', (req, res) => (async () => {
  const db = await setup(req, res); if (!db) return;
  const { row, error } = cleanFinding(req.body, false);
  if (error) return res.status(400).json({ error });
  if (row.sort_order == null) {
    const mx = await db.get('SELECT MAX(sort_order) m FROM red_flag_findings WHERE matter_id = ?', [req.params.matterId]);
    row.sort_order = ((mx && mx.m) || 0) + 10;
  }
  const id = uuidv4();
  const cols = Object.keys(row);
  await db.run(`INSERT INTO red_flag_findings (id, matter_id, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`,
    [id, req.params.matterId, ...cols.map((c) => row[c])]);
  res.status(201).json(toApi(await db.get('SELECT * FROM red_flag_findings WHERE id = ?', [id])));
})().catch(fail(res)));

// PUT /api/matters/:matterId/red-flags/findings/:id  (only the fields sent change)
router.put('/findings/:id', (req, res) => (async () => {
  const db = await setup(req, res); if (!db) return;
  const { row, error } = cleanFinding(req.body, true);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(row);
  if (!cols.length) return res.status(400).json({ error: 'Nothing to update' });
  const r = await db.run(`UPDATE red_flag_findings SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND matter_id = ?`,
    [...cols.map((c) => row[c]), req.params.id, req.params.matterId]);
  if (!r.changes) return res.status(404).json({ error: 'Finding not found' });
  res.json(toApi(await db.get('SELECT * FROM red_flag_findings WHERE id = ?', [req.params.id])));
})().catch(fail(res)));

// DELETE /api/matters/:matterId/red-flags/findings/:id
router.delete('/findings/:id', (req, res) => (async () => {
  const db = await setup(req, res); if (!db) return;
  const r = await db.run('DELETE FROM red_flag_findings WHERE id = ? AND matter_id = ?', [req.params.id, req.params.matterId]);
  if (!r.changes) return res.status(404).json({ error: 'Finding not found' });
  res.json({ deleted: true });
})().catch(fail(res)));

// PUT /api/matters/:matterId/red-flags/report
router.put('/report', (req, res) => (async () => {
  const db = await setup(req, res); if (!db) return;
  const report = cleanReport(req.body);
  await db.run(`INSERT INTO red_flag_reports (matter_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(matter_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
    [req.params.matterId, JSON.stringify(report)]);
  res.json(report);
})().catch(fail(res)));

module.exports = router;
