const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initializeDatabase } = require('../server/db/schema');

async function seed() {
  try {
    // Ensure .data directory exists
    const dataDir = path.join(__dirname, '../.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Initializing database...');
    const db = await initializeDatabase();

    // Load demo data
    const demoDataPath = path.join(__dirname, '../seed-data/demo-firm.json');
    const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf-8'));

    console.log('Seeding users...');
    for (const user of demoData.users) {
      db.run(
        `INSERT OR IGNORE INTO users (id, email, name, role) VALUES (?, ?, ?, ?)`,
        [user.id, user.email, user.name, user.role],
        (err) => {
          if (err) console.error('Error inserting user:', err);
        }
      );
    }

    console.log('Seeding matters...');
    for (const matter of demoData.matters) {
      db.run(
        `INSERT OR IGNORE INTO matters (id, firm_id, name, client_name, status) VALUES (?, ?, ?, ?, ?)`,
        [matter.id, demoData.firm.id, matter.name, matter.clientName, matter.status],
        (err) => {
          if (err) console.error('Error inserting matter:', err);
        }
      );
    }

    console.log('Seeding matter assignments...');
    for (const matter of demoData.matters) {
      for (const userId of matter.assignedUsers) {
        const user = demoData.users.find((u) => u.id === userId);
        if (user) {
          db.run(
            `INSERT OR IGNORE INTO matter_assignments (id, matter_id, user_id, role) VALUES (?, ?, ?, ?)`,
            [uuidv4(), matter.id, userId, user.role],
            (err) => {
              if (err) console.error('Error inserting assignment:', err);
            }
          );
        }
      }
    }

    console.log('Seeding documents...');
    for (const doc of demoData.documents) {
      db.run(
        `INSERT OR IGNORE INTO documents (id, matter_id, s3_key, filename, content_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.matterId, null, doc.filename, doc.contentType, doc.uploadedBy],
        (err) => {
          if (err) console.error('Error inserting document:', err);
        }
      );
    }

    // Close DB after a brief delay to allow inserts to complete
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          process.exit(1);
        } else {
          console.log('✓ Seed complete! Demo data loaded.');
          console.log('  Run: npm start');
          process.exit(0);
        }
      });
    }, 500);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
