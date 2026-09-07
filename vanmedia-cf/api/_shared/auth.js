import crypto from "crypto";

export function hmac(data, secret) {
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(data).digest("base64");
}

export function makeToken(username, secret) {
  const ts = Date.now().toString();
  const msg = `${username}:${ts}`;
  const sig = hmac(msg, secret);
  return `${msg}:${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [username, ts, sig] = parts;
  const msg = `${username}:${ts}`;
  const expected = hmac(msg, secret);
  if (expected !== sig) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < 24 * 60 * 60 * 1000;
}

export function requireAuth(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const secret = process.env.SECRET_KEY;
  const ok = verifyToken(token, secret);
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
