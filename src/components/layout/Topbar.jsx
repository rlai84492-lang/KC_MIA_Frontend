import { useEffect, useRef } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { PATHS } from "../../data/campaignConfig";
import { useDashboard } from "../../context/DashboardContext";
import { NAV } from "./Sidebar";
import { istDateRange } from "../../utils/istDates";
import { istTime } from "../../utils/format";
import { useToast } from "../common/Toast";

const TITLES = {
  overview: ["Overview", "The campaign at a glance"],
  conversations: ["Conversations", "Every session, live from the bot"],
  referrals: ["Referral Leads", "Contacts shared for future occasions"],
  audiences: ["Cohorts", "Customers grouped by where they are in the journey"],
  visits: ["Store Visits", "Bookings made in the WhatsApp Flow"]
};

// Views that show only the "All paths" toggle.
const ALL_PATHS_ONLY = ["audiences", "referrals", "visits"];

export default function Topbar({ view, onNavigate, user, onLogout }) {
  const { filters, setFilters, refresh, loading, error, updatedAt, settled } = useDashboard();
  const toast = useToast();
  const manualRefresh = useRef(null); // `settled` value when Refresh was pressed
  const [title, subtitle] = TITLES[view];

  const rangeOptions = [
    ["1", "Today"],
    ["7", "7 Days"],
    ["30", "30 Days"]
  ];

  const setRange = (range) => {
    const { from, to } = istDateRange(range);
    setFilters((f) => ({ ...f, range, from, to }));
  };

  const pathOptions = [{ id: "all", toggleLabel: "All paths", emoji: "🌙" }].concat(
    ALL_PATHS_ONLY.includes(view) ? [] : PATHS
  );
  const activePath = ALL_PATHS_ONLY.includes(view) ? "all" : filters.path;

  // Confirm a Refresh press once it has finished (automatic refreshes stay silent).
  useEffect(() => {
    if (manualRefresh.current === null || settled === manualRefresh.current) return;
    manualRefresh.current = null;
    toast(error ? "Couldn’t refresh. Showing the last data received." : "Dashboard refreshed");
  }, [settled, error, toast]);

  const onRefresh = () => {
    manualRefresh.current = settled;
    refresh();
  };

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 lg:pl-7 lg:pr-[34px] lg:pt-6">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 lg:hidden">
            <span className="whitespace-nowrap font-display text-lg font-medium text-kc-deep">Mia by Tanishq</span>
            <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.06em] text-kc-rose">Karwa Chauth CRM</span>
          </div>
          <h1 className="m-0 font-display text-[28px] font-medium leading-tight tracking-[-0.01em] text-kc-deep lg:text-[34px]">
            {title}
          </h1>
          <div className="mt-0.5 text-[15px] text-kc-ink2">
            {subtitle}
            {updatedAt && <> · Updated {istTime(updatedAt)}</>}
          </div>
        </div>

        {/* Signed-in user + Log out, top-right (reference: "Mia Admin") */}
        {user && (
          <div className="flex flex-none items-center gap-2 rounded-full border border-kc-line bg-white py-1 pl-1 pr-1.5">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-mia-700 text-[13px] font-semibold uppercase text-white" aria-hidden="true">
              {user.username.slice(0, 2)}
            </span>
            <span className="hidden max-w-[160px] truncate text-[15px] text-kc-ink sm:inline">{user.username}</span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              title={`Signed in as ${user.username}`}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-kc-ink2 hover:bg-kc-panel2"
            >
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        )}
      </header>


      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="Sections">
        {NAV.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={view === id ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
              view === id ? "bg-kc-accentSoft font-medium text-mia-700" : "text-kc-ink2 hover:bg-kc-panel2"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="z-10 flex flex-wrap items-center justify-between gap-3 bg-kc-bg px-4 pb-1 pt-2 lg:sticky lg:top-0 lg:pl-7 lg:pr-[34px]">
        <div className="seg-group" role="group" aria-label="Chatbot path">
          {pathOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activePath === p.id}
              onClick={() => setFilters((f) => ({ ...f, path: p.id }))}
              className="seg-btn"
            >
              <span aria-hidden="true">{p.emoji}</span>
              {p.toggleLabel}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="seg-group gold" role="group" aria-label="Date range">
            {rangeOptions.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.range === value}
                onClick={() => setRange(value)}
                className="seg-btn"
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className="grid h-10 w-10 flex-none place-items-center rounded-full border border-kc-line bg-white text-kc-ink2 hover:bg-kc-panel2 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </>
  );
}
