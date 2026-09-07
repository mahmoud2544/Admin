import { jsonResponse } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  return track(request, env);
}
export async function onRequestPost({ request, env }) {
  return track(request, env);
}

async function track(request, env) {
  const url = new URL(request.url);
  let type = url.searchParams.get("type");
  if (!type) {
    const body = await request.json().catch(() => ({}));
    type = body.type || "view";
  }

  const data = (await env.CONTENT_KV.get("analytics", "json")) || { views: 0, interactions: 0, monthly: {} };

  if (type === "view") data.views = (data.views || 0) + 1;
  else if (type === "interaction") data.interactions = (data.interactions || 0) + 1;

  const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  if (!data.monthly) data.monthly = {};
  if (!data.monthly[monthKey]) data.monthly[monthKey] = { views: 0, interactions: 0 };
  if (type === "view") data.monthly[monthKey].views += 1;
  else if (type === "interaction") data.monthly[monthKey].interactions += 1;

  await env.CONTENT_KV.put("analytics", JSON.stringify(data));
  return jsonResponse({ success: true });
}
