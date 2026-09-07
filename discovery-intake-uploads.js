/* Discovery Intake — upload, auto-categorize, render category buckets & stats. */

const API_BASE = window.API_BASE || 'http://localhost:3000/api';
const BUCKETS = ['financial', 'income', 'property', 'legal', 'disclosure', 'other'];
const BUCKET_LABEL = {
  financial: '💰 Financial Statements',
  income: '📄 Tax Returns & Income',
  property: '🏠 Property & Assets',
  legal: '⚖ Court & Legal Documents',
  disclosure: '📋 AFI & Disclosures',
  other: '📎 Other',
};

function matterId() {
  return (
    (window.Veritas && window.Veritas.currentMatterId) ||
    new URLSearchParams(location.search).get('matter') ||
    localStorage.getItem('currentMatterId') ||
    null
  );
}

// Verify the matter actually exists in the backend; clear it if stale.
async function validMatterId() {
  const mid = matterId();
  if (!mid) return null;
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}`);
    if (r.ok) return mid;
  } catch (e) { /* backend down */ }
  // Stale or invalid -> clear so we stop pointing at a phantom matter.
  localStorage.removeItem('currentMatterId');
  if (window.Veritas) window.Veritas.currentMatterId = null;
  return null;
}

// Show a prominent blocking banner over the dropzone when no valid matter.
function showNoMatterBanner(show) {
  const dz = document.getElementById('dropzone');
  if (!dz) return;
  let banner = document.getElementById('noMatterBanner');
  if (show) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'noMatterBanner';
      banner.style.cssText = 'background:#fff3cd;border:2px solid #f0ad4e;border-radius:8px;padding:18px;margin-bottom:14px;color:#856404;';
      banner.innerHTML = `
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;">⚠ No matter selected</div>
        <div style="font-size:13px;margin-bottom:12px;">Documents must attach to a real matter. Create or select one before uploading.</div>
        <a href="case-intake.html" style="display:inline-block;padding:9px 14px;background:#1c3f66;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">+ New Case Intake</a>`;
      dz.parentElement.insertBefore(banner, dz);
      dz.style.opacity = '0.4';
      dz.style.pointerEvents = 'none';
    }
  } else if (banner) {
    banner.remove();
    dz.style.opacity = '';
    dz.style.pointerEvents = '';
  }
}

function currentUserId() {
  return localStorage.getItem('currentUserId') || 'user-unknown';
}

/* ---------- Upload queue UI ---------- */
function ensureQueue() {
  let q = document.getElementById('uploadQueue');
  if (!q) {
    q = document.createElement('div');
    q.id = 'uploadQueue';
    q.className = 'upload-queue';
    const dz = document.getElementById('dropzone');
    (dz ? dz.parentElement : document.querySelector('.main')).appendChild(q);
  }
  return q;
}

function queueItem(id, name) {
  const el = document.createElement('div');
  el.className = 'upload-item processing';
  el.id = `qi-${id}`;
  el.innerHTML = `
    <div class="upload-name">${name}</div>
    <div class="upload-bar"><div class="upload-bar-fill" style="width:15%"></div></div>
    <div class="upload-status">Uploading…</div>`;
  return el;
}

/* ---------- Upload ---------- */
async function uploadToServer(file) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item = queueItem(id, file.name);
  ensureQueue().appendChild(item);
  const bar = item.querySelector('.upload-bar-fill');
  const status = item.querySelector('.upload-status');

  const mid = matterId();
  if (!mid) {
    item.classList.replace('processing', 'error');
    status.textContent = '❌ No matter selected. Select a case first.';
    return;
  }

  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('userId', currentUserId());

    bar.style.width = '45%';
    // 90s timeout so a hung upload reports instead of spinning forever.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    let resp;
    try {
      resp = await fetch(`${API_BASE}/matters/${mid}/documents/upload`, { method: 'POST', body: fd, signal: ctrl.signal });
    } catch (netErr) {
      clearTimeout(timer);
      throw new Error(
        netErr.name === 'AbortError'
          ? 'Upload timed out (file may be large or OCR is slow). Try again.'
          : 'Cannot reach the backend. Start it with: node server/index.js'
      );
    }
    clearTimeout(timer);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Upload failed');

    bar.style.width = '100%';
    item.classList.replace('processing', 'complete');

    if (data.duplicate) {
      status.textContent = '⤺ Already uploaded (skipped)';
      return { file: file.name, outcome: 'duplicate' };
    }

    let msg = `✅ ${BUCKET_LABEL[data.categoryBucket] || data.category}`;
    if (data.transactionCount > 0) msg += ` · ${data.transactionCount} transactions${data.bankName ? ` · ${data.bankName}` : ''}`;
    if (data.ocrNeeded) msg += ' · ⚠ needs OCR review';
    status.textContent = msg;
    return { file: file.name, outcome: 'uploaded', category: data.categoryBucket, transactions: data.transactionCount || 0 };
  } catch (err) {
    console.error(err);
    item.classList.replace('processing', 'error');
    status.textContent = `❌ ${err.message}`;
    return { file: file.name, outcome: 'failed', error: err.message };
  }
}

// Run async tasks with limited concurrency so a big batch doesn't stall on one slow file.
async function runBatched(items, worker, onResult, concurrency = 3) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await worker(items[i], i);
      } catch (error) {
        results[i] = { file: items[i].name, outcome: 'failed', error: error.message || 'Unexpected upload error' };
      }
      // A rendering error must not stop the remaining files in the queue.
      try { onResult(results[i], i + 1, items.length); } catch (error) { console.error('Batch progress update failed', error); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

let uploadBatchActive = false;

async function uploadWithRetry(file, attempts = 2) {
  let result = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await uploadToServer(file);
    if (result.outcome !== 'failed') return result;
    if (attempt < attempts) {
      const item = document.querySelector(`#uploadQueue .upload-item:last-child .upload-status`);
      if (item) item.textContent = `Retrying (${attempt + 1}/${attempts})…`;
    }
  }
  return result;
}

