/**
 * Document Parser & Auto-Mapping Engine
 * Extracts financial data from various document formats and maps to categories
 */

class DocumentParser {
  constructor() {
    this.supportedFormats = ['csv', 'json', 'txt'];
    this.categoryMappings = this.initializeCategoryMappings();
    this.unmappedItems = [];
  }

  // Initialize mapping rules for categories
  initializeCategoryMappings() {
    return {
      'health_insurance': {
        keywords: ['health', 'insurance', 'premium', 'medical', 'aetna', 'blue cross', 'anthem', 'cigna', 'humana'],
        patterns: [/insurance.*premium/i, /health.*insurance/i, /medical.*insurance/i],
        minAmount: 50,
        maxAmount: 2000
      },
      'childcare': {
        keywords: ['daycare', 'childcare', 'preschool', 'babysitter', 'nanny', 'tuition'],
        patterns: [/daycare/i, /child care/i, /preschool/i],
        minAmount: 500,
        maxAmount: 3000
      },
      'medical_dental': {
        keywords: ['doctor', 'dental', 'pharmacy', 'hospital', 'medical', 'therapy', 'clinic'],
        patterns: [/doctor|dental|pharmacy|hospital|clinic/i],
        minAmount: 20,
        maxAmount: 1000
      },
      'education': {
        keywords: ['school', 'tuition', 'education', 'supplies', 'books', 'university', 'college'],
        patterns: [/school.*tuition|tuition.*school|education/i],
        minAmount: 100,
        maxAmount: 2000
      },
      'housing': {
        keywords: ['mortgage', 'rent', 'property tax', 'insurance', 'maintenance', 'home'],
        patterns: [/mortgage|rent payment|property tax/i],
        minAmount: 500,
        maxAmount: 5000
      },
      'utilities': {
        keywords: ['electric', 'gas', 'water', 'internet', 'phone', 'cable', 'utility'],
        patterns: [/electricity|gas|water|utility|internet|phone bill|cable/i],
        minAmount: 20,
        maxAmount: 500
      },
      'transportation': {
        keywords: ['car', 'auto', 'fuel', 'insurance', 'maintenance', 'parking', 'transit'],
        patterns: [/car payment|auto insurance|fuel|gas station|parking/i],
        minAmount: 50,
        maxAmount: 1500
      },
      'food': {
        keywords: ['grocery', 'food', 'restaurant', 'dining', 'supermarket'],
        patterns: [/grocery|food|restaurant|dining/i],
        minAmount: 20,
        maxAmount: 800
      }
    };
  }

  /**
   * Parse uploaded document and extract transactions
   */
  async parseDocument(file, fileType) {
    try {
      let data;

      if (fileType === 'csv') {
        data = await this.parseCSV(file);
      } else if (fileType === 'json') {
        data = await this.parseJSON(file);
      } else if (fileType === 'txt') {
        data = await this.parseTXT(file);
      } else {
        throw new Error('Unsupported file format');
      }

      return this.extractTransactions(data);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  }

  /**
   * Parse CSV file
   */
  async parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue;
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};

          headers.forEach((header, idx) => {
            row[header] = values[idx];
          });

