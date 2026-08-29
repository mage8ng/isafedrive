import EmbeddedPostgres from 'embedded-postgres';

const pg = new EmbeddedPostgres({
  databaseDir: 'data/postgres',
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

try {
  await pg.initialise();
  process.stdout.write('Postgres cluster initialised\n');
} catch (error) {
  process.stdout.write(
    `initialise skipped: ${error && (error.message ?? error)}\n`,
  );
}

await pg.start();
process.stdout.write('PostgreSQL listening on localhost:5432\n');

for (const dbName of ['isafedrive']) {
  try {
    await pg.createDatabase(dbName);
    process.stdout.write(`Database ${dbName} created\n`);
  } catch {
    process.stdout.write(`Database ${dbName} already exists\n`);
  }
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    await pg.stop();
  } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

setInterval(() => {}, 60_000);
