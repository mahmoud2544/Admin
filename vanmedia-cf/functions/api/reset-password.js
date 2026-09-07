import { jsonResponse, hashPassword, getAdminUser, saveAdminUser } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_KV) {
    return jsonResponse({ error: "Server not configured: CONTENT_KV binding is missing" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const token = body.token || "";
  const password = body.password || "";

  if (!token) {
    return jsonResponse({ error: "Missing reset token." }, 400);
  }
  if (!password || password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  }

  const raw = await env.CONTENT_KV.get(`reset_token:${token}`);
  if (!raw) {
    return jsonResponse({ error: "This reset link is invalid or has expired." }, 400);
  }

  const { email, exp } = JSON.parse(raw);
  if (Date.now() > exp) {
    await env.CONTENT_KV.delete(`reset_token:${token}`);
    return jsonResponse({ error: "This reset link has expired. Please request a new one." }, 400);
  }

  const user = await getAdminUser(env);
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    return jsonResponse({ error: "Admin account not found." }, 404);
  }

  user.passwordHash = await hashPassword(password);
  await saveAdminUser(env, user);
  await env.CONTENT_KV.delete(`reset_token:${token}`);

  return jsonResponse({ ok: true });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
