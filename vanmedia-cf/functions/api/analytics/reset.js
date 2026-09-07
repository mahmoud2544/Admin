import { requireAuth, jsonResponse } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  await env.CONTENT_KV.put("analytics", JSON.stringify({ views: 0, interactions: 0, monthly: {} }));
  return jsonResponse({ success: true, message: "User tracking data reset successfully" });
}
