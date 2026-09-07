import { jsonResponse, hashPassword, getAdminUser, saveAdminUser } from "../_shared/auth.js";

// GET  /api/register  -> { registered: boolean }  (lets admin.html decide whether
//                          to show the "Register" or the "Log In" screen)
// POST /api/register  -> creates the single admin account. Only works once --
//                          if an account already exists this returns 409 and the
//                          person should use /api/login (or /api/forgot-password).
export async function onRequestGet({ env }) {
  const user = await getAdminUser(env);
  return jsonResponse({ registered: !!user });
}

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_KV) {
    return jsonResponse({ error: "Server not configured: CONTENT_KV binding is missing" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400);
  }
  if (!password || password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  }

  const existing = await getAdminUser(env);
  if (existing) {
    return jsonResponse({ error: "An admin account already exists. Please log in instead." }, 409);
  }

  const passwordHash = await hashPassword(password);
  await saveAdminUser(env, { email, passwordHash, createdAt: Date.now() });

  return jsonResponse({ ok: true, email });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
