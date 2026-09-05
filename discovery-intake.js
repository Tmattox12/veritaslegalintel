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
    const uploadItem = createUploadItem(uploadId, file.name);
    queue.appendChild(uploadItem);

    uploadFile(file, uploadId);
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

async function uploadFile(file, uploadId) {
  const item = document.getElementById(uploadId);
  const statusEl = item.querySelector('.upload-status');
  const barEl = item.querySelector('.upload-bar-fill');

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', getCurrentUserId());

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
    statusEl.innerHTML = `
      ✅ Processed: ${summary.transactionCount} transactions, ${summary.incomeItemsCreated} income items, ${summary.flagsRaised} flags detected
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