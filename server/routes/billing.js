// Billing for one matter: activity captured while working in Veritas, draft
// time entries built from it, the retainer (client trust) ledger, and
// statements that draw fees from trust.
//
// Ethics guardrails built in:
// - Only active time is captured (the browser stops counting when idle or hidden).
// - Captured time becomes a DRAFT; only attorney-approved entries are billed.
// - Billed entries are frozen; corrections are write-offs, never deletions.
// - Every billed entry keeps a link to the timestamped activity behind it.
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router({ mergeParams: true });

// A new session starts after this much time with no activity.
const SESSION_GAP_MS = 15 * 60 * 1000;
// A session still receiving heartbeats this recently is left open.
const OPEN_SESSION_MS = 10 * 60 * 1000;
// Sessions shorter than this are logged but never billed.
const MIN_BILLABLE_SECONDS = 60;
// A heartbeat can cover a long span after the backend was unreachable.
const MAX_HEARTBEAT_SECONDS = 8 * 3600;

const ROLES = ['attorney', 'paralegal'];
const ENTRY_STATUSES = ['draft', 'approved', 'written_off'];

// UTBMS litigation task code for the page a session spent the most time on.
function taskCodeFor(page) {
  const p = String(page || '');
  if (/settlement/.test(p)) return 'L160';
  if (/case-intake|intake-questionnaire|case-detail/.test(p)) return 'L190';
  if (/discovery|document-hub|reconciliation|merchant|forensic|red-flags|audit/.test(p)) return 'L110';
  return 'L120';
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function db(req) {
  // Heartbeats from other tabs may be writing; wait briefly instead of failing.
  req.db.configure('busyTimeout', 3000);
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    req.db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    req.db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    req.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
  // Runs fn inside one transaction so a statement never half-applies.
  const tx = async (fn) => {
    await run('BEGIN IMMEDIATE');
    try { const out = await fn(); await run('COMMIT'); return out; }
    catch (e) { await run('ROLLBACK').catch(() => {}); throw e; }
  };
  return { run, get, all, tx };
}

const send500 = (res) => (err) => res.status(500).json({ error: err.message });

async function requireMatter(q, matterId) {
  return q.get('SELECT id, name, client_name, case_no, petitioner, respondent FROM matters WHERE id = ? AND deleted_at IS NULL', [matterId]);
}

async function loadSettings(q, matterId) {
  const row = await q.get('SELECT * FROM matter_billing WHERE matter_id = ?', [matterId]);
  return row || { matter_id: matterId, attorney_rate: 350, paralegal_rate: 150, retainer_amount: 5000, evergreen_min: 2500, rounding: 'up' };
}

function toTenths(seconds, rounding) {
  const tenths = seconds / 360;
  return Math.max(1, rounding === 'nearest' ? Math.round(tenths) : Math.ceil(tenths - 1e-9)) / 10;
}

// "Uploaded" x3 of "document" -> "uploaded 3 documents".
function describeActions(actions) {
  const counts = new Map();
  actions.forEach((a) => {
    const verb = String(a.verb || '').trim();
    if (!verb) return;
    const noun = String(a.noun || '').trim();
    const key = `${verb}\u0000${noun}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([key, n]) => {
    const [verb, noun] = key.split('\u0000');
    const v = verb.charAt(0).toLowerCase() + verb.slice(1);
    if (!noun) return n > 1 ? `${v} (${n}x)` : v;
    return `${v} ${n} ${n === 1 ? noun : `${noun.replace(/y$/, 'ie')}s`}`;
  });
}

function buildNarrative(rows) {
  const pages = new Map();
  rows.forEach((r) => {
    const label = r.page_label || r.page || 'Veritas';
    const p = pages.get(label) || { seconds: 0, actions: [] };
    p.seconds += r.active_seconds;
    try { p.actions.push(...(JSON.parse(r.actions || '[]') || [])); } catch (e) { /* ignore bad row */ }
    pages.set(label, p);
  });
  const parts = [...pages.entries()]
    .filter(([, p]) => p.seconds >= 30 || p.actions.length)
    .map(([label, p]) => {
      const did = describeActions(p.actions);
      return `${label}: ${did.length ? did.join(', ') : 'review and analysis'}`;
    });
  return parts.length ? `Reviewed and analyzed financial records. ${parts.join('. ')}.` : 'Reviewed and analyzed financial records.';
}

// ---------- Activity capture ----------

// POST /api/matters/:matterId/billing/activity — one heartbeat from the browser.
router.post('/activity', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const b = req.body || {};
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    const started = new Date(b.startedAt);
    const ended = new Date(b.endedAt);
    if (isNaN(started) || isNaN(ended) || ended < started) return res.status(400).json({ error: 'Invalid time range' });
    const span = (ended - started) / 1000;
    const activeSeconds = Math.max(0, Math.min(Math.round(Number(b.activeSeconds) || 0), Math.ceil(span) + 5, MAX_HEARTBEAT_SECONDS));
    const actions = (Array.isArray(b.actions) ? b.actions : []).slice(0, 200).map((a) => ({
      at: String(a.at || '').slice(0, 30),
      verb: String(a.verb || '').slice(0, 80),
      noun: String(a.noun || '').slice(0, 60),
      detail: String(a.detail || '').slice(0, 200),
    }));
    if (!activeSeconds && !actions.length) return res.json({ success: true, skipped: true });

    const userId = (req.user && req.user.id) || String(b.userId || 'user-unknown').slice(0, 100);
    const userName = (req.user && req.user.name) || String(b.userName || '').slice(0, 100) || null;
    const localDate = /^\d{4}-\d{2}-\d{2}$/.test(b.localDate || '') ? b.localDate : started.toISOString().slice(0, 10);
    await q.run(
      `INSERT INTO time_activity (id, matter_id, user_id, user_name, page, page_label, local_date, started_at, ended_at, active_seconds, actions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), matterId, userId, userName, String(b.page || '').slice(0, 120), String(b.pageLabel || '').slice(0, 120),
        localDate, started.toISOString(), ended.toISOString(), activeSeconds, JSON.stringify(actions)]
    );
    res.json({ success: true });
  } catch (err) { send500(res)(err); }
});

