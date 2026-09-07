import { requireAuth } from "./_shared/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(455).json({ error: "Method not allowed" });

  if (!requireAuth(req, res)) return;

  const body = req.body || {};
  if (body.current !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid current password" });
  }

  return res.status(400).json({
    error:
      "Password changes aren't stored automatically here. Go to your Vercel Project " +
      "-> Settings -> Environment Variables and update ADMIN_PASSWORD, then redeploy."
  });
}
