/* ===========================================================
   Document Reference System - Links calculated numbers to source documents
   Allows any displayed number to be clicked to reveal supporting evidence
   =========================================================== */

// ============================
// 1. DATA STRUCTURES
// ============================

/**
 * Represents a single calculated value linked to documents
 */
class CalculationReference {
  constructor(config) {
    this.id = config.id || this.generateId();
    this.displayValue = config.displayValue;          // The number/text shown to user
    this.description = config.description;            // "Annual income from W-2", etc.
    this.category = config.category;                  // 'income', 'expense', 'asset', 'calculation'
    this.documentIds = config.documentIds || [];      // Array of linked document IDs
    this.exhibits = config.exhibits || [];            // Array of exhibit objects (name, file, page, etc.)
    this.method = config.method || '';                // How/why this number was calculated
    this.breakdown = config.breakdown || [];          // [{ k: label, v: value }, ...]
    this.highlightRefs = config.highlightRefs || [];  // References to highlights in docs
    this.metadata = config.metadata || {};            // Custom metadata (date range, source, etc.)
    this.timestamp = new Date();
  }

  generateId() {
    return `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a document reference to this calculation
   */
  addDocument(docId, exhibit) {
    if (!this.documentIds.includes(docId)) {
      this.documentIds.push(docId);
    }
    if (exhibit) {
      this.exhibits.push(exhibit);
    }
  }

  /**
   * Add a highlight reference (e.g., specific page/section in a document)
   */
  addHighlight(docId, highlightInfo) {
    this.highlightRefs.push({
      docId,
      page: highlightInfo.page,
      label: highlightInfo.label,
      value: highlightInfo.value,
      ref: highlightInfo.ref,
      timestamp: new Date()
    });
  }

  /**
   * Get all linked documents
   */
  getDocuments() {
    return this.documentIds;
  }

  /**
   * Get all exhibits for display
   */
  getExhibits() {
    return this.exhibits;
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      id: this.id,
      displayValue: this.displayValue,
      description: this.description,
      category: this.category,
      documentIds: this.documentIds,
      exhibits: this.exhibits,
      method: this.method,
      breakdown: this.breakdown,
      highlightRefs: this.highlightRefs,
      metadata: this.metadata,
      timestamp: this.timestamp
    };
  }
}

/**
 * Module-wide document link manager
 * Tracks all calculations and their document references for a module/case
 */
class DocumentLinkManager {
  constructor(caseId, moduleName) {
    this.caseId = caseId;
    this.moduleName = moduleName;
    this.calculations = new Map();  // id -> CalculationReference
    this.documentCache = new Map(); // docId -> document metadata
    this.linkIndex = new Map();     // docId -> [calc IDs] for reverse lookup
    this.api = typeof api !== 'undefined' ? api : null;
  }

  /**
   * Register a calculated value with document references
   */
  registerCalculation(config) {
    const calc = new CalculationReference(config);
    this.calculations.set(calc.id, calc);

    // Update reverse index
    calc.documentIds.forEach(docId => {
      if (!this.linkIndex.has(docId)) {
        this.linkIndex.set(docId, []);
      }
      this.linkIndex.get(docId).push(calc.id);
    });

    return calc;
  }

  /**
   * Find a calculation by ID
   */
  getCalculation(calcId) {
    return this.calculations.get(calcId);
  }

  /**
   * Find all calculations linked to a document
   */
  getCalculationsByDocument(docId) {
    const calcIds = this.linkIndex.get(docId) || [];
    return calcIds
      .map(id => this.calculations.get(id))
      .filter(calc => calc !== undefined);
  }

  /**
   * Get all calculations in this module
   */
  getAllCalculations() {
    return Array.from(this.calculations.values());
  }

  /**
   * Cache document metadata for quick lookup
   */
  cacheDocument(docId, metadata) {
    this.documentCache.set(docId, metadata);
  }

  /**
   * Get cached document info
   */
  getDocumentInfo(docId) {
    return this.documentCache.get(docId);
  }

  /**
   * Load document references from server for this case/module
   */
  async loadDocumentReferences() {
    if (!this.api) return;
    try {
      const response = await this.api.getDocuments(this.caseId);
      if (response && response.documents) {
        response.documents.forEach(doc => {
          this.cacheDocument(doc._id, {
            id: doc._id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            category: doc.category,
            s3Url: doc.s3Url,
            uploadedAt: doc.uploadedAt,
            metadata: doc.metadata
          });
        });
      }
    } catch (error) {
      console.error('Failed to load document references:', error);
    }
  }

  /**
   * Export all calculations with their document links
   */
  export() {
    return {
      caseId: this.caseId,
      moduleName: this.moduleName,
      calculations: Array.from(this.calculations.values()).map(c => c.toJSON()),
      documentCache: Object.fromEntries(this.documentCache),
      exportedAt: new Date()
    };
  }

  /**
   * Import calculations with document links
   */
  import(data) {
    if (data.calculations) {
      data.calculations.forEach(calcData => {
        const calc = new CalculationReference(calcData);
        this.calculations.set(calc.id, calc);
      });
    }
  }
}

// ============================
// 2. GLOBAL MANAGER INSTANCE
// ============================

let documentLinkManager = null;

/**
 * Initialize the document link manager for the current module
 */
function initializeDocumentLinking(caseId, moduleName) {
  documentLinkManager = new DocumentLinkManager(caseId, moduleName);
  return documentLinkManager;
}

/**
 * Get the current document link manager
 */
function getDocumentLinkManager() {
  if (!documentLinkManager) {
    console.warn('DocumentLinkManager not initialized. Call initializeDocumentLinking() first.');
  }
  return documentLinkManager;
}

// ============================
// 3. UI INTEGRATION HELPERS
// ============================

/**
 * Make a number clickable and link it to documents
 * Usage: <span class="doc-link" data-calc-id="income_w2_2025">$236,819</span>
 */
function makeNumberClickable(element, calcId) {
  if (!element) return;

  const manager = getDocumentLinkManager();
  if (!manager) return;

  const calc = manager.getCalculation(calcId);
  if (!calc) {
    console.warn(`Calculation ${calcId} not found in manager`);
    return;
  }

  // Add visual indicator that this is clickable
  element.classList.add('doc-linked');
  element.setAttribute('data-calc-id', calcId);
  element.style.cursor = 'pointer';
  element.title = `Click to view source documents (${calc.documentIds.length} linked)`;

  // Add click handler
  element.addEventListener('click', (e) => {
    e.stopPropagation();
    showDocumentModal(calcId);
  });
}

/**
 * Auto-link all elements with data-calc-id attribute
 */
function autoLinkNumbers() {
  const manager = getDocumentLinkManager();
  if (!manager) return;

  const elements = document.querySelectorAll('[data-calc-id]');
  elements.forEach(el => {
    const calcId = el.getAttribute('data-calc-id');
    makeNumberClickable(el, calcId);
  });
}

/**
 * Create a linked value HTML span
 */
function createLinkedValue(value, calcId, className = '') {
  return `<span class="doc-link ${className}" data-calc-id="${calcId}">${value}</span>`;
}

// ============================
// 4. MODAL DISPLAY
// ============================

/**
 * Show the document reference modal for a calculation
 */
function showDocumentModal(calcId) {
  const manager = getDocumentLinkManager();
  if (!manager) return;

  const calc = manager.getCalculation(calcId);
  if (!calc) {
    console.error(`Calculation ${calcId} not found`);
    return;
  }

  // Build modal content
  const modalContent = buildModalContent(calc, manager);

  // Show/create modal
  let modal = document.getElementById('docLinkModal');
  if (!modal) {
    modal = createModal();
    document.body.appendChild(modal);
  }

  // Populate and show
  const contentArea = modal.querySelector('.modal-body');
  contentArea.innerHTML = modalContent;

  // Attach event handlers
  attachModalHandlers(modal, calc, manager);

  // Show modal
  modal.classList.add('active');
}

/**
 * Create the modal element (one-time initialization)
 */
function createModal() {
  const modal = document.createElement('div');
  modal.id = 'docLinkModal';
  modal.className = 'doc-link-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">Source Documents</h2>
        <button class="modal-close" aria-label="Close" type="button">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <!-- Content populated dynamically -->
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="docLinkModalClose">Close</button>
      </div>
    </div>
  `;

  // Close handlers
  modal.querySelector('.modal-close').addEventListener('click', () => hideDocumentModal());
  modal.querySelector('#docLinkModalClose').addEventListener('click', () => hideDocumentModal());
  modal.querySelector('.modal-overlay').addEventListener('click', () => hideDocumentModal());

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      hideDocumentModal();
    }
  });

  return modal;
}

