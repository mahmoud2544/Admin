import { del } from '@vercel/blob';
import { getRedis, cors } from './_lib/redis.js';
import { requireSession } from './_lib/auth.js';

const KEY = 'vaney:media';

// GET    /api/media?section=about   -> public, list media (optionally filtered)
// POST   /api/media                 -> admin, registers a file already uploaded to Blob
//                                       { section, type, url, pathname, name }
// DELETE /api/media?id=m123         -> admin, also deletes the underlying Blob file
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
    const media = (await redis.get(KEY)) || [];
    const { section } = req.query;
    const filtered = section ? media.filter((m) => m.section === section) : media;
    return res.status(200).json(filtered);
  }

  if (!(await requireSession(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { section, type, url, pathname, name } = req.body || {};
    if (!section || !type || !url) {
      return res.status(400).json({ error: 'section, type and url are required' });
    }
    const media = (await redis.get(KEY)) || [];
    const item = {
      id: 'm' + Date.now(),
      section,
      type,
      url,
      pathname,
      name: name || pathname || 'file',
      added: new Date().toISOString(),
    };
    media.unshift(item);
    await redis.set(KEY, media);
    return res.status(201).json(item);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const media = (await redis.get(KEY)) || [];
    const item = media.find((m) => m.id === id);
    const next = media.filter((m) => m.id !== id);
    await redis.set(KEY, next);
    if (item?.pathname) {
      try {
        await del(item.pathname);
      } catch {
        // file may already be gone — not fatal
      }
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');
  return res.status(405).end();
}
