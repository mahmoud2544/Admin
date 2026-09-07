// Shared auth helpers. admin.html sends "Authorization: Bearer <token>" on
// protected calls (login, upload, content save, analytics, password).
// Tokens are HMAC-signed with SECRET_KEY and expire after 24h.

export async function hmac(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

export async function makeToken(username, secret) {
  const ts = Date.now().toString();
  const msg = `${username}:${ts}`;
  const sig = await hmac(msg, secret);
  return `${msg}:${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [username, ts, sig] = parts;
  const msg = `${username}:${ts}`;
  const expected = await hmac(msg, secret);
  if (expected !== sig) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < 24 * 60 * 60 * 1000;
}

// Returns null if authorized, or a 401 Response if not.
export async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const ok = await verifyToken(token, env.SECRET_KEY);
  if (!ok) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

// --- Password hashing (PBKDF2-SHA256, Web Crypto -- no external deps) ---

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function pbkdf2(password, saltBytes, iterations = 100000) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, keyMaterial, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const hash = await pbkdf2(password, fromHex(saltHex));
  return toHex(hash) === hashHex;
}

// --- Single admin account, stored in KV (replaces the old ADMIN_PASSWORD
// env var approach). Registration only works once; after that people log
// in with the email/password they registered, and can reset it by email
// if they forget it. ---

const ADMIN_USER_KEY = "admin_user";

export async function getAdminUser(env) {
  if (!env.CONTENT_KV) return null;
  const raw = await env.CONTENT_KV.get(ADMIN_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveAdminUser(env, user) {
  await env.CONTENT_KV.put(ADMIN_USER_KEY, JSON.stringify(user));
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    }
  });
}
