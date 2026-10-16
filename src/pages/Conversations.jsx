import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { CATEGORIES, CATEGORY_CODES, PATH_BY_ID, PATH_STEPS, SHARED_STEPS, stepDef } from "../data/campaignConfig";
import { useDashboard } from "../context/DashboardContext";
import { useDashboardQuery } from "../hooks/useDashboardQuery";
import { useToast } from "../components/common/Toast";
import MetricCard from "../components/common/MetricCard";
import Loading from "../components/common/Loading";
import ErrorState from "../components/common/ErrorState";
import PanelHeader from "../components/common/PanelHeader";
import { CustomerCell, PathPill } from "../components/tables/TableParts";
import { Pager, SortHeader, nextSort } from "../components/tables/TableKit";
import { RANGE_LABELS, agoMinutes, asIst, fmt, istDateTime, maskPhone } from "../utils/format";
import { downloadCsv, toCsv } from "../utils/csv";

// Step filter: every flow step once, in flow order (reference: "All Steps"). The value sent is the step code.
const STEP_OPTIONS = [...PATH_STEPS.celebrating, ...PATH_STEPS.shopping, ...PATH_STEPS.sparkle, ...SHARED_STEPS]
  .filter((s, i, list) => list.findIndex((x) => x.code === s.code) === i);

