import crypto from 'node:crypto';
import { getRedis } from './redis.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // sessions last 30 days

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSession(email) {
  const redis = getRedis();
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`vaney:session:${token}`, email, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function destroySession(token) {
  if (!token) return;
  const redis = getRedis();
  await redis.del(`vaney:session:${token}`);
}

export async function getSessionEmail(token) {
  if (!token) return null;
  const redis = getRedis();
  return (await redis.get(`vaney:session:${token}`)) || null;
}

export function getBearerToken(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

/** Resolves the logged-in admin's email from the request's Authorization header, or null. */
export async function requireSession(req) {
  return getSessionEmail(getBearerToken(req));
}

export function readUser(raw) {
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
