import { cors } from '../_lib/redis.js';
import { getBearerToken, destroySession } from '../_lib/auth.js';

// POST /api/auth/logout — Authorization: Bearer <token>
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }
  await destroySession(getBearerToken(req));
  return res.status(204).end();
}
