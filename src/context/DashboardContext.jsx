import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dashboardService } from "../services/dashboardService";
import { PATHS } from "../data/campaignConfig";
import { usePolling } from "../hooks/usePolling";
import { istDateRange } from "../utils/istDates";
import { readPrefs, writePrefs } from "../utils/prefs";

// How often every page re-fetches while the tab is visible. See INTEGRATION_NOTES.md → "How up to date the dashboard is".
export const AUTO_REFRESH_MS = 30000;

const RANGES = ["1", "7", "30"];
const PATH_IDS = ["all", ...PATHS.map((p) => p.id)];

const DashboardContext = createContext(null);

// Starting filters: the path and range last used in this browser, dates recalculated for today (IST).
function initialFilters() {
  const saved = readPrefs();
  const range = RANGES.includes(saved.range) ? saved.range : "7";
  const path = PATH_IDS.includes(saved.path) ? saved.path : "all";
  return { path, range, ...istDateRange(range) };
}

export function DashboardProvider({ children }) {
  const [filters, setFilters] = useState(initialFilters);

  // Bumped by Refresh and by auto-refresh: every page re-fetches its data when it changes.
  const [refreshTick, setRefreshTick] = useState(0);

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  // Counts finished summary loads (success or failure), so the Refresh button knows when its refresh is done.
  const [settled, setSettled] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    writePrefs({ path: filters.path, range: filters.range });
  }, [filters.path, filters.range]);

  const reloadSummary = useCallback(async () => {
    const id = ++latestRequest.current;
    setLoading(true);

    try {
            // Loaded on every page (the sidebar needs them): GET /metric-cards and GET /paths.
      // Kept exactly as the backend sends them: summary.metricCards and summary.paths.
      const [metricCards, paths] = await Promise.all([
        dashboardService.getMetricCards({ from: filters.from, to: filters.to, flow: filters.path }),
        dashboardService.getPaths({ from: filters.from, to: filters.to })
      ]);
      if (id !== latestRequest.current) return; // a newer request (other filters) already started
      setSummary({ metricCards, paths });

      setError("");
      setUpdatedAt(new Date());
    } catch (err) {
      if (id !== latestRequest.current) return;
      // Keep the last good summary on screen; the error is shown as a banner with Retry.
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      if (id === latestRequest.current) {
        setLoading(false);
        setSettled((n) => n + 1);
      }
    }
  }, [filters.from, filters.to, filters.path]);

  useEffect(() => {
    reloadSummary();
  }, [reloadSummary, refreshTick]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // Auto-refresh. Paused while the tab is hidden; runs at once when it becomes visible again.
  // If the IST day has changed (dashboard left open past midnight), the range moves forward to include today.
  usePolling(
    () => {
      setFilters((f) => {
        const next = istDateRange(f.range);
        return next.to === f.to ? f : { ...f, ...next };
      });
      refresh();
    },
    AUTO_REFRESH_MS,
    [refresh],
    { immediate: false }
  );

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      summary,
      loading,
      error,
      updatedAt,
      settled,
      refresh,
      refreshTick,
      service: dashboardService
    }),
    [filters, summary, loading, error, updatedAt, settled, refresh, refreshTick]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}
