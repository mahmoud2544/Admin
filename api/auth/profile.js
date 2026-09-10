import { getRedis, cors } from '../_lib/redis.js';
import { getBearerToken, getSessionEmail, readUser, hashPassword } from '../_lib/auth.js';

const USERS_KEY = 'vaney:users';

// POST /api/auth/profile — Authorization: Bearer <token>, { name?, password? }
// Email is intentionally not editable here (it's the account's key).
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

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

  const { name, password } = req.body || {};
  if (name) user.name = String(name).trim();
  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    user.passwordHash = hashPassword(password);
  }
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(user) });

  return res.status(200).json({ name: user.name, email: user.email });
}