async function handleFiles(fileList) {
  const selectedFiles = Array.from(fileList || []);
  const seenNames = new Set();
  const selectionDuplicates = [];
  const files = selectedFiles.filter((file) => {
    const key = file.name.toLowerCase();
    if (seenNames.has(key)) {
      selectionDuplicates.push(file.name);
      return false;
    }
    seenNames.add(key);
    return true;
  });
  if (!files.length) return;

  if (uploadBatchActive) {
    alert('A document batch is already processing. Wait for its reconciliation to finish before selecting another batch.');
    return;
  }

  // Block early with a clear banner if there's no valid matter.
  const mid = await validMatterId();
  if (!mid) {
    showNoMatterBanner(true);
    return;
  }

  uploadBatchActive = true;
  const startTime = Date.now();
  const running = { uploaded: 0, duplicates: 0, failed: 0 };
  // Large PDF/OCR batches are intentionally serial: one slow PDF cannot make
  // the browser abandon siblings, and every file receives a retry.
  const concurrency = files.length > 20 ? 1 : 3;
  showBatchProgress({ selected: selectedFiles.length, queued: files.length, selectionDuplicates: selectionDuplicates.length, complete: 0, uploaded: 0, duplicates: 0, failed: 0, concurrency });
  let results = [];
  try {
    results = await runBatched(files, (f) => uploadWithRetry(f), (result, complete, total) => {
    if (result?.outcome === 'uploaded') running.uploaded++;
    if (result?.outcome === 'duplicate') running.duplicates++;
    if (result?.outcome === 'failed') running.failed++;
    showBatchProgress({
      selected: selectedFiles.length,
      queued: total,
      selectionDuplicates: selectionDuplicates.length,
      complete,
      uploaded: running.uploaded,
      duplicates: running.duplicates,
      failed: running.failed,
      concurrency,
    });
    }, concurrency);
  } finally {
    uploadBatchActive = false;
  }

  // Reconciliation summary
  const uploaded = results.filter((r) => r && r.outcome === 'uploaded');
  const dups = results.filter((r) => r && r.outcome === 'duplicate');
  const failed = results.filter((r) => r && r.outcome === 'failed');
  const txTotal = uploaded.reduce((s, r) => s + (r.transactions || 0), 0);
  showRecon({
    selected: selectedFiles.length,
    uploaded: uploaded.length,
    duplicates: dups.length + selectionDuplicates.length,
    failed: failed.length,
    transactions: txTotal,
    failedFiles: failed,
    seconds: ((Date.now() - startTime) / 1000).toFixed(1),
  });

  finishBatchProgress({
    selected: selectedFiles.length,
    uploaded: uploaded.length,
    duplicates: dups.length + selectionDuplicates.length,
    failed: failed.length,
  });

  refreshBuckets();
}

