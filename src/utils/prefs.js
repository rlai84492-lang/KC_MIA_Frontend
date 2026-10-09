// Remembers the last page, path and date range in this browser only (reference: localStorage "ishara-console").
// Storage can be blocked (private windows, strict settings), so every access is wrapped and failures are ignored.
const KEY = "mia-kc26-dashboard";

export function readPrefs() {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function writePrefs(patch) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch {
    // not saved; the dashboard still works with defaults
  }
}
