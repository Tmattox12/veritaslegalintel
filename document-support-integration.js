<<<<<<< HEAD
/**
 * Document Support Integration Layer
 * Bridges the existing SUPPORT objects with the new DOCUMENT_SUPPORT registry
 * Adds reconciliation display to all "View support" modals
 */

/**
 * Enhanced version of showSupportDrawer that includes document links and reconciliation
 */
function showSupportDrawerWithDocuments(supportKey) {
  const key = String(supportKey || '').split(':');
  if (key.length !== 2) return;
  
  const party = key[0];
  const id = key[1];
  
  // Get the original support data
  const originalSupport = SUPPORT && SUPPORT[party + ':' + id];
  
  // Get the new document registry data
  const docSupport = getSupportForNumber(id);
  
  // Build the enhanced modal content
  let html = `<div class="support-modal-content" style="position:relative;">
    <button class="support-modal-close" onclick="this.closest('.support-modal-full').style.display='none'">×</button>`;
  
  // Include original support info
  if (originalSupport) {
    html += renderOriginalSupportInfo(originalSupport);
  }
  
  // Include document registry info with actual links and reconciliation
  if (docSupport) {
    html += renderSupportModal(id, docSupport);
  } else {
    html += `<div style="padding:20px;background:#f5f5f5;border-radius:6px;">
      <p>No detailed document support catalogued yet. Document mapping is in progress.</p>
    </div>`;
  }
  
  html += '</div>';
  
  // Create or reuse modal
  let modal = document.getElementById('supportDrawerModalEnhanced');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supportDrawerModalEnhanced';
    modal.className = 'support-modal-full';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;overflow-y:auto;';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = html;
  modal.style.display = 'flex';
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

/**
 * Render the original support info (from SUPPORT object)
 */
function renderOriginalSupportInfo(support) {
  let html = `<div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:6px;">
    <h3 style="margin:0 0 12px;color:#12233b;">Original Support Documentation</h3>`;
  
  if (support.method) {
    html += `<div style="margin-bottom:8px;"><strong>Method:</strong> ${esc(support.method)}</div>`;
  }
  
  if (support.breakdown && Array.isArray(support.breakdown)) {
    html += `<div style="margin-bottom:12px;"><strong>Breakdown:</strong>`;
    html += `<table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;">
      <tr style="background:#fff;"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Item</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">Amount</th></tr>`;
    
    support.breakdown.forEach(item => {
      html += `<tr style="background:#fff;"><td style="padding:6px;border-bottom:1px solid #eee;">${esc(item.k)}</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;">${esc(item.v)}</td></tr>`;
    });
    
    html += `</table></div>`;
  }
  
  if (support.exhibits && Array.isArray(support.exhibits) && support.exhibits.length > 0) {
    html += `<div><strong>Exhibits on File:</strong><ul style="margin:8px 0;padding-left:20px;">`;
    
    support.exhibits.forEach(exhibit => {
      html += `<li style="font-size:11px;margin-bottom:6px;">`;
      html += `<strong>${esc(exhibit.docTitle || exhibit.name)}</strong>`;
      if (exhibit.period) html += ` (${esc(exhibit.period)})`;
      if (exhibit.kind) html += ` <span class="doc-type-badge ${exhibit.kind}">${esc(exhibit.kind)}</span>`;
      if (exhibit.file) {
        html += ` <a href="${encodeURI(exhibit.file)}" target="_blank" class="exhibit-link">View ↗</a>`;
      } else {
        html += ` <span style="color:#999;font-size:10px;">document not yet uploaded</span>`;
      }
      html += `</li>`;
    });
    
    html += `</ul></div>`;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Add support indicators to all numbers in tables
 * Shows visually which numbers have document support available
 */
function addSupportIndicators() {
  // Add to all cells with data-number attribute
  document.querySelectorAll('[data-number-id]').forEach(cell => {
    const numberId = cell.getAttribute('data-number-id');
    const support = getSupportForNumber(numberId);
    
    if (support && support.documents && support.documents.length > 0) {
      cell.classList.add('cell-with-support');
      
      const docCount = support.documents.length;
      const docTypes = [...new Set(support.documents.map(d => d.type))];
      
      const tooltip = `
        <div class="cell-support-tooltip">
          ${docCount} supporting documents
        </div>
      `;
      cell.innerHTML += tooltip;
      
      // Make clickable
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        if (!e.target.closest('a')) {
          e.stopPropagation();
          showSupportDrawerWithDocuments(numberId + ':' + numberId);
        }
      });
    }
  });
}

/**
 * Auto-integrate on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  // If document-support-registry is loaded, activate indicators
  if (typeof DOCUMENT_SUPPORT !== 'undefined') {
    addSupportIndicators();
  }
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showSupportDrawerWithDocuments,
    addSupportIndicators,
    renderOriginalSupportInfo
  };
}
=======
/**
 * Document Support Integration Layer
 * Bridges the existing SUPPORT objects with the new DOCUMENT_SUPPORT registry
 * Adds reconciliation display to all "View support" modals
 */

/**
 * Enhanced version of showSupportDrawer that includes document links and reconciliation
 */
function showSupportDrawerWithDocuments(supportKey) {
  const key = String(supportKey || '').split(':');
  if (key.length !== 2) return;
  
  const party = key[0];
  const id = key[1];
  
  // Get the original support data
  const originalSupport = SUPPORT && SUPPORT[party + ':' + id];
  
  // Get the new document registry data
  const docSupport = getSupportForNumber(id);
  
  // Build the enhanced modal content
  let html = `<div class="support-modal-content" style="position:relative;">
    <button class="support-modal-close" onclick="this.closest('.support-modal-full').style.display='none'">×</button>`;
  
  // Include original support info
  if (originalSupport) {
    html += renderOriginalSupportInfo(originalSupport);
  }
  
  // Include document registry info with actual links and reconciliation
  if (docSupport) {
    html += renderSupportModal(id, docSupport);
  } else {
    html += `<div style="padding:20px;background:#f5f5f5;border-radius:6px;">
      <p>No detailed document support catalogued yet. Document mapping is in progress.</p>
    </div>`;
  }
  
  html += '</div>';
  
  // Create or reuse modal
  let modal = document.getElementById('supportDrawerModalEnhanced');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supportDrawerModalEnhanced';
    modal.className = 'support-modal-full';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;overflow-y:auto;';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = html;
  modal.style.display = 'flex';
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

/**
 * Render the original support info (from SUPPORT object)
 */
function renderOriginalSupportInfo(support) {
  let html = `<div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:6px;">
    <h3 style="margin:0 0 12px;color:#12233b;">Original Support Documentation</h3>`;
  
  if (support.method) {
    html += `<div style="margin-bottom:8px;"><strong>Method:</strong> ${esc(support.method)}</div>`;
  }
  
  if (support.breakdown && Array.isArray(support.breakdown)) {
    html += `<div style="margin-bottom:12px;"><strong>Breakdown:</strong>`;
    html += `<table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;">
      <tr style="background:#fff;"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Item</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">Amount</th></tr>`;
    
    support.breakdown.forEach(item => {
      html += `<tr style="background:#fff;"><td style="padding:6px;border-bottom:1px solid #eee;">${esc(item.k)}</td><td style="text-align:right;padding:6px;border-bottom:1px solid #eee;">${esc(item.v)}</td></tr>`;
    });
    
    html += `</table></div>`;
  }
  
  if (support.exhibits && Array.isArray(support.exhibits) && support.exhibits.length > 0) {
    html += `<div><strong>Exhibits on File:</strong><ul style="margin:8px 0;padding-left:20px;">`;
    
    support.exhibits.forEach(exhibit => {
      html += `<li style="font-size:11px;margin-bottom:6px;">`;
      html += `<strong>${esc(exhibit.docTitle || exhibit.name)}</strong>`;
      if (exhibit.period) html += ` (${esc(exhibit.period)})`;
      if (exhibit.kind) html += ` <span class="doc-type-badge ${exhibit.kind}">${esc(exhibit.kind)}</span>`;
      if (exhibit.file) {
        html += ` <a href="${encodeURI(exhibit.file)}" target="_blank" class="exhibit-link">View ↗</a>`;
      } else {
        html += ` <span style="color:#999;font-size:10px;">document not yet uploaded</span>`;
      }
      html += `</li>`;
    });
    
    html += `</ul></div>`;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Add support indicators to all numbers in tables
 * Shows visually which numbers have document support available
 */
function addSupportIndicators() {
  // Add to all cells with data-number attribute
  document.querySelectorAll('[data-number-id]').forEach(cell => {
    const numberId = cell.getAttribute('data-number-id');
    const support = getSupportForNumber(numberId);
    
    if (support && support.documents && support.documents.length > 0) {
      cell.classList.add('cell-with-support');
      
      const docCount = support.documents.length;
      const docTypes = [...new Set(support.documents.map(d => d.type))];
      
      const tooltip = `
        <div class="cell-support-tooltip">
          ${docCount} supporting documents
        </div>
      `;
      cell.innerHTML += tooltip;
      
      // Make clickable
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        if (!e.target.closest('a')) {
          e.stopPropagation();
          showSupportDrawerWithDocuments(numberId + ':' + numberId);
        }
      });
    }
  });
}

/**
 * Auto-integrate on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  // If document-support-registry is loaded, activate indicators
  if (typeof DOCUMENT_SUPPORT !== 'undefined') {
    addSupportIndicators();
  }
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showSupportDrawerWithDocuments,
    addSupportIndicators,
    renderOriginalSupportInfo
  };
}
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
