# Vaney Media admin — Express edition (Render + Cloudinary)

Same admin panel, rebuilt on a plain, persistent Node server instead of
Vercel's serverless functions. This fixes the two things that kept
breaking: no more "new project every time you redeploy," and no more
fragile client-upload-token dance for photos/videos — uploads are now a
normal file upload straight to your own server.

## What's in here

```
server.js            Express app — serves the panel and all /api routes
routes/
  content.js          text content blocks
  media.js             photo/video upload, list, delete
  contact.js           contact details
  analytics.js         real traffic stats
  track.js              ingest endpoint the live site pings
  auth.js               register / login / sessions / password reset
lib/
  redis.js              database connection + small helpers
  auth.js                password hashing + sessions
  storage.js             Cloudinary upload/delete
public/
  index.html             the admin panel itself
  tracker.js              drop-in analytics script for vaneymedia.com
package.json
.env.example
```

## Before you start: three accounts to create (all free)

1. **[render.com](https://render.com)** — hosts the server, deploys from GitHub automatically from now on (no more drag-and-drop).
2. **[upstash.com](https://upstash.com)** — the database (same one used before, if you still have it, you can reuse it).
3. **[cloudinary.com](https://cloudinary.com)** — stores photos/videos, replaces Vercel Blob.

## Step 1 — Put this project on GitHub

1. Unzip this project.
2. On [github.com](https://github.com), create a new repository (e.g. `vaney-media-server`), private is fine.
3. Upload the contents of the unzipped folder (not the folder itself — its contents: `server.js`, `routes/`, `lib/`, `public/`, `package.json`, etc.) via **uploading an existing file**, then commit.

## Step 2 — Create the Upstash Redis database

1. Sign up at upstash.com.
2. **Create Database** → Redis → any name/region → free tier.
3. On the database's page, find the **REST API** section — copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values. Keep this tab open, you'll paste these into Render next.

## Step 3 — Create the Cloudinary account

1. Sign up at cloudinary.com.
2. Your **Dashboard** home page shows three values right at the top: **Cloud name**, **API Key**, **API Secret**. Keep this open too.

## Step 4 — Deploy to Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect your GitHub account, pick the `vaney-media-server` repo.
3. Fill in:
   - **Name**: anything, e.g. `vaney-media-admin`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Scroll to **Environment Variables**, add all five:
   ```
   UPSTASH_REDIS_REST_URL      = (from Step 2)
   UPSTASH_REDIS_REST_TOKEN    = (from Step 2)
   CLOUDINARY_CLOUD_NAME       = (from Step 3)
   CLOUDINARY_API_KEY          = (from Step 3)
   CLOUDINARY_API_SECRET       = (from Step 3)
   ```
5. Click **Create Web Service**.

It builds and deploys — takes a couple of minutes the first time. You'll get a URL like `https://vaney-media-admin.onrender.com`. **This URL won't change** on future deploys — pushing new code to GitHub automatically redeploys the same service from now on, nothing to reconnect.

Note: Render's free tier "spins down" after 15 minutes of no traffic and takes ~30-50 seconds to wake back up on the next request. Fine for an admin panel you check occasionally; if that delay ever bothers you, Render's paid tier removes it.

## Step 5 — Create your account

Open the Render URL, click **Register**, create your admin login. From then on, **Log in** works from any device — phone, laptop, different browser — same email and password.

## Step 6 — Point vaneymedia.com at this API

Same idea as before — add this near `</body>` on each page section of your actual site:

```html
<script type="module">
const API_BASE = 'https://vaney-media-admin.onrender.com'; // your Render URL

async function renderSection(section, blocksElId, mediaElId) {
  const [blocks, media] = await Promise.all([
    fetch(`${API_BASE}/api/content?section=${section}`).then(r => r.json()),
    fetch(`${API_BASE}/api/media?section=${section}`).then(r => r.json())
  ]);
  const blocksEl = document.getElementById(blocksElId);
  if (blocksEl) {
    blocksEl.innerHTML = blocks.map(b => `<div class="cms-block"><h3>${b.title}</h3><p>${b.body}</p></div>`).join('');
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

Add matching empty containers, e.g. `<div id="about-blocks"></div>` inside each section. Contact details work the same way via `${API_BASE}/api/contact`.

## Step 7 — Add real analytics tracking

Add this once near `</body>` on every page:

```html
<script src="https://vaney-media-admin.onrender.com/tracker.js"></script>
```

Recognized interaction events for buttons: `vaneyTrack('add_to_cart')`, `checkout_start`, `contact_submit`, `newsletter_signup`, `video_play`.

## Updating the site later

Any time you want to change something: edit the files, upload the changed ones to the same GitHub repo (or use `git push` if you're comfortable with Git), and Render redeploys automatically within a minute or two — same URL, same database, same storage, nothing to reconnect.

## Local testing (optional)

```bash
npm install
cp .env.example .env   # fill in the five values
npm start
```
Then open `http://localhost:3000`.

## Honest limits, same as before

- **Forgot password** shows the reset code directly in the panel since no email service is connected — fine for one admin, ask if you want real email delivery added later.
- **Registration is open** to anyone who has your panel's URL. Keep it private, or ask for invite-only signup as a follow-up.