/**
 * Hide the document modal
 */
function hideDocumentModal() {
  const modal = document.getElementById('docLinkModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Build the modal content HTML
 */
function buildModalContent(calc, manager) {
  let html = '';

  // Section 1: Calculation overview
  html += `
    <div class="doc-section doc-section-calculation">
      <h3>Calculation: ${calc.description}</h3>
      <div class="doc-value-display">
        <div class="doc-value-large">${calc.displayValue}</div>
        <div class="doc-value-category">${calc.category}</div>
      </div>
  `;

  // Method explanation
  if (calc.method) {
    html += `
      <div class="doc-method">
        <strong>Method:</strong> ${escapeHtml(calc.method)}
      </div>
    `;
  }

  // Breakdown
  if (calc.breakdown && calc.breakdown.length > 0) {
    html += '<div class="doc-breakdown"><strong>Breakdown:</strong><table>';
    calc.breakdown.forEach(item => {
      const highlight = item.hi ? ' class="highlight"' : '';
      const total = item.tot ? ' style="font-weight: bold; border-top: 1px solid #ccc; padding-top: 8px;"' : '';
      html += `<tr${highlight}${total}><td>${escapeHtml(item.k)}</td><td>${escapeHtml(item.v)}</td></tr>`;
    });
    html += '</table></div>';
  }

  html += '</div>';

  // Section 2: Linked documents
  if (calc.exhibits && calc.exhibits.length > 0) {
    html += '<div class="doc-section doc-section-exhibits">';
    html += '<h3>Supporting Documents</h3>';

    calc.exhibits.forEach((exhibit, idx) => {
      html += buildExhibitHTML(exhibit, idx, calc.id);
    });

    html += '</div>';
  } else if (calc.documentIds && calc.documentIds.length > 0) {
    html += '<div class="doc-section doc-section-exhibits">';
    html += '<h3>Linked Documents</h3>';

    calc.documentIds.forEach((docId, idx) => {
      const docInfo = manager.getDocumentInfo(docId);
      html += buildDocumentHTML(docId, docInfo, idx);
    });

    html += '</div>';
  } else {
    html += '<div class="doc-alert alert-info">No documents linked to this calculation yet.</div>';
  }

  return html;
}

/**
 * Build HTML for an exhibit with metadata
 */
function buildExhibitHTML(exhibit, idx, calcId) {
  let html = `
    <div class="exhibit-card" data-exhibit-idx="${idx}" data-calc-id="${calcId}">
      <div class="exhibit-header">
        <div class="exhibit-title">${escapeHtml(exhibit.name)}</div>
        <div class="exhibit-meta">
          <span class="badge badge-${exhibit.kind}">${exhibit.kind}</span>
          ${exhibit.page ? `<span class="exhibit-page">p. ${exhibit.page}</span>` : ''}
          ${exhibit.period ? `<span class="exhibit-period">${escapeHtml(exhibit.period)}</span>` : ''}
        </div>
      </div>

      ${exhibit.docTitle ? `<div class="exhibit-doctitle">${escapeHtml(exhibit.docTitle)}</div>` : ''}
      ${exhibit.payer ? `<div class="exhibit-payer">Payer: ${escapeHtml(exhibit.payer)}</div>` : ''}

      ${buildHighlightsHTML(exhibit)}
      ${buildRowsHTML(exhibit)}

      <div class="exhibit-actions">
        ${exhibit.file ? `
          <a href="${escapeHtml(exhibit.file)}" target="_blank" class="btn btn-sm btn-primary">
            View Document
          </a>
        ` : `
          <span class="exhibit-note-missing">Document file not available</span>
        `}
      </div>

      ${exhibit.flag ? `<div class="exhibit-flag alert-warning">${escapeHtml(exhibit.flag)}</div>` : ''}
      ${exhibit.foot ? `<div class="exhibit-footer">${escapeHtml(exhibit.foot)}</div>` : ''}
    </div>
  `;

  return html;
}

/**
 * Build HTML for highlights within an exhibit
 */
function buildHighlightsHTML(exhibit) {
  if (!exhibit.highlights || exhibit.highlights.length === 0) {
    return '';
  }

  let html = '<div class="exhibit-highlights"><strong>Key Highlights:</strong><ul>';
  exhibit.highlights.forEach(h => {
    if (h.pending) {
      html += `
        <li class="highlight-pending">
          <span class="highlight-label">${escapeHtml(h.label)}</span>
          <span class="highlight-value">${escapeHtml(h.value)}</span>
          <span class="highlight-ref">${escapeHtml(h.ref)}</span>
          <span class="badge badge-warning">Pending verification</span>
        </li>
      `;
    } else {
      html += `
        <li>
          <span class="highlight-label">${escapeHtml(h.label)}</span>
          <span class="highlight-value">${escapeHtml(h.value)}</span>
          <span class="highlight-ref">${escapeHtml(h.ref)}</span>
          ${h.pg ? `<span class="highlight-page">p. ${h.pg}</span>` : ''}
        </li>
      `;
    }
  });
  html += '</ul></div>';
  return html;
}

/**
 * Build HTML for table rows within an exhibit
 */
function buildRowsHTML(exhibit) {
  if (!exhibit.rows || exhibit.rows.length === 0) {
    return '';
  }

  let html = '<div class="exhibit-rows"><table>';
  exhibit.rows.forEach(row => {
    const highlight = row.hi ? ' class="highlight"' : '';
    html += `<tr${highlight}><td>${escapeHtml(row.k)}</td><td>${escapeHtml(row.v)}</td></tr>`;
  });
  html += '</table></div>';
  return html;
}

/**
 * Build HTML for a generic document reference
 */
function buildDocumentHTML(docId, docInfo, idx) {
  if (!docInfo) {
    return `<div class="document-card">Document ${docId} (metadata not available)</div>`;
  }

  return `
    <div class="document-card" data-doc-id="${docId}">
      <div class="document-title">${escapeHtml(docInfo.fileName)}</div>
      <div class="document-meta">
        <span class="badge">${docInfo.fileType}</span>
        <span class="badge">${docInfo.category}</span>
        ${docInfo.uploadedAt ? `<span class="timestamp">${new Date(docInfo.uploadedAt).toLocaleDateString()}</span>` : ''}
      </div>
      ${docInfo.s3Url ? `
        <div class="document-actions">
          <a href="${escapeHtml(docInfo.s3Url)}" target="_blank" class="btn btn-sm btn-primary">
            Open Document
          </a>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Attach event handlers to modal
 */
function attachModalHandlers(modal, calc, manager) {
  // Exhibit click handlers (for future expansion - view full document, zoom, etc.)
  const exhibits = modal.querySelectorAll('.exhibit-card');
  exhibits.forEach(exhibit => {
    exhibit.addEventListener('click', function(e) {
      if (e.target.closest('.exhibit-actions a')) {
        // Let link handle it
        return;
      }
      // Could add expand/collapse or additional actions here
    });
  });
}

// ============================
// 5. UTILITY FUNCTIONS
// ============================

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (typeof window !== 'undefined' && typeof window.renderSafeText === 'function') {
    return window.renderSafeText(text);
  }

  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Format currency for display
 */
function formatCurrency(value) {
  if (typeof value === 'string') {
    return value;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format a calculation reference for display in HTML
 */
function displayCalculationWithLink(calc, className = '') {
  if (!calc) return '';
  return `<span class="doc-link ${className}" data-calc-id="${calc.id}">${escapeHtml(calc.displayValue)}</span>`;
}

/**
 * Convert SUPPORT object (from modules like spousal.js) to CalculationReferences
 */
function importFromSupportObject(supportObj, manager, moduleContext) {
  if (!manager) return;

  Object.entries(supportObj).forEach(([key, support]) => {
    if (!support || !support.breakdown) return;

    // Find the primary value from breakdown (usually marked with tot: true or last item)
    const primary = support.breakdown.find(b => b.tot) || support.breakdown[support.breakdown.length - 1];
    if (!primary) return;

    const config = {
      id: key,
      displayValue: primary.v,
      description: support.method ? support.method.substring(0, 100) + '...' : key,
      category: moduleContext || 'calculation',
      exhibits: support.exhibits || [],
      method: support.method,
      breakdown: support.breakdown,
      documentIds: (support.exhibits || [])
        .filter(ex => ex.file)
        .map((ex, idx) => `${key}_exhibit_${idx}`)
    };

    manager.registerCalculation(config);
  });
}

// ============================
// 6. EXPORT FOR USE
// ============================

// Make classes available globally
window.CalculationReference = CalculationReference;
window.DocumentLinkManager = DocumentLinkManager;

// Export functions
window.DocumentLinking = {
  initializeDocumentLinking,
  getDocumentLinkManager,
  makeNumberClickable,
  autoLinkNumbers,
  createLinkedValue,
  showDocumentModal,
  hideDocumentModal,
  escapeHtml,
  formatCurrency,
  displayCalculationWithLink,
  importFromSupportObject
};
