/**
 * Reconciliation Modal - Document Upload Integration
 * Adds upload tab and import functionality to existing modals
 */

function initializeUploadIntegration() {
  // Wait for ReconciliationModal to load
  const originalOpenReconciliation = window.openReconciliation;

  window.openReconciliation = function(data) {
    // Call original
    originalOpenReconciliation(data);

    // Add upload tab after modal opens
    setTimeout(() => {
      const modal = document.querySelector('.recon-modal-overlay');
      if (modal && !modal.querySelector('.upload-tab-btn')) {
        addUploadTabToModal(modal);
      }
    }, 100);
  };
}

function addUploadTabToModal(modal) {
  const header = modal.querySelector('.recon-modal-header');
  if (!header) return;

  // Create tab container if needed
  let tabContainer = modal.querySelector('.recon-modal-tabs');
  if (!tabContainer) {
    tabContainer = document.createElement('div');
    tabContainer.className = 'recon-modal-tabs';
    tabContainer.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 12px 18px;
      border-bottom: 1px solid #e5e0d5;
      background: #f9f9f9;
      margin-top: 0;
    `;
    header.after(tabContainer);
  }

  // Add upload tab button
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'upload-tab-btn';
  uploadBtn.innerHTML = '📤 Import Data';
  uploadBtn.style.cssText = `
    padding: 8px 16px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #2e5b8a;
    transition: all 0.2s;
  `;

  uploadBtn.onmouseenter = () => {
    uploadBtn.style.background = '#e8f3ff';
    uploadBtn.style.borderColor = '#2e5b8a';
  };

  uploadBtn.onmouseleave = () => {
    uploadBtn.style.background = 'white';
    uploadBtn.style.borderColor = '#ddd';
  };

  uploadBtn.onclick = () => showUploadPanel(modal);
  tabContainer.appendChild(uploadBtn);

  // Add upload panel
  const content = modal.querySelector('.recon-modal-content');
  if (content && !content.querySelector('#uploadPanel')) {
    const uploadPanel = document.createElement('div');
    uploadPanel.id = 'uploadPanel';
    uploadPanel.style.display = 'none';
    uploadPanel.innerHTML = getUploadPanelHTML();
    content.appendChild(uploadPanel);

    setupUploadPanel(uploadPanel);
  }
}

function showUploadPanel(modal) {
  const content = modal.querySelector('.recon-modal-content');
  const tableSection = content.querySelector('.recon-table-section');
  const uploadPanel = content.querySelector('#uploadPanel');

  if (tableSection && uploadPanel) {
    tableSection.style.display = tableSection.style.display === 'none' ? 'block' : 'none';
    uploadPanel.style.display = uploadPanel.style.display === 'none' ? 'block' : 'none';
  }
}

function getUploadPanelHTML() {
  return `
    <div style="padding: 18px;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 700;">
        📤 Import Expenses
      </h3>

      <div style="background: #f0f4f8; border-left: 3px solid #2e5b8a; padding: 12px 15px; border-radius: 4px; margin-bottom: 20px; font-size: 12px; color: #333;">
        <strong>Supported Formats:</strong> CSV, JSON, TXT files<br>
        <strong>Columns Needed:</strong> Date, Description, Amount
      </div>

      <div id="uploadAreaPanel" style="border: 2px dashed #2e5b8a; border-radius: 8px; padding: 30px; text-align: center; background: #f8f9fa; cursor: pointer; transition: all 0.3s; margin-bottom: 20px;">
        <div style="font-size: 14px; color: #2e5b8a; margin-bottom: 8px; font-weight: 600;">
          📁 Click to upload or drag & drop
        </div>
        <div style="font-size: 12px; color: #666;">
          CSV, JSON, or TXT files up to 5MB
        </div>
        <input type="file" id="uploadFileInput" class="file-input" accept=".csv,.json,.txt" style="display: none;" />
      </div>

      <div id="uploadStatus" style="display: none; text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #2e5b8a; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div style="margin-top: 10px; color: #666; font-size: 12px;">Processing file...</div>
      </div>

      <div id="uploadResults" style="display: none;"></div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
}

function setupUploadPanel(panel) {
  const uploadArea = panel.querySelector('#uploadAreaPanel');
  const fileInput = panel.querySelector('#uploadFileInput');
  const uploadStatus = panel.querySelector('#uploadStatus');
  const uploadResults = panel.querySelector('#uploadResults');

  uploadArea.onclick = () => fileInput.click();

  uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.style.background = '#e8f3ff';
  };

  uploadArea.ondragleave = () => {
    uploadArea.style.background = '#f8f9fa';
  };

  uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.style.background = '#f8f9fa';
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0], panel);
    }
  };

  fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0], panel);
    }
  };
}

