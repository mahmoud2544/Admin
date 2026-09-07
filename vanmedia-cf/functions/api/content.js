import { requireAuth, jsonResponse } from "../_shared/auth.js";

export async function onRequestGet({ env }) {
  const data = (await env.CONTENT_KV.get("content", "json")) || {};
  return jsonResponse(data);
}

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const newData = await request.json().catch(() => null);
  if (!newData) return jsonResponse({ error: "Invalid JSON body" }, 400);

  await env.CONTENT_KV.put("content", JSON.stringify(newData));
  return jsonResponse({ success: true });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
