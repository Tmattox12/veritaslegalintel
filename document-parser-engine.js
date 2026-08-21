/**
 * Document Parser Engine
 * Comprehensive parsing, auto-categorization with confidence scoring
 * Maps expenses to AFI categories and flags unmapped items for manual review
 */

const EXPENSE_CATEGORIES = {
  'health-insurance': {
    name: 'Health Insurance',
    icon: '🏥',
    keywords: ['health', 'insurance', 'premium', 'blue cross', 'aetna', 'cigna', 'united', 'humana', 'medical insurance', 'coverage'],
    minConfidence: 0.85
  },
  'childcare': {
    name: 'Childcare',
    icon: '👶',
    keywords: ['daycare', 'preschool', 'babysitter', 'nanny', 'childcare', 'childcare', 'after school', 'camp'],
    minConfidence: 0.80
  },
  'medical-dental': {
    name: 'Medical/Dental',
    icon: '🦷',
    keywords: ['doctor', 'dental', 'dentist', 'pharmacy', 'prescription', 'medical', 'cvs', 'walgreens', 'clinic', 'hospital', 'rx', 'teeth'],
    minConfidence: 0.85
  },
  'education': {
    name: 'Education',
    icon: '📚',
    keywords: ['school', 'tuition', 'books', 'supplies', 'education', 'college', 'university', 'course', 'lesson'],
    minConfidence: 0.85
  },
  'housing': {
    name: 'Housing',
    icon: '🏠',
    keywords: ['mortgage', 'rent', 'property tax', 'maintenance', 'repair', 'home', 'house', 'apartment', 'landlord', 'lease'],
    minConfidence: 0.90
  },
  'utilities': {
    name: 'Utilities',
    icon: '⚡',
    keywords: ['electric', 'gas', 'water', 'internet', 'phone', 'utility', 'verizon', 'at&t', 'comcast', 'cable'],
    minConfidence: 0.85
  },
  'transportation': {
    name: 'Transportation',
    icon: '🚗',
    keywords: ['car', 'fuel', 'gas', 'insurance', 'maintenance', 'repair', 'payment', 'uber', 'lyft', 'taxi', 'parking', 'registration'],
    minConfidence: 0.85
  },
  'food': {
    name: 'Food',
    icon: '🍔',
    keywords: ['grocery', 'groceries', 'restaurant', 'dining', 'food', 'coffee', 'lunch', 'dinner', 'breakfast', 'market', 'supermarket'],
    minConfidence: 0.80
  }
};

class DocumentParserEngine {
  constructor() {
    this.parsedItems = [];
    this.categorizedItems = [];
    this.unmappedItems = [];
  }