function showBatchProgress(progress) {
  let el = document.getElementById('uploadBatchProgress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'uploadBatchProgress';
    el.style.cssText = 'margin-top:12px;border:1px solid #cdddea;border-left:4px solid #2e5b8a;border-radius:8px;background:#f7fafd;padding:12px;';
    const queue = document.getElementById('uploadQueue');
    queue.parentElement.insertBefore(el, queue);
  }
  const pct = progress.queued ? Math.round((progress.complete / progress.queued) * 100) : 0;
  el.innerHTML = `
    <div style="font-weight:700;color:#1c3f66;">📤 Batch upload in progress</div>
    <div style="font-size:12px;color:#42526e;margin-top:4px;">Selected: <strong>${progress.selected}</strong> · Queue: <strong>${progress.queued}</strong> · Completed: <strong>${progress.complete}/${progress.queued}</strong> · Uploaded: <strong>${progress.uploaded}</strong> · Already present: <strong>${progress.duplicates + progress.selectionDuplicates}</strong> · Failed: <strong>${progress.failed}</strong></div>
    <div style="height:6px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-top:8px;"><div style="width:${pct}%;height:100%;background:#2e5b8a;"></div></div>
    <div style="font-size:11px;color:#6b7280;margin-top:5px;">${progress.concurrency === 1 ? 'Large batch safety mode: one file at a time, with one automatic retry.' : 'Three files process at a time.'} The remaining selected files are safely queued, not skipped.</div>`;
}

function finishBatchProgress(result) {
  const queue = document.getElementById('uploadQueue');
  if (queue) queue.replaceChildren();

  const progress = document.getElementById('uploadBatchProgress');
  if (!progress) return;
  const allAccounted = result.failed === 0;
  progress.style.borderLeftColor = allAccounted ? '#2e7d32' : '#c62828';
  progress.innerHTML = `
    <div style="font-weight:700;color:#1c3f66;">${allAccounted ? '✓ Batch upload complete' : '⚠ Batch completed with failures'}</div>
    <div style="font-size:12px;color:#42526e;margin-top:4px;">Selected: <strong>${result.selected}</strong> · Uploaded: <strong>${result.uploaded}</strong> · Already present: <strong>${result.duplicates}</strong> · Failed: <strong>${result.failed}</strong></div>
    <div style="font-size:11px;color:#6b7280;margin-top:5px;">Per-file rows cleared. The reconciliation summary below is the retained audit record.</div>`;
}

/* ---------- Upload reconciliation summary ---------- */
function showRecon(r) {
  let el = document.getElementById('uploadRecon');
  if (!el) {
    el = document.createElement('div');
    el.id = 'uploadRecon';
    el.style.cssText = 'margin-top:12px;border:1px solid #d8e3f1;border-radius:8px;background:#fff;padding:14px;';
    const q = document.getElementById('uploadQueue');
    (q ? q.parentElement : document.querySelector('.main')).insertBefore(el, q ? q.nextSibling : null);
  }
  const allGood = r.failed === 0 && (r.uploaded + r.duplicates) === r.selected;
  el.style.borderLeft = `4px solid ${allGood ? '#2e7d32' : '#c62828'}`;
  el.innerHTML = `
    <div style="font-weight:700;color:#1c3f66;margin-bottom:8px;">📋 Upload reconciliation — ${r.seconds}s</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;">
      <div><span style="color:#666;">Selected:</span> <strong>${r.selected}</strong></div>
      <div><span style="color:#2e7d32;">Uploaded:</span> <strong>${r.uploaded}</strong></div>
      <div><span style="color:#856404;">Already had:</span> <strong>${r.duplicates}</strong></div>
      <div><span style="color:#c62828;">Failed:</span> <strong>${r.failed}</strong></div>
      <div><span style="color:#666;">Transactions parsed:</span> <strong>${r.transactions}</strong></div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:${allGood ? '#2e7d32' : '#c62828'};">
      ${allGood
        ? '✓ Every selected file is accounted for (uploaded or already present).'
        : `⚠ ${r.selected - r.uploaded - r.duplicates} file(s) did NOT complete. ${r.duplicates ? 'Duplicates were skipped. ' : ''}See failed items above.`}
    </div>
    ${r.failedFiles && r.failedFiles.length
      ? '<div style="margin-top:8px;font-size:11px;color:#c62828;">' + r.failedFiles.map((f) => `• ${f.file}: ${f.error}`).join('<br>') + '</div>'
      : ''}
  `;
}

