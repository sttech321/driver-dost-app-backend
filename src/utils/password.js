import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Lightweight scrypt-based hashing (no native bcrypt dependency to install).
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const derived = scryptSync(password, salt, 64);
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}
