import { useState } from "react";
import { Download } from "lucide-react";
import { PATH_BY_ID } from "../data/campaignConfig";
import { useDashboard } from "../context/DashboardContext";
import { useDashboardQuery } from "../hooks/useDashboardQuery";
import { useToast } from "../components/common/Toast";
import MetricCard from "../components/common/MetricCard";
import Loading from "../components/common/Loading";
import ErrorState from "../components/common/ErrorState";
import PanelHeader from "../components/common/PanelHeader";
import { CustomerCell } from "../components/tables/TableParts";
import { Pager } from "../components/tables/TableKit";
import { RANGE_LABELS, agoMinutes, asIst, fmt, istDateTime, maskPhone, percent } from "../utils/format";
import { downloadCsv, toCsv } from "../utils/csv";

// The table's "Show" chips. `id` is the backend's `show` value.
const SHOW = [
  { id: "all", label: "All" },
  { id: "husbands", label: "Husbands" },
  { id: "wives", label: "Wives" },
  { id: "consented", label: "Consent: yes" }
];

// A card the backend sends as null doesn't apply to the selected path, so it shows "–".
const countOrDash = (value) => (value == null ? "–" : fmt(value));

export default function Referrals() {
  const { filters, service } = useDashboard();
  const toast = useToast();
  const [show, setShow] = useState("all");
  const [copying, setCopying] = useState(false);
  const [fullNumbers, setFullNumbers] = useState(false);


  // Any filter change goes back to page 1.
  const filterKey = [filters.from, filters.to, show].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;

  // Referral Leads always covers every path (the top toggle only offers "All paths" here).
  const params = { from: filters.from, to: filters.to, flow: "all" };

  // GET /referral-leads/summary: the 5 cards and the Opt-in Leads section.
  const { data: cards, error: cardsError } = useDashboardQuery(
    () => service.getReferralLeadsSummary(params),
    [service, filters.from, filters.to]
  );

  // GET /referral-leads: newest first, 50 rows per page.
  const { data, error } = useDashboardQuery(
    () => service.getReferralLeads({ ...params, show, page }),
    [service, filterKey, page]
  );

  if ((!data && error) || (!cards && cardsError)) return <ErrorState message={error || cardsError} />;
  if (!data || !cards) return <Loading />;

  const optIn = cards.optInLeads;

  async function copyCsv() {
    setCopying(true);
    try {
      // GET /referral-leads/export?scope=all → { columns, rows }: each row is keyed by its column header.
      // The Status column isn't used on this page. Mobiles are masked unless
      // "Full mobile numbers in downloads" is ticked.
      const result = await service.exportReferralLeads({ ...params, show, scope: "all" });
      const columns = result.columns.filter((header) => header !== "Status").map((header) => ({
        header,
        value: (row) => (header === "Mobile" && !fullNumbers ? maskPhone(row[header]) : row[header])
      }));
      const filename = `mia-kc26-referral-leads-${(RANGE_LABELS[filters.range] || "custom").toLowerCase().replace(/\s+/g, "")}.csv`;
      downloadCsv(filename, toCsv(columns, result.rows));
      toast(`Downloaded ${fmt(result.rows.length)} referral leads · ${filename}`);
    } catch {
      toast("Couldn’t prepare the download. Please try again.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <div className="kpi-grid five">
        <MetricCard icon="🤝" value={fmt(cards.referralLeads)} label="Referral Leads" detail={`${RANGE_LABELS[filters.range] || "Selected range"} · all referred contacts`} />
        <MetricCard icon="💍" value={countOrDash(cards.husbandsReferred)} label="Husbands Referred" detail="By wives · Step 1J" />
        <MetricCard icon="🎂" value={countOrDash(cards.wivesReferred)} label="Wives Referred" detail="By husbands · Step 2F" />
        <MetricCard icon="✅" value={percent(cards.consentGivenPct, 0)} label="Consent Given" detail={`${fmt(cards.canBeMessaged)} can be messaged`} />
        <MetricCard icon="💌" value={countOrDash(cards.isharaForwards)} label="Ishara Forwards" detail="Husband reached; number not captured" />
      </div>

      <section className="panel">
        <PanelHeader icon="🤝" title="Referral Leads"
          subtitle={`Contacts a customer shared for a future occasion. Only rows with consent can be messaged. Showing ${fmt(data.totalElements)} leads, newest first.`} />

        <div className="tools">
          <span className="tools-label">Show:</span>
          <div className="chips" role="group" aria-label="Show">
            {SHOW.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={show === s.id} onClick={() => setShow(s.id)}>{s.label}</button>
            ))}
          </div>
          <span className="flex-1" />
          <label className="opts">
            <input type="checkbox" checked={fullNumbers} onChange={(e) => setFullNumbers(e.target.checked)} />
            Full mobile numbers in downloads
          </label>
          <button type="button" className="btn" onClick={copyCsv} disabled={copying || !data.totalElements}>
            <Download size={16} aria-hidden="true" />Download as CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Referred By</th>
                <th>Referred Contact</th>
                <th>Relation</th>
                <th>Mobile</th>
                <th>Key Date</th>
                <th>Consent</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const p = PATH_BY_ID[r.flow];
                return (
                  <tr key={r.leadId}>
                    <td>
                      <CustomerCell name={r.referredBy}
                        sub={<><span style={{ color: p?.color }} aria-hidden="true">●</span> <span title={istDateTime(asIst(r.capturedAt))}>{p?.shortLabel || r.pathLabel} · {agoMinutes(r.minutesAgo)}</span></>} />
                    </td>
                    <td><CustomerCell name={r.contactName} sub={`Step ${r.contactStep}`} /></td>
                    <td>{r.relation}</td>
                    <td className="mono">{r.mobile || <span className="text-kc-ink3">—</span>}</td>
                    <td className="mono">{r.keyDateLabel}</td>
                    <td><span className={`pill ${r.consentLabel === "Yes" ? "p-good" : "p-mute"}`}>{r.consentLabel || "Pending"}</span></td>
                  </tr>
                );
              })}
              {!data.rows.length && (
                <tr><td colSpan={6}><div className="empty">No referral leads in this range. Try 30 Days.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={data.size} total={data.totalElements} onPage={(p) => setPageState({ key: filterKey, page: p })} />
      </section>

      <section className="panel">
        <PanelHeader icon="✨" title="Opt-in Leads" subtitle="“Here for the sparkle” customers who said yes to new arrivals and offers" />
        <div className="px-4 pb-5 pt-[18px] sm:px-[22px]">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="pstat"><div className="pstat-value">{fmt(optIn.optedIn)}</div><div className="pstat-label">Said yes to “keep me posted”</div></div>
            <div className="pstat"><div className="pstat-value">{percent(optIn.pctOfSparkleOpenerTaps)}</div><div className="pstat-label">Of sparkle opener taps</div></div>
            <div className="pstat"><div className="pstat-value">{fmt(optIn.sparkleOpenerTaps)}</div><div className="pstat-label">Sparkle opener taps</div></div>
          </div>
        </div>
      </section>
    </>
  );
}
