import { Router } from 'express';
import { getRedis } from '../lib/redis.js';
import { requireSession } from '../lib/auth.js';

const router = Router();
const KEY = 'vaney:contact';

// GET  /api/contact -> public, current contact details (or null if never set)
router.get('/', async (req, res) => {
  try {
    const redis = getRedis();
    res.json((await redis.get(KEY)) || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contact -> admin, replaces contact details
router.post('/', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const redis = getRedis();
    const contact = req.body || {};
    await redis.set(KEY, contact);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
