import { useDashboard } from "../../context/DashboardContext";
import { istTime } from "../../utils/format";

// A refresh failed but older data is still on screen: say so, and how old it is.
export default function RefreshBanner() {
  const { error, summary, updatedAt, refresh, loading } = useDashboard();
  if (!error || !summary) return null;
  return (
    <div className="refresh-banner" role="alert">
      <span>
        <b>Couldn’t refresh.</b> Showing data from {updatedAt ? istTime(updatedAt) : "earlier"}. Trying again automatically.
      </span>
      <button type="button" className="btn sm" onClick={refresh} disabled={loading}>Retry</button>
    </div>
  );
}
