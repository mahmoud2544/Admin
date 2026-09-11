import { Router } from 'express';
import { getRedis, INTERACTION_LABELS, isoDate } from '../lib/redis.js';
import { requireSession } from '../lib/auth.js';

const router = Router();
const LIVE_WINDOW_MS = 5 * 60 * 1000;
const WEEKS = 8;
const DAYS = WEEKS * 7;

function emptyDay() {
  return { pv: 0, s: 0, nv: 0, rv: 0, conv: 0, hours: Array(24).fill(0) };
}
function readDay(raw) {
  const d = emptyDay();
  if (!raw) return d;
  d.pv = Number(raw.pv) || 0;
  d.s = Number(raw.s) || 0;
  d.nv = Number(raw.nv) || 0;
  d.rv = Number(raw.rv) || 0;
  d.conv = Number(raw.conv) || 0;
  for (let h = 0; h < 24; h++) d.hours[h] = Number(raw['h' + h]) || 0;
  return d;
}

// GET /api/analytics — admin only.
router.get('/', async (req, res) => {
  const email = await requireSession(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const now = Date.now();
  const dates = [];
  for (let i = DAYS - 1; i >= 0; i--) dates.push(isoDate(new Date(now - i * 86400000)));

  const pipe = redis.pipeline();
  dates.forEach((d) => pipe.hgetall(`vaney:day:${d}`));
  pipe.hgetall('vaney:devices');
  pipe.hgetall('vaney:sources');
  pipe.hgetall('vaney:interactions');
  pipe.hgetall('vaney:pages');
  pipe.zremrangebyscore('vaney:live', 0, now - LIVE_WINDOW_MS);
  pipe.zcard('vaney:live');
  pipe.lrange('vaney:log', 0, 19);

  const results = await pipe.exec();

  const dayResults = results.slice(0, DAYS).map(readDay);
  let idx = DAYS;
  const devicesRaw = results[idx++] || {};
  const sourcesRaw = results[idx++] || {};
  const interactionsRaw = results[idx++] || {};
  const pagesRaw = results[idx++] || {};
  idx++; // zremrangebyscore result, unused
  const liveNow = Number(results[idx++]) || 0;
  const recentLogRaw = results[idx++] || [];

  const today = dayResults[dayResults.length - 1];
  const yesterday = dayResults[dayResults.length - 2] || emptyDay();
  const pctDelta = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

  const avgPagesPerSession = today.s > 0 ? +(today.pv / today.s).toFixed(1) : 0;
  const conversionRate = today.s > 0 ? +((today.conv / today.s) * 100).toFixed(1) : 0;

  const last14 = dayResults.slice(-14);
  const last14Dates = dates.slice(-14);

  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const chunk = dayResults.slice(w * 7, w * 7 + 7);
    weeks.push({
      label: dates[w * 7],
      newVisitors: chunk.reduce((sum, d) => sum + d.nv, 0),
      returningVisitors: chunk.reduce((sum, d) => sum + d.rv, 0),
    });
  }

  const topPages = Object.entries(pagesRaw)
    .map(([path, count]) => [path, Number(count) || 0])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalRecentPageviews = dayResults.reduce((sum, d) => sum + d.pv, 0);
  const interactions = { pageview: totalRecentPageviews };
  Object.keys(INTERACTION_LABELS).forEach((key) => {
    interactions[key] = Number(interactionsRaw[key]) || 0;
  });

  const recentLog = recentLogRaw
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  res.json({
    today: {
      newVisitors: today.nv,
      returningVisitors: today.rv,
      sessions: today.s,
      pageViews: today.pv,
      avgPagesPerSession,
      conversionRate,
    },
    deltas: {
      newVisitorsPct: pctDelta(today.nv, yesterday.nv),
      pageViewsPct: pctDelta(today.pv, yesterday.pv),
      sessionsPct: pctDelta(today.s, yesterday.s),
    },
    liveNow,
    hourlyToday: today.hours,
    last14Days: { labels: last14Dates, sessions: last14.map((d) => d.s), pageViews: last14.map((d) => d.pv) },
    last8Weeks: weeks,
    devices: {
      mobile: Number(devicesRaw.mobile) || 0,
      desktop: Number(devicesRaw.desktop) || 0,
      tablet: Number(devicesRaw.tablet) || 0,
    },
    sources: {
      search: Number(sourcesRaw.search) || 0,
      direct: Number(sourcesRaw.direct) || 0,
      social: Number(sourcesRaw.social) || 0,
      referral: Number(sourcesRaw.referral) || 0,
      email: Number(sourcesRaw.email) || 0,
    },
    interactionLabels: { pageview: 'Page views', ...INTERACTION_LABELS },
    interactions,
    topPages,
    recentLog,
  });
});

export default router;
