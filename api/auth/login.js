import { getRedis, cors } from '../_lib/redis.js';
import { verifyPassword, createSession, readUser } from '../_lib/auth.js';

const USERS_KEY = 'vaney:users';

// POST /api/auth/login — { email, password } -> { token, name, email }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

  const { email: rawEmail, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

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
  return res.status(200).json({ token, name: user.name, email: user.email });
}
