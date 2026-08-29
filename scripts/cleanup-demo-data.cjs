const pg = require('pg');

const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/isafedrive',
});

const KEEP_PHONES = ['+234000000001', '+2348012345678', '+23470706474164'];

async function main() {
  await c.connect();
  const tables = [
    'chat_messages',
    'payments',
    'wallet_transactions',
    'wallets',
    'driver_withdrawals',
    'ratings',
    'support_tickets',
    'safety_incidents',
    'fraud_alerts',
    'notifications',
    'rides',
    'corporate_employees',
    'corporate_accounts',
    'fleet_drivers',
    'fleets',
    'deliveries',
    'vehicles',
    'drivers',
    'promotions',
    'audit_logs',
  ];
  for (const t of tables) {
    await c.query(`DELETE FROM ${t}`);
    console.log(`cleared ${t}`);
  }
  const placeholders = KEEP_PHONES.map((_, i) => `$${i + 1}`).join(',');
  const removed = await c.query(
    `DELETE FROM users WHERE phone NOT IN (${placeholders}) RETURNING phone`,
    KEEP_PHONES,
  );
  console.log(`removed ${removed.rowCount} test users`);
  const kept = await c.query('SELECT phone, role, username FROM users ORDER BY created_at');
  console.log('kept users:', JSON.stringify(kept.rows));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