function processFile(file, panel) {
  const fileType = file.name.split('.').pop().toLowerCase();

  if (!['csv', 'json', 'txt'].includes(fileType)) {
    alert('Unsupported format. Use CSV, JSON, or TXT.');
    return;
  }

  const uploadArea = panel.querySelector('#uploadAreaPanel');
  const uploadStatus = panel.querySelector('#uploadStatus');
  const uploadResults = panel.querySelector('#uploadResults');

  uploadArea.style.display = 'none';
  uploadStatus.style.display = 'block';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      let items = [];

      if (fileType === 'csv') {
        items = parseCSV(e.target.result);
      } else if (fileType === 'json') {
        items = JSON.parse(e.target.result);
        if (!Array.isArray(items)) items = [items];
      } else if (fileType === 'txt') {
        items = parseTXT(e.target.result);
      }

      displayResults(items, uploadStatus, uploadResults, uploadArea, panel);
    } catch (error) {
      uploadStatus.style.display = 'none';
      uploadResults.style.display = 'block';
      uploadResults.innerHTML = `
        <div style="background: #ffebee; border: 1px solid #f44336; border-radius: 6px; padding: 15px; color: #c62828;">
          ⚠️ Error: ${error.message}
        </div>
      `;
      uploadArea.style.display = 'block';
    }
  };

  reader.readAsText(file);
}

function parseCSV(csv) {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    items.push(row);
  }

  return items;
}

function parseTXT(txt) {
  const lines = txt.split('\n');
  const items = [];

  lines.forEach(line => {
    if (line.trim()) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        items.push({
          date: parts[0],
          description: parts[1],
          amount: parts[2] || '0'
        });
      }
    }
  });

  return items;
}

function displayResults(items, uploadStatus, uploadResults, uploadArea, panel) {
  uploadStatus.style.display = 'none';
  uploadResults.style.display = 'block';

  const summary = `
    <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 600; color: #333;">Items Imported:</span>
        <span style="color: #2e7d32; font-weight: 700; font-size: 18px;">${items.length}</span>
      </div>
      <div style="font-size: 12px; color: #666;">
        Total amount: $${items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)}
      </div>
    </div>

    <button style="
      width: 100%;
      padding: 12px;
      background: #2e5b8a;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
    " onclick="addImportedItemsToModal(${JSON.stringify(items).replace(/"/g, '&quot;')})">
      ✅ Add ${items.length} Expenses to Reconciliation
    </button>

    <button style="
      width: 100%;
      padding: 12px;
      background: white;
      color: #2e5b8a;
      border: 1px solid #2e5b8a;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    " onclick="location.reload()">
      ↺ Cancel
    </button>
  `;

  uploadResults.innerHTML = summary;
}

function addImportedItemsToModal(items) {
  // Store in session
  sessionStorage.setItem('importedItems', JSON.stringify(items));

  alert(`✅ Added ${items.length} expenses! They will be saved to the database.`);

  // Optionally close modal and reload
  const modal = document.querySelector('.recon-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUploadIntegration);
} else {
  initializeUploadIntegration();
}
