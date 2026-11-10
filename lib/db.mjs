import pg from 'pg';

export class SetupError extends Error {}

export function database() {
  if (!process.env.DATABASE_URL) {
    throw new SetupError('The database is being connected. Please try again soon.');
  }
  if (!globalThis.setflowDatabase) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 12000,
    });
    pool.on('error', () => console.error('An idle database connection closed.'));
    globalThis.setflowDatabase = pool;
  }
  return globalThis.setflowDatabase;
}

export async function transaction(work) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
