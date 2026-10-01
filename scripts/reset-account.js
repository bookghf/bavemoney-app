#!/usr/bin/env node

/**
 * Reset one user's ledger data in the local development database, keeping
 * their login (email, password, sessions) so they can start fresh.
 *
 *   yarn reset-account <email>          # shows what will be deleted, asks to confirm
 *   yarn reset-account <email> --yes    # no prompt (scripts, CI)
 *
 * Deletes: transactions (and their attachments), budgets, accounts, and the
 * user's own categories. Keeps: the user row, refresh tokens, system categories.
 *
 * It runs psql inside the money-api Postgres container (default `ledger-db`),
 * which trusts local connections, so no database password is needed here.
 * Override with LEDGER_DB_CONTAINER, LEDGER_DB_USER, LEDGER_DB_NAME.
 */

const { execFileSync } = require('child_process');
const readline = require('readline');

const CONTAINER = process.env.LEDGER_DB_CONTAINER || 'ledger-db';
const DB_USER = process.env.LEDGER_DB_USER || 'ledger';
const DB_NAME = process.env.LEDGER_DB_NAME || 'ledger';

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();
const skipPrompt = args.includes('--yes') || args.includes('-y');

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: yarn reset-account <email> [--yes]');
  process.exit(1);
}

/**
 * Run SQL through psql in the container. The email travels as a psql variable
 * (:'email' quotes it), never spliced into the SQL text.
 */
function psql(sql) {
  try {
    return execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`, '-tA', '-F', '|'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    const detail = (error.stderr || error.message || '').toString().trim();
    console.error(`Could not reach the database in container "${CONTAINER}". Is money-api running (docker compose up -d)?`);
    if (detail) console.error(detail);
    process.exit(1);
  }
}

// Same lookup as the API: emails are case-insensitive.
const USER = `(SELECT id FROM users WHERE lower(email) = :'email' ORDER BY created_at LIMIT 1)`;

const counts = psql(`
  SELECT
    (SELECT COUNT(*) FROM users WHERE id = ${USER}),
    (SELECT COUNT(*) FROM transactions WHERE user_id = ${USER}),
    (SELECT COUNT(*) FROM accounts WHERE user_id = ${USER}),
    (SELECT COUNT(*) FROM budgets WHERE user_id = ${USER}),
    (SELECT COUNT(*) FROM categories WHERE user_id = ${USER});
`);
const [found, transactions, accounts, budgets, categories] = counts.split('|').map(Number);

if (!found) {
  console.error(`No user with email ${email}.`);
  process.exit(1);
}

console.log(`\nReset account ${email} (database ${DB_NAME} in ${CONTAINER})`);
console.log('This permanently deletes:');
console.log(`  ${transactions} transactions (with attachments)`);
console.log(`  ${accounts} accounts`);
console.log(`  ${budgets} budgets`);
console.log(`  ${categories} custom categories`);
console.log('The login (email and password) is kept.\n');

function reset() {
  // One transaction, children before parents (transactions reference
  // accounts and categories without ON DELETE CASCADE).
  psql(`
    BEGIN;
    DELETE FROM transactions WHERE user_id = ${USER};
    DELETE FROM budgets WHERE user_id = ${USER};
    DELETE FROM accounts WHERE user_id = ${USER};
    DELETE FROM categories WHERE user_id = ${USER} AND parent_id IS NOT NULL;
    DELETE FROM categories WHERE user_id = ${USER};
    COMMIT;
  `);
  console.log(`✅ ${email} was reset. Pull to refresh in the app (or sign out and back in).`);
}

if (skipPrompt) {
  reset();
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`Type the email again to confirm: `, (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== email) {
      console.log('Cancelled; nothing was deleted.');
      process.exit(1);
    }
    reset();
  });
}