// GET /api/matters/:matterId/billing/activity/today?userId=&date= — for the timer chip.
router.get('/activity/today', (req, res) => {
  const q = db(req);
  const userId = (req.user && req.user.id) || req.query.userId || 'user-unknown';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  q.get('SELECT COALESCE(SUM(active_seconds), 0) AS seconds FROM time_activity WHERE matter_id = ? AND user_id = ? AND local_date = ?',
    [req.params.matterId, userId, date])
    .then((row) => res.json({ seconds: row.seconds }))
    .catch(send500(res));
});

// GET /api/matters/:matterId/billing/activity?days=14 — the detailed audit log.
router.get('/activity', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 120);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  db(req).all(
    `SELECT id, user_id, user_name, page, page_label, local_date, started_at, ended_at, active_seconds, actions, entry_id
     FROM time_activity WHERE matter_id = ? AND started_at >= ? ORDER BY started_at DESC LIMIT 5000`,
    [req.params.matterId, since]
  ).then((rows) => res.json(rows.map((r) => ({ ...r, actions: JSON.parse(r.actions || '[]') }))))
    .catch(send500(res));
});

// POST /api/matters/:matterId/billing/build-drafts — turn captured activity into
// draft time entries, one per work session. Open sessions wait unless includeOpen.
router.post('/build-drafts', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const includeOpen = req.body && req.body.includeOpen === true;
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    const settings = await loadSettings(q, matterId);
    const created = await q.tx(async () => {
      const rows = await q.all(
        'SELECT * FROM time_activity WHERE matter_id = ? AND entry_id IS NULL ORDER BY user_id, started_at', [matterId]);

      const sessions = [];
      let cur = null;
      rows.forEach((r) => {
        const gap = cur ? new Date(r.started_at) - new Date(cur.rows[cur.rows.length - 1].ended_at) : Infinity;
        if (!cur || cur.userId !== r.user_id || cur.date !== r.local_date || gap > SESSION_GAP_MS) {
          cur = { userId: r.user_id, userName: r.user_name, date: r.local_date, rows: [] };
          sessions.push(cur);
        }
        cur.rows.push(r);
      });

      const now = Date.now();
      const out = [];
      for (const s of sessions) {
        const last = s.rows[s.rows.length - 1];
        if (!includeOpen && now - new Date(last.ended_at) < OPEN_SESSION_MS) continue;
        const ids = s.rows.map((r) => r.id);
        const marks = ids.map(() => '?').join(',');
        const seconds = s.rows.reduce((sum, r) => sum + r.active_seconds, 0);
        if (seconds < MIN_BILLABLE_SECONDS) {
          await q.run(`UPDATE time_activity SET entry_id = 'below_minimum' WHERE id IN (${marks})`, ids);
          continue;
        }
        const byPage = {};
        s.rows.forEach((r) => { byPage[r.page] = (byPage[r.page] || 0) + r.active_seconds; });
        const mainPage = Object.keys(byPage).sort((a, b) => byPage[b] - byPage[a])[0];
        const entry = {
          id: uuidv4(),
          hours: toTenths(seconds, settings.rounding),
          narrative: buildNarrative(s.rows),
          task: taskCodeFor(mainPage),
        };
        await q.run(
          `INSERT INTO time_entries (id, matter_id, user_id, timekeeper, role, work_date, started_at, ended_at, active_seconds, hours, rate, task_code, narrative, status, source)
           VALUES (?, ?, ?, ?, 'attorney', ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'auto')`,
          [entry.id, matterId, s.userId, s.userName, s.date, s.rows[0].started_at, last.ended_at, seconds,
            entry.hours, settings.attorney_rate, entry.task, entry.narrative]
        );
        await q.run(`UPDATE time_activity SET entry_id = ? WHERE id IN (${marks})`, [entry.id, ...ids]);
        out.push(entry.id);
      }
      return out;
    });
    res.json({ success: true, created: created.length });
  } catch (err) { send500(res)(err); }
});

