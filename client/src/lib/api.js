import { SERVER_URL } from "./native";

// JSON calls to the server's /api routes. Returns { ok, status, data, error }.
export async function api(path, { method = "GET", body, token } = {}) {
  try {
    const res = await fetch(`${SERVER_URL || ""}/api${path}`, {
      method,
      headers: {
        ...(body && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data?.error || "Something went wrong." };
  } catch {
    return { ok: false, status: 0, data: null, error: "Can't reach the server. Check your internet connection and try again." };
  }
}
