import { getRedis, cors } from '../_lib/redis.js';
import { hashPassword, createSession } from '../_lib/auth.js';

const USERS_KEY = 'vaney:users';

// POST /api/auth/register — { name, email, password } -> { token, name, email }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

  const { name, email: rawEmail, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const existing = await redis.hget(USERS_KEY, email);
  if (existing) {
    return res.status(409).json({ error: 'An admin with this email already exists.' });
  }

  const user = {
    name: String(name).trim(),
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(user) });

  const token = await createSession(email);
  return res.status(201).json({ token, name: user.name, email: user.email });
}