// ---------- Time entries ----------

// POST /api/matters/:matterId/billing/entries — manual entry (calls, court, work outside Veritas).
router.post('/entries', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const b = req.body || {};
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    const hours = Math.round(Number(b.hours) * 10) / 10;
    if (!(hours > 0) || hours > 24) return res.status(400).json({ error: 'Hours must be between 0.1 and 24' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.workDate || '')) return res.status(400).json({ error: 'workDate (YYYY-MM-DD) is required' });
    const narrative = String(b.narrative || '').trim();
    if (!narrative) return res.status(400).json({ error: 'A description of the work is required' });
    const role = ROLES.includes(b.role) ? b.role : 'attorney';
    const settings = await loadSettings(q, matterId);
    const rate = Number(b.rate) > 0 ? Number(b.rate) : settings[`${role}_rate`];
    const id = uuidv4();
    await q.run(
      `INSERT INTO time_entries (id, matter_id, user_id, timekeeper, role, work_date, hours, rate, task_code, narrative, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual')`,
      [id, matterId, (req.user && req.user.id) || b.userId || null, String(b.timekeeper || '').slice(0, 100) || null,
        role, b.workDate, hours, rate, String(b.taskCode || '').slice(0, 10) || null, narrative.slice(0, 2000)]
    );
    res.json({ success: true, id });
  } catch (err) { send500(res)(err); }
});