          rows.push(row);
        }

        resolve(rows);
      };

      reader.onerror = (e) => reject(new Error('Failed to read CSV'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse JSON file
   */
  async parseJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          resolve(Array.isArray(json) ? json : [json]);
        } catch (error) {
          reject(new Error('Invalid JSON format'));
        }
      };

      reader.onerror = (e) => reject(new Error('Failed to read JSON'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse TXT file (line-based format)
   */
  async parseTXT(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const txt = e.target.result;
        const lines = txt.split('\n');
        const rows = [];

        // Try to parse date | description | amount format
        lines.forEach(line => {
          if (line.trim()) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 2) {
              rows.push({
                date: parts[0],
                description: parts[1],
                amount: parts[2] || '0'
              });
            }
          }
        });

        resolve(rows);
      };

      reader.onerror = (e) => reject(new Error('Failed to read TXT'));
      reader.readAsText(file);
    });
  }

  /**
   * Extract and normalize transactions from parsed data
   */
  extractTransactions(data) {
    const transactions = [];

    data.forEach((row, idx) => {
      const transaction = this.normalizeTransaction(row);

      if (transaction && transaction.amount) {
        transaction.id = `imported-${Date.now()}-${idx}`;
        transaction.status = 'unmapped';
        transactions.push(transaction);
      }
    });

    return {
      success: true,
      count: transactions.length,
      items: transactions
    };
  }

  /**
   * Normalize transaction from various column names
   */
  normalizeTransaction(row) {
    const datePatterns = ['date', 'transaction_date', 'posted_date', 'date_posted'];
    const descPatterns = ['description', 'memo', 'narration', 'reference', 'desc'];
    const amountPatterns = ['amount', 'value', 'debit', 'credit', 'transaction_amount', 'amt'];

    let transaction = {
      date: null,
      description: null,
      amount: null,
      category: null,
      mappedCategory: null,
      confidence: 0
    };

    // Find date
    for (let pattern of datePatterns) {
      if (row[pattern]) {
        transaction.date = this.parseDate(row[pattern]);
        break;
      }
    }

    // Find description
    for (let pattern of descPatterns) {
      if (row[pattern]) {
        transaction.description = row[pattern];
        break;
      }
    }

    // Find amount
    for (let pattern of amountPatterns) {
      if (row[pattern]) {
        transaction.amount = this.parseAmount(row[pattern]);
        break;
      }
    }

    if (!transaction.amount || !transaction.description) {
      return null;
    }

    return transaction;
  }

  /**
   * Parse date in various formats
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    // Try common formats
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{1,2})-([a-z]{3})-(\d{4})/i, // DD-Mon-YYYY
    ];

    for (let fmt of formats) {
      const match = dateStr.match(fmt);
      if (match) {
        return dateStr; // Return original for now
      }
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Parse amount from string
   */
  parseAmount(amountStr) {
    if (!amountStr) return 0;

    // Remove currency symbols and parse number
    const cleaned = amountStr.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : Math.abs(amount);
  }

  /**
   * Auto-map transactions to categories
   */
  autoMapTransactions(transactions) {
    const mapped = [];
    this.unmappedItems = [];

    transactions.forEach(transaction => {
      const mapping = this.findBestMatch(transaction);

      if (mapping && mapping.confidence > 0.6) {
        transaction.mappedCategory = mapping.category;
        transaction.confidence = mapping.confidence;
        transaction.status = 'mapped';
        mapped.push(transaction);
      } else {
        transaction.status = 'unmapped';
        this.unmappedItems.push(transaction);
      }
    });

    return {
      mapped,
      unmapped: this.unmappedItems,
      mappingRate: Math.round((mapped.length / transactions.length) * 100)
    };
  }

  /**
   * Find best category match for transaction
   */
  findBestMatch(transaction) {
    let bestMatch = {
      category: null,
      confidence: 0
    };

    const desc = transaction.description.toLowerCase();
    const amount = transaction.amount;

    for (let [category, rules] of Object.entries(this.categoryMappings)) {
      let confidence = 0;

      // Check keywords
      const keywordMatches = rules.keywords.filter(kw => desc.includes(kw.toLowerCase())).length;
      if (keywordMatches > 0) {
        confidence += 0.3 * (keywordMatches / rules.keywords.length);
      }

      // Check patterns
      const patternMatches = rules.patterns.filter(pattern => pattern.test(desc)).length;
      if (patternMatches > 0) {
        confidence += 0.4;
      }

      // Check amount range
      if (amount >= rules.minAmount && amount <= rules.maxAmount) {
        confidence += 0.3;
      }

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          category,
          confidence: Math.min(confidence, 1)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Get unmapped items for manual mapping
   */
  getUnmappedItems() {
    return this.unmappedItems;
  }

  /**
   * Manually map item to category
   */
  manuallyMapItem(itemId, category) {
    const item = this.unmappedItems.find(i => i.id === itemId);
    if (item) {
      item.mappedCategory = category;
      item.status = 'manually_mapped';
      this.unmappedItems = this.unmappedItems.filter(i => i.id !== itemId);
      return true;
    }
    return false;
  }

  /**
   * Get summary of mapping results
   */
  getSummary() {
    return {
      unmappedCount: this.unmappedItems.length,
      unmappedItems: this.unmappedItems,
      categories: Object.keys(this.categoryMappings)
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentParser;
}
