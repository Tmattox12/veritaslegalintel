/**
 * Document Upload & Mapping UI
 * Handles file upload, auto-mapping display, and manual mapping interface
 */

class DocumentUploadUI {
  constructor(modalId = 'reconciliation-modal') {
    this.modalId = modalId;
    this.parser = new DocumentParser();
    this.currentMappingSession = null;
    this.initializeStyles();
  }

  // Add styles to page
  initializeStyles() {
    if (document.getElementById('doc-upload-styles')) return;

    const styles = `
      #doc-upload-styles {
        display: none;
      }

      .upload-tab-content {
        padding: 18px;
        display: none;
      }

      .upload-tab-content.active {
        display: block;
      }

      .upload-area {
        border: 2px dashed #2e5b8a;
        border-radius: 8px;
        padding: 30px;
        text-align: center;
        background: #f8f9fa;
        cursor: pointer;
        transition: all 0.3s;
        margin-bottom: 20px;
      }

      .upload-area:hover {
        background: #e8f3ff;
        border-color: #1f5f9d;
      }

      .upload-area.dragover {
        background: #dde8f7;
        border-color: #1f5f9d;
      }

      .upload-area-text {
        font-size: 14px;
        color: #2e5b8a;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .upload-area-sub {
        font-size: 12px;
        color: #666;
      }

      .file-input {
        display: none;
      }

      .upload-formats {
        background: #f0f4f8;
        border-left: 3px solid #2e5b8a;
        padding: 12px 15px;
        border-radius: 4px;
        margin-bottom: 20px;
        font-size: 12px;
        color: #333;
      }

      .mapping-results {
        margin-top: 20px;
      }

      .mapping-summary {
        background: #e8f5e9;
        border: 1px solid #4caf50;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 20px;
      }

      .mapping-summary.partial {
        background: #fff8e1;
        border-color: #fbc02d;
      }

      .mapping-summary.error {
        background: #ffebee;
        border-color: #f44336;
      }

      .summary-stat {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
      }

      .summary-stat:last-child {
        margin-bottom: 0;
      }

      .stat-label {
        font-weight: 600;
        color: #333;
      }

      .stat-value {
        color: #2e5b8a;
        font-weight: 700;
      }

      .unmapped-section {
        margin-top: 30px;
      }

      .unmapped-title {
        font-size: 14px;
        font-weight: 700;
        color: #333;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e5e0d5;
      }

      .unmapped-item {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 15px;
        transition: all 0.2s;
      }

      .unmapped-item:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .unmapped-info {
        flex: 1;
      }

      .unmapped-date {
        font-size: 11px;
        color: #999;
        margin-bottom: 4px;
      }

      .unmapped-desc {
        font-size: 13px;
        color: #333;
        font-weight: 500;
        margin-bottom: 6px;
      }

      .unmapped-amount {
        font-size: 13px;
        font-weight: 700;
        color: #2e5b8a;
      }

      .unmapped-select {
        min-width: 200px;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        background: white;
      }

      .unmapped-map-btn {
        padding: 6px 12px;
        background: #2e5b8a;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
      }

      .unmapped-map-btn:hover {
        background: #1f5f9d;
      }

      .mapped-item {
        background: #f0f8f5;
        border: 1px solid #4caf50;
        border-radius: 6px;
        padding: 12px 15px;
        margin-bottom: 10px;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mapped-check {
        color: #4caf50;
        font-weight: 700;
        font-size: 14px;
      }

      .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #2e5b8a;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .tab-buttons {
        display: flex;
        gap: 10px;
        border-bottom: 2px solid #e5e0d5;
        margin-bottom: 0;
      }

      .tab-btn {
        padding: 12px 20px;
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #666;
        transition: all 0.2s;
      }

      .tab-btn.active {
        color: #2e5b8a;
        border-bottom-color: #2e5b8a;
      }

      .tab-btn:hover {
        color: #2e5b8a;
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'doc-upload-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  /**
   * Create upload tab in modal
   */
  createUploadTab(modal) {
    const modalBody = modal.querySelector('.veritas-modal-body') || modal.querySelector('.modal-body');
    if (!modalBody) return;

    // Create tab buttons if not exists
    let tabContainer = modal.querySelector('.tab-buttons');
    if (!tabContainer) {
      tabContainer = document.createElement('div');
      tabContainer.className = 'tab-buttons';
      modalBody.parentNode.insertBefore(tabContainer, modalBody);
    }

    // Add upload tab button
    if (!tabContainer.querySelector('[data-tab="upload"]')) {
      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'tab-btn';
      uploadBtn.setAttribute('data-tab', 'upload');
      uploadBtn.textContent = '📤 Import Data';
      uploadBtn.onclick = () => this.switchTab('upload', modal);
      tabContainer.appendChild(uploadBtn);
    }

    // Create upload tab content
    let uploadContent = modalBody.querySelector('[data-tab-content="upload"]');
    if (!uploadContent) {
      uploadContent = document.createElement('div');
      uploadContent.className = 'upload-tab-content';
      uploadContent.setAttribute('data-tab-content', 'upload');
      uploadContent.innerHTML = this.getUploadHTML();
      modalBody.parentNode.appendChild(uploadContent);

      // Setup event listeners
      this.setupUploadListeners(uploadContent);
    }

    return uploadContent;
  }

  /**
   * Get upload interface HTML
   */
  getUploadHTML() {
    return `
      <div class="upload-section">
        <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 700; color: #333;">
          Import Expenses from Document
        </h3>

        <div class="upload-formats">
          <strong>Supported Formats:</strong> CSV, JSON, TXT<br>
          <strong>Example CSV:</strong> Date | Description | Amount
        </div>

        <div class="upload-area" id="uploadArea">
          <div class="upload-area-text">📁 Click to upload or drag & drop</div>
          <div class="upload-area-sub">CSV, JSON, or TXT files up to 5MB</div>
          <input type="file" class="file-input" id="fileInput" accept=".csv,.json,.txt" />
        </div>

        <div id="uploadProgress" style="display: none; text-align: center;">
          <div class="loading-spinner"></div>
          <div style="margin-top: 10px; color: #666; font-size: 12px;">Processing file...</div>
        </div>

        <div id="mappingResults" class="mapping-results" style="display: none;"></div>
      </div>
    `;
  }

  /**
   * Setup upload event listeners
   */
  setupUploadListeners(container) {
    const uploadArea = container.querySelector('#uploadArea');
    const fileInput = container.querySelector('#fileInput');
    const progressDiv = container.querySelector('#uploadProgress');
    const resultsDiv = container.querySelector('#mappingResults');

    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0], container);
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0], container);
      }
    });
  }

  /**
   * Handle file upload and processing
   */
  async handleFile(file, container) {
    const fileType = file.name.split('.').pop().toLowerCase();

    if (!['csv', 'json', 'txt'].includes(fileType)) {
      alert('Unsupported file format. Use CSV, JSON, or TXT.');
      return;
    }

    const uploadArea = container.querySelector('#uploadArea');
    const progressDiv = container.querySelector('#uploadProgress');
    const resultsDiv = container.querySelector('#mappingResults');

    uploadArea.style.display = 'none';
    progressDiv.style.display = 'block';

    try {
      // Parse document
      const parseResult = await this.parser.parseDocument(file, fileType);

      if (!parseResult.success) {
        throw new Error(parseResult.error);
      }

      // Auto-map transactions
      const mappingResult = this.parser.autoMapTransactions(parseResult.items);

      // Store session
      this.currentMappingSession = {
        file: file.name,
        parseResult,
        mappingResult,
        timestamp: new Date()
      };

      // Display results
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      resultsDiv.innerHTML = this.getMappingResultsHTML(mappingResult);

      // Setup mapping handlers
      this.setupMappingHandlers(container, mappingResult);
    } catch (error) {
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      resultsDiv.innerHTML = `
        <div class="mapping-summary error">
          <div class="summary-stat">
            <span class="stat-label">⚠️ Error:</span>
            <span class="stat-value">${error.message}</span>
          </div>
        </div>
      `;
      uploadArea.style.display = 'block';
    }
  }

  /**
   * Get mapping results HTML
   */
  getMappingResultsHTML(result) {
    const { mapped, unmapped, mappingRate } = result;

    let html = `
      <div class="mapping-summary ${mappingRate < 100 ? (mappingRate > 50 ? 'partial' : 'error') : ''}">
        <div class="summary-stat">
          <span class="stat-label">Total Imported:</span>
          <span class="stat-value">${mapped.length + unmapped.length} items</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Auto-Mapped:</span>
          <span class="stat-value">${mapped.length} (${mappingRate}%)</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Need Manual Review:</span>
          <span class="stat-value">${unmapped.length} items</span>
        </div>
      </div>
    `;

    // Show unmapped items if any
    if (unmapped.length > 0) {
      html += `<div class="unmapped-section">
        <div class="unmapped-title">📋 Items Requiring Manual Mapping</div>
        <div id="unmappedList"></div>
      </div>`;
    }

    // Action buttons
    html += `
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button class="btn btn-primary" id="importBtn" onclick="documentUploadUI.importMappedData()">
          ✅ Import ${mapped.length + unmapped.length} Expenses
        </button>
        <button class="btn btn-secondary" onclick="documentUploadUI.resetUpload()">
          ↺ Upload Another File
        </button>
      </div>
    `;

    return html;
  }

  /**
   * Setup mapping handlers for unmapped items
   */
  setupMappingHandlers(container, result) {
    const { unmapped } = result;
    if (unmapped.length === 0) return;

    const unmappedList = container.querySelector('#unmappedList');
    if (!unmappedList) return;

    unmappedList.innerHTML = unmapped.map((item, idx) => `
      <div class="unmapped-item" id="item-${idx}">
        <div class="unmapped-info">
          <div class="unmapped-date">${item.date || 'No Date'}</div>
          <div class="unmapped-desc">${item.description}</div>
          <div class="unmapped-amount">$${item.amount.toFixed(2)}</div>
        </div>
        <select class="unmapped-select" id="category-${idx}" onchange="documentUploadUI.updateItemMapping(${idx}, this.value)">
          <option value="">Select Category...</option>
          ${this.getCategoryOptions()}
        </select>
        <button class="unmapped-map-btn" onclick="documentUploadUI.manualMapItem(${idx})">
          Map →
        </button>
      </div>
    `).join('');
  }

  /**
   * Get category options for dropdown
   */
  getCategoryOptions() {
    const categories = {
      'health_insurance': '🏥 Health Insurance',
      'childcare': '👶 Childcare',
      'medical_dental': '🦷 Medical/Dental',
      'education': '📚 Education',
      'housing': '🏠 Housing',
      'utilities': '⚡ Utilities',
      'transportation': '🚗 Transportation',
      'food': '🍔 Food'
    };

    return Object.entries(categories)
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join('');
  }

  /**
   * Manually map an item
   */
  manualMapItem(index) {
    const categorySelect = document.querySelector(`#category-${index}`);
    const category = categorySelect.value;

    if (!category) {
      alert('Please select a category');
      return;
    }

    if (this.currentMappingSession) {
      const item = this.currentMappingSession.mappingResult.unmapped[index];
      if (item) {
        item.mappedCategory = category;
        item.status = 'manually_mapped';

        // Update UI
        const itemDiv = document.querySelector(`#item-${index}`);
        itemDiv.innerHTML = `
          <div class="mapped-item">
            <span>${item.date} | ${item.description}</span>
            <span style="font-weight: 700;">$${item.amount.toFixed(2)}</span>
            <span class="mapped-check">✓</span>
          </div>
        `;
      }
    }
  }

