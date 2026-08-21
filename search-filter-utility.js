/**
 * Search & Filter Utility for Veritas Document Hub
 * Provides search, filtering, and sorting capabilities for category pages
 *
 * Usage:
 * 1. Include in category page: <script src="search-filter-utility.js"></script>
 * 2. Call initializeSearchFilter(containerId, dataArray) to enable
 * 3. Bind to form inputs with class "search-input" and "filter-select"
 */

class SearchFilterUtility {
  constructor(containerId, dataArray = []) {
    this.containerId = containerId;
    this.originalData = [...dataArray];
    this.filteredData = [...dataArray];
    this.searchTerm = '';
    this.filters = {};
    this.sortField = 'date';
    this.sortOrder = 'desc'; // desc for newest first
  }

  /**
   * Search across multiple fields
   */
  search(term, searchFields = ['date', 'merchant', 'description', 'category', 'amount']) {
    this.searchTerm = term.toLowerCase();

    if (!this.searchTerm) {
      this.filteredData = [...this.originalData];
    } else {
      this.filteredData = this.originalData.filter(item => {
        return searchFields.some(field => {
          const value = this._getNestedValue(item, field);
          return value && value.toString().toLowerCase().includes(this.searchTerm);
        });
      });
    }

    this._applySort();
    return this.filteredData;
  }

  /**
   * Filter by category or other field
   */
  filter(filterField, filterValue) {
    if (filterValue === '' || filterValue === 'all') {
      delete this.filters[filterField];
    } else {
      this.filters[filterField] = filterValue;
    }

    this._applyFilters();
    return this.filteredData;
  }

  /**
   * Apply all active filters
   */
  _applyFilters() {
    this.filteredData = this.originalData.filter(item => {
      return Object.keys(this.filters).every(field => {
        const itemValue = this._getNestedValue(item, field);
        const filterValue = this.filters[field];
        return itemValue === filterValue || itemValue.toString().includes(filterValue);
      });
    });

    this._applySort();
  }

  /**
   * Sort by field
   */
  sort(field, order = 'asc') {
    this.sortField = field;
    this.sortOrder = order.toLowerCase();
    this._applySort();
    return this.filteredData;
  }

  /**
   * Apply current sort to filtered data
   */
  _applySort() {
    this.filteredData.sort((a, b) => {
      let aVal = this._getNestedValue(a, this.sortField);
      let bVal = this._getNestedValue(b, this.sortField);

      // Handle dates
      if (this.sortField === 'date') {
        aVal = new Date(aVal || '1970-01-01').getTime();
        bVal = new Date(bVal || '1970-01-01').getTime();
      }

      // Handle numbers
      if (this.sortField === 'amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Get value from nested object property
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Get statistics from filtered data
   */
  getStats() {
    return {
      totalCount: this.filteredData.length,
      total: this.filteredData.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
      average: this.filteredData.length > 0
        ? this.filteredData.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) / this.filteredData.length
        : 0,
      categories: [...new Set(this.filteredData.map(item => item.category).filter(Boolean))]
    };
  }

  /**
   * Get unique values for a field (for filter dropdowns)
   */
  getUniqueValues(field) {
    return [...new Set(this.originalData
      .map(item => this._getNestedValue(item, field))
      .filter(Boolean))].sort();
  }

  /**
   * Export filtered data
   */
  exportAsCSV(filename = 'export.csv') {
    const headers = this.filteredData.length > 0
      ? Object.keys(this.filteredData[0])
      : [];

    let csv = headers.join(',') + '\n';

    this.filteredData.forEach(row => {
      const values = headers.map(header => {
        const value = this._getNestedValue(row, header);
        const stringValue = value ? value.toString() : '';
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
      csv += values.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export filtered data as JSON
   */
  exportAsJSON(filename = 'export.json') {
    const blob = new Blob([JSON.stringify(this.filteredData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Initialize search/filter UI for a category page
 */
function initializeSearchFilter(categoryName, dataArray = []) {
  const searchFilter = new SearchFilterUtility(categoryName, dataArray);

  // Setup search input
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const results = searchFilter.search(e.target.value);
      updateDisplayData(results);
      updateStats(searchFilter.getStats());
    });
  }

  // Setup category filter
  const categoryFilter = document.querySelector('.filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function(e) {
      const results = searchFilter.filter('category', e.target.value);
      updateDisplayData(results);
      updateStats(searchFilter.getStats());
    });

    // Populate category options
    const categories = searchFilter.getUniqueValues('category');
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);
    });
  }

  // Setup date range filter
  const dateFromInput = document.querySelector('.filter-date-from');
  const dateToInput = document.querySelector('.filter-date-to');

  if (dateFromInput && dateToInput) {
    const updateDateFilter = () => {
      const dateFrom = dateFromInput.value;
      const dateTo = dateToInput.value;

      let results = dataArray;

      if (dateFrom) {
        results = results.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= new Date(dateFrom);
        });
      }

      if (dateTo) {
        results = results.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate <= new Date(dateTo);
        });
      }

      searchFilter.filteredData = results;
      updateDisplayData(results);
      updateStats(searchFilter.getStats());
    };

    dateFromInput.addEventListener('change', updateDateFilter);
    dateToInput.addEventListener('change', updateDateFilter);
  }

  // Setup amount range filter
  const amountMinInput = document.querySelector('.filter-amount-min');
  const amountMaxInput = document.querySelector('.filter-amount-max');

  if (amountMinInput && amountMaxInput) {
    const updateAmountFilter = () => {
      const minAmount = parseFloat(amountMinInput.value) || 0;
      const maxAmount = parseFloat(amountMaxInput.value) || Infinity;

      const results = dataArray.filter(item => {
        const amount = parseFloat(item.amount) || 0;
        return amount >= minAmount && amount <= maxAmount;
      });

      searchFilter.filteredData = results;
      updateDisplayData(results);
      updateStats(searchFilter.getStats());
    };

    amountMinInput.addEventListener('change', updateAmountFilter);
    amountMaxInput.addEventListener('change', updateAmountFilter);
  }

  // Setup sort
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function(e) {
      const [field, order] = e.target.value.split('-');
      const results = searchFilter.sort(field, order);
      updateDisplayData(results);
    });
  }

  // Setup export buttons
  const exportCSVBtn = document.querySelector('.export-csv-btn');
  if (exportCSVBtn) {
    exportCSVBtn.addEventListener('click', () => {
      searchFilter.exportAsCSV(`${categoryName}-export-${new Date().toISOString().split('T')[0]}.csv`);
    });
  }

  const exportJSONBtn = document.querySelector('.export-json-btn');
  if (exportJSONBtn) {
    exportJSONBtn.addEventListener('click', () => {
      searchFilter.exportAsJSON(`${categoryName}-export-${new Date().toISOString().split('T')[0]}.json`);
    });
  }

  // Setup clear filters
  const clearFiltersBtn = document.querySelector('.clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = '';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (amountMinInput) amountMinInput.value = '';
      if (amountMaxInput) amountMaxInput.value = '';

      searchFilter.filteredData = [...searchFilter.originalData];
      updateDisplayData(searchFilter.filteredData);
      updateStats(searchFilter.getStats());
    });
  }

  return searchFilter;
}

