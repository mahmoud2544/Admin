import {
  requireAuth,
  jsonResponse,
  getAdminUser,
  saveAdminUser,
  hashPassword,
  verifyPassword
} from "../_shared/auth.js";

// Change password from inside the admin panel (requires an active session).
// Forgotten passwords go through /api/forgot-password + /api/reset-password
// instead, since that doesn't require being logged in.
export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  if (!env.CONTENT_KV) {
    return jsonResponse({ error: "Server not configured: CONTENT_KV binding is missing" }, 500);
  }

  const user = await getAdminUser(env);
  if (!user) {
    return jsonResponse({ error: "No admin account found." }, 404);
  }

  const body = await request.json().catch(() => ({}));
  const currentOk = await verifyPassword(body.current || "", user.passwordHash);
  if (!currentOk) {
    return jsonResponse({ error: "Invalid current password" }, 401);
  }
  if (!body.new || body.new.length < 8) {
    return jsonResponse({ error: "New password must be at least 8 characters." }, 400);
  }

  user.passwordHash = await hashPassword(body.new);
  await saveAdminUser(env, user);

  return jsonResponse({ ok: true, message: "Password updated." });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
