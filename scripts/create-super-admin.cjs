const bcrypt = require('bcryptjs');
const pg = require('pg');

const USERNAME = process.env.ADMIN_USERNAME || 'isafeadmin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'prof_uchendu@!safedr!ve?';

const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/isafedrive',
});

c.connect()
  .then(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const existing = await c.query('SELECT id FROM users WHERE username = $1', [USERNAME]);
    if (existing.rows.length > 0) {
      await c.query(
        "UPDATE users SET password_hash = $1, role = 'super_admin', status = 'active' WHERE username = $2",
        [hash, USERNAME],
      );
      console.log(`super admin '${USERNAME}' password updated`);
    } else {
      const phone = '+234000000001';
      const byPhone = await c.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (byPhone.rows.length > 0) {
        await c.query(
          "UPDATE users SET username = $1, password_hash = $2, role = 'super_admin', status = 'active' WHERE phone = $3",
          [USERNAME, hash, phone],
        );
        console.log(`super admin '${USERNAME}' attached to existing platform account`);
      } else {
        await c.query(
          "INSERT INTO users (phone, username, password_hash, role, full_name, status) VALUES ($1, $2, $3, 'super_admin', 'iSafeDrive Super Admin', 'active')",
          [phone, USERNAME, hash],
        );
        console.log(`super admin '${USERNAME}' created`);
      }
    }
    const check = await c.query(
      "SELECT username, role, status FROM users WHERE username = $1",
      [USERNAME],
    );
    console.log(JSON.stringify(check.rows[0]));
    await c.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
