import { Router } from 'express';
import { getRedis } from '../lib/redis.js';
import { requireSession } from '../lib/auth.js';

const router = Router();
const KEY = 'vaney:content_blocks';

// GET    /api/content?section=about   -> public, list blocks (optionally filtered)
router.get('/', async (req, res) => {
  try {
    const redis = getRedis();
    const blocks = (await redis.get(KEY)) || [];
    const { section } = req.query;
    res.json(section ? blocks.filter((b) => b.section === section) : blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST   /api/content -> admin, { section, title, body }
router.post('/', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  const { section, title, body } = req.body || {};
  if (!section || !title || !body) {
    return res.status(400).json({ error: 'section, title and body are required' });
  }

  try {
    const redis = getRedis();
    const blocks = (await redis.get(KEY)) || [];
    const block = { id: 'b' + Date.now(), section, title, body, added: new Date().toISOString() };
    blocks.unshift(block);
    await redis.set(KEY, blocks);
    res.status(201).json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/content?id=b123 -> admin
router.delete('/', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const redis = getRedis();
    const blocks = (await redis.get(KEY)) || [];
    await redis.set(KEY, blocks.filter((b) => b.id !== id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
