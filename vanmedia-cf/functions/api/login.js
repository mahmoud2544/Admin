import { makeToken, jsonResponse, getAdminUser, verifyPassword } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_KV) {
    return jsonResponse({ error: "Server not configured: CONTENT_KV binding is missing" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || body.username || "").trim().toLowerCase();
  const password = body.password || "";

  const user = await getAdminUser(env);
  if (!user) {
    return jsonResponse({ error: "No admin account exists yet. Please register first.", needsRegistration: true }, 400);
  }

  if (!email || email !== user.email.toLowerCase() || !(await verifyPassword(password, user.passwordHash))) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  const token = await makeToken(user.email, env.SECRET_KEY);
  return jsonResponse({ token, email: user.email });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
