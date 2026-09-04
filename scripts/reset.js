const fs = require('fs');
const path = require('path');

async function removeWithRetry(dir, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries - 1}...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw err;
      }
    }
  }
}

async function reset() {
  try {
    console.log('Resetting Veritas template...');

    // Remove .data directory
    const dataDir = path.join(__dirname, '../.data');
    if (fs.existsSync(dataDir)) {
      console.log('Removing .data directory...');
      await removeWithRetry(dataDir);
    }

    // Remove /uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      console.log('Removing uploads directory...');
      await removeWithRetry(uploadsDir);
    }

    // Remove any .sqlite files
    const currentDir = path.join(__dirname, '..');
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      if (file.endsWith('.sqlite') || file.endsWith('.db')) {
        const filePath = path.join(currentDir, file);
        console.log(`Removing ${file}...`);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`Could not remove ${file}, will try again...`);
        }
      }
    }

    console.log('✓ Template reset complete!');
    console.log('  Run: npm run seed');
    console.log('  Then: npm start');
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err.message);
    console.error('\n💡 Tip: Make sure the server is not running.');
    console.error('   Kill any running "npm start" processes before retrying.');
    process.exit(1);
  }
}

reset();
