import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { database } from './db.mjs';
import { ApiError } from './http.js';

export const SESSION_COOKIE = 'setflow_session';
const SESSION_AGE = 14 * 24 * 60 * 60;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hasPro(user) {
  return user.is_demo || ['active', 'trialing'].includes(user.subscription_status);
}

export function hasVerifiedEmail(user) {
  return user.is_demo || Boolean(user.email_verified_at);
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { rows } = await database().query(
    'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id ' +
    'WHERE sessions.token_hash = $1 AND sessions.expires_at > now()',
    [digest(token)]
  );
  return rows[0] ?? null;
}

export async function requireSessionUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, 'Log in to continue.');
  return user;
}

export async function requireUser() {
  const user = await requireSessionUser();
  if (!hasVerifiedEmail(user)) throw new ApiError(403, 'Verify your email to continue.');
  return user;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await database().query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3 * interval \'1 second\')',
    [digest(token), userId, SESSION_AGE]
  );
  return token;
}

export async function removeSession(token) {
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await database().query('DELETE FROM sessions WHERE token_hash = $1', [digest(token)]);
  }
}

export function sessionCookieOptions(request, clear = false) {
  return {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL) || new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: clear ? 0 : SESSION_AGE,
  };
}

export async function rateLimitAccount(request, intent, email) {
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const limits = [
    { key: intent + ':ip:' + ip, max: intent === 'signup' ? 10 : 50 },
    { key: intent + ':email:' + email, max: 10 },
  ];
  for (const limit of limits) {
    const { rows } = await database().query(
      "INSERT INTO rate_limits (bucket, attempts, expires_at) VALUES ($1, 1, now() + interval '10 minutes') " +
      "ON CONFLICT (bucket) DO UPDATE SET " +
      "attempts = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.attempts + 1 END, " +
      "expires_at = CASE WHEN rate_limits.expires_at <= now() THEN now() + interval '10 minutes' ELSE rate_limits.expires_at END " +
      "RETURNING attempts",
      [digest(limit.key)]
    );
    if (rows[0].attempts > limit.max) {
      throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.');
    }
  }
}

export async function addUser(email, name, passwordHash) {
  const { rows } = await database().query(
    'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) ' +
    'ON CONFLICT (email) DO NOTHING RETURNING id',
    [randomUUID(), email, name, passwordHash]
  );
  return rows[0];
}
