let currentMatterId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Load current matter from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  currentMatterId = urlParams.get('matter') || localStorage.getItem('currentMatterId');

  if (!currentMatterId) {
    showError('No matter selected. Please go back and select a matter first.');
    return;
  }

  initializeDropzone();
  loadUploadedDocuments();
});

function initializeDropzone() {
  const dropzone = document.querySelector('.dropzone');
  const fileInput = document.querySelector('input[type="file"]');

  if (!dropzone || !fileInput) return;

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('active');
    const files = e.dataTransfer.files;
    handleFileSelection(files);
  });

  // Click to browse
  dropzone.addEventListener('click', () => fileInput.click());

  const browseBtn = document.querySelector('.dz-browse');
  if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  fileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files);
  });
}

async function handleFileSelection(files) {
  const queue = document.querySelector('.upload-queue') || createUploadQueue();

  for (const file of files) {
    // Only process PDFs
    if (file.type !== 'application/pdf') {
      showError(`${file.name} is not a PDF. Only PDF files are supported.`);
      continue;
    }

    const uploadId = 'upload-' + Date.now() + '-' + Math.random();

    // Check for duplicates before creating upload item
    const isDuplicate = await checkForDuplicate(file);
    if (isDuplicate) {
      window.pendingFile = file;
      window.pendingUploadId = uploadId;
      showDuplicateWarning(file, uploadId, queue);
      return; // Stop and wait for user decision
    }

    const uploadItem = createUploadItem(uploadId, file.name);
    queue.appendChild(uploadItem);
    uploadFile(file, uploadId);
  }
}

async function checkForDuplicate(file) {
  if (!currentMatterId) return false;

  try {
    // Calculate file hash
    const hash = await calculateFileHash(file);

    // Get existing documents
    const response = await fetch(`/api/matters/${currentMatterId}/documents`);
    const documents = await response.json();

    // Check for matching filename or hash
    const duplicate = documents.find(doc =>
      doc.filename === file.name || doc.file_hash === hash
    );

    return duplicate ? { ...duplicate, hash } : null;
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return false;
  }
}

async function calculateFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showDuplicateWarning(file, uploadId, queue) {
  // Create modal for duplicate warning
  const modal = document.createElement('div');
  modal.className = 'duplicate-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
      <h2 style="margin: 0 0 12px 0; color: #1a1a1a;">📄 Duplicate Document</h2>
      <p style="color: #666; margin: 0 0 20px 0;">
        <strong>${file.name}</strong> appears to already be in this case.
      </p>
      <p style="color: #999; font-size: 13px; margin: 0 0 24px 0;">
        What would you like to do?
      </p>
      <div style="display: flex; gap: 12px;">
        <button onclick="this.closest('.duplicate-modal').remove()" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #666; cursor: pointer; font-weight: 600;">
          Ignore
        </button>
        <button onclick="window.uploadDuplicate('${uploadId}', false); this.closest('.duplicate-modal').remove()" style="flex: 1; padding: 10px; border: 1px solid #1c3f66; border-radius: 8px; background: white; color: #1c3f66; cursor: pointer; font-weight: 600;">
          Upload Anyway
        </button>
        <button onclick="window.uploadDuplicate('${uploadId}', true); this.closest('.duplicate-modal').remove()" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #ff9800; color: white; cursor: pointer; font-weight: 600;">
          Replace
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Store file for deferred upload
window.pendingFile = null;
window.pendingUploadId = null;

window.uploadDuplicate = function(uploadId, replace) {
  if (window.pendingFile) {
    const uploadItem = createUploadItem(uploadId, window.pendingFile.name);
    const queue = document.querySelector('.upload-queue') || createUploadQueue();
    queue.appendChild(uploadItem);
    uploadFile(window.pendingFile, uploadId, replace);
    window.pendingFile = null;
  }
}

function createUploadQueue() {
  const parent = document.querySelector('.intake-grid') || document.querySelector('main');
  const queue = document.createElement('div');
  queue.className = 'upload-queue';
  parent.insertBefore(queue, parent.firstChild);
  return queue;
}

function createUploadItem(id, filename) {
  const item = document.createElement('div');
  item.id = id;
  item.className = 'upload-item processing';
  item.innerHTML = `
    <div class="upload-name">${filename}</div>
    <div class="upload-bar">
      <div class="upload-bar-fill" style="width: 0%"></div>
    </div>
    <div class="upload-status">Uploading...</div>
  `;
  return item;
}

async function uploadFile(file, uploadId, replace = false) {
  const item = document.getElementById(uploadId);
  const statusEl = item.querySelector('.upload-status');
  const barEl = item.querySelector('.upload-bar-fill');

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', getCurrentUserId());
    if (replace) formData.append('replace', 'true');

    // Simulate progress updates
    let progress = 10;
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 20;
        barEl.style.width = progress + '%';
      }
    }, 100);

    const response = await fetch(`/api/matters/${currentMatterId}/bank-statements/upload`, {
      method: 'POST',
      body: formData,
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    barEl.style.width = '100%';

    // Show success details
    const summary = result.summary;
    const action = replace ? '🔄 Replaced' : '✅ Processed';
    statusEl.innerHTML = `
      ${action}: ${summary.transactionCount} transactions, ${summary.incomeItemsCreated} income items, ${summary.flagsRaised} flags detected
    `;

    item.classList.remove('processing');
    item.classList.add('complete');

    // Store extracted data for case intake form
    if (result.extracted) {
      const bankStatementsData = {
        incomeItems: result.extracted.incomeItems || [],
        flags: result.extracted.flags || [],
        transactions: result.extracted.transactions || [],
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('bankStatementsData', JSON.stringify(bankStatementsData));
      console.log('✓ Bank statement data saved for case intake');
    }

    // Reload document list
    loadUploadedDocuments();
  } catch (error) {
    clearInterval(progressInterval);
    statusEl.textContent = `❌ Error: ${error.message}`;
    item.classList.remove('processing');
    item.classList.add('error');
  }
}

async function loadUploadedDocuments() {
  if (!currentMatterId) return;

  try {
    const response = await fetch(`/api/matters/${currentMatterId}/documents`);
    const documents = await response.json();

    // Filter for financial statements (bank statements, credit card statements, etc.)
    const bankStatements = documents.filter(d => d.category === 'financial_statement');

    // Group by document for display
    const container = document.querySelector('.category-section') || createCategorySection();

    if (bankStatements.length === 0) {
      container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">No bank statements uploaded yet.</div>';
      return;
    }

    let html = '<div class="category-title">📊 Bank Statements</div><div class="doc-list">';
    bankStatements.forEach(doc => {
      html += `
        <div class="doc-item">
          <span class="doc-name">${doc.filename}</span>
          <span class="doc-badge received">Processed</span>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

function createCategorySection() {
  const parent = document.querySelector('main');
  const section = document.createElement('div');
  section.className = 'category-section';
  parent.appendChild(section);
  return section;
}

function getCurrentUserId() {
  // Try to get from localStorage or use a placeholder
  return localStorage.getItem('currentUserId') || 'user-unknown';
}

function showError(message) {
  const container = document.querySelector('main');
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'background: #ffebee; color: #c62828; padding: 16px; border-radius: 8px; margin: 16px; border-left: 4px solid #c62828;';
  errorDiv.textContent = '⚠️ ' + message;
  container.insertBefore(errorDiv, container.firstChild);
}