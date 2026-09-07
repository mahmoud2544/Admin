import { makeToken } from "./_shared/auth.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const username = process.env.ADMIN_USERNAME || "vanadmin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return res.status(500).json({ error: "Server not configured: ADMIN_PASSWORD is not set" });
  }

  if (body.password !== password) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = makeToken(username, process.env.SECRET_KEY);
  return res.status(200).json({ token, username });
}
