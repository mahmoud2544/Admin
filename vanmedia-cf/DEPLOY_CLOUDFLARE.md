# Van Media on Cloudflare Pages — Setup Guide

This is a full rebuild of your Flask admin system as Cloudflare Pages +
Pages Functions (JavaScript) + R2 (file storage) + KV (content data), since
Cloudflare Pages can't run Python. The admin panel (`admin.html`) is
unchanged — it talks to the same `/api/...` endpoints either way, so it
looks and works identically. What changed is what's running behind those
endpoints.

## What's in this folder

```
admin.html            ← unchanged admin panel UI
setup.html            ← one-time "import my content" button (use once)
style.css             ← unchanged site styling
seed-content.json     ← copy of your content.json, used only for first-time import
Images/               ← your existing images/videos, used only for first-time import
functions/
  index.js             ← renders the live homepage from KV content (was template.html)
  _shared/
    render.js            ← JS port of your template.html's dynamic sections
    auth.js              ← signed login tokens
  Images/[[path]].js    ← serves uploaded media from R2
  api/
    login.js, password.js, forget-user.js
    content.js            ← GET/POST site content (was content.json)
    upload.js             ← uploads to R2 (was saving to disk)
    seed.js               ← powers setup.html's one-time import
    analytics.js, analytics/track.js, analytics/reset.js
```

## Step 1 — Push to GitHub

Push everything in this folder to a repo (a fresh one is simplest — call it
`vanmedia-cf`). Make sure the files land at the **repo root**, not nested
inside an extra folder (that's what tripped up the Render attempt — same
thing would break here).

## Step 2 — Create the Cloudflare Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick the repo.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
3. Click **Save and Deploy**. It'll fail to show real content yet — that's
   expected, we haven't wired up storage.

## Step 3 — Create the R2 bucket (image/video storage)

1. **R2** → **Create bucket** → name it `vaney-media`.
2. No need to enable public access — the `/Images/[[path]].js` function
   serves files through your own domain, not a public R2 URL.

## Step 4 — Create the KV namespace (content storage)

1. **Workers & Pages** → **KV** → **Create namespace** → name it
   `vaney-content`.

## Step 5 — Bind them to your Pages project

Pages project → **Settings** → **Functions**:
- **R2 bucket bindings** → add one named exactly `MEDIA_BUCKET` → pointing
  to `vaney-media`.
- **KV namespace bindings** → add one named exactly `CONTENT_KV` → pointing
  to `vaney-content`.

## Step 6 — Set environment variables

Still in **Settings → Environment variables**, add (mark `SECRET_KEY` and
`RESEND_API_KEY` as **Secret**):

| Name              | Value                                                            |
|-------------------|-------------------------------------------------------------------|
| `SECRET_KEY`      | any long random string (signs login sessions)                     |
| `RESEND_API_KEY`  | an API key from [resend.com](https://resend.com) (free tier is fine) — used to send the "forgot password" reset email |
| `RESEND_FROM`     | *(optional)* e.g. `Van Media Admin <admin@vaneymedia.com>` — the sending address; must be a domain you've verified in Resend |
| `SITE_URL`        | *(optional)* `https://vaneymedia.com` — used to build the link inside reset emails; defaults to that if unset |

Apply to both Production and Preview, then redeploy (Deployments → latest →
**Retry deployment**) so the bindings/variables take effect.

There's no more `ADMIN_USERNAME`/`ADMIN_PASSWORD` — the admin account now
lives in `CONTENT_KV` instead of environment variables, so it can be
registered and reset from the admin panel itself (see Step 7).

## Step 7 — Register your admin account

Visit `https://<your-project>.pages.dev/admin` (or `vaneymedia.com/admin`
once the domain is attached — see Step 9). Since no admin account exists
yet, you'll land on a **Create Admin Account** screen instead of the login
screen. Enter the email and password you want to use and register.

This only works once — after that, `/admin` always shows the normal login
screen, and `/api/register` refuses further registrations (so a stranger
can't create their own admin account later). From then on:
- **Log in** with that email + password.
- **Forgot password?** on the login screen emails a reset link (via Resend)
  to the registered email, valid for 1 hour.
- **Settings → Update Password** lets you change your password while
  logged in.

## Step 8 — Import your existing content (once)

Visit `https://<your-project>.pages.dev/setup.html`, log in with your admin
account, click **Run Setup**. This copies `seed-content.json` and
everything in `Images/` from this deploy into KV/R2. It's safe to click
more than once — it skips files that are already there.

## Step 9 — Check everything works

- `/` — your live site, now rendered from KV content
- `/admin` — log in, try uploading an image, adding it to a section, saving
  — refresh `/` and confirm it shows up
- Click **Forgot password?** on the login screen and confirm the reset
  email arrives and its link lets you set a new password

## Step 10 — Point vaneymedia.com at this project

Cloudflare Pages → your new project → **Custom domains** → add
`vaneymedia.com`. If it's currently attached to your old Pages project,
Cloudflare will let you move it over (or you can remove it from the old
project first, then add it here). No DNS changes needed if you're staying
within Cloudflare Pages — just reassigning which project the domain points to.

---

## Known limitations of this version

- **One admin account.** This is built for a single admin login (register
  once, log in from then on), not a multi-user team system.
- **Forgot-password emails require Resend.** If `RESEND_API_KEY` isn't set,
  `/api/forgot-password` still responds successfully (so it doesn't leak
  whether an account exists) but no email actually goes out — check the
  Cloudflare Functions logs for a "RESEND_API_KEY is not set" error if
  resets aren't arriving.
- **Large video uploads:** Cloudflare Pages Functions have request body
  size limits (typically ~100MB). Your existing videos are all under 10MB
  so this shouldn't bite you yet, but very long/high-res future uploads
  might need compressing first.
- **First load after a while:** unlike the Render option, Cloudflare Pages
  Functions don't "sleep," so there's no cold-start delay — this one's
  actually better than Render in that respect.

## If something doesn't work

- **500 error / blank homepage:** check that `CONTENT_KV` binding exists
  and you've run `/setup.html` at least once.
- **Images 404:** confirm `MEDIA_BUCKET` binding is named exactly that
  (case-sensitive), and that setup.html reported those files as "copied"
  not "failed."
- **Can't log in / stuck on "Create Admin Account":** you haven't
  registered yet on this deploy, or `CONTENT_KV` isn't bound (registration
  is stored there). Register once at `/admin`, or check the KV binding.
- **Reset email never arrives:** confirm `RESEND_API_KEY` is set and that
  `RESEND_FROM` is a verified sending domain in your Resend account.
- **Uploads fail:** check the browser console — a missing `MEDIA_BUCKET`
  binding is the usual cause.