// PATCH /api/matters/:matterId/billing/entries/:entryId — edit, approve, or write off.
router.patch('/entries/:entryId', async (req, res) => {
  const q = db(req);
  const { matterId, entryId } = req.params;
  const b = req.body || {};
  try {
    const entry = await q.get('SELECT * FROM time_entries WHERE id = ? AND matter_id = ?', [entryId, matterId]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status === 'billed') return res.status(409).json({ error: 'Billed entries cannot be changed' });

    const next = { ...entry };
    if (b.hours != null) {
      const hours = Math.round(Number(b.hours) * 10) / 10;
      if (!(hours > 0) || hours > 24) return res.status(400).json({ error: 'Hours must be between 0.1 and 24' });
      next.hours = hours;
    }
    if (b.narrative != null) next.narrative = String(b.narrative).slice(0, 2000);
    if (b.taskCode != null) next.task_code = String(b.taskCode).slice(0, 10) || null;
    if (b.timekeeper != null) next.timekeeper = String(b.timekeeper).slice(0, 100) || null;
    if (b.role != null) {
      if (!ROLES.includes(b.role)) return res.status(400).json({ error: 'Invalid role' });
      if (b.role !== entry.role && b.rate == null) next.rate = (await loadSettings(q, matterId))[`${b.role}_rate`];
      next.role = b.role;
    }
    if (b.rate != null) {
      if (!(Number(b.rate) > 0)) return res.status(400).json({ error: 'Invalid rate' });
      next.rate = Number(b.rate);
    }
    if (b.status != null) {
      if (!ENTRY_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
      if (b.status === 'approved' && !String(next.narrative || '').trim()) return res.status(400).json({ error: 'Add a description before approving' });
      next.status = b.status;
      next.approved_at = b.status === 'approved' ? new Date().toISOString() : null;
    }
    await q.run(
      `UPDATE time_entries SET hours = ?, narrative = ?, task_code = ?, timekeeper = ?, role = ?, rate = ?, status = ?, approved_at = ? WHERE id = ?`,
      [next.hours, next.narrative, next.task_code, next.timekeeper, next.role, next.rate, next.status, next.approved_at, entryId]
    );
    res.json({ success: true });
  } catch (err) { send500(res)(err); }
});

// ---------- Fee terms & trust ----------

router.put('/settings', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const b = req.body || {};
  const num = (v, min = 0) => (Number.isFinite(Number(v)) && Number(v) >= min ? Number(v) : null);
  const s = {
    attorney_rate: num(b.attorneyRate, 1),
    paralegal_rate: num(b.paralegalRate, 1),
    retainer_amount: num(b.retainerAmount),
    evergreen_min: num(b.evergreenMin),
    rounding: b.rounding === 'nearest' ? 'nearest' : 'up',
  };
  if (Object.values(s).some((v) => v === null)) return res.status(400).json({ error: 'Rates must be positive and amounts zero or more' });
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    await q.run(
      `INSERT INTO matter_billing (matter_id, attorney_rate, paralegal_rate, retainer_amount, evergreen_min, rounding, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(matter_id) DO UPDATE SET attorney_rate = excluded.attorney_rate, paralegal_rate = excluded.paralegal_rate,
         retainer_amount = excluded.retainer_amount, evergreen_min = excluded.evergreen_min, rounding = excluded.rounding,
         updated_at = CURRENT_TIMESTAMP`,
      [matterId, s.attorney_rate, s.paralegal_rate, s.retainer_amount, s.evergreen_min, s.rounding]
    );
    res.json({ success: true });
  } catch (err) { send500(res)(err); }
});

