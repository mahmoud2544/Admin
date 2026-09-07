import { jsonResponse } from "../_shared/auth.js";

export async function onRequestPost() {
  return jsonResponse({ success: true, message: "User credentials and session forgotten" });
}
