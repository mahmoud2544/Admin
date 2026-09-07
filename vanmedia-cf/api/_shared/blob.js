import { put, list } from "@vercel/blob";

export async function getBlobJson(key) {
  try {
    const { blobs } = await list({ prefix: key });
    const blob = blobs.find((b) => b.pathname === key);
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`Error reading ${key} from Vercel Blob:`, e);
    return null;
  }
}

export async function putBlobJson(key, data) {
  const jsonStr = JSON.stringify(data);
  return await put(key, jsonStr, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false
  });
}
