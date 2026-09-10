import { getRedis, cors } from './_lib/redis.js';
import { requireSession } from './_lib/auth.js';

const KEY = 'vaney:contact';

// GET  /api/contact -> public, current contact details (or null if never set)
// POST /api/contact -> admin, replaces contact details
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (req.method === 'GET') {
    const contact = (await redis.get(KEY)) || null;
    return res.status(200).json(contact);
  }

  if (!(await requireSession(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const contact = req.body || {};
    await redis.set(KEY, contact);
    return res.status(200).json(contact);
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  return res.status(405).end();
}
