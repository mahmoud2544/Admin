import { getRedis, cors } from '../_lib/redis.js';

const USERS_KEY = 'vaney:users';
const RESET_TTL_SECONDS = 15 * 60;

// POST /api/auth/forgot — { email } -> { ok, code }
// No email service is connected, so the code is returned directly in the
// response instead of being emailed. Swap this for a real email send (e.g.
// via Resend) once you're ready to wire one up.
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const existing = await redis.hget(USERS_KEY, email);
  if (!existing) {
    return res.status(404).json({ error: 'No admin account found with that email.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(`vaney:reset:${email}`, code, { ex: RESET_TTL_SECONDS });

  return res.status(200).json({ ok: true, code });
}
