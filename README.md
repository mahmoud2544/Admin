# Vaney Media admin — live backend

This turns the admin panel from a mockup into something real: adding a photo,
video, or text block (or editing contact details) actually saves it, and
vaneymedia.com can display it. Login is a real account system too — hashed
passwords, sessions that work from any device, no manual token to copy.

## What's in here

```
api/
  content.js         CRUD for text content blocks
  media.js           CRUD for photo/video metadata
  blob-upload.js     authorizes direct browser -> storage uploads
  contact.js         GET/POST contact details
  analytics.js       real traffic stats for the dashboard
  track.js           ingest endpoint the live site pings
  auth/
    register.js      create an admin account
    login.js         start a session
    logout.js        end a session
    me.js            check who's logged in
    forgot.js        request a password reset code
    reset.js         apply a password reset
    profile.js       update name / password
  _lib/
    redis.js         shared database helper
    auth.js          password hashing + session helpers
public/
  index.html         the admin panel (calls the api/ routes)
  tracker.js          drop-in analytics script for vaneymedia.com
package.json
```

The admin panel and its API are ONE Vercel project — the panel calls
`/api/...` on the same domain, no extra config needed. Your live site,
vaneymedia.com, is a **separate** project and reads from this one over the
network (CORS is already enabled for that).

## 1. Deploy this project

```bash
cd vaney-media-backend
npm install
npx vercel        # first deploy, follow the prompts
npx vercel --prod # promote to production
```

You'll get a URL like `https://vaney-media-admin.vercel.app` — that's your
admin panel's live address from now on.

## 2. Connect a database (Upstash Redis)

In the Vercel dashboard: your project → **Storage** tab → **Connect Store**
→ **Upstash Redis** (or **Browse Marketplace** if it's not pinned) → create
a small/free database → connect it to this project. Vercel injects the
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`
/ `KV_REST_API_TOKEN`) env vars automatically — `api/_lib/redis.js` reads
either naming. This same database now stores your admin accounts and
sessions too, alongside content, media metadata, and analytics.

## 3. Connect file storage (Vercel Blob)

Same **Storage** tab → **Connect Store** → **Blob** → create a store →
connect it. This gives every deployment a `BLOB_READ_WRITE_TOKEN` env var
automatically (used implicitly by the `@vercel/blob` SDK).

## 4. Redeploy once

**Deployments** tab → **⋯** on the latest → **Redeploy**, so the project
picks up the storage connections from steps 2–3.

There's no admin token to set up anymore — logging in from the panel's
Register/Login screen is the real authorization now, and it works from any
browser or device as long as you sign in with the same email and password.

## 5. Create your account

Open the deployed URL, use **Register** once to create your admin account,
then use **Log in** from any other device going forward. Sessions last 30
days and can be ended any time with **Log out**.

## 6. Point vaneymedia.com at this API

Your site's real code isn't something I can see or edit directly, so add
this snippet wherever each section renders (About, Services, Products,
Portfolio, Video), replacing `API_BASE` with your deployed URL from step 1:

```html
<script type="module">
const API_BASE = 'https://vaney-media-admin.vercel.app';

async function renderSection(section, blocksElId, mediaElId) {
  const [blocks, media] = await Promise.all([
    fetch(`${API_BASE}/api/content?section=${section}`).then(r => r.json()),
    fetch(`${API_BASE}/api/media?section=${section}`).then(r => r.json())
  ]);

  const blocksEl = document.getElementById(blocksElId);
  if (blocksEl) {
    blocksEl.innerHTML = blocks.map(b => `
      <div class="cms-block">
        <h3>${b.title}</h3>
        <p>${b.body}</p>
      </div>
    `).join('');
  }

  const mediaEl = document.getElementById(mediaElId);
  if (mediaEl) {
    mediaEl.innerHTML = media.map(m => m.type === 'video'
      ? `<video src="${m.url}" controls></video>`
      : `<img src="${m.url}" alt="${m.name}">`
    ).join('');
  }
}

renderSection('about', 'about-blocks', 'about-media');
renderSection('services', 'services-blocks', 'services-media');
renderSection('products', 'products-blocks', 'products-media');
renderSection('portfolio', 'portfolio-blocks', 'portfolio-media');
renderSection('video', 'video-blocks', 'video-media');
</script>
```

Add matching empty containers in each section's HTML, e.g.:

```html
<section id="about">
  <div id="about-blocks"></div>
  <div id="about-media"></div>
</section>
```

Contact details work the same way — fetch `${API_BASE}/api/contact` and
fill in your existing contact markup / footer with the returned fields
(`org`, `location`, `whatsapp`, `instagram`, `email`, `phone`).

## 7. Add real analytics tracking (optional, already built)

Add this once near `</body>` on every page of vaneymedia.com:

```html
<script src="https://vaney-media-admin.vercel.app/tracker.js"></script>
```

The Analytics and Visitors views will then show real traffic instead of
placeholder numbers. Track button clicks (add-to-cart, contact form, etc.)
with `vaneyTrack('add_to_cart')` — see `public/tracker.js` for the full list
of recognized event names.

## How accounts and sessions work now

- Passwords are hashed with `scrypt` (Node's built-in crypto) before being
  stored — never in plain text.
- Logging in issues a random session token, stored in Redis with a 30-day
  expiry, and saved in your browser's local storage. Every write request
  (add content, upload media, edit contact info) sends that token and the
  server checks it against Redis on every call — so it works identically
  from a phone, a laptop, or a different browser, as long as you log in
  with the same email and password each time.
- **Forgot password** generates a 6-digit code stored in Redis for 15
  minutes. Since no email-sending service is connected, the code is shown
  directly in the panel rather than emailed — fine for a single admin, but
  means anyone who can open the "Forgot password" screen and knows your
  email can see the reset code too. If you want real email delivery (via a
  service like Resend), that's a small follow-up — say the word.
- Registration is currently open to anyone who finds your panel's URL — it
  doesn't require an invite. Keep that URL private, or ask for an
  invite-only signup flow as a follow-up if you'll be sharing the link.

