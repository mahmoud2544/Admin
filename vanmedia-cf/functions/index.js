import { renderSite } from "./_shared/render.js";

export async function onRequestGet({ env }) {
  let data = {};
  try {
    data = (await env.CONTENT_KV.get("content", "json")) || {};
  } catch (e) {
    // fall through with empty data rather than crashing the whole site
  }
  // Matches the original server.py behavior: portfolio is displayed newest-first.
  if (Array.isArray(data.portfolio)) {
    data = { ...data, portfolio: [...data.portfolio].reverse() };
  }
  const html = renderSite(data);
  return new Response(html, {
    headers: { "content-type": "text/html; charset=UTF-8" }
  });
}
