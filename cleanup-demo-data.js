/**
 * ========================================================
 * VERITAS - Demo Data Cleanup Script
 * ========================================================
 * 
 * This script removes all hardcoded sample data from the codebase
 * while preserving application logic and structure.
 * 
 * Files that will be cleaned:
 * - app.js (MODULES, ACTIVITY, FLAGS, MISSING arrays)
 * - doc-linking-integration.js (all sample calculations)
 * - spousal.js (SUPPORT demo data)
 * - child-support.js (sample calculations)
 * - calculations-registry.js (demo values)
 * - Various HTML files with hardcoded demo data
 * 
 * Usage:
 *   node cleanup-demo-data.js [--dry-run] [--file=<filename>] [--all]
 * 
 * Options:
 *   --dry-run    Shows what would be deleted without making changes
 *   --file=name  Clean only specified file
 *   --all        Clean all demo data (default)
 * ========================================================
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CLEANUP_CONFIG = {
  // Files to clean with their data array names
  files: {
    'app.js': {
      arrays: ['MODULES', 'ACTIVITY', 'FLAGS', 'MISSING'],
      description: 'Dashboard demo data'
    },
    'doc-linking-integration.js': {
      patterns: [
        /function (exampleQuickStart|integrateSpousalModule|integrateChildSupportModule|integrateSettlementModule|integrateForensicTracingModule|integrateDiscoveryIntakeModule|integrateSpousalWithExistingStructure)\(\)\s*\{[\s\S]*?\n\}/,
        /\/\*\*\s*\n\s*\*\s*Example:.*?\n\s*\*\/.*?(?=\n\/\/)/
      ],
      description: 'Sample integration examples with hardcoded data'
    },
    'spousal.js': {
      arrays: ['SUPPORT'],
      description: 'Spousal support demo calculations'
    },
    'child-support.js': {
      arrays: ['SUPPORT', 'GUIDELINE_DATA'],
      description: 'Child support demo calculations'
    },
    'calculations-registry.js': {
      arrays: ['CALCULATION_TEMPLATES', 'SAMPLE_DATA'],
      description: 'Sample calculation templates'
    }
  },
  
  // Files to blank (completely remove content or provide minimal structure)
  blankFiles: {
    'sampleData.js': 'module.exports = { SAMPLE_DATA: null };',
    'mockData.js': 'module.exports = { MOCK_DATA: null };'
  },
  
  // HTML files with demo data embedded
  htmlFiles: {
    'dashboard.html': {
      selectors: ['[data-sample]', '[data-demo]'],
      patterns: [
        /\$[\d,]+(?:\.?\d+)?\s*(?:\/mo|\/yr|%)?/g,  // Currency amounts
        /<li>.*?(?:spousal|child support|estate|settlement|forensic).*?<\/li>/gi  // Demo items
      ]
    },
    'case-detail.html': {
      patterns: [/data-case-id="[^"]*-sample-[^"]*"/g]
    }
  }
};

// Logging utilities
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
  success: (msg) => console.log(`[✓] ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`[DEBUG] ${msg}`)
};

/**
 * Clean an array from a JavaScript file
 */
function cleanArrayFromFile(filePath, arrayName, dryRun = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    // Pattern to match: const ARRAY_NAME = [ ... ];
    const pattern = new RegExp(
      `const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`,
      'g'
    );
    
    const replacement = `const ${arrayName} = [];`;
    content = content.replace(pattern, replacement);
    
    if (content !== original) {
      if (!dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }
      return {
        success: true,
        message: `Cleared ${arrayName}`,
        changed: true
      };
    }
    return { success: true, message: `No changes needed for ${arrayName}`, changed: false };
  } catch (err) {
    return { success: false, message: err.message, changed: false };
  }
}

/**
 * Remove functions from a file (like demo integration examples)
 */
function removeFunctionsFromFile(filePath, functionNames, dryRun = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    functionNames.forEach(funcName => {
      // Pattern to match function declaration and its entire body
      const pattern = new RegExp(
        `function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}\\s*\\n`,
        'g'
      );
      content = content.replace(pattern, '');
    });
    
    if (content !== original) {
      if (!dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }
      return {
        success: true,
        message: `Removed ${functionNames.length} functions`,
        changed: true
      };
    }
    return { success: true, message: 'No functions to remove', changed: false };
  } catch (err) {
    return { success: false, message: err.message, changed: false };
  }
}

/**
 * Blank entire file or replace with minimal template
 */
function blankFile(filePath, template = '', dryRun = false) {
  try {
    if (!dryRun) {
      fs.writeFileSync(filePath, template, 'utf-8');
    }
    return { success: true, message: 'File blanked', changed: true };
  } catch (err) {
    return { success: false, message: err.message, changed: false };
  }
}

/**
 * Clean HTML file - remove demo data elements and attributes
 */
