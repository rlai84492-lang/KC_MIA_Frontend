import { PATHS } from "../../data/campaignConfig";

const PATH_BY_ID = Object.fromEntries(PATHS.map((p) => [p.id, p]));

const INI_TONES = [
  ["#E8F0FC", "#2F6FD0"],
  ["#F7DFE6", "#7A1F3D"],
  ["#E7F6EC", "#16A34A"],
  ["#EEEBFB", "#6D5BD0"],
  ["#FBE7F0", "#B8336A"]
];

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function tone(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return INI_TONES[h % INI_TONES.length];
}

// Initials avatar + name + secondary line (reference .who).
export function CustomerCell({ name, sub }) {
  const [bg, fg] = tone(name);
  return (
    <div className="flex items-center gap-3">
      <span className="ini" style={{ background: bg, color: fg }} aria-hidden="true">{initials(name)}</span>
      <div className="min-w-0">
        <b className="block whitespace-nowrap font-semibold">{name}</b>
        {sub && <small className="block whitespace-nowrap text-xs text-kc-ink3">{sub}</small>}
      </div>
    </div>
  );
}

export function PathPill({ path }) {
  const p = PATH_BY_ID[path];
  if (!p) return <span className="pill p-mute">{path || "—"}</span>;
  return <span className={`pill ${p.pill}`}>{p.shortLabel}</span>;
}

const STATUS_TONE = {
  Active: "p-good",
  Completed: "p-violet",
  Confirmed: "p-good",
  Captured: "p-info",
  Sent: "p-warn",
  Idle: "p-mute"
};

export function StatusPill({ status }) {
  return <span className={`pill ${STATUS_TONE[status] || "p-mute"}`}>{status}</span>;
}
