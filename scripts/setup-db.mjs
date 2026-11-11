import { readdir, readFile } from 'node:fs/promises';
import nextEnv from '@next/env';
import { database, transaction } from '../lib/db.mjs';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

if (!process.env.DATABASE_URL) {
  if (process.argv.includes('--if-configured')) {
    console.log('Database setup skipped. Connect DATABASE_URL before deploying the app.');
    process.exit(0);
  }
  console.error('Add DATABASE_URL to the environment to set up the database.');
  process.exit(1);
}

const migrationDirectory = new URL('../db/', import.meta.url);
const migrations = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();

try {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(21021108)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(name, migrationDirectory), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log('Applied ' + name);
    }
  });
} catch (error) {
  console.error('Database setup failed (' + (error.code ?? error.name) + '). Verify the connection and retry.');
  process.exitCode = 1;
} finally {
  await database().end();
}
