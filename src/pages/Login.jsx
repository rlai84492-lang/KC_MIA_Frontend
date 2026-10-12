import { useState } from "react";
import { login } from "../services/authApi";

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await login(username.trim(), password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kc-bg px-4 text-kc-ink">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm"
        noValidate
      >
        <h1 className="text-2xl font-semibold">Karva Chauth Dashboard</h1>
        <p className="mt-1 text-sm opacity-70">Sign in to continue</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="kc-username">
          Username
        </label>
        <input
          id="kc-username"
          type="text"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-rose-700 focus:ring-2 focus:ring-rose-700/20"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="kc-password">
          Password
        </label>
        <input
          id="kc-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-rose-700 focus:ring-2 focus:ring-rose-700/20"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-rose-700 px-4 py-2.5 font-medium text-white hover:bg-rose-800 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}