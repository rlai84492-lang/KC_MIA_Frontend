import { useState } from "react";
import { Download } from "lucide-react";
import { AUDIENCE_SEGMENTS, PATHS, PATH_BY_ID } from "../data/campaignConfig";
import { useDashboard } from "../context/DashboardContext";
import { useDashboardQuery } from "../hooks/useDashboardQuery";
import { useToast } from "../components/common/Toast";
import MetricCard from "../components/common/MetricCard";
import Loading from "../components/common/Loading";
import ErrorState from "../components/common/ErrorState";
import { RANGE_LABELS, fmt } from "../utils/format";
import { downloadCsv, toCsv } from "../utils/csv";

// Cohorts always cover every path (the top toggle only offers "All paths" here).
// The card text (definition, next step, use it for) comes from campaignConfig, matched by the backend's card `key`.
const SEG_BY_ID = Object.fromEntries(AUDIENCE_SEGMENTS.map((g) => [g.id, g]));
const PRIORITY_STRIP = ["Hint sent, no visit", "List started, no hint", "Browsing / shortlisted, no purchase"];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function PathPills({ flows }) {
  if (!flows.length) return <span className="pill p-mute">No path chosen</span>;
  if (flows.length === PATHS.length) return <span className="pill p-mute">All paths</span>;
  return flows.map((id) => <span key={id} className={`pill ${PATH_BY_ID[id]?.pill || "p-mute"}`}>{PATH_BY_ID[id]?.shortLabel || id}</span>);
}

// One card from GET /cohorts/summary: { key, label, flows, priority, count }.
function SegmentCard({ card, busy, onDownload }) {
  const text = SEG_BY_ID[card.key] || {};
  return (
    <div className="segcard">
      <div className="segcard-head">
        <div className="segcard-name">{card.label}</div>
        <div className="segcard-count">{fmt(card.count)}</div>
      </div>
      {text.definition && <div className="segcard-def">{text.definition}</div>}
      <div className="segcard-meta">
        <PathPills flows={card.flows || []} />
        {card.priority && <span className="pill p-mute">Priority {card.priority}</span>}
      </div>
      {text.nextStep && <div className="segcard-next"><span>Suggested next step:</span> {text.nextStep}</div>}
      {text.useFor && <div className="segcard-use"><b>Use it for</b> · {text.useFor.join(" · ")}</div>}
      <div className="segcard-acts">
        <button type="button" className="btn sm" disabled={!card.count || busy} onClick={onDownload}>
          <Download size={15} aria-hidden="true" />Download CSV
        </button>
      </div>
    </div>
  );
}

export default function Audiences() {
  const { filters, service } = useDashboard();
  const toast = useToast();
  const [fullNumbers, setFullNumbers] = useState(false);
  const [busy, setBusy] = useState(null);

  const range = { from: filters.from, to: filters.to };

  // GET /cohorts/summary: the 2 cards and the count on every segment card.
  const { data, error } = useDashboardQuery(
    () => service.getCohortsSummary(range),
    [service, filters.from, filters.to]
  );

  if (!data && error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const stopped = data.whereTheyStopped;
  const completed = data.completedOrOptedInSegments;

  // GET /cohorts/<key>?fullMobile=… → { columns, rows }: each row is keyed by its column header.
  // The backend masks the mobiles unless the "Full mobile numbers in downloads" box is ticked.
  async function download(card) {
    setBusy(card.key);
    try {
      const result = await service.getCohortSegment(card.key, { ...range, fullMobile: fullNumbers });
      const columns = result.columns.map((header) => ({ header, value: (row) => row[header] }));
      const filename = `mia-kc26-${slug(card.label)}-${(RANGE_LABELS[filters.range] || "custom").toLowerCase().replace(/\s+/g, "")}.csv`;
      downloadCsv(filename, toCsv(columns, result.rows));
      toast(`Downloaded ${fmt(result.rows.length)} customers · ${filename}`);
    } catch {
      toast("Couldn’t prepare the download. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const segmentCard = (card) => (
    <SegmentCard key={card.key} card={card} busy={busy === card.key} onDownload={() => download(card)} />
  );

  return (
    <>
      <div className="kpi-grid">
        <MetricCard icon="🔁" value={fmt(data.engagedNotFinished)} label="Engaged, Not Finished" detail="Can be picked up where they left" />
        <MetricCard icon="🏁" value={fmt(data.completedOrOptedIn)} label="Completed or Opted In" detail="Visits, purchases, consents" />
      </div>

      <div className="sechead">
        <h2>Where they stopped</h2>
        <span>Each customer sits in one segment, by priority · {fmt(stopped.total)} customers</span>
      </div>
      <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-[22px]">
        <div className="prio">
          <span>Priority when someone fits more than one:</span>
          {PRIORITY_STRIP.map((t, i) => (
            <span key={t} className="contents">
              <span><span className="prio-n">{i + 1}</span>{t}</span>
              {i < PRIORITY_STRIP.length - 1 && <span className="prio-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <label className="opts">
          <input type="checkbox" checked={fullNumbers} onChange={(e) => setFullNumbers(e.target.checked)} />
          Full mobile numbers in downloads
        </label>
      </div>
      <div className="segcards">{stopped.segments.map(segmentCard)}</div>

      <div className="sechead">
        <h2>Completed or opted in</h2>
        <span>Customers who took an action · {fmt(completed.total)} customers</span>
      </div>
      <div className="segcards">{completed.segments.map(segmentCard)}</div>
    </>
  );
}
