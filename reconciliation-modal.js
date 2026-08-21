/**
 * Veritas Reconciliation Modal Component
 * Reusable modal for displaying reconciliation details across the site
 * Works with any expense category and data structure
 */

class ReconciliationModal {
  constructor(options = {}) {
    this.data = options.data || {};
    this.title = options.title || 'Reconciliation Detail';
    this.expenseCategory = options.expenseCategory || 'General';
    this.documentLinks = options.documentLinks || [];
    this.modalId = `recon-modal-${Date.now()}`;
    this.isOpen = false;

    this.init();
  }

  init() {
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'recon-modal-overlay';
    modal.innerHTML = `
      <!-- Modal -->
      <div class="recon-modal">
        <!-- Header -->
        <div class="recon-modal-header">
          <h2>${this.title}</h2>
          <button class="recon-modal-close" aria-label="Close modal">×</button>
        </div>

        <!-- Content -->
        <div class="recon-modal-content">
          <!-- Controls -->
          <div class="recon-controls">
            <button class="recon-btn-print">🖨️ Print</button>
            <button class="recon-btn-download">⬇️ Download PDF</button>
          </div>

          <!-- Table Section -->
          <div class="recon-table-section">
            <h3>${this.expenseCategory}</h3>
            <div class="recon-table-wrapper">
              <table class="recon-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>YTD</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody class="recon-table-body">
                  <!-- Rows populated dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary Section -->
          <div class="recon-summary">
            <h4>Summary</h4>
            <div class="recon-summary-grid">
              <div class="recon-summary-item">
                <span class="recon-summary-label">YTD Through:</span>
                <span class="recon-summary-value" data-field="ytdThrough">—</span>
              </div>
              <div class="recon-summary-item">
                <span class="recon-summary-label">Total Amount:</span>
                <span class="recon-summary-value" data-field="totalAmount">$0.00</span>
              </div>
              <div class="recon-summary-item">
                <span class="recon-summary-label">Items Documented:</span>
                <span class="recon-summary-value" data-field="itemsDocumented">0</span>
              </div>
              <div class="recon-summary-item">
                <span class="recon-summary-label">Items Estimated:</span>
                <span class="recon-summary-value" data-field="itemsEstimated">0</span>
              </div>
              <div class="recon-summary-item">
                <span class="recon-summary-label">Total Items:</span>
                <span class="recon-summary-value" data-field="totalItems">0</span>
              </div>
              <div class="recon-summary-item">
                <span class="recon-summary-label">Status:</span>
                <span class="recon-summary-value" data-field="status">Pending</span>
              </div>
            </div>
          </div>

          <!-- Document Links Section -->
          <div class="recon-documents" id="recon-documents">
            <h4>Supporting Documents</h4>
            <div class="recon-documents-list">
              <!-- Document links populated dynamically -->
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="recon-modal-footer">
          <button class="recon-btn-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.populateTable();
    this.updateSummary();
    this.populateDocuments();
  }

  attachEventListeners() {
    const closeBtn = this.modal.querySelector('.recon-modal-close');
    const closeFooterBtn = this.modal.querySelector('.recon-btn-close');
    const printBtn = this.modal.querySelector('.recon-btn-print');
    const downloadBtn = this.modal.querySelector('.recon-btn-download');
    const overlay = this.modal;

    closeBtn.addEventListener('click', () => this.close());
    closeFooterBtn.addEventListener('click', () => this.close());
    printBtn.addEventListener('click', () => this.print());
    downloadBtn.addEventListener('click', () => this.downloadPDF());

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Prevent closing on modal click
    this.modal.querySelector('.recon-modal').addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  populateTable() {
    const tbody = this.modal.querySelector('.recon-table-body');
    tbody.innerHTML = '';

    if (!this.data.items || this.data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="recon-empty">No reconciliation data available</td></tr>';
      return;
    }

    this.data.items.forEach((item) => {
      const row = document.createElement('tr');
      row.className = `recon-row recon-status-${item.status || 'unknown'}`;

      row.innerHTML = `
        <td>${this.formatDate(item.date)}</td>
        <td>${this.escapeHtml(item.description)}</td>
        <td>${this.formatCurrency(item.amount)}</td>
        <td>${this.escapeHtml(item.category)}</td>
        <td>${this.formatCurrency(item.ytd)}</td>
        <td>${this.escapeHtml(item.note || '—')}</td>
        <td><span class="recon-status ${item.status}">${item.status || 'unknown'}</span></td>
        <td>
          ${item.sourceLink ? `<a href="${this.escapeHtml(item.sourceLink)}" target="_blank" rel="noopener noreferrer" class="recon-doc-link">📄 View</a>` : '—'}
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  updateSummary() {
    if (!this.data.items || this.data.items.length === 0) return;

    const summary = this.calculateSummary();

    Object.entries(summary).forEach(([key, value]) => {
      const element = this.modal.querySelector(`[data-field="${key}"]`);
      if (element) {
        if (key.includes('Amount') || key === 'totalAmount') {
          element.textContent = this.formatCurrency(value);
        } else if (key.includes('Items') || key === 'totalItems') {
          element.textContent = value;
        } else {
          element.textContent = value;
        }
      }
    });
  }

  calculateSummary() {
    const items = this.data.items || [];
    const documented = items.filter(i => i.status === 'doc').length;
    const estimated = items.filter(i => i.status === 'est').length;

    return {
      ytdThrough: this.formatDate(this.data.ytdThrough || new Date()),
      totalAmount: items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
      itemsDocumented: documented,
      itemsEstimated: estimated,
      totalItems: items.length,
      status: this.data.status || 'Complete'
    };
  }

  populateDocuments() {
    const docContainer = this.modal.querySelector('.recon-documents-list');
    docContainer.innerHTML = '';

    if (!this.documentLinks || this.documentLinks.length === 0) {
      docContainer.innerHTML = '<p class="recon-empty">No supporting documents</p>';
      return;
    }

    this.documentLinks.forEach((doc) => {
      const link = document.createElement('a');
      link.href = doc.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'recon-doc-item';
      link.innerHTML = `
        <span class="recon-doc-icon">📎</span>
        <span class="recon-doc-name">${this.escapeHtml(doc.name)}</span>
        <span class="recon-doc-type">${this.escapeHtml(doc.type || 'Document')}</span>
      `;
      docContainer.appendChild(link);
    });
  }

  open() {
    this.modal.classList.add('active');
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.remove('active');
    this.isOpen = false;
    document.body.style.overflow = '';
  }

  print() {
    const printWindow = window.open('', '', 'width=900,height=800');
    const content = this.modal.querySelector('.recon-modal-content').innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.title}</title>
        <link rel="stylesheet" href="reconciliation-modal.css" media="print">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .recon-controls, .recon-modal-footer { display: none; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .recon-summary { margin: 30px 0; }
          .recon-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        </style>
      </head>
      <body>
        <h2>${this.title}</h2>
        ${content}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  downloadPDF() {
    // Create a new window for printing to PDF
    const printWindow = window.open('', '', 'width=1200,height=800');
    const content = this.getPDFContent();

    printWindow.document.write(content);
    printWindow.document.close();

    // Wait for styles to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  getPDFContent() {
    const style = `
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .pdf-header { margin-bottom: 30px; border-bottom: 2px solid #2e5b8a; padding-bottom: 15px; }
        .pdf-title { font-size: 18px; font-weight: bold; color: #2e5b8a; margin: 0; }
        .pdf-case-info { font-size: 11px; color: #666; margin-top: 5px; }
        .pdf-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .pdf-table th { background: #f5f7fb; padding: 10px; text-align: left; border: 1px solid #e4e8f0; font-size: 12px; font-weight: bold; color: #2e5b8a; }
        .pdf-table td { padding: 8px 10px; border: 1px solid #e4e8f0; font-size: 11px; }
        .pdf-table tr.est { background: #fffbeb; }
        .pdf-table tr.doc { background: #f0fdf4; }
        .pdf-summary { background: #f5f7fb; padding: 15px; border-left: 4px solid #2e5b8a; margin: 20px 0; }
        .pdf-summary-title { font-weight: bold; color: #2e5b8a; margin-bottom: 10px; }
        .pdf-summary-row { display: flex; justify-content: space-between; font-size: 11px; padding: 5px 0; border-bottom: 1px solid #e4e8f0; }
        .pdf-summary-row:last-child { border-bottom: none; }
        .pdf-documents { margin: 20px 0; }
        .pdf-documents-title { font-weight: bold; color: #2e5b8a; margin-bottom: 10px; }
        .pdf-doc-item { font-size: 11px; padding: 5px 0; color: #2e5b8a; }
        .pdf-footer { font-size: 9px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; text-align: center; }
      </style>
    `;

    const caseInfo = this.data.caseInfo || {};
    const summary = this.calculateSummary();

    let tableRows = '';
    if (this.data.items && this.data.items.length > 0) {
      this.data.items.forEach(item => {
        const statusClass = item.status || 'unknown';
        tableRows += `
          <tr class="${statusClass}">
            <td>${this.formatDate(item.date)}</td>
            <td>${this.escapeHtml(item.description)}</td>
            <td>${this.formatCurrency(item.amount)}</td>
            <td>${this.escapeHtml(item.category)}</td>
            <td>${this.formatCurrency(item.ytd)}</td>
            <td>${this.escapeHtml(item.note || '—')}</td>
            <td>${item.status || 'unknown'}</td>
          </tr>
        `;
      });
    }

    let docLinks = '';
    if (this.documentLinks && this.documentLinks.length > 0) {
      docLinks = '<div class="pdf-documents">';
      docLinks += '<div class="pdf-documents-title">Supporting Documents</div>';
      this.documentLinks.forEach(doc => {
        docLinks += `<div class="pdf-doc-item">• ${this.escapeHtml(doc.name)} (${this.escapeHtml(doc.type)})</div>`;
      });
      docLinks += '</div>';
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.title}</title>
        ${style}
      </head>
      <body>
        <div class="pdf-header">
          <div class="pdf-title">${this.escapeHtml(this.title)}</div>
          <div class="pdf-case-info">
            ${caseInfo.caseName ? 'Case: ' + this.escapeHtml(caseInfo.caseName) : ''}
            ${caseInfo.caseNumber ? ' | Case #: ' + this.escapeHtml(caseInfo.caseNumber) : ''}
            ${caseInfo.county ? ' | County: ' + this.escapeHtml(caseInfo.county) : ''}
          </div>
        </div>

        <h3>${this.escapeHtml(this.expenseCategory)}</h3>
        <table class="pdf-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Category</th>
              <th>YTD</th>
              <th>Note</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="pdf-summary">
          <div class="pdf-summary-title">Summary</div>
          <div class="pdf-summary-row">
            <span>YTD Through:</span>
            <span>${this.formatDate(this.data.ytdThrough || new Date())}</span>
          </div>
          <div class="pdf-summary-row">
            <span>Total Amount:</span>
            <span>${this.formatCurrency(summary.totalAmount)}</span>
          </div>
          <div class="pdf-summary-row">
            <span>Items Documented:</span>
            <span>${summary.itemsDocumented}</span>
          </div>
          <div class="pdf-summary-row">
            <span>Items Estimated:</span>
            <span>${summary.itemsEstimated}</span>
          </div>
          <div class="pdf-summary-row">
            <span>Total Items:</span>
            <span>${summary.totalItems}</span>
          </div>
          <div class="pdf-summary-row">
            <span>Status:</span>
            <span>${this.escapeHtml(this.data.status || 'Complete')}</span>
          </div>
        </div>

        ${docLinks}

        <div class="pdf-footer">
          Generated: ${new Date().toLocaleString()} | Veritas Financial Intelligence System
        </div>
      </body>
      </html>
    `;
  }

  formatDate(date) {
    if (!date) return '—';
    if (typeof date === 'string') return date;
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatCurrency(value) {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  destroy() {
    if (this.modal) {
      this.modal.remove();
    }
  }
}

// Global function to open reconciliation modal
function openReconciliation(options) {
  const modal = new ReconciliationModal(options);
  modal.open();
  return modal;
}

// Auto-attach to [View Recon] links if data attributes are present
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-view-recon]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Get data from link attributes
      const dataAttr = link.getAttribute('data-recon-data');
      const title = link.getAttribute('data-recon-title') || 'Reconciliation Detail';
      const category = link.getAttribute('data-recon-category') || 'Expense';
      const docsAttr = link.getAttribute('data-recon-docs');

      try {
        const data = dataAttr ? JSON.parse(dataAttr) : {};
        const docs = docsAttr ? JSON.parse(docsAttr) : [];

        openReconciliation({
          data,
          title,
          expenseCategory: category,
          documentLinks: docs
        });
      } catch (error) {
        console.error('Error opening reconciliation modal:', error);
      }
    });
  });
});