async function trustBalance(q, matterId) {
  const row = await q.get(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END), 0) AS balance
     FROM trust_transactions WHERE matter_id = ?`, [matterId]);
  return round2(row.balance);
}

// POST /api/matters/:matterId/billing/trust — record a retainer deposit or refund.
// Fees leave trust only through a statement (see /invoices).
router.post('/trust', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const b = req.body || {};
  const amount = round2(b.amount);
  if (!['deposit', 'refund'].includes(b.kind)) return res.status(400).json({ error: 'kind must be deposit or refund' });
  if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be more than zero' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    await q.tx(async () => {
      if (b.kind === 'refund' && amount > await trustBalance(q, matterId)) throw Object.assign(new Error('Refund is more than the trust balance'), { status: 400 });
      await q.run('INSERT INTO trust_transactions (id, matter_id, txn_date, kind, amount, memo) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), matterId, b.date, b.kind, amount, String(b.memo || '').slice(0, 300) || null]);
    });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ---------- Statements ----------

// POST /api/matters/:matterId/billing/invoices — bill every approved entry
// (through `through` if given), pay it from trust as far as the balance goes.
router.post('/invoices', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const through = /^\d{4}-\d{2}-\d{2}$/.test((req.body || {}).through || '') ? req.body.through : '9999-12-31';
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    const settings = await loadSettings(q, matterId);
    const invoiceId = await q.tx(async () => {
      const entries = await q.all(
        `SELECT * FROM time_entries WHERE matter_id = ? AND status = 'approved' AND work_date <= ? ORDER BY work_date, started_at`,
        [matterId, through]);
      if (!entries.length) throw Object.assign(new Error('No approved entries to bill'), { status: 400 });

      const fees = round2(entries.reduce((s, e) => s + round2(e.hours * e.rate), 0));
      const hours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 10) / 10;
      const balance = await trustBalance(q, matterId);
      const applied = round2(Math.min(Math.max(balance, 0), fees));
      const after = round2(balance - applied);
      const due = round2(fees - applied);
      // Evergreen: when trust falls below the minimum, ask the client to bring
      // it back up to the retainer amount (plus anything trust did not cover).
      const replenish = after < settings.evergreen_min ? round2(settings.retainer_amount - after + due) : due;
      const { n } = await q.get('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices WHERE matter_id = ?', [matterId]);
      const id = uuidv4();
      const today = new Date().toISOString().slice(0, 10);

      await q.run(
        `INSERT INTO invoices (id, matter_id, number, period_start, period_end, hours_total, fees_total, trust_applied, amount_due, trust_balance_after, replenish_requested)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, matterId, n, entries[0].work_date, entries[entries.length - 1].work_date, hours, fees, applied, due, after, replenish]);
      if (applied > 0) {
        await q.run('INSERT INTO trust_transactions (id, matter_id, txn_date, kind, amount, memo, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), matterId, today, 'applied', applied, `Applied to statement #${n}`, id]);
      }
      const marks = entries.map(() => '?').join(',');
      await q.run(`UPDATE time_entries SET status = 'billed', invoice_id = ? WHERE id IN (${marks})`, [id, ...entries.map((e) => e.id)]);
      return id;
    });
    res.json({ success: true, id: invoiceId });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// GET /api/matters/:matterId/billing/invoices/:invoiceId — everything a printed statement needs.
router.get('/invoices/:invoiceId', async (req, res) => {
  const q = db(req);
  const { matterId, invoiceId } = req.params;
  try {
    const invoice = await q.get('SELECT * FROM invoices WHERE id = ? AND matter_id = ?', [invoiceId, matterId]);
    if (!invoice) return res.status(404).json({ error: 'Statement not found' });
    const [matter, entries, trust] = await Promise.all([
      requireMatter(q, matterId),
      q.all('SELECT * FROM time_entries WHERE invoice_id = ? ORDER BY work_date, started_at', [invoiceId]),
      q.all('SELECT * FROM trust_transactions WHERE matter_id = ? AND created_at <= (SELECT created_at FROM invoices WHERE id = ?) ORDER BY txn_date, created_at', [matterId, invoiceId]),
    ]);
    res.json({ invoice, matter, entries, trust });
  } catch (err) { send500(res)(err); }
});

