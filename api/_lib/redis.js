import { Redis } from '@upstash/redis';

let client;

/**
 * Gets a singleton Upstash Redis client using whichever env var names
 * the Vercel Marketplace integration injected. Connect an Upstash Redis
 * store to this project from the Vercel dashboard's Storage tab first.
 */
export function getRedis() {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Redis is not connected. In the Vercel dashboard, open this project > Storage > Connect Store > Upstash Redis.'
    );
  }
  client = new Redis({ url, token });
  return client;
}

/** Coarse device class from a User-Agent string. */
export function parseDevice(ua = '') {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Coarse traffic source from a referrer URL. */
export function parseSource(referrer = '') {
  if (!referrer) return 'direct';
  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'referral';
  }
  if (/google|bing|yahoo|duckduckgo|baidu/i.test(host)) return 'search';
  if (/facebook|instagram|twitter|x\.com|tiktok|linkedin|threads/i.test(host)) return 'social';
  if (/mail\.|gmail|outlook/i.test(host)) return 'email';
  return 'referral';
}

/** Interaction event names the tracker is allowed to send, and their display labels. */
export const INTERACTION_LABELS = {
  add_to_cart: 'Add to cart clicks',
  checkout_start: 'Checkout starts',
  contact_submit: 'Contact form submits',
  newsletter_signup: 'Newsletter signups',
  video_play: 'Video plays',
};

export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Allow vaneymedia.com (a different origin/project) to read from these APIs. */
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