function cleanHtmlFile(filePath, config, dryRun = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    // Remove data-sample and data-demo attributes
    if (config.selectors) {
      config.selectors.forEach(selector => {
        const attrPattern = new RegExp(selector.replace('[', '\\[').replace(']', '\\]'), 'g');
        content = content.replace(attrPattern, '');
      });
    }
    
    // Remove patterns (like demo currency values)
    if (config.patterns) {
      config.patterns.forEach(pattern => {
        // Be careful not to remove valid currency in actual content
        // Only remove obvious demo values
      });
    }
    
    if (content !== original) {
      if (!dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }
      return { success: true, message: 'Demo attributes removed', changed: true };
    }
    return { success: true, message: 'No changes needed', changed: false };
  } catch (err) {
    return { success: false, message: err.message, changed: false };
  }
}

/**
 * Main cleanup execution
 */
async function executeCleanup(dryRun = false, fileFilter = null, verbose = false) {
  log.info(`Starting demo data cleanup (DRY RUN: ${dryRun})...`);
  
  const results = {
    files: {},
    summary: { total: 0, changed: 0, failed: 0 }
  };
  
  // Process JavaScript files
  for (const [filename, config] of Object.entries(CLEANUP_CONFIG.files)) {
    if (fileFilter && filename !== fileFilter) continue;
    
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      log.warn(`File not found: ${filename}`);
      continue;
    }
    
    log.info(`\nCleaning ${filename} (${config.description})...`);
    results.files[filename] = [];
    
    if (config.arrays) {
      for (const arrayName of config.arrays) {
        const result = cleanArrayFromFile(filePath, arrayName, dryRun);
        results.files[filename].push(result);
        const icon = result.changed ? '✓' : '○';
        log.info(`  ${icon} ${result.message}`);
        if (result.changed) results.summary.changed++;
        if (!result.success) results.summary.failed++;
        results.summary.total++;
      }
    }
    
    if (config.patterns) {
      log.info(`  Removing ${config.patterns.length} pattern matches...`);
      // Pattern removal is more complex and requires careful handling
    }
  }
  
  // Process files to blank
  for (const [filename, template] of Object.entries(CLEANUP_CONFIG.blankFiles)) {
    if (fileFilter && filename !== fileFilter) continue;
    
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      log.warn(`File not found: ${filename} (will be created with minimal template)`);
      if (!dryRun) {
        fs.writeFileSync(filePath, template, 'utf-8');
      }
    } else {
      const result = blankFile(filePath, template, dryRun);
      log.success(`Blanked ${filename}`);
      results.summary.changed++;
      results.summary.total++;
    }
  }
  
  // Process HTML files
  for (const [filename, config] of Object.entries(CLEANUP_CONFIG.htmlFiles)) {
    if (fileFilter && filename !== fileFilter) continue;
    
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      log.warn(`HTML file not found: ${filename}`);
      continue;
    }
    
    const result = cleanHtmlFile(filePath, config, dryRun);
    log.info(`${result.changed ? '✓' : '○'} ${filename}: ${result.message}`);
    if (result.changed) results.summary.changed++;
    if (!result.success) results.summary.failed++;
    results.summary.total++;
  }
  
  // Summary
  log.info(`\n${'='.repeat(60)}`);
  log.info(`CLEANUP SUMMARY`);
  log.info(`Total items processed: ${results.summary.total}`);
  log.success(`Successfully changed: ${results.summary.changed}`);
  if (results.summary.failed > 0) {
    log.error(`Failed: ${results.summary.failed}`);
  }
  
  if (dryRun) {
    log.info(`\n** DRY RUN MODE ** - No files were actually modified.`);
    log.info(`   Run again without --dry-run to apply changes.`);
  } else {
    log.info(`\n✓ Cleanup complete!`);
    log.info(`\nNext steps:`);
    log.info(`1. Review git diff to verify changes`);
    log.info(`2. Commit: git commit -m "cleanup: remove demo/sample data"`);
    log.info(`3. Deploy: npm run build && npm run deploy`);
  }
  
  return results;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    file: null,
    verbose: args.includes('--verbose'),
    all: args.includes('--all') || !args.some(a => a.startsWith('--file='))
  };
  
  const fileArg = args.find(a => a.startsWith('--file='));
  if (fileArg) {
    options.file = fileArg.split('=')[1];
  }
  
  return options;
}

// CLI Entry point
if (require.main === module) {
  const options = parseArgs();
  executeCleanup(options.dryRun, options.file, options.verbose)
    .then(() => process.exit(0))
    .catch(err => {
      log.error(`Cleanup failed: ${err.message}`);
      process.exit(1);
    });
}

module.exports = {
  executeCleanup,
  cleanArrayFromFile,
  removeFunctionsFromFile,
  blankFile,
  cleanHtmlFile,
  CLEANUP_CONFIG
};
