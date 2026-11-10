import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, scryptOptions);
  return 'scrypt:' + salt + ':' + key.toString('hex');
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, hex] = encoded?.split(':') ?? [];
  const valid = algorithm === 'scrypt' && /^[a-f0-9]{32}$/.test(salt) && /^[a-f0-9]{128}$/.test(hex);
  const key = await derive(password, valid ? salt : '00000000000000000000000000000000', 64, scryptOptions);
  return valid && timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