  /**
   * Import mapped data to reconciliation
   */
  importMappedData() {
    if (!this.currentMappingSession) return;

    const { mappingResult } = this.currentMappingSession;
    const { mapped, unmapped } = mappingResult;

    const allMapped = [...mapped, ...unmapped.filter(i => i.status === 'manually_mapped')];

    if (allMapped.length === 0) {
      alert('No items to import. Please map all items first.');
      return;
    }

    // Store in localStorage
    const importData = {
      timestamp: new Date().toISOString(),
      fileName: this.currentMappingSession.file,
      items: allMapped,
      count: allMapped.length
    };

    let imports = JSON.parse(localStorage.getItem('reconciliation_imports') || '[]');
    imports.push(importData);
    localStorage.setItem('reconciliation_imports', JSON.stringify(imports));

    alert(`✅ Imported ${allMapped.length} expenses successfully!`);
    this.resetUpload();

    // Trigger update event
    window.dispatchEvent(new CustomEvent('reconciliationDataImported', { detail: importData }));
  }

  /**
   * Reset upload UI
   */
  resetUpload() {
    this.currentMappingSession = null;
    const fileInput = document.querySelector('#fileInput');
    if (fileInput) fileInput.value = '';
    location.reload();
  }

  /**
   * Switch between tabs
   */
  switchTab(tab, modal) {
    // Update buttons
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    // Update content
    modal.parentNode.querySelectorAll('[data-tab-content]').forEach(content => {
      content.classList.toggle('active', content.getAttribute('data-tab-content') === tab);
    });
  }
}

// Initialize globally
let documentUploadUI = null;
document.addEventListener('DOMContentLoaded', () => {
  if (!documentUploadUI) {
    documentUploadUI = new DocumentUploadUI();
  }
});
