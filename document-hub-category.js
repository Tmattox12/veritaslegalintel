/* Shared Document Hub category page engine.
 * Every document-hub-*.html page sets window.HUB_CONFIG (category, optional
 * typeFilter, and labels) then includes this file. All document data comes
 * from the real backend for the active matter — nothing is hardcoded here
 * and nothing is stored in localStorage. This is the one place the logic
 * lives, so category pages stay a blank template until real data exists. */
(function () {
  const API_BASE = window.API_BASE || 'http://localhost:3000/api';
  const config = window.HUB_CONFIG || {};

  function matterId() {
    return (
      (window.Veritas && window.Veritas.currentMatterId) ||
      new URLSearchParams(location.search).get('matter') ||
      localStorage.getItem('currentMatterId') ||
      null
    );
  }

  // Informational only — the real upload/classification pipeline lives in Document Intake.
  window.selectCategory = function selectCategory() {
    location.href = `discovery-intake.html?matter=${matterId() || ''}`;
  };

  function renderBanner(matter) {
    const el = document.getElementById('activeMatterBanner');
    if (!el) return;
    if (!matter) {
      el.innerHTML = '<a href="case-intake.html">No active case — start Case Intake →</a>';
      return;
    }
    el.innerHTML = `Active case: <strong>${matter.name || 'Untitled Case'}</strong>`;
  }

  function matchesHub(doc) {
    if (doc.deleted_at) return false;
    if (config.category && doc.category !== config.category) return false;
    if (config.typeFilter && config.typeFilter.length && !config.typeFilter.includes(doc.document_type)) return false;
    return true;
  }

  async function loadDocuments() {
    const list = document.getElementById('documentsList');
    const mid = matterId();
    const goToIntake = document.getElementById('goToIntakeBtn');
    if (goToIntake) goToIntake.href = `discovery-intake.html?matter=${mid || ''}`;

    if (!mid) {
      renderBanner(null);
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No active case selected</div>
          <p style="font-size: 12px; margin-top: 6px;">Select or create a case, then upload documents in Document Intake.</p>
        </div>
      `;
      return;
    }

    try {
      const [matterRes, docsRes] = await Promise.all([
        fetch(`${API_BASE}/matters/${mid}`),
        fetch(`${API_BASE}/matters/${mid}/documents`),
      ]);
      renderBanner(matterRes.ok ? await matterRes.json() : null);
      const docs = docsRes.ok ? await docsRes.json() : [];
      const matched = (docs || []).filter(matchesHub);

      document.getElementById('totalDocs').textContent = matched.length;
      document.getElementById('totalItems').textContent = matched.filter((d) => d.extraction_status === 'parsed' || d.extraction_status === 'manual').length;
      document.getElementById('totalValue').textContent = matched.filter((d) => d.ocr_needed).length;

      if (!matched.length) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">${config.emptyTitle || 'No documents on file yet'}</div>
            <p style="font-size: 12px; margin-top: 6px;">${config.emptyHint || 'Upload documents in Document Intake — they will appear here automatically once classified.'}</p>
          </div>
        `;
        return;
      }

      list.innerHTML = matched.map((d) => `
        <div class="doc-item">
          <div class="doc-info">
            <div class="doc-name">${d.filename}</div>
            <div class="doc-meta">
              ${d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : 'Date unknown'} ·
              ${d.document_type || 'Document type pending'}
              ${d.ocr_needed ? ' · needs review' : ''}
            </div>
          </div>
          <div class="doc-stat">${d.ocr_needed ? 'Review' : (d.extraction_status || 'Uploaded')}</div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Could not reach the backend</div>
          <p style="font-size: 12px; margin-top: 6px;">Start the Node server on :3000, then reload this page.</p>
        </div>
      `;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDocuments);
  } else {
    loadDocuments();
  }
  window.addEventListener('matterSelected', loadDocuments);
})();
