import { requireAuth, jsonResponse } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const formData = await request.formData().catch(() => null);
  const file = formData ? formData.get("file") : null;
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "No file provided" }, 400);
  }

  const MAX_BYTES = 200 * 1024 * 1024; // 200MB safety cap
  if (file.size > MAX_BYTES) {
    return jsonResponse({ error: "File too large (200MB max)" }, 400);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const key = `${uniqueId}_${safeName}`;

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" }
  });

  return jsonResponse({ path: `Images/${key}` });
}

export async function onRequestOptions() {
  return jsonResponse({});
}