// LEDES 1998B — the standard e-billing text format clients and billing
// systems import. One fee line per entry; fields are pipe-delimited and each
// line ends with "[]".
router.get('/invoices/:invoiceId/ledes', async (req, res) => {
  const q = db(req);
  const { matterId, invoiceId } = req.params;
  try {
    const invoice = await q.get('SELECT * FROM invoices WHERE id = ? AND matter_id = ?', [invoiceId, matterId]);
    if (!invoice) return res.status(404).json({ error: 'Statement not found' });
    const [matter, entries] = await Promise.all([
      q.get('SELECT * FROM matters WHERE id = ?', [matterId]),
      q.all('SELECT * FROM time_entries WHERE invoice_id = ? ORDER BY work_date, started_at', [invoiceId]),
    ]);
    const clean = (s) => String(s ?? '').replace(/[|\r\n[\]]+/g, ' ').trim();
    const ymd = (s) => String(s || '').slice(0, 10).replace(/-/g, '');
    const CLASS = { attorney: 'PT', paralegal: 'PL' };
    const head = ['INVOICE_DATE', 'INVOICE_NUMBER', 'CLIENT_ID', 'LAW_FIRM_MATTER_ID', 'INVOICE_TOTAL', 'BILLING_START_DATE', 'BILLING_END_DATE',
      'INVOICE_DESCRIPTION', 'LINE_ITEM_NUMBER', 'EXP/FEE/INV_ADJ_TYPE', 'LINE_ITEM_NUMBER_OF_UNITS', 'LINE_ITEM_ADJUSTMENT_AMOUNT', 'LINE_ITEM_TOTAL',
      'LINE_ITEM_DATE', 'LINE_ITEM_TASK_CODE', 'LINE_ITEM_EXPENSE_CODE', 'LINE_ITEM_ACTIVITY_CODE', 'TIMEKEEPER_ID', 'LINE_ITEM_DESCRIPTION',
      'LAW_FIRM_ID', 'LINE_ITEM_UNIT_COST', 'TIMEKEEPER_NAME', 'TIMEKEEPER_CLASSIFICATION', 'CLIENT_MATTER_ID'];
    const rows = entries.map((e, i) => [
      ymd(invoice.created_at), invoice.number, clean(matter.client_name || matter.name), clean(matter.case_no || matter.id), invoice.fees_total.toFixed(2),
      ymd(invoice.period_start), ymd(invoice.period_end), `Statement ${invoice.number}`, i + 1, 'F', e.hours.toFixed(1), '0.00',
      round2(e.hours * e.rate).toFixed(2), ymd(e.work_date), clean(e.task_code), '', '', clean(e.user_id || e.timekeeper), clean(e.narrative),
      clean(matter.firm_id), e.rate.toFixed(2), clean(e.timekeeper), CLASS[e.role] || 'OT', clean(matter.id),
    ].join('|'));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${invoice.number}-ledes1998b.txt"`);
    res.send(['LEDES1998B[]', `${head.join('|')}[]`, ...rows.map((r) => `${r}[]`)].join('\r\n'));
  } catch (err) { send500(res)(err); }
});

// ---------- Efficiency report ----------

// Minutes the firm estimates each unit of work takes by hand. The firm should
// set these from its own experience; the report labels them as estimates.
const DEFAULT_BASELINES = { document: 5, transaction: 0.5, incomeDoc: 15 };

// Which Veritas pages count toward each kind of work.
const WORK_GROUPS = [
  { key: 'intake', label: 'Document intake and organization', re: /^(discovery-|document-hub-(?!income|expenses)|document-reconciliation|case-)/ },
  { key: 'transactions', label: 'Bank and card statement analysis (expenses, AFI, tracing)', re: /^(document-hub-expenses|merchant-|afi|cashflow|forensic|red-flags|audit-)/ },
  { key: 'income', label: 'Income analysis and support calculations', re: /^(document-hub-income|income-|spousal|child-support|credits)/ },
  { key: 'property', label: 'Property division and equity compensation (RSU)', re: /^(rsu|equitable|settlement|estate)/ },
];

