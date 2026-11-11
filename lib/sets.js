import { randomUUID } from 'node:crypto';
import { hasPro } from './account';
import { database, transaction } from './db.mjs';
import { ApiError } from './http';

export const PRO_DAILY_PLANS = 30;

export async function planAllowance(client, user) {
  const pro = hasPro(user);
  const { rows } = await client.query(
    'SELECT count(*)::integer AS used FROM sets WHERE user_id = $1 ' +
    "AND (plan IS NOT NULL OR created_at > now() - interval '2 minutes') " +
    "AND ($2::boolean = false OR created_at > now() - interval '24 hours')",
    [user.id, pro]
  );
  const limit = pro ? PRO_DAILY_PLANS : 1;
  return { pro, limit, remaining: Math.max(0, limit - rows[0].used) };
}

export async function reservePlan(userId, vibe, targetMinutes) {
  return transaction(async (client) => {
    const { rows: [user] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user) throw new ApiError(401, 'Log in to continue.');
    const pending = await client.query(
      "SELECT 1 FROM sets WHERE user_id = $1 AND plan IS NULL AND created_at > now() - interval '2 minutes'",
      [user.id]
    );
    if (pending.rowCount) throw new ApiError(409, 'Your other set is still generating.');
    const allowance = await planAllowance(client, user);
    if (!allowance.remaining) {
      throw new ApiError(429, allowance.pro
        ? 'You’ve reached your plan limit for the last 24 hours.'
        : 'You’ve used your free set. Upgrade to Pro to generate another.');
    }
    const id = randomUUID();
    await client.query(
      'INSERT INTO sets (id, user_id, vibe, target_minutes) VALUES ($1, $2, $3, $4)',
      [id, user.id, vibe, targetMinutes]
    );
    return id;
  });
}

export async function listSets(userId) {
  const { rows } = await database().query(
    'SELECT id, title, vibe, target_minutes, created_at FROM sets WHERE user_id = $1 AND plan IS NOT NULL ORDER BY created_at DESC',
    [userId]
  );
  return rows.map((set) => ({ ...set, created_at: set.created_at.toISOString() }));
}

export async function readSet(client, userId, id, lock = false) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(404, 'That set could not be found.');
  }
  const { rows: [set] } = await client.query(
    'SELECT id, title, vibe, target_minutes, plan, created_at, updated_at FROM sets ' +
    'WHERE user_id = $1 AND id = $2 AND plan IS NOT NULL' + (lock ? ' FOR UPDATE' : ''),
    [userId, id]
  );
  if (!set) throw new ApiError(404, 'That set could not be found.');
  return set;
}
