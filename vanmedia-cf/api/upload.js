import busboy from "busboy";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { requireAuth } from "./_shared/auth.js";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(455).json({ error: "Method not allowed" });

  if (!requireAuth(req, res)) return;

  try {
    const bb = busboy({ headers: req.headers });
    let uploadedPath = null;
    const uploadPromises = [];

    bb.on("file", (name, fileStream, info) => {
      const { filename, mimeType } = info;
      const safeName = (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const key = `Images/${uniqueId}_${safeName}`;

      const chunks = [];
      fileStream.on("data", (chunk) => chunks.push(chunk));

      const uploadPromise = new Promise((resolve, reject) => {
        fileStream.on("end", async () => {
          try {
            const fileBuffer = Buffer.concat(chunks);
            await put(key, fileBuffer, {
              access: "public",
              contentType: mimeType || "application/octet-stream",
              addRandomSuffix: false
            });
            uploadedPath = key;
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        fileStream.on("error", reject);
      });

      uploadPromises.push(uploadPromise);
    });

    bb.on("finish", async () => {
      await Promise.all(uploadPromises);
      if (!uploadedPath) {
        return res.status(400).json({ error: "No file provided" });
      }
      return res.status(200).json({ path: uploadedPath });
    });

    bb.on("error", (err) => {
      return res.status(500).json({ error: err.message });
    });

    req.pipe(bb);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
