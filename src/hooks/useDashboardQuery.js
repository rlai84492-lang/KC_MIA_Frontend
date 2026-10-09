import { useEffect, useRef, useState } from "react";
import { useDashboard } from "../context/DashboardContext";

// Loads page data through the dashboard service.
// - Re-runs when `deps` change and whenever the dashboard is refreshed (Refresh button / auto-refresh).
// - Keeps the previous data on screen while a refresh is in flight, so tables don't flash or lose their place.
// - Ignores answers that arrive after a newer request was started.
export function useDashboardQuery(fetcher, deps) {
  const { refreshTick } = useDashboard();
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve()
      .then(fetcher)
      .then(
        (data) => { if (id === latest.current) setState({ data, error: "", loading: false }); },
        (err) => { if (id === latest.current) setState((s) => ({ ...s, error: err.message || "Unable to load data.", loading: false })); }
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshTick]);

  return state;
}