router.get('/efficiency', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  try {
    const matter = await requireMatter(q, matterId);
    if (!matter) return res.status(404).json({ error: 'Matter not found' });
    const [settings, docs, statements, txns, incomeDocs, pages] = await Promise.all([
      q.get('SELECT * FROM matter_billing WHERE matter_id = ?', [matterId]),
      q.get('SELECT COUNT(*) AS n FROM documents WHERE matter_id = ? AND deleted_at IS NULL', [matterId]),
      q.get(`SELECT COUNT(*) AS n FROM bank_statements WHERE matter_id = ? AND processing_status = 'completed'`, [matterId]),
      q.get('SELECT COUNT(*) AS n FROM bank_transactions bt JOIN bank_statements bs ON bs.id = bt.bank_statement_id WHERE bs.matter_id = ?', [matterId]),
      q.get(`SELECT COUNT(*) AS n FROM income_evidence_reviews WHERE matter_id = ? AND status IN ('accepted', 'rejected')`, [matterId]),
      q.all('SELECT page, SUM(active_seconds) AS seconds FROM time_activity WHERE matter_id = ? GROUP BY page', [matterId]),
    ]);
    let baselines = { ...DEFAULT_BASELINES };
    try { Object.assign(baselines, JSON.parse((settings && settings.baselines) || '{}')); } catch (e) { /* defaults */ }
    const seconds = Object.fromEntries(WORK_GROUPS.map((g) => [g.key, 0]));
    let other = 0;
    pages.forEach((p) => {
      const g = WORK_GROUPS.find((x) => x.re.test(p.page || ''));
      if (g) seconds[g.key] += p.seconds; else other += p.seconds;
    });
    res.json({
      matter,
      rate: (settings && settings.attorney_rate) || 350,
      baselines,
      volumes: { documents: docs.n, statements: statements.n, transactions: txns.n, incomeDocs: incomeDocs.n },
      groups: WORK_GROUPS.map((g) => ({ key: g.key, label: g.label, seconds: seconds[g.key] })),
      otherSeconds: other,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { send500(res)(err); }
});

router.put('/efficiency/baselines', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  const b = req.body || {};
  const out = {};
  for (const k of Object.keys(DEFAULT_BASELINES)) {
    const v = Number(b[k]);
    if (!(v >= 0) || v > 600) return res.status(400).json({ error: `Invalid minutes for ${k}` });
    out[k] = v;
  }
  try {
    if (!(await requireMatter(q, matterId))) return res.status(404).json({ error: 'Matter not found' });
    await q.run(`INSERT INTO matter_billing (matter_id, baselines) VALUES (?, ?)
                 ON CONFLICT(matter_id) DO UPDATE SET baselines = excluded.baselines, updated_at = CURRENT_TIMESTAMP`, [matterId, JSON.stringify(out)]);
    res.json({ success: true });
  } catch (err) { send500(res)(err); }
});

// ---------- Summary for the Billing & Trust page ----------

router.get('/summary', async (req, res) => {
  const q = db(req);
  const { matterId } = req.params;
  try {
    const matter = await requireMatter(q, matterId);
    if (!matter) return res.status(404).json({ error: 'Matter not found' });
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [settings, balance, trust, entries, invoices, uncaptured, recent] = await Promise.all([
      loadSettings(q, matterId),
      trustBalance(q, matterId),
      q.all('SELECT * FROM trust_transactions WHERE matter_id = ? ORDER BY txn_date DESC, created_at DESC', [matterId]),
      q.all(`SELECT * FROM time_entries WHERE matter_id = ? AND (status != 'billed' OR work_date >= ?) ORDER BY work_date DESC, started_at DESC`, [matterId, since30]),
      q.all('SELECT * FROM invoices WHERE matter_id = ? ORDER BY number DESC', [matterId]),
      q.get('SELECT COALESCE(SUM(active_seconds), 0) AS seconds, COUNT(*) AS beats FROM time_activity WHERE matter_id = ? AND entry_id IS NULL', [matterId]),
      q.get(`SELECT COALESCE(SUM(hours * rate), 0) AS fees FROM time_entries WHERE matter_id = ? AND status IN ('draft', 'approved', 'billed') AND work_date >= ?`, [matterId, since30]),
    ]);

    const amountOf = (e) => round2(e.hours * e.rate);
    const sumWhere = (status) => round2(entries.filter((e) => e.status === status).reduce((s, e) => s + amountOf(e), 0));
    const wip = { draft: sumWhere('draft'), approved: sumWhere('approved') };
    wip.total = round2(wip.draft + wip.approved);
    const available = round2(balance - wip.total);
    const burnPerDay = round2(recent.fees / 30);
    const daysLeft = burnPerDay > 0 ? Math.max(0, Math.floor(available / burnPerDay)) : null;

    res.json({
      matter,
      settings,
      trust: { balance, available, ledger: trust },
      wip,
      burn: {
        last30Fees: round2(recent.fees),
        perDay: burnPerDay,
        daysLeft,
        depletesOn: daysLeft != null ? new Date(Date.now() + daysLeft * 86400000).toISOString().slice(0, 10) : null,
      },
      alerts: {
        workingAtRisk: wip.total > balance,
        belowEvergreen: available < settings.evergreen_min,
        replenishSuggested: round2(Math.max(0, settings.retainer_amount - available)),
      },
      uncapturedMinutes: Math.round(uncaptured.seconds / 60),
      entries: entries.map((e) => ({ ...e, amount: amountOf(e) })),
      invoices,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { send500(res)(err); }
});

module.exports = router;
