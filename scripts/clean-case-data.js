const fs = require('fs');
const path = require('path');

// Case-specific data to replace with placeholders
const replacements = [
  { pattern: /[Party Name] v\. [Party Name]/gi, replacement: '[Party A] v. [Party B]' },
  { pattern: /Matter/gi, replacement: 'Matter' },
  { pattern: /[Party Name]/gi, replacement: '[Party Name]' },
  { pattern: /\bLuis\b/gi, replacement: '[Party A]' },
  { pattern: /\bConi\b/gi, replacement: '[Party B]' },
  { pattern: /[Case No.]/gi, replacement: '[Case No.]' },
  { pattern: /[County]/gi, replacement: '[County]' },
  { pattern: /[State]/gi, replacement: '[State]' },
  { pattern: /[Third Party]/gi, replacement: '[Third Party]' },
  { pattern: /[Child]/gi, replacement: '[Child]' },
  { pattern: /[Counsel]/gi, replacement: '[Counsel]' },
  { pattern: /[Expert]/gi, replacement: '[Expert]' },
  { pattern: /[Employer A]/gi, replacement: '[Employer A]' },
  { pattern: /[Employer B]/gi, replacement: '[Employer B]' },
  { pattern: /[Agency]/gi, replacement: '[Agency]' },
  { pattern: /[Agency]/gi, replacement: '[Agency]' },
];

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    // Apply replacements
    replacements.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, replacement);
    });

    // Write back if changed
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Cleaned: ${path.basename(filePath)}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`✗ Error cleaning ${filePath}:`, err.message);
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
      if (cleanFile(filePath)) count++;
    } else if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
      count += cleanDirectory(filePath);
    }
  });

  return count;
}

console.log('Cleaning case-specific data from all files...\n');
const cleaned = cleanDirectory(path.join(__dirname, '..'));
console.log(`\n✓ Cleaned ${cleaned} files`);
