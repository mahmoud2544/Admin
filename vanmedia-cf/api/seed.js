import fs from "fs";
import path from "path";
import { put, list } from "@vercel/blob";
import { requireAuth } from "./_shared/auth.js";
import { putBlobJson } from "./_shared/blob.js";

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

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(455).json({ error: "Method not allowed" });

  if (!requireAuth(req, res)) return;

  try {
    const seedPath = path.join(process.cwd(), "seed-content.json");
    if (!fs.existsSync(seedPath)) {
      return res.status(500).json({ error: "seed-content.json not found" });
    }
    const content = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

    const paths = new Set(EXTRA_ASSETS);
    collectImagePaths(content, paths);
    (content.portfolio || []).forEach((p) => {
      if (p.filename) paths.add(`Images/${p.filename}`);
    });

    const results = { copied: [], skipped: [], failed: [] };

    // Fetch existing blobs list to avoid re-uploading
    let existingBlobs = [];
    try {
      const { blobs } = await list({ prefix: "Images/" });
      existingBlobs = blobs.map((b) => b.pathname);
    } catch (e) {
      // Storage might be empty, continue
    }

    for (const relPath of paths) {
      const key = relPath;
      if (existingBlobs.includes(key)) {
        results.skipped.push(key);
        continue;
      }

      const localFilePath = path.join(process.cwd(), relPath);
      if (!fs.existsSync(localFilePath)) {
        results.failed.push(key);
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(localFilePath);
        const contentType = getMimeType(localFilePath);
        await put(key, fileBuffer, {
          access: "public",
          contentType,
          addRandomSuffix: false
        });
        results.copied.push(key);
      } catch (e) {
        console.error(`Failed seeding ${key}:`, e);
        results.failed.push(key);
      }
    }

    await putBlobJson("content.json", content);

    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