// The backend's sort names: customer, phone, path, step, category, budget, lastActivity.
const DEFAULT_SORT = { key: "lastActivity", dir: "desc" };

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function Conversations() {
  const { filters,service } = useDashboard();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [flowStep, setFlowStep] = useState("all");
  const [sortChoice, setSort] = useState(DEFAULT_SORT);
  const [copying, setCopying] = useState(false);
  const [fullNumbers, setFullNumbers] = useState(false);
  const q = useDebounced(query.trim(), 250);


  // "I'm celebrating" has no budget step (flow script v7), so its view has no Budget column.
  const sort = filters.path === "celebrating" && sortChoice.key === "budget" ? DEFAULT_SORT : sortChoice;

  // Any filter change goes back to page 1.
  const filterKey = [filters.from, filters.to, filters.path, q, category, flowStep, sort.key, sort.dir].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;

  // GET /conversations/summary: the 5 cards follow only the path and the date range.
  const { data: cards, error: cardsError } = useDashboardQuery(
    () => service.getConversationsSummary({ from: filters.from, to: filters.to, flow: filters.path }),
    [service, filters.from, filters.to, filters.path]
  );

  // GET /conversations and /conversations/export take the same filters (the backend's parameter names).
  // A filter left on "all" (or an empty search) is not sent.
  const params = {
    from: filters.from,
    to: filters.to,
    flow: filters.path,
    ...(category !== "all" && { category: CATEGORY_CODES[category] }),
    ...(flowStep !== "all" && { step: flowStep }),
    ...(q && { search: q }),
    sort: sort.key,
    direction: sort.dir
  };
  const { data, error } = useDashboardQuery(
    () => service.getConversations({ ...params, page }),
    [service, filterKey, page]
  );

  if ((!data && error) || (!cards && cardsError)) return <ErrorState message={error || cardsError} />;
  if (!data || !cards) return <Loading />;

  // The backend leaves the Budget column out on "I'm celebrating" (showBudget = false).
  const showBudget = data.showBudget;
  const pathLabel = filters.path === "all" ? "" : ` · ${PATH_BY_ID[filters.path].label}`;
  const onSort = (key) => setSort(nextSort(sort, key));

  async function copyCsv() {
    setCopying(true);
    try {
      // GET /conversations/export?scope=all → { columns, rows }: each row is keyed by its column header.
      const result = await service.exportConversations({ ...params, scope: "all" });
      // Phones are masked in this download unless "Full mobile numbers in downloads" is ticked.
      const columns = result.columns.map((header) => ({
        header,
        value: (row) => (header === "Phone" && !fullNumbers ? maskPhone(row[header]) : row[header])
      }));

      const filename = `mia-kc26-conversations-${(RANGE_LABELS[filters.range] || "custom").toLowerCase().replace(/\s+/g, "")}.csv`;
      downloadCsv(filename, toCsv(columns, result.rows));
      toast(`Downloaded ${fmt(result.rows.length)} rows · ${filename}`);
    } catch {
      toast("Couldn’t prepare the download. Please try again.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      {/* "Total Conversation" shows on All paths only; on a single path the row has 4 cards. */}
      <div className={filters.path === "all" ? "kpi-grid five" : "kpi-grid"}>
        {filters.path === "all" && (
          <MetricCard icon="💬" value={fmt(cards.totalSessions)} label="Total Conversation" detail="Conversations started in range" />
        )}
        <MetricCard icon="🗂" value={fmt(cards.enteredDiscovery)} label="Entered Discovery" detail="Picked a category" />
        <MetricCard icon="🎠" value={fmt(cards.carouselReached)} label="Carousel Reached" detail="Saw the product cards" />
        <MetricCard icon="💌" value={filters.path === "all" || filters.path === "celebrating" ? fmt(cards.isharaSent) : "–"} label="Ishara Sent" detail="Celebrating path" />
        <MetricCard icon="📍" value={fmt(cards.visitsBooked)} label="Visits Booked" detail="WhatsApp Flow" />
      </div>

      <section className="panel">
        <PanelHeader icon="💬" title="All Conversations"
          subtitle={`Showing ${fmt(data.totalElements)} sessions · ${RANGE_LABELS[filters.range] || "Selected range"}${pathLabel}`} />

        <div className="tools">
          {/* Path filter hidden: the table follows the path chosen at the top of the page.
          <span className="tools-label">Path:</span>
          <div className="chips" role="group" aria-label="Path">
            {[{ id: "all", shortLabel: "All" }, ...PATHS].map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={filters.path === p.id}
                onClick={() => setFilters((f) => ({ ...f, path: p.id }))}>{p.shortLabel}</button>
            ))}
          </div>
          */}


          <label className="tools-label" htmlFor="convCat">Category:</label>
          <select id="convCat" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>

          <label className="tools-label" htmlFor="convStep">Step:</label>
          <select id="convStep" value={flowStep} onChange={(e) => setFlowStep(e.target.value)} className="field">
            <option value="all">All Steps</option>
            {STEP_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
          </select>

          <div className="relative min-w-[200px] max-w-[280px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-kc-ink3" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name / phone…" aria-label="Search name or phone" className="field w-full pl-8" />
          </div>

          <span className="flex-1" />
          <label className="opts">
            <input type="checkbox" checked={fullNumbers} onChange={(e) => setFullNumbers(e.target.checked)} />
            Full mobile numbers in downloads
          </label>
          <button type="button" className="btn" onClick={copyCsv} disabled={copying || !data.totalElements}>
            <Download size={16} aria-hidden="true" />Download as CSV ({fmt(data.totalElements)})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <SortHeader label="Customer" sortKey="customer" sort={sort} onSort={onSort} />
                <SortHeader label="Phone" sortKey="phone" sort={sort} onSort={onSort} />
                <SortHeader label="Path" sortKey="path" sort={sort} onSort={onSort} />
                <SortHeader label="Step" sortKey="step" sort={sort} onSort={onSort} />
                <SortHeader label="Category" sortKey="category" sort={sort} onSort={onSort} />
                {showBudget && <SortHeader label="Budget" sortKey="budget" sort={sort} onSort={onSort} />}
                <SortHeader label="Last Activity" sortKey="lastActivity" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.sessionId}>
                  <td><CustomerCell name={row.customerName} sub={row.status} /></td>
                  <td className="mono">{row.phone}</td>
                  <td><PathPill path={row.flow} /></td>
                  <td><span className={`pill ${stepDef(row.flow, row.stepCode)?.tone || "p-mute"}`}>{row.stepLabel}</span></td>
                  <td>{row.categoryLabel || <span className="text-kc-ink3">—</span>}</td>
                  {showBudget && <td className="whitespace-nowrap">{row.budgetLabel || <span className="text-kc-ink3">—</span>}</td>}
                  <td className="mono" title={istDateTime(asIst(row.lastActivity))}>{agoMinutes(row.minutesAgo)}</td>
                </tr>
              ))}
              {!data.rows.length && (
                <tr><td colSpan={showBudget ? 7 : 6}><div className="empty">No conversations match these filters. Clear the search or pick “All Steps”.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={data.size} total={data.totalElements} onPage={(p) => setPageState({ key: filterKey, page: p })} />
      </section>
    </>
  );
}
