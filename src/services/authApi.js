// Login / logout / current user. Same domain par chalta hai, session cookie browser khud bhejta hai.
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

/** Koi bhi API 401 de -> App login page dikhata hai. */
export const UNAUTHORIZED_EVENT = "kc:unauthorized";

async function call(path, options = {}) {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
}

/** Logged-in user ya null. */
export async function me() {
  const res = await call("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json();
}

export async function login(username, password) {
  const res = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error("Invalid username or password");
  if (res.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  return res.json();
}

export async function logout() {
  try {
    await call("/api/auth/logout", { method: "POST" });
  } catch {
    // network error par bhi frontend logout kar dega
  }
}