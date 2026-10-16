import { useState } from "react";
import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { login } from "../services/authApi";
import "../styles/login.css";

// Background stars: placed once when the app loads, so they don't jump on every keystroke.
const STARS = Array.from({ length: 100 }, () => ({
  size: Math.random() * 2.2 + 0.5,
  top: Math.random() * 100,
  left: Math.random() * 100,
  duration: Math.random() * 4 + 2,
  delay: Math.random() * 5,
  opacity: Math.random() * 0.7 + 0.2
}));

// Shooting stars: position, length, angle, how often and when they start.
const SHOOTING_STARS = [
  { top: "18%", left: "65%", width: 180, angle: 15, duration: 8, delay: 1 },
  { top: "35%", left: "45%", width: 120, angle: 20, duration: 12, delay: 4.5 },
  { top: "12%", left: "30%", width: 150, angle: 12, duration: 10, delay: 7 }
];

// Rangoli petals: colour, position, drift duration and delay.
const PETALS = [
  { color: "#b8860b", style: { bottom: "20%", left: "15%" }, duration: 9, delay: 0 },
  { color: "#c0392b", style: { bottom: "30%", left: "8%" }, duration: 7, delay: 2 },
  { color: "#f5c842", style: { bottom: "15%", right: "18%" }, duration: 11, delay: 1 },
  { color: "#8b5cf6", style: { bottom: "25%", right: "10%" }, duration: 8, delay: 3 },
  { color: "#e67e22", style: { top: "20%", left: "10%" }, duration: 10, delay: 0.5 },
  { color: "#d4a012", style: { top: "30%", right: "8%", width: 4, height: 4 }, duration: 9, delay: 2.5 }
];

// Floating diyas: position, float duration and delay. `wide` ones are hidden on phones, where they would sit under the card.
const DIYAS = [
  { style: { bottom: 50, left: 28 }, duration: 5.5, delay: 0 },
  { style: { bottom: 80, left: 100 }, duration: 7, delay: 0.9 },
  { style: { bottom: 45, left: 170 }, duration: 6, delay: 0.4, wide: true },
  { style: { bottom: 60, right: 30 }, duration: 5, delay: 0.2 },
  { style: { bottom: 88, right: 105 }, duration: 7.5, delay: 1.3 },
  { style: { bottom: 50, right: 175 }, duration: 6.5, delay: 0.7, wide: true },
  { style: { top: 100, left: 20 }, duration: 8, delay: 0.3 }
];