// Persistent, always-visible reconciliation of what's currently stored for the matter.
async function showStoredRecon() {
  const mid = await validMatterId();
  if (!mid) return;
  try {
    const [docsR, covR] = await Promise.all([
      fetch(`${API_BASE}/matters/${mid}/documents`),
      fetch(`${API_BASE}/matters/${mid}/bank-statements/coverage`),
    ]);
    const docs = await docsR.json();
    const cov = await covR.json();
    const parsedCount = (docs || []).filter((doc) => doc.extraction_status === 'parsed').length;
    const reviewCount = (docs || []).filter((doc) => doc.extraction_status === 'needs_review' || doc.ocr_needed).length;
    const unclassifiedCount = (docs || []).filter((doc) => doc.category === 'Other').length;

    let el = document.getElementById('storedRecon');
    if (!el) {
      el = document.createElement('div');
      el.id = 'storedRecon';
      el.style.cssText = 'margin-top:12px;border:1px solid #d8e3f1;border-left:4px solid #2e5b8a;border-radius:8px;background:#f7fafd;padding:14px;';
      const panel = document.getElementById('dropzone')?.closest('.panel');
      if (panel) panel.appendChild(el);
    }
    const acctLine = (cov.accounts || [])
      .map((a) => `${a.account}: ${a.months.length} mo / ${a.totalTx} tx`)
      .join(' · ');
    el.innerHTML = `
      <div style="font-weight:700;color:#1c3f66;margin-bottom:6px;">📦 Currently stored for this matter</div>
      <div style="font-size:12px;color:#42526e;">
        <strong>${(docs || []).length}</strong> documents ·
        <strong>${cov.totalStatements || 0}</strong> statements ·
        <strong>${cov.totalTransactions || 0}</strong> transactions
      </div>
      <div style="font-size:11px;margin-top:4px;color:${reviewCount || unclassifiedCount ? '#8a6a1f' : '#2e7d32'};">
        ${parsedCount} parsed · ${reviewCount} need OCR/parsing review · ${unclassifiedCount} need category review
      </div>
      ${acctLine ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;">${acctLine}</div>` : ''}
      <div style="margin-top:10px;">
        <button type="button" id="reconFolderBtn" class="btn ghost" style="padding:8px 12px;font-size:12px;">🗂 Reconcile against a folder…</button>
        <span id="reconFolderSummary" style="font-size:12px;color:#42526e;margin-left:8px;"></span>
      </div>
    `;
    const btn = el.querySelector('#reconFolderBtn');
    if (btn && !btn.__wired) {
      btn.__wired = true;
      btn.addEventListener('click', pickFolderAndReconcile);
    }
    showSavedFolderRecon();
  } catch (e) { /* backend down */ }
}

/* ---------- Folder reconciliation ---------- */
// Read a chosen folder (via webkitdirectory) and diff its filenames against stored docs.
function pickFolderAndReconcile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('directory', '');
  input.multiple = true;
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const filenames = files.map((f) => f.name);
    await reconcileFilenames(filenames, files);
  });
  input.click();
}

async function reconcileFilenames(filenames, sourceFiles = []) {
  const mid = await validMatterId();
  if (!mid) { showNoMatterBanner(true); return; }
  const out = document.getElementById('reconFolderSummary');
  if (out) out.textContent = 'Reconciling…';
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/documents/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames }),
    });
    let d = await r.json();
    // A filename mismatch can still be the same document. Hash only the
    // apparent misses (rather than all source PDFs) and ask the server again.
    if (d.missingCount && sourceFiles.length && window.crypto?.subtle) {
      if (out) out.textContent = `Checking ${d.missingCount} apparent missing file(s) for identical contents…`;
      const missingKeys = new Set(d.missing.map((name) => name.toLowerCase()));
      const candidates = sourceFiles.filter((file) => missingKeys.has(file.name.toLowerCase()));
      const manifest = [];
      for (const file of candidates) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        manifest.push({ name: file.name, hash });
      }
      const retry = await fetch(`${API_BASE}/matters/${mid}/documents/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames, files: manifest }),
      });
      d = await retry.json();
    }
    // Keep the manifest (names only) so the current reconciliation remains
    // visible after refresh. Browser security prevents persisting file handles;
    // the user selects the folder again only when ready to upload missing files.
    localStorage.setItem(`veritas_folder_recon_${mid}`, JSON.stringify({
      sourceCount: d.sourceCount,
      presentCount: d.presentCount,
      missingCount: d.missingCount,
      extraCount: d.extraCount,
      missing: d.missing,
      checkedAt: new Date().toISOString(),
    }));
    if (out) {
      const ok = d.missingCount === 0;
      out.textContent = `${d.presentCount}/${d.sourceCount} stored · ${d.missingCount} missing · ${d.extraCount} extra`;
      out.style.color = ok ? '#2e7d32' : '#c62828';
    }
    showFolderRecon(d, sourceFiles);
  } catch (e) {
    if (out) { out.textContent = 'Could not reconcile — is the backend running?'; out.style.color = '#c62828'; }
  }
}

