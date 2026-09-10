import { getRedis, cors } from '../_lib/redis.js';
import { hashPassword, readUser } from '../_lib/auth.js';

const USERS_KEY = 'vaney:users';

// POST /api/auth/reset — { email, code, password }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

  const { email: rawEmail, code, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, code and new password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

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

  return res.status(200).json({ ok: true });
}
