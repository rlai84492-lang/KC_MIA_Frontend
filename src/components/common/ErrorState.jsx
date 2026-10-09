import { useDashboard } from "../../context/DashboardContext";

// Shown in place of a page when its first load failed (nothing to fall back on). Retry re-fetches everything.
export default function ErrorState({ message }) {
  const { refresh } = useDashboard();
  return (
    <section className="panel" role="alert">
      <div className="empty grid justify-items-center gap-3">
        <div className="font-display text-xl font-medium text-kc-deep">Couldn’t load this page</div>
        <div className="max-w-md text-sm">{message || "The dashboard server didn’t answer."} The dashboard will keep trying every 30 seconds.</div>
        <button type="button" className="btn" onClick={refresh}>Retry now</button>
      </div>
    </section>
  );
}
