/**
 * Expense Mapping UI Component
 * Displays unmapped items and provides manual categorization interface
 * Integrates with Document Hub
 */

class ExpenseMappingUI {
  constructor() {
    this.unmappedItems = [];
    this.currentItem = null;
    this.currentIndex = 0;
  }

  /**
   * Load unmapped items from localStorage
   */
  loadUnmappedItems() {
    const allItems = JSON.parse(localStorage.getItem('hub_expenses') || '[]');
    this.unmappedItems = allItems.filter(item => item.status === 'unmapped' || !item.category);
    return this.unmappedItems;
  }

  /**
   * Create mapping modal UI
   */
  createMappingModal(item, index, total) {
    const modal = document.createElement('div');
    modal.id = 'mappingModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    const categoryButtons = Object.entries(documentParser.EXPENSE_CATEGORIES || {}).map(([key, cat]) => `
      <button class="mapping-category-btn" onclick="window.expenseMappingUI.selectCategory('${key}', ${index})" style="
        flex: 1;
        padding: 16px;
        margin: 8px;
        border: 2px solid #ddd;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
      " onmouseover="this.style.borderColor='#2e5b8a'; this.style.background='#f0f4f8';" onmouseout="this.style.borderColor='#ddd'; this.style.background='white';">
        <div style="font-size: 24px; margin-bottom: 6px;">${cat.icon}</div>
        ${cat.name}
      </button>
    `).join('');

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 30px;
        max-width: 700px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        max-height: 90vh;
        overflow-y: auto;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 18px; color: #333;">📋 Map Expense</h2>
          <span style="font-size: 12px; color: #999;">Item ${index + 1} of ${total}</span>
        </div>

        <div style="
          background: #f9f9f9;
          border-left: 4px solid #2e5b8a;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 24px;
        ">
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; font-size: 13px;">Date:</strong>
            <span style="color: #666;">${item.date || 'Not specified'}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; font-size: 13px;">Description:</strong>
            <span style="color: #666; font-size: 14px;">${item.description || item.name || 'No description'}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; font-size: 13px;">Amount:</strong>
            <span style="color: #2e5b8a; font-weight: 700; font-size: 16px;">$${parseFloat(item.amount || 0).toFixed(2)}</span>
          </div>
          ${item.vendor ? `
            <div>
              <strong style="color: #333; display: block; font-size: 13px;">Vendor:</strong>
              <span style="color: #666;">${item.vendor}</span>
            </div>
          ` : ''}
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 14px; color: #333; margin: 0 0 12px 0;">Select Category:</h3>
          <div style="
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          ">
            ${categoryButtons}
          </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button onclick="window.expenseMappingUI.skipItem(${index})" style="
            flex: 1;
            padding: 12px;
            background: white;
            color: #2e5b8a;
            border: 1px solid #2e5b8a;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          ">Skip</button>
          <button onclick="window.expenseMappingUI.closeMappingModal()" style="
            flex: 1;
            padding: 12px;
            background: white;
            color: #666;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          ">Close</button>
        </div>

        <div style="
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #999;
          text-align: center;
        ">
          💡 Tip: You can skip items and map them later
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Select category for item
   */
  selectCategory(categoryKey, index) {
    const allItems = JSON.parse(localStorage.getItem('hub_expenses') || '[]');
    const unmappedItems = allItems.filter(item => item.status === 'unmapped' || !item.category);

    if (index < unmappedItems.length) {
      const item = unmappedItems[index];
      const categoryData = documentParser.EXPENSE_CATEGORIES[categoryKey];

      // Update item with mapping
      item.category = categoryKey;
      item.categoryName = categoryData.name;
      item.status = 'mapped';
      item.confidence = 1.0; // User-mapped gets full confidence
      item.mappedBy = 'user';
      item.mappedAt = new Date().toISOString();

      // Save to AFI reconciliation imports
      const reconciliations = JSON.parse(localStorage.getItem('reconciliation_imports') || '[]');
      reconciliations.push(item);
      localStorage.setItem('reconciliation_imports', JSON.stringify(reconciliations));

      // Update hub expenses
      const updatedItem = allItems.find(it => it === item);
      if (updatedItem) {
        updatedItem.status = 'mapped';
        updatedItem.category = categoryKey;
        updatedItem.categoryName = categoryData.name;
        updatedItem.mappedBy = 'user';
        updatedItem.mappedAt = new Date().toISOString();
      }
      localStorage.setItem('hub_expenses', JSON.stringify(allItems));

      // Trigger event
      window.dispatchEvent(new Event('itemMapped'));

      // Close modal and show next
      this.closeMappingModal();
      NotificationSystem.success(
        'Item Mapped Successfully!',
        `Mapped to: ${categoryData.name}\n\nRedirecting to AFI Expenses...`
      );
      setTimeout(() => window.location.href = 'afi.html', 1500);
    }
  }

  /**
   * Skip current item
   */
  skipItem(index) {
    this.currentIndex = index + 1;
    const unmappedItems = this.loadUnmappedItems();

    if (this.currentIndex < unmappedItems.length) {
      this.closeMappingModal();
      this.showMappingModal(unmappedItems[this.currentIndex], this.currentIndex, unmappedItems.length);
    } else {
      NotificationSystem.success('All Done!', 'No more items to map. All expenses have been categorized!');
      this.closeMappingModal();
    }
  }

  /**
   * Show mapping modal for item
   */
  showMappingModal(item, index, total) {
    const existingModal = document.getElementById('mappingModal');
    if (existingModal) existingModal.remove();

    const modal = this.createMappingModal(item, index, total);
    document.body.appendChild(modal);
  }

  /**
   * Close mapping modal
   */
  closeMappingModal() {
    const modal = document.getElementById('mappingModal');
    if (modal) modal.remove();
  }

  /**
   * Create unmapped items section for hub
   */
  createUnmappedSection() {
    const unmappedItems = this.loadUnmappedItems();

    if (unmappedItems.length === 0) {
      return `
        <div class="upload-section" style="margin-top: 24px;">
          <div class="section-title">✅ All Items Mapped</div>
          <div style="padding: 24px; text-align: center; color: #999;">
            <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
            <div style="font-size: 14px; font-weight: 600; color: #333;">All uploaded items have been categorized!</div>
            <div style="font-size: 12px; margin-top: 6px;">Check AFI Expenses for mapped items.</div>
          </div>
        </div>
      `;
    }

    const itemsList = unmappedItems.map((item, idx) => `
      <div class="doc-item" style="margin-bottom: 12px;">
        <div class="doc-info">
          <div class="doc-name" style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px;">
            ${item.description || item.name || 'Unnamed Expense'}
          </div>
          <div class="doc-meta" style="font-size: 11px; color: #999;">
            ${item.date ? item.date + ' · ' : ''}${item.sourceFile || 'Uploaded'}
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div class="doc-stat" style="background: #fff3cd; color: #856404;">
            ⚠️ Needs Mapping
          </div>
          <button onclick="window.expenseMappingUI.showMappingModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, ${idx}, ${unmappedItems.length})" style="
            padding: 6px 12px;
            background: #2e5b8a;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
          ">Map →</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="upload-section" style="margin-top: 24px;">
        <div class="section-title">⚠️ Items Requiring Manual Mapping (${unmappedItems.length})</div>
        <div style="font-size: 12px; color: #666; margin-bottom: 16px;">
          These items couldn't be automatically categorized. Click "Map" to assign them to the correct expense category.
        </div>
        <div>
          ${itemsList}
        </div>
      </div>
    `;
  }

  /**
   * Initialize mapping UI
   */
  init() {
    window.expenseMappingUI = this;
  }
}

// Create global instance
const expenseMappingUI = new ExpenseMappingUI();
expenseMappingUI.init();