function showFolderRecon(d, sourceFiles = []) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const ok = d.missingCount === 0;
  const missHtml = d.missing.length
    ? `<div style="max-height:200px;overflow:auto;margin-top:6px;font-size:11px;color:#c62828;">${d.missing.map((m) => '• ' + m).join('<br>')}</div>`
    : '<div style="color:#2e7d32;font-size:12px;margin-top:6px;">✓ Every source file is stored (no missing).</div>';
  const extraHtml = d.extra.length
    ? `<div style="margin-top:10px;font-size:11px;color:#856404;"><strong>In system but not in folder (${d.extraCount}):</strong><br>${d.extra.map((m) => '• ' + m).join('<br>')}</div>`
    : '';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;max-width:640px;width:100%;max-height:80vh;overflow:auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#1c3f66;">🗂 Folder ↔ System Reconciliation</h3>
        <button class="btn ghost" id="frClose">Close</button>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin-bottom:8px;">
        <div><span style="color:#666;">Source files:</span> <strong>${d.sourceCount}</strong></div>
        <div><span style="color:#2e7d32;">Stored:</span> <strong>${d.presentCount}</strong></div>
        <div><span style="color:#856404;">Same-content copies:</span> <strong>${d.contentDuplicateCount || 0}</strong></div>
        <div><span style="color:#c62828;">Missing:</span> <strong>${d.missingCount}</strong></div>
        <div><span style="color:#856404;">Extra in system:</span> <strong>${d.extraCount}</strong></div>
      </div>
      <div style="font-size:12px;color:${ok ? '#2e7d32' : '#c62828'};font-weight:600;margin-bottom:6px;">
        ${ok ? `✓ Every source file is accounted for (${d.contentDuplicateCount || 0} byte-identical renamed copy/copies).` : `⚠ ${d.missingCount} source file(s) are not yet in the system.`}
      </div>
      ${missHtml}
      ${extraHtml}
      ${d.missingCount && sourceFiles.length ? `<div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;"><button class="btn" id="frUploadMissing">Upload ${d.missingCount} missing file(s)</button></div>` : ''}
      ${d.missingCount && !sourceFiles.length ? `<div style="margin-top:14px;font-size:12px;color:#42526e;">Select the same folder again with <strong>Reconcile against a folder…</strong> to enable uploading these ${d.missingCount} missing files.</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#frClose').addEventListener('click', () => overlay.remove());
  const uploadMissing = overlay.querySelector('#frUploadMissing');
  if (uploadMissing) {
    uploadMissing.addEventListener('click', async () => {
      const missingNames = new Set(d.missing.map((name) => name.toLowerCase()));
      const missingFiles = sourceFiles.filter((file) => missingNames.has(file.name.toLowerCase()));
      if (!missingFiles.length) return;
      overlay.remove();
      await handleFiles(missingFiles);
      await showStoredRecon();
      // Re-run against the full original folder manifest so the result proves
      // whether every source file is now stored, not merely that the batch ended.
      await reconcileFilenames(sourceFiles.map((file) => file.name), sourceFiles);
    });
  }
}

function showSavedFolderRecon() {
  const mid = matterId();
  if (!mid) return;
  try {
    const saved = JSON.parse(localStorage.getItem(`veritas_folder_recon_${mid}`) || 'null');
    if (!saved) return;
    const out = document.getElementById('reconFolderSummary');
    if (!out) return;
    out.textContent = `${saved.presentCount}/${saved.sourceCount} stored · ${saved.missingCount} missing · ${saved.extraCount} extra`;
    out.style.color = saved.missingCount ? '#c62828' : '#2e7d32';
  } catch (error) { /* ignore stale manifest */ }
}

/* ---------- Category buckets & stats ---------- */
function bucketEls() {
  const map = {};
  document.querySelectorAll('.category-section').forEach((sec) => {
    const title = (sec.querySelector('.category-title')?.textContent || '').trim();
    if (title.includes('Financial Statements')) map.financial = sec.querySelector('.doc-list');
    else if (title.includes('Tax Returns')) map.income = sec.querySelector('.doc-list');
    else if (title.includes('Property & Assets')) map.property = sec.querySelector('.doc-list');
    else if (title.includes('Court & Legal')) map.legal = sec.querySelector('.doc-list');
    else if (title.includes('AFI & Disclosures')) map.disclosure = sec.querySelector('.doc-list');
    else if (title.includes('Other')) map.other = sec.querySelector('.doc-list');
  });
  return map;
}

function docBucket(d) {
  const c = (d.category || '').toLowerCase();
  if (c.includes('financial statement')) return 'financial';
  if (c.includes('tax') || c.includes('income')) return 'income';
  if (c.includes('property') || c.includes('asset')) return 'property';
  if (c.includes('court') || c.includes('legal')) return 'legal';
  if (c.includes('afi') || c.includes('disclosure')) return 'disclosure';
  return 'other';
}

function docItem(d) {
  const div = document.createElement('div');
  div.className = 'doc-item';
  const categories = ['Financial Statements', 'Tax Returns & Income', 'Property & Assets', 'Court & Legal Documents', 'AFI & Disclosures', 'Other'];
  const type = d.document_type;
  const isPayStub = type === 'Pay Stub / Earnings Statement';
  const isBank = type === 'Bank Account Statement';
  const isCard = type === 'Credit Card Statement';
  const isTyped = isPayStub || isBank || isCard;
  const options = categories.map((category) =>
    `<option value="${category}" ${d.category === category && !isTyped ? 'selected' : ''}>${category}</option>`
  ).join('')
    + `<option value="__bank__" ${isBank ? 'selected' : ''}>Bank Account Statement (feeds AFI expenses)</option>`
    + `<option value="__credit_card__" ${isCard ? 'selected' : ''}>Credit Card Statement (feeds AFI expenses)</option>`
    + `<option value="__pay_stub__" ${isPayStub ? 'selected' : ''}>Pay Stub (links to Income)</option>`;
  const badge = d.ocr_needed ? '<span class="doc-badge pending">OCR review</span>'
    : '<span class="doc-badge received">Received</span>';
  div.innerHTML = `
    <div>
      <span class="doc-name">${d.filename}</span>
      <select class="map-select" data-category style="margin-top:4px;max-width:220px;">${options}</select>
      <div style="font-size:11px;color:${d.classification_confidence === 'needs_review' ? '#b45309' : '#6b7280'};margin-top:3px;">${d.document_type || 'Document type pending'}${d.classification_confidence === 'needs_review' ? ' · review needed' : ''}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center;">
      ${badge}
      ${d.s3_key ? '<button class="btn ghost" style="padding:4px 8px;font-size:11px;" data-dl>⬇</button>' : ''}
      ${d.ocr_needed ? '<button class="btn ghost" style="padding:4px 8px;font-size:11px;" data-ocr>Mark reviewed</button>' : ''}
    </div>`;
  const btn = div.querySelector('[data-ocr]');
  if (btn) btn.addEventListener('click', () => markReviewed(d.id));
  const dl = div.querySelector('[data-dl]');
  if (dl) dl.addEventListener('click', () => downloadOriginal(d.id, d.filename));
  const categorySelect = div.querySelector('[data-category]');
  if (categorySelect) categorySelect.addEventListener('change', () => {
    const v = categorySelect.value;
    if (v === '__pay_stub__') {
      updateDocumentCategory(d.id, 'Tax Returns & Income', 'Pay Stub / Earnings Statement');
    } else if (v === '__bank__') {
      classifyAccount(d, 'Bank Account Statement');
    } else if (v === '__credit_card__') {
      classifyAccount(d, 'Credit Card Statement');
    } else {
      updateDocumentCategory(d.id, v);
    }
  });
  return div;
}

// Classify every statement that shares this document's account number at once.
async function classifyAccount(doc, documentType) {
  const m = (doc.filename || '').match(/(?:acct|account|cc|card)\s*(\d{3,})/i);
  if (!m) {
    updateDocumentCategory(doc.id, 'Financial Statements', documentType);
    return;
  }
  const account = m[1];
  if (!confirm(`Apply "${documentType}" to all statements for account ${account}?`)) {
    refreshBuckets();
    return;
  }
  const mid = matterId();
  try {
    const response = await fetch(`${API_BASE}/matters/${mid}/documents/classify-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, category: 'Financial Statements', documentType }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Update failed');
    refreshBuckets();
  } catch (error) {
    alert('Could not update the account statements.');
    refreshBuckets();
  }
}

