import { Redis } from '@upstash/redis';

let client;

/** Singleton Upstash Redis client, built from plain env vars (works on any host). */
export function getRedis() {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment variables.'
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