/**
 * Create search filter HTML for insertion into category page
 * Returns HTML string for the search/filter toolbar
 */
function createSearchFilterHTML() {
  return `
    <div class="search-filter-toolbar" style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e0d5; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #333; margin-bottom: 12px;">🔍 Search & Filter Documents</h3>
      </div>

      <!-- Search Input -->
      <div style="margin-bottom: 16px;">
        <input
          type="text"
          class="search-input"
          placeholder="Search by date, merchant, category, amount..."
          style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;"
        />
      </div>

      <!-- Filters Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <!-- Category Filter -->
        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">Category</label>
          <select class="filter-category" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
            <option value="">-- All Categories --</option>
          </select>
        </div>

        <!-- Date Range -->
        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">From Date</label>
          <input type="date" class="filter-date-from" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
        </div>

        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">To Date</label>
          <input type="date" class="filter-date-to" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
        </div>

        <!-- Amount Range -->
        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">Min Amount</label>
          <input type="number" class="filter-amount-min" placeholder="0.00" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
        </div>

        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">Max Amount</label>
          <input type="number" class="filter-amount-max" placeholder="∞" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
        </div>

        <!-- Sort -->
        <div>
          <label style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; font-weight: 600;">Sort By</label>
          <select class="sort-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Largest Amount</option>
            <option value="amount-asc">Smallest Amount</option>
          </select>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="clear-filters-btn" style="padding: 8px 16px; background: #f0f0f0; color: #333; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Clear Filters</button>
        <button class="export-csv-btn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">📥 Export CSV</button>
        <button class="export-json-btn" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">📥 Export JSON</button>
      </div>

      <!-- Stats Display -->
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
        <span id="stats-count">0 items</span> |
        <span id="stats-total">Total: $0.00</span> |
        <span id="stats-average">Avg: $0.00</span>
      </div>
    </div>
  `;
}

/**
 * Update display data (to be implemented in category pages)
 */
function updateDisplayData(results) {
  // This function should be overridden in each category page
  // to update the table/list display with filtered results
  console.log('Update display with', results.length, 'results');
}

/**
 * Update statistics display (to be implemented in category pages)
 */
function updateStats(stats) {
  const countEl = document.getElementById('stats-count');
  const totalEl = document.getElementById('stats-total');
  const avgEl = document.getElementById('stats-average');

  if (countEl) countEl.textContent = `${stats.totalCount} item${stats.totalCount !== 1 ? 's' : ''}`;
  if (totalEl) totalEl.textContent = `Total: $${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (avgEl) avgEl.textContent = `Avg: $${stats.average.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SearchFilterUtility,
    initializeSearchFilter,
    createSearchFilterHTML,
    updateDisplayData,
    updateStats
  };
}