async function updateDocumentCategory(docId, category, documentType) {
  try {
    const body = { category };
    if (documentType) body.documentType = documentType;
    const response = await fetch(`${API_BASE}/documents/${docId}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Category update failed');
    refreshBuckets();
  } catch (error) {
    alert('Could not update the document category.');
  }
}

async function downloadOriginal(docId, filename) {
  try {
    const r = await fetch(`${API_BASE}/documents/${docId}/download`);
    if (!r.ok) throw new Error('Download failed');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'document';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert('Could not download the original file.');
  }
}

async function refreshBuckets() {
  const mid = await validMatterId();
  showNoMatterBanner(!mid);
  if (!mid) {
    renderStats([], { financial: [], income: [], property: [], legal: [], disclosure: [], other: [] });
    return;
  }
  let docs = [];
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/documents`);
    docs = await r.json();
  } catch (e) {
    console.error('load documents', e);
  }

  const els = bucketEls();
  const counts = {};
  BUCKETS.forEach((b) => (counts[b] = []));

  (docs || []).forEach((d) => counts[docBucket(d)].push(d));

  BUCKETS.forEach((b) => {
    const el = els[b];
    if (!el) return;
    el.innerHTML = '';
    if (counts[b].length === 0) {
      el.innerHTML = '<div style="color:#bbb;font-size:12px;padding:8px;">No documents yet.</div>';
    } else {
      counts[b].forEach((d) => el.appendChild(docItem(d)));
    }
  });

  renderStats(docs, counts);
}

