const { v4: uuidv4 } = require('uuid');

const LARGE_TRANSFER_THRESHOLD = 25000; // Flag transfers over $25k
const ROUND_TRIP_WINDOW_DAYS = 14; // Look for in/out within 14 days

async function detectFlags(db, matterId, bankStatementId, transactions) {
  const flags = [];

  // Get all previous bank statements for this matter to check for account patterns
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM bank_statements WHERE matter_id = ? AND id != ? AND processing_status = 'completed'`,
      [matterId, bankStatementId],
      (err, previousStatements) => {
        if (err) {
          reject(err);
          return;
        }

        // Collect all known account numbers for this matter
        const knownAccounts = new Set();
        if (previousStatements) {
          previousStatements.forEach(stmt => {
            if (stmt.account_number_masked) {
              knownAccounts.add(stmt.account_number_masked);
            }
          });
        }

        // Rule 1: Large/Unusual Transfers
        transactions.forEach(txn => {
          if (txn.flow_type === 'transfer' && Math.abs(txn.amount) > LARGE_TRANSFER_THRESHOLD) {
            flags.push({
              id: uuidv4(),
              matter_id: matterId,
              bank_transaction_id: txn.id,
              rule_type: 'large_transfer',
              severity: 'high',
              title: 'Large Transfer Detected',
              description: `${txn.transaction_type === 'debit' ? 'Outgoing' : 'Incoming'} transfer of $${Math.abs(txn.amount).toFixed(2)} on ${txn.transaction_date}. Description: ${txn.description}`,
            });
          }
        });

        // Rule 2: Undisclosed Accounts
        transactions.forEach(txn => {
          // Check if transaction mentions an account number not in our records
          const accountPattern = /\*{0,4}\s*\d{3,4}|\b\d{8,12}\b/g;
          const mentionedAccounts = txn.description.match(accountPattern) || [];

          mentionedAccounts.forEach(account => {
            const masked = `****${account.slice(-4)}`;
            if (!knownAccounts.has(masked) && !knownAccounts.has(account)) {
              flags.push({
                id: uuidv4(),
                matter_id: matterId,
                bank_transaction_id: txn.id,
                rule_type: 'undisclosed_account',
                severity: 'critical',
                title: 'Potential Undisclosed Account',
                description: `Transaction references account ${masked} not disclosed in statement records. Amount: $${txn.amount}. Description: ${txn.description}`,
              });
            }
          });
        });

        // Rule 3: Round-Trip/Structuring
        detectRoundTrips(transactions, flags, matterId);

        // Rule 4: Claude Qualitative Flags (passed in from extraction)
        // These are handled separately - they come from the Claude extraction result

        resolve(flags);
      }
    );
  });
}

function detectRoundTrips(transactions, flags, matterId) {
  const txnsByCounterparty = {};

  // Group transactions by extracted counterparty
  transactions.forEach(txn => {
    const counterparty = extractCounterparty(txn.description);
    if (!txnsByCounterparty[counterparty]) {
      txnsByCounterparty[counterparty] = [];
    }
    txnsByCounterparty[counterparty].push(txn);
  });

  // Check each counterparty for round-trip patterns
  Object.entries(txnsByCounterparty).forEach(([counterparty, counterpartyTxns]) => {
    if (counterpartyTxns.length < 2) return;

    for (let i = 0; i < counterpartyTxns.length - 1; i++) {
      const out = counterpartyTxns[i];
      const outDate = new Date(out.transaction_date);

      for (let j = i + 1; j < counterpartyTxns.length; j++) {
        const back = counterpartyTxns[j];
        const backDate = new Date(back.transaction_date);

        // Check if within window and opposite directions
        const daysDiff = Math.abs((backDate - outDate) / (1000 * 60 * 60 * 24));
        const oppositeFlow = out.transaction_type !== back.transaction_type;
        const similarAmount = Math.abs(out.amount - back.amount) < 100; // Within $100

        if (daysDiff <= ROUND_TRIP_WINDOW_DAYS && oppositeFlow && similarAmount) {
          flags.push({
            id: uuidv4(),
            matter_id: matterId,
            bank_transaction_id: out.id,
            rule_type: 'round_trip',
            severity: 'high',
            title: 'Potential Round-Trip Transfer',
            description: `Money appears to go to ${counterparty} on ${out.transaction_date} and return ${Math.ceil(daysDiff)} days later on ${back.transaction_date}. Amounts: $${Math.abs(out.amount).toFixed(2)} out, $${Math.abs(back.amount).toFixed(2)} back. Pattern suggests possible structuring.`,
          });
        }
      }
    }
  });
}

function extractCounterparty(description) {
  // Extract counterparty from transaction description
  // Simple heuristic: take first meaningful word(s)
  const cleaned = description.replace(/\*\d{3,}/g, '').trim();
  const parts = cleaned.split(/\s+/);
  return parts.slice(0, 3).join(' ').toLowerCase();
}

async function insertFlags(db, flags) {
  return new Promise((resolve, reject) => {
    if (flags.length === 0) {
      resolve([]);
      return;
    }

    const stmt = db.prepare(
      `INSERT INTO flags (id, matter_id, bank_transaction_id, rule_type, severity, title, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    let completed = 0;
    flags.forEach(flag => {
      stmt.run(
        [flag.id, flag.matter_id, flag.bank_transaction_id, flag.rule_type, flag.severity, flag.title, flag.description],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === flags.length) {
            stmt.finalize(() => resolve(flags));
          }
        }
      );
    });
  });
}

module.exports = {
  detectFlags,
  insertFlags,
};
