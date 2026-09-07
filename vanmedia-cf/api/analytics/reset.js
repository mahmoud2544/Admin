import { requireAuth } from "../_shared/auth.js";
import { putBlobJson } from "../_shared/blob.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(455).json({ error: "Method not allowed" });

  if (!requireAuth(req, res)) return;

  await putBlobJson("analytics.json", { views: 0, interactions: 0, monthly: {} });
  return res.status(200).json({ success: true, message: "User tracking data reset successfully" });
}
