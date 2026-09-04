const fs = require('fs');
const path = require('path');

// Replace all dollar amounts and numeric examples with placeholders
const replacements = [
  // Dollar amounts
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\$2,015\.70/g, replacement: '[amount]' },
  { pattern: /\$3,425\.70/g, replacement: '[amount]' },
  { pattern: /\$1,060\.80/g, replacement: '[amount]' },
  { pattern: /\$6,000\/month/g, replacement: '[monthly amount]' },
  { pattern: /\[support amount]/g, replacement: '[support amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  { pattern: /\[amount]/g, replacement: '[amount]' },
  // Percentages and shares
  { pattern: /[share percentage]/g, replacement: '[share percentage]' },
  { pattern: /[percentage]/g, replacement: '[percentage]' },
];

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    replacements.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, replacement);
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function cleanDirectory(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && (file.endsWith('.html') || file.endsWith('.js'))) {
      if (cleanFile(filePath)) {
        console.log(`✓ ${path.basename(filePath)}`);
        count++;
      }
    } else if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
      count += cleanDirectory(filePath);
    }
  });

  return count;
}

console.log('Removing all dollar amounts and numeric examples...\n');
const cleaned = cleanDirectory(path.join(__dirname, '..'));
console.log(`\n✓ Cleaned ${cleaned} files`);
