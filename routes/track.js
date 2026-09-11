import { Router } from 'express';
import { getRedis, parseDevice, parseSource, INTERACTION_LABELS, isoDate } from '../lib/redis.js';

const router = Router();

// POST /api/track — called by tracker.js on vaneymedia.com.
// body: { event: 'pageview' | 'ping' | <interaction name>, path, referrer,
//         sessionId, isNewSession, isNewVisitor }
router.post('/', async (req, res) => {
  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const body = req.body || {};
  const event = String(body.event || 'pageview').slice(0, 40);
  const path = String(body.path || '/').slice(0, 200);
  const referrer = String(body.referrer || '').slice(0, 300);
  const sessionId = String(body.sessionId || '').slice(0, 80);
  const isNewSession = Boolean(body.isNewSession);
  const isNewVisitor = Boolean(body.isNewVisitor);

  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const isPing = event === 'ping';
  const isInteraction = Object.prototype.hasOwnProperty.call(INTERACTION_LABELS, event);
  const isPageview = event === 'pageview';
  if (!isPing && !isInteraction && !isPageview) {
    return res.status(400).json({ error: 'unrecognized event' });
  }

  const now = Date.now();
  const day = isoDate(new Date(now));
  const hour = new Date(now).getUTCHours();
  const dayKey = `vaney:day:${day}`;
  const device = parseDevice(req.headers['user-agent'] || '');
  const source = parseSource(referrer);

  const pipe = redis.pipeline();

  if (!isPing) {
    pipe.zadd('vaney:live', { score: now, member: sessionId });
  }

  if (isPageview) {
    pipe.hincrby(dayKey, 'pv', 1);
    pipe.hincrby('vaney:pages', path, 1);
    if (isNewSession) {
      pipe.hincrby(dayKey, 's', 1);
      pipe.hincrby(dayKey, isNewVisitor ? 'nv' : 'rv', 1);
      pipe.hincrby(dayKey, `h${hour}`, 1);
      pipe.hincrby('vaney:devices', device, 1);
      pipe.hincrby('vaney:sources', source, 1);
    }
    pipe.lpush('vaney:log', JSON.stringify({ ts: now, path, event: 'pageview', device, source, isNewSession }));
    pipe.ltrim('vaney:log', 0, 299);
  }

  if (isInteraction) {
    pipe.hincrby('vaney:interactions', event, 1);
    pipe.hincrby(dayKey, 'conv', 1);
    pipe.lpush('vaney:log', JSON.stringify({ ts: now, path, event, device, source }));
    pipe.ltrim('vaney:log', 0, 299);
  }

  await pipe.exec();
  res.status(204).end();
});

export default router;
