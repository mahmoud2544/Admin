import { requireAuth, jsonResponse } from "../_shared/auth.js";

// Images referenced directly in the page template, not in content.json.
const EXTRA_ASSETS = ["Images/logo.png", "Images/icon.png", "Images/video2.mp4"];

function collectImagePaths(node, found) {
  if (typeof node === "string") {
    if (node.startsWith("Images/")) found.add(node);
  } else if (Array.isArray(node)) {
    node.forEach((n) => collectImagePaths(n, found));
  } else if (node && typeof node === "object") {
    Object.values(node).forEach((n) => collectImagePaths(n, found));
  }
}

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  // Load the starter content.json bundled with this deploy (as a static asset).
  const contentUrl = new URL("/seed-content.json", request.url);
  const contentRes = await env.ASSETS.fetch(contentUrl);
  if (!contentRes.ok) {
    return jsonResponse({ error: "seed-content.json not found in this deploy" }, 500);
  }
  const content = await contentRes.json();

  // Portfolio filenames are stored without the "Images/" prefix -- add it
  // back just for collecting which files need to be copied into R2.
  const paths = new Set(EXTRA_ASSETS);
  collectImagePaths(content, paths);
  (content.portfolio || []).forEach((p) => {
    if (p.filename) paths.add(`Images/${p.filename}`);
  });

  const results = { copied: [], skipped: [], failed: [] };

  for (const path of paths) {
    const key = path.replace(/^Images\//, "");
    try {
      const existing = await env.MEDIA_BUCKET.head(key);
      if (existing) {
        results.skipped.push(key);
        continue;
      }
      const assetUrl = new URL(`/${path}`, request.url);
      const assetRes = await env.ASSETS.fetch(assetUrl);
      if (!assetRes.ok) {
        results.failed.push(key);
        continue;
      }
      const contentType = assetRes.headers.get("content-type") || "application/octet-stream";
      await env.MEDIA_BUCKET.put(key, assetRes.body, { httpMetadata: { contentType } });
      results.copied.push(key);
    } catch (e) {
      results.failed.push(key);
    }
  }

  await env.CONTENT_KV.put("content", JSON.stringify(content));

  return jsonResponse({ success: true, ...results });
}
