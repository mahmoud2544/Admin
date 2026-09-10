import { getRedis, cors } from '../_lib/redis.js';
import { getBearerToken, getSessionEmail, readUser } from '../_lib/auth.js';

const USERS_KEY = 'vaney:users';

// GET /api/auth/me — Authorization: Bearer <token> -> { name, email }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
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

  return res.status(200).json({ name: user.name, email: user.email });
}