  /**
   * Parse uploaded file based on type
   */
  parseFile(file, fileContent) {
    const fileType = file.name.split('.').pop().toLowerCase();
    let items = [];

    try {
      if (fileType === 'csv') {
        items = this.parseCSV(fileContent);
      } else if (fileType === 'txt') {
        items = this.parseTXT(fileContent);
      } else if (fileType === 'json') {
        items = this.parseJSON(fileContent);
      } else if (['xlsx', 'xls', 'docx', 'doc', 'pdf'].includes(fileType)) {
        // For binary formats, create placeholder for backend processing
        items = this.createBinaryPlaceholder(file);
      } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
        // For images, create placeholder for OCR
        items = this.createImagePlaceholder(file);
      }

      // Add metadata
      items = items.map(item => ({
        ...item,
        sourceFile: file.name,
        uploadedAt: new Date().toISOString(),
        rawData: true
      }));

      return items;
    } catch (error) {
      console.error(`Error parsing ${fileType}:`, error);
      return [];
    }
  }

  parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      if (row.amount || row.description) {
        items.push(row);
      }
    }
    return items;
  }

  parseTXT(content) {
    const lines = content.split('\n');
    const items = [];

    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split('|').map(p => p.trim());

      if (parts.length >= 2) {
        items.push({
          date: parts[0] || '',
          description: parts[1] || '',
          amount: parts[2] || '',
          vendor: parts[3] || ''
        });
      }
    });
    return items;
  }

  parseJSON(content) {
    try {
      let data = JSON.parse(content);
      if (!Array.isArray(data)) {
        data = [data];
      }
      return data;
    } catch (e) {
      return [];
    }
  }

  createBinaryPlaceholder(file) {
    return [{
      fileName: file.name,
      fileType: file.name.split('.').pop().toUpperCase(),
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      description: `[${file.name.split('.').pop().toUpperCase()} File - Pending Backend Parsing]`,
      status: 'pending-parsing',
      confidence: 0
    }];
  }

  createImagePlaceholder(file) {
    return [{
      fileName: file.name,
      fileType: 'IMAGE',
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      description: `[Receipt/Document Image - Pending OCR Processing]`,
      status: 'pending-ocr',
      confidence: 0
    }];
  }

  /**
   * Auto-categorize items with confidence scoring
   */
  categorizeItems(items) {
    return items.map(item => {
      const description = (item.description || item.name || '').toLowerCase();
      const categoryMatch = this.findBestCategory(description);

      return {
        ...item,
        category: categoryMatch.category,
        categoryName: categoryMatch.categoryName,
        confidence: categoryMatch.confidence,
        status: categoryMatch.confidence >= 0.75 ? 'mapped' : 'unmapped',
        mapping: {
          matched: categoryMatch.matched,
          score: categoryMatch.confidence,
          algorithm: 'keyword-matching'
        }
      };
    });
  }

  /**
   * Find best matching category using keyword matching
   */
  findBestCategory(description) {
    let bestMatch = {
      category: null,
      categoryName: 'Uncategorized',
      confidence: 0,
      matched: []
    };

    Object.entries(EXPENSE_CATEGORIES).forEach(([catKey, catData]) => {
      const matches = catData.keywords.filter(keyword =>
        description.includes(keyword.toLowerCase())
      );

      if (matches.length > 0) {
        // Confidence based on number of keyword matches
        const confidence = Math.min(
          0.5 + (matches.length * 0.15),
          0.95
        );

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category: catKey,
            categoryName: catData.name,
            confidence: Math.round(confidence * 100) / 100,
            matched: matches
          };
        }
      }
    });

    return bestMatch;
  }

  /**
   * Separate mapped and unmapped items
   */
  separateByMapping(items) {
    const mapped = [];
    const unmapped = [];

    items.forEach(item => {
      if (item.status === 'mapped') {
        mapped.push(item);
      } else {
        unmapped.push(item);
      }
    });

    return { mapped, unmapped };
  }

  /**
   * Process complete batch of files
   */
  async processBatch(files, onProgress = null) {
    const results = {
      total: 0,
      parsed: 0,
      mapped: 0,
      unmapped: 0,
      errors: [],
      mappedItems: [],
      unmappedItems: [],
      summary: {}
    };

    // Step 1: Reading files
    if (onProgress) onProgress(1);

    const fileContents = [];
    for (const file of files) {
      try {
        const content = await this.readFile(file);
        fileContents.push({ file, content });
      } catch (error) {
        results.errors.push(`${file.name}: ${error.message}`);
      }
    }

    // Step 2: Extracting data
    if (onProgress) onProgress(2);

    for (const { file, content } of fileContents) {
      try {
        let items = this.parseFile(file, content);
        if (items.length === 0) continue;
        results.parsed += items.length;
        results.mappedItems.push(...items); // Temporary storage
      } catch (error) {
        results.errors.push(`${file.name}: ${error.message}`);
      }
    }

    // Step 3: AI Analysis (categorization)
    if (onProgress) onProgress(3);

    const allItems = results.mappedItems;
    const categorizedItems = this.categorizeItems(allItems);
    const { mapped, unmapped } = this.separateByMapping(categorizedItems);

    results.mapped = mapped.length;
    results.unmapped = unmapped.length;
    results.total = categorizedItems.length;
    results.mappedItems = mapped;
    results.unmappedItems = unmapped;

    // Step 4: Mapping expenses
    if (onProgress) onProgress(4);

    // Items already categorized in step 3

    // Step 5: Storing results
    if (onProgress) onProgress(5);

    // Generate summary
    results.summary = this.generateCategorySummary(results.mappedItems);

    return results;
  }

  /**
   * Generate summary by category
   */
  generateCategorySummary(items) {
    const summary = {};

    Object.values(EXPENSE_CATEGORIES).forEach(cat => {
      summary[cat.name] = {
        count: 0,
        totalAmount: 0,
        items: []
      };
    });

    items.forEach(item => {
      const catName = item.categoryName || 'Uncategorized';
      if (!summary[catName]) {
        summary[catName] = { count: 0, totalAmount: 0, items: [] };
      }
      summary[catName].count += 1;
      summary[catName].totalAmount += parseFloat(item.amount || 0);
      summary[catName].items.push(item);
    });

    return summary;
  }

  /**
   * Helper: Read file as text
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileType = file.name.split('.').pop().toLowerCase();

      reader.onload = (e) => {
        try {
          if (['csv', 'txt', 'json'].includes(fileType)) {
            resolve(e.target.result);
          } else {
            // For binary/image files, just return metadata
            resolve(JSON.stringify({
              fileName: file.name,
              size: file.size,
              type: fileType
            }));
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));

      if (['csv', 'txt', 'json'].includes(fileType)) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }
}

// Export for use
const documentParser = new DocumentParserEngine();
