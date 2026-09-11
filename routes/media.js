import { Router } from 'express';
import multer from 'multer';
import { getRedis } from '../lib/redis.js';
import { requireSession } from '../lib/auth.js';
import { uploadBuffer, deleteAsset, isConfigured } from '../lib/storage.js';

const router = Router();
const KEY = 'vaney:media';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap, generous for video
});

// GET /api/media?section=about -> public, list media (optionally filtered)
router.get('/', async (req, res) => {
  try {
    const redis = getRedis();
    const media = (await redis.get(KEY)) || [];
    const { section } = req.query;
    res.json(section ? media.filter((m) => m.section === section) : media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media -> admin, multipart/form-data: file + section
// The browser sends the file straight here (plain upload) — this endpoint
// forwards it to Cloudinary and saves the resulting URL in Redis.
router.post('/', upload.single('file'), async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Media storage is not set up yet — add your Cloudinary credentials.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded' });

  const section = req.body?.section;
  if (!section) return res.status(400).json({ error: 'section is required' });
  const isVideo = req.file.mimetype.startsWith('video/');

  try {
    const result = await uploadBuffer(req.file.buffer, {
      resourceType: isVideo ? 'video' : 'image',
      folder: `vaney-media/${section}`,
    });

    const redis = getRedis();
    const media = (await redis.get(KEY)) || [];
    const item = {
      id: 'm' + Date.now(),
      section,
      type: isVideo ? 'video' : 'photo',
      url: result.secure_url,
      publicId: result.public_id,
      name: req.file.originalname,
      added: new Date().toISOString(),
    };
    media.unshift(item);
    await redis.set(KEY, media);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/media?id=m123 -> admin, also deletes the Cloudinary asset
router.delete('/', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const redis = getRedis();
    const media = (await redis.get(KEY)) || [];
    const item = media.find((m) => m.id === id);
    await redis.set(KEY, media.filter((m) => m.id !== id));
    if (item?.publicId) {
      try {
        await deleteAsset(item.publicId, item.type === 'video' ? 'video' : 'image');
      } catch {
        // asset may already be gone — not fatal
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