async function renderStats(docs, counts) {
  const total = (docs || []).length;
  const ocr = (docs || []).filter((d) => d.ocr_needed).length;
  const financial = counts.financial.length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('totalDocs', total);
  set('bankCount', financial);
  set('ocrCount', ocr);

  // tax + paystub estimates from category
  set('taxCount', counts.income.length);

  // real transaction count + per-statement list
  const mid = matterId();
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements`);
    const stmts = await r.json();
    const txTotal = (stmts || []).reduce((s, st) => s + (st.transaction_count || 0), 0);
    set('paystubCount', txTotal);
    const lbl = document.querySelector('#paystubCount')?.nextElementSibling;
    if (lbl) lbl.textContent = 'Parsed transactions';
    renderStatements(stmts || []);
    updateStatusBadge(true, total, txTotal);
  } catch (e) {
    updateStatusBadge(false, 0, 0);
  }
}

// Small always-visible badge so you can tell live data vs. stale/offline at a glance.
function updateStatusBadge(online, docCount, txCount) {
  let b = document.getElementById('diStatusBadge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'diStatusBadge';
    b.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:5000;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
    document.body.appendChild(b);
  }
  if (online) {
    b.style.background = '#e8f5e9'; b.style.color = '#2e7d32'; b.style.border = '1px solid #2e7d32';
    b.textContent = `● Live · ${docCount} docs · ${txCount} transactions`;
  } else {
    b.style.background = '#ffebee'; b.style.color = '#c62828'; b.style.border = '1px solid #c62828';
    b.textContent = '● Backend offline — start: node server/index.js (then hard-refresh)';
  }
}

/* ---------- Parsed statements list + CSV downloads ---------- */
function renderStatements(stmts) {
  const host = document.getElementById('statementsList');
  if (!host) return;
  host.innerHTML = '';
  if (!stmts.length) {
    host.innerHTML = '<div style="color:#bbb;font-size:12px;padding:8px;">No parsed statements yet.</div>';
    return;
  }
  stmts.forEach((st) => {
    const row = document.createElement('div');
    row.className = 'doc-item';
    const label = st.filename || st.bank_name || 'Statement';
    const acct = st.account_number_masked ? ` · ${st.account_number_masked}` : '';
    const type = st.account_type ? st.account_type.replace('_', ' ') : '';
    const period = (st.statement_start && st.statement_end)
      ? `${st.statement_start} → ${st.statement_end}`
      : 'period not detected';
    row.innerHTML = `
      <div>
        <span class="doc-name">${label}</span>
        <div style="font-size:11px;color:#999;margin-top:2px;">${st.bank_name || ''}${acct}${type ? ' · ' + type : ''}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:1px;">${period} · ${st.transaction_count || 0} transactions</div>
      </div>
      <button class="btn ghost" style="padding:4px 10px;font-size:11px;" data-csv="${st.id}">⬇ CSV</button>`;
    row.querySelector('[data-csv]').addEventListener('click', () => downloadStatementCSV(st.id));
    host.appendChild(row);
  });
}

async function downloadStatementCSV(statementId) {
  const mid = matterId();
  if (!mid) return;
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements/${statementId}/export.csv`);
    if (!r.ok) throw new Error('Export failed');
    const csv = await r.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statement-${statementId}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert('Could not download statement CSV.');
  }
}

/* ---------- Transactions modal ---------- */
async function openTransactions() {
  const mid = matterId();
  if (!mid) return;
  let rows = [];
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements/transactions?limit=1000`);
    rows = await r.json();
  } catch (e) {
    alert('Could not load transactions — is the Node backend running on :3000?');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const body = rows.length ? rows.map((t) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${t.transaction_date || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${parseFloat(t.amount || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${t.flow_type || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${t.mapped_category || t.suggested_category || ''}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" style="padding:20px;text-align:center;color:#999;">No transactions yet.</td></tr>';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;max-width:900px;width:100%;max-height:80vh;overflow:auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#1c3f66;">💳 Extracted Transactions (${rows.length})</h3>
        <button class="btn ghost" id="txClose">Close</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f6f9fd;text-align:left;">
          <th style="padding:8px;">Date</th><th style="padding:8px;">Description</th>
          <th style="padding:8px;text-align:right;">Amount</th><th style="padding:8px;">Flow</th><th style="padding:8px;">Category</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#txClose').addEventListener('click', () => overlay.remove());
}

/* ---------- OCR review ---------- */
async function markReviewed(docId) {
  try {
    await fetch(`${API_BASE}/documents/${docId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } finally {
    refreshBuckets();
  }
}

