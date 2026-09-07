import { requireAuth, jsonResponse } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const data = (await env.CONTENT_KV.get("analytics", "json")) || { views: 0, interactions: 0, monthly: {} };
  return jsonResponse(data);
}
