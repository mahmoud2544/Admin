import { getRedis, cors } from './_lib/redis.js';
import { requireSession } from './_lib/auth.js';

const KEY = 'vaney:content_blocks';

// GET    /api/content?section=about   -> public, list blocks (optionally filtered)
// POST   /api/content                 -> admin, { section, title, body }
// DELETE /api/content?id=b123         -> admin
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
    const blocks = (await redis.get(KEY)) || [];
    const { section } = req.query;
    const filtered = section ? blocks.filter((b) => b.section === section) : blocks;
    return res.status(200).json(filtered);
  }

  if (!(await requireSession(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { section, title, body } = req.body || {};
    if (!section || !title || !body) {
      return res.status(400).json({ error: 'section, title and body are required' });
    }
    const blocks = (await redis.get(KEY)) || [];
    const block = { id: 'b' + Date.now(), section, title, body, added: new Date().toISOString() };
    blocks.unshift(block);
    await redis.set(KEY, blocks);
    return res.status(201).json(block);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const blocks = (await redis.get(KEY)) || [];
    const next = blocks.filter((b) => b.id !== id);
    await redis.set(KEY, next);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');
  return res.status(405).end();
}