// 12 tick marks around the chalni, every 30 degrees.
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: false, password: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [welcome, setWelcome] = useState(false);

  function shakeForm() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const missing = { username: !username.trim(), password: !password };
    setFieldErrors(missing);
    setError("");
    if (missing.username || missing.password) {
      shakeForm();
      return;
    }
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      // Show "Welcome Back" briefly, then open the dashboard.
      setWelcome(true);
      setTimeout(() => onLoggedIn(user), 1200);
    } catch (err) {
      setError(err.message);
      setPassword("");
      setBusy(false);
      shakeForm();
    }
  }

  return (
    <div className="kcl-page">
      {/* Background: sky, nebula, stars, shooting stars, moon, petals, diyas (decoration only) */}
      <div className="kcl-sky" aria-hidden="true" />
      <div className="kcl-nebula kcl-n1" aria-hidden="true" />
      <div className="kcl-nebula kcl-n2" aria-hidden="true" />
      <div className="kcl-nebula kcl-n3" aria-hidden="true" />

      <div aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="kcl-star"
            style={{
              width: s.size,
              height: s.size,
              top: `${s.top}%`,
              left: `${s.left}%`,
              "--kcl-op": s.opacity,
              animationDuration: `${s.duration}s`,
              animationDelay: `-${s.delay}s`
            }}
          />
        ))}
        {SHOOTING_STARS.map((s, i) => (
          <span
            key={i}
            className="kcl-shoot"
            style={{
              top: s.top,
              left: s.left,
              width: s.width,
              transform: `rotate(${s.angle}deg)`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`
            }}
          />
        ))}
      </div>

      <div className="kcl-moon-scene" aria-hidden="true">
        <div className="kcl-halo kcl-halo-3" />
        <div className="kcl-halo kcl-halo-2" />
        <div className="kcl-halo kcl-halo-1" />
        <div className="kcl-moon-disk">
          <div className="kcl-moon-shadow" />
          <div className="kcl-crater kcl-crater-1" />
          <div className="kcl-crater kcl-crater-2" />
        </div>
      </div>

      {PETALS.map((p, i) => (
        <span
          key={i}
          className="kcl-petal"
          style={{ ...p.style, background: p.color, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
          aria-hidden="true"
        />
      ))}

      {DIYAS.map((d, i) => (
        <div
          key={i}
          className={d.wide ? "kcl-diya kcl-diya-wide" : "kcl-diya"}
          style={{ ...d.style, animationDuration: `${d.duration}s`, animationDelay: `${d.delay}s` }}
          aria-hidden="true"
        >
          <div className="kcl-diya-glow" />
          <div className="kcl-diya-flame" />
          <div className="kcl-diya-rim" />
          <div className="kcl-diya-base" />
        </div>
      ))}

      {/* Login card */}
      <div className="kcl-card-wrap">
        <div className="kcl-outer-ring" aria-hidden="true" />
        <div className="kcl-card">
          <div className="kcl-strip-top" aria-hidden="true" />
          <span className="kcl-orn kcl-orn-tl" aria-hidden="true" />
          <span className="kcl-orn kcl-orn-tr" aria-hidden="true" />
          <span className="kcl-orn kcl-orn-bl" aria-hidden="true" />
          <span className="kcl-orn kcl-orn-br" aria-hidden="true" />

          <div className="kcl-card-inner">
            <div className="kcl-header">
              <div className="kcl-chalni" aria-hidden="true">
                <div className="kcl-chalni-ring3">
                  {TICKS.map((deg) => (
                    <span key={deg} className="kcl-tick" style={{ transform: `translateX(-50%) rotate(${deg}deg)` }} />
                  ))}
                </div>
                <div className="kcl-chalni-ring2" />
                <div className="kcl-chalni-ring1">
                  <div className="kcl-chalni-center" />
                </div>
              </div>
              <h1 className="kcl-brand">Mia by Tanishq</h1>
              <div className="kcl-festival-pill">
                <span className="kcl-pill-dot" aria-hidden="true" />
                Karwa Chauth 2026
                <span className="kcl-pill-dot" aria-hidden="true" />
              </div>
            </div>

            <div className="kcl-divider" aria-hidden="true">
              <span className="kcl-div-line" />
              <span className="kcl-div-center">
                <span className="kcl-div-diamond-sm" />
                <span className="kcl-div-diamond" />
                <span className="kcl-div-diamond-sm" />
              </span>
              <span className="kcl-div-line kcl-div-line-r" />
            </div>

            <form onSubmit={handleSubmit} className={shake ? "kcl-shake" : undefined} noValidate>
              {error && <p role="alert" className="kcl-error">{error}</p>}

              <div className="kcl-field">
                <label className="kcl-label" htmlFor="kc-username">Username</label>
                <div className="kcl-input-wrap">
                  <span className="kcl-icon-wrap" aria-hidden="true">
                    <User size={15} strokeWidth={1.5} />
                  </span>
                  <input
                    id="kc-username"
                    className="kcl-input"
                    type="text"
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setFieldErrors((f) => ({ ...f, username: false }));
                      setError("");
                    }}
                    aria-invalid={fieldErrors.username}
                  />
                </div>
                {fieldErrors.username && <p className="kcl-field-error">Please enter your username</p>}
              </div>

              <div className="kcl-field">
                <label className="kcl-label" htmlFor="kc-password">Password</label>
                <div className="kcl-input-wrap">
                  <span className="kcl-icon-wrap" aria-hidden="true">
                    <Lock size={15} strokeWidth={1.5} />
                  </span>
                  <input
                    id="kc-password"
                    className="kcl-input kcl-input-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((f) => ({ ...f, password: false }));
                      setError("");
                    }}
                    aria-invalid={fieldErrors.password}
                  />
                  <button
                    type="button"
                    className="kcl-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="kcl-field-error">Please enter your password</p>}
              </div>

              <button type="submit" className="kcl-btn" disabled={busy}>
                <span className="kcl-btn-bg" aria-hidden="true" />
                <span className="kcl-btn-shimmer" aria-hidden="true" />
                <span className="kcl-btn-content">
                  {busy ? (
                    <>
                      <span className="kcl-loader" aria-hidden="true" /> Authenticating…
                    </>
                  ) : (
                    <>
                      <LogIn size={14} strokeWidth={2} aria-hidden="true" /> Sign in to dashboard
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>

          <div className="kcl-strip-bottom" aria-hidden="true" />
        </div>
      </div>

      {/* Shown for a moment after a successful sign-in */}
      {welcome && (
        <div className="kcl-welcome" role="status">
          <div className="kcl-welcome-diyas" aria-hidden="true">
            <span className="kcl-welcome-diya">🪔</span>
            <span className="kcl-welcome-diya">🪔</span>
            <span className="kcl-welcome-diya">🪔</span>
          </div>
          <div className="kcl-welcome-line" aria-hidden="true" />
          <div className="kcl-welcome-title">Welcome Back</div>
          <div className="kcl-welcome-sub">Shubh Karwa Chauth</div>
          <div className="kcl-welcome-line" aria-hidden="true" />
          <div className="kcl-welcome-note">Opening the dashboard…</div>
        </div>
      )}
    </div>
  );
}
