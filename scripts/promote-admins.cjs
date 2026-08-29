const pg = require('pg');
const c = new pg.Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/isafedrive',
});
c.connect()
  .then(async () => {
    await c.query("UPDATE users SET role = 'super_admin' WHERE phone = '+2348012345678'");
    await c.query(
      "INSERT INTO users (phone, role, full_name, status) VALUES ('+23470706474164', 'admin', 'Platform Admin', 'active') ON CONFLICT DO NOTHING",
    );
    await c.query(
      "UPDATE users SET role = 'admin' WHERE phone = '+23470706474164' AND role NOT IN ('admin','super_admin')",
    );
    const r = await c.query(
      "SELECT phone, role, status FROM users WHERE role IN ('admin','super_admin') ORDER BY created_at",
    );
    console.log(JSON.stringify(r.rows, null, 1));
    await c.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
