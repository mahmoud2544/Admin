import { requireAuth } from "./_shared/auth.js";
import { getBlobJson, putBlobJson } from "./_shared/blob.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const data = (await getBlobJson("content.json")) || {};
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    if (!requireAuth(req, res)) return;

    const newData = req.body;
    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    await putBlobJson("content.json", newData);
    return res.status(200).json({ success: true });
  }

  return res.status(455).json({ error: "Method not allowed" });
}
