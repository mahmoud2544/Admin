import { jsonResponse, getAdminUser } from "../_shared/auth.js";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();

  // Always return the same generic response, whether or not the email
  // matches an account, so this endpoint can't be used to probe for the
  // admin's email address.
  const generic = () =>
    jsonResponse({ ok: true, message: "If that email is registered, a password reset link has been sent." });

  if (!email) return generic();
  if (!env.CONTENT_KV) {
    return jsonResponse({ error: "Server not configured: CONTENT_KV binding is missing" }, 500);
  }

  const user = await getAdminUser(env);
  if (!user || user.email.toLowerCase() !== email) {
    return generic();
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await env.CONTENT_KV.put(
    `reset_token:${token}`,
    JSON.stringify({ email: user.email, exp: Date.now() + TOKEN_TTL_SECONDS * 1000 }),
    { expirationTtl: TOKEN_TTL_SECONDS }
  );

  const siteUrl = env.SITE_URL || "https://vaneymedia.com";
  const resetUrl = `${siteUrl.replace(/\/$/, "")}/admin.html?reset=${token}`;
  await sendResetEmail(env, user.email, resetUrl);

  return generic();
}

async function sendResetEmail(env, toEmail, resetUrl) {
  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set -- cannot send password reset email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Van Media Admin <admin@vaneymedia.com>",
        to: [toEmail],
        subject: "Reset your Van Media admin password",
        html: `
          <p>Someone requested a password reset for the Van Media admin panel.</p>
          <p><a href="${resetUrl}">Click here to set a new password</a>.</p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `
      })
    });
    if (!res.ok) {
      console.error("Resend API error:", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (err) {
    console.error("Error sending reset email:", err);
    return false;
  }
}

export async function onRequestOptions() {
  return jsonResponse({});
}
