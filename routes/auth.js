import { Router } from 'express';
import { getRedis } from '../lib/redis.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionEmail,
  getBearerToken,
  requireSession,
  readUser,
} from '../lib/auth.js';

const router = Router();
const USERS_KEY = 'vaney:users';
const RESET_TTL_SECONDS = 15 * 60;

// POST /api/auth/register — { name, email, password } -> { token, name, email }
router.post('/register', async (req, res) => {
  const { name, email: rawEmail, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const existing = await redis.hget(USERS_KEY, email);
  if (existing) return res.status(409).json({ error: 'An admin with this email already exists.' });

  const user = {
    name: String(name).trim(),
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(user) });

  const token = await createSession(email);
  res.status(201).json({ token, name: user.name, email: user.email });
});

// POST /api/auth/login — { email, password } -> { token, name, email }
router.post('/login', async (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const user = readUser(await redis.hget(USERS_KEY, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = await createSession(email);
  res.json({ token, name: user.name, email: user.email });
});

// GET /api/auth/me — Authorization: Bearer <token> -> { name, email }
router.get('/me', async (req, res) => {
  const email = await getSessionEmail(getBearerToken(req));
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const user = readUser(await redis.hget(USERS_KEY, email));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ name: user.name, email: user.email });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  await destroySession(getBearerToken(req));
  res.status(204).end();
});

// POST /api/auth/forgot — { email } -> { ok, code }
router.post('/forgot', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const existing = await redis.hget(USERS_KEY, email);
  if (!existing) return res.status(404).json({ error: 'No admin account found with that email.' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(`vaney:reset:${email}`, code, { ex: RESET_TTL_SECONDS });
  res.json({ ok: true, code });
});

// POST /api/auth/reset — { email, code, password }
router.post('/reset', async (req, res) => {
  const { email: rawEmail, code, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !code || !password) return res.status(400).json({ error: 'Email, code and new password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const savedCode = await redis.get(`vaney:reset:${email}`);
  if (!savedCode || String(savedCode) !== String(code)) {
    return res.status(400).json({ error: 'That reset code is incorrect or has expired.' });
  }

  const user = readUser(await redis.hget(USERS_KEY, email));
  if (!user) return res.status(404).json({ error: 'No admin account found with that email.' });

  user.passwordHash = hashPassword(password);
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(user) });
  await redis.del(`vaney:reset:${email}`);
  res.json({ ok: true });
});

// POST /api/auth/profile — Authorization: Bearer <token>, { name?, password? }
router.post('/profile', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const user = readUser(await redis.hget(USERS_KEY, email));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, password } = req.body || {};
  if (name) user.name = String(name).trim();
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    user.passwordHash = hashPassword(password);
  }
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(user) });
  res.json({ name: user.name, email: user.email });
});

export default router;
