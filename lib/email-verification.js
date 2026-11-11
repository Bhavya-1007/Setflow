import { createHash, randomBytes } from 'node:crypto';
import { database, SetupError } from './db.mjs';
import { ApiError } from './http';

export const verificationCodePattern = /^[A-Za-z0-9_-]{16}$/;

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export async function sendVerificationCode(userId) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !sender) throw new SetupError('Verification emails are being connected. Try again later.');

  const code = randomBytes(12).toString('base64url');
  const { rows: [user] } = await database().query(
    `UPDATE users
     SET email_verification_hash = $2, email_verification_expires_at = now() + interval '20 minutes',
         email_verification_sent_at = now()
     WHERE id = $1 AND email_verified_at IS NULL AND NOT is_demo
       AND (email_verification_sent_at IS NULL OR email_verification_sent_at <= now() - interval '1 minute')
     RETURNING email`,
    [userId, hashCode(code)]
  );
  if (!user) throw new ApiError(429, 'Wait a minute before requesting another code.');

  let delivery;
  try {
    delivery = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SetFlow', email: sender },
        to: [{ email: user.email }],
        subject: 'Verify your SetFlow email',
        textContent: `Paste this one-time code into SetFlow to verify your email.\n\n${code}\n\nThe code expires in 20 minutes. If you didn’t create a SetFlow account, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
  } catch (error) {
    console.error('Verification email request failed', { type: error.name, code: error.cause?.code });
    throw new ApiError(502, 'The verification email couldn’t be sent. Try again in a minute.');
  }
  if (!delivery.ok) {
    console.error('Verification email request rejected', { status: delivery.status });
    throw new ApiError(502, 'The verification email couldn’t be sent. Try again in a minute.');
  }
}

export async function confirmVerificationCode(userId, code) {
  const { rowCount } = await database().query(
    `UPDATE users
     SET email_verified_at = now(), email_verification_hash = NULL,
         email_verification_expires_at = NULL, email_verification_sent_at = NULL
     WHERE id = $1 AND email_verified_at IS NULL AND NOT is_demo
       AND email_verification_hash = $2 AND email_verification_expires_at > now()`,
    [userId, hashCode(code)]
  );
  if (!rowCount) throw new ApiError(400, 'That code is invalid or expired. You can request a new one.');
}