/* ---------- Statement coverage (per account / month) ---------- */
async function openCoverage() {
  const mid = matterId();
  if (!mid) return;
  let data;
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements/coverage`);
    data = await r.json();
  } catch (e) {
    alert('Could not load coverage — is the backend running on :3000?');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const monthName = (iso) => {
    if (!iso) return '?';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const acctHtml = (data.accounts || []).map((a) => {
    // detect month gaps
    const starts = a.months.map((m) => m.start).filter(Boolean).sort();
    let gaps = [];
    for (let i = 1; i < starts.length; i++) {
      const prev = new Date(starts[i - 1]); const cur = new Date(starts[i]);
      const diff = (cur.getFullYear() - prev.getFullYear()) * 12 + (cur.getMonth() - prev.getMonth());
      if (diff > 1) gaps.push(`${monthName(starts[i - 1])} → ${monthName(starts[i])}`);
    }
    const chips = a.months.map((m) =>
      `<span style="display:inline-block;background:#e8f3ff;color:#1b5fae;border-radius:4px;padding:2px 6px;margin:2px;font-size:11px;">${monthName(m.start)} (${m.tx})</span>`
    ).join('');
    const gapHtml = gaps.length
      ? `<div style="color:#c62828;font-size:11px;margin-top:6px;">⚠ Gap(s): ${gaps.join(', ')}</div>`
      : `<div style="color:#2e7d32;font-size:11px;margin-top:6px;">✓ Contiguous</div>`;
    return `
      <div style="border:1px solid #e4e9f1;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-weight:700;color:#1c3f66;">${a.account} <span style="font-weight:400;color:#666;font-size:11px;">${a.type || ''}</span></div>
        <div style="font-size:11px;color:#666;margin:4px 0;">${a.months.length} statement(s) · ${a.totalTx} transactions</div>
        <div>${chips}</div>
        ${gapHtml}
      </div>`;
  }).join('');

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;max-width:760px;width:100%;max-height:80vh;overflow:auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#1c3f66;">🗓 Statement Coverage</h3>
        <button class="btn ghost" id="covClose">Close</button>
      </div>
      <div style="font-size:12px;color:#51617a;margin-bottom:12px;">
        ${data.totalStatements} statement(s) · ${data.totalTransactions} transactions across ${(data.accounts || []).length} account(s).
        Each chip is one month (transaction count). Gaps are months with no statement.
      </div>
      ${acctHtml || '<div style="color:#999;">No statements parsed yet.</div>'}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#covClose').addEventListener('click', () => overlay.remove());
}

/* ---------- Wire up ---------- */
let __dzWired = false;
function initDiscoveryUploads() {
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('fileInput');

  if (dz && !__dzWired) {
    __dzWired = true;
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('active'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('active');
      handleFiles(e.dataTransfer.files);
    });
    // Clicking anywhere on the dropzone opens the picker.
    dz.addEventListener('click', () => { fi && fi.click(); });

    // Browse button: open the picker once, and don't let the click bubble to the dropzone.
    const browse = dz.querySelector('.dz-browse');
    if (browse && !browse.__wired) {
      browse.__wired = true;
      browse.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fi && fi.click();
      });
    }
  }
  if (fi && !fi.__wired) {
    fi.__wired = true;
    fi.addEventListener('change', (e) => {
      const files = e.target.files;
      handleFiles(files);
      // Reset so selecting the same files again re-fires change.
      e.target.value = '';
    });
  }

  // Button the page uses to view transactions (if present)
  const txBtn = document.querySelector('[data-view-transactions]');
  if (txBtn) txBtn.addEventListener('click', openTransactions);

  // Consolidated CSV export of all transactions for the matter
  const exportAll = document.getElementById('exportAllCsvBtn');
  if (exportAll) exportAll.addEventListener('click', downloadAllCSV);

  // Statement coverage (per account / month)
  const covBtn = document.getElementById('coverageBtn');
  if (covBtn) covBtn.addEventListener('click', openCoverage);

  refreshBuckets();
  showStoredRecon();
  window.addEventListener('matterSelected', () => { refreshBuckets(); showStoredRecon(); });
}

async function downloadAllCSV() {
  const mid = matterId();
  if (!mid) return;
  try {
    const r = await fetch(`${API_BASE}/matters/${mid}/bank-statements/export.csv`);
    if (!r.ok) throw new Error('Export failed');
    const csv = await r.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert('Could not export transactions — is the Node backend running on :3000?');
  }
}

document.addEventListener('DOMContentLoaded', initDiscoveryUploads);
