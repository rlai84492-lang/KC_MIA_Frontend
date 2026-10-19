  import { PATHS, PATH_BY_ID } from "../data/campaignConfig";
  import { useDashboard } from "../context/DashboardContext";
  import { useDashboardQuery } from "../hooks/useDashboardQuery";
  import MetricCard from "../components/common/MetricCard";
  import Loading from "../components/common/Loading";
  import ErrorState from "../components/common/ErrorState";
  import PanelHeader from "../components/common/PanelHeader";
  import Sparkline from "../components/charts/Sparkline";
  import ActivityFeed from "../components/overview/ActivityFeed";
  import { RANGE_LABELS, dayLabel, fmt, percent } from "../utils/format";

  const BAR_COLORS = ["#7A1F3D", "#93304F", "#AA4865", "#C0637D", "#C9A15A", "#B68C47", "#9E7638", "#7E5B2A", "#5E1830", "#8C2B4A"];

  const PATH_GOALS = {
    celebrating: "Builds a wishlist and sends an Ishara to her husband.",
    shopping: "Picks one piece, then buys online or books a visit.",
    sparkle: "Browses for herself; no relationship assumed."
  };

  // "The three paths" card stats. Each key is the exact field name on that path's item in GET /paths.
  const PATH_CARD_STATS = {
    celebrating: [["Opener taps", "openerTaps"], ["Ishara sent", "isharaSent"], ["Visits booked", "visitsBooked"], ["Husbands referred", "husbandsReferred"]],
    shopping: [["Opener taps", "openerTaps"], ["Buy-online clicks", "buyOnlineClicks"], ["Visits booked", "visitsBooked"], ["Wives referred", "wivesReferred"]],
    sparkle: [["Opener taps", "openerTaps"], ["Pieces shortlisted", "piecesShortlisted"], ["Visits booked", "visitsBooked"], ["Keep me posted", "keepMePosted"]]
  };

  function OutcomeTile({ label, value, foot, points, color, hero, chip }) {
    return (
      <div className={`tile${hero ? " hero" : ""}`}>
        <div className="tile-label">
          <span>{label}</span>
          {chip && <span className="tchip">{chip}</span>}
        </div>
        <div className="tile-value">{value}</div>
        <div className="tile-foot">{foot}</div>
        {points ? <Sparkline points={points} color={color} format={fmt} /> : <div className="h-[34px]" />}
      </div>
    );
  }

  // One panel from GET /category-budget-picks: rows [{ key, label, customers, pct }], in display order.
  function Bars({ rows, color }) {
    if (!rows.length) return <p className="muted m-0">No picks in this range.</p>;
    const max = Math.max(1, ...rows.map((r) => r.customers));
    return (
      <div className="grid gap-[9px]">
        {rows.map((r) => (
          <div key={r.key} className="hb" data-tip={`${r.label}\n${fmt(r.customers)} customers`}>
            <span>{r.label}</span>
            <div className="hb-track"><span style={{ width: `${(100 * r.customers) / max}%`, background: color }} /></div>
            <span className="hb-value">{fmt(r.customers)} · {percent(r.pct, 0)}</span>
          </div>
        ))}
      </div>
    );
  }


  function RetargetTemplates({ data, error }) {
    if (error && !data) return <p className="muted m-0">Could not load re-target templates.</p>;
    if (!data) return <p className="muted m-0">Loading…</p>;
    const rows = data.templates || [];
    const td = "py-3 pr-4 text-right tabular-nums";
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider opacity-70">
              <th className="py-3 pr-4">Template</th><th className="py-3 pr-4">Audience</th>
              <th className="py-3 pr-4 text-right">Sent</th><th className="py-3 pr-4 text-right">Delivered</th>
              <th className="py-3 pr-4 text-right">Read</th><th className="py-3 pr-4 text-right">Failed</th>
              <th className="py-3 text-right">Tapped</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.step} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{r.label}</td>
                <td className="py-3 pr-4 opacity-70">{r.audience}</td>
                <td className={td}>{fmt(r.sent)}</td>
                <td className={td}>{fmt(r.delivered)} <small className="opacity-60">{percent(r.deliveryRate)}</small></td>
                <td className={td}>{fmt(r.read)} <small className="opacity-60">{percent(r.readRate)}</small></td>
                <td className={`${td} text-red-700`}>{fmt(r.failed)}</td>
                <td className="py-3 text-right font-semibold tabular-nums text-[#7A1F3D]">{fmt(r.tapped)} <small className="font-normal opacity-60">{percent(r.tapRate)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  export default function Overview() {
    const { summary, loading, error, filters, service } = useDashboard();

        // Outcome tiles, drop-off and the category / budget panels are only on this page, so they load here:
    // GET /outcomes, GET /flow-dropoff and GET /category-budget-picks.
    // The 5 metric cards always show All paths (GET /metric-cards with flow=all), whichever path tab is selected.
    const params = { from: filters.from, to: filters.to, flow: filters.path };
    const { data: page, error: pageError } = useDashboardQuery(
      () => Promise.all([
        service.getOutcomes(params),
        service.getFlowDropoff(params),
        service.getCategoryBudgetPicks(params),
        service.getMetricCards({ from: filters.from, to: filters.to, flow: "all" })
      ]).then(([outcomes, flowDropoff, categoryBudgetPicks, metricCards]) => ({ outcomes, flowDropoff, categoryBudgetPicks, metricCards })),
      [service, filters.from, filters.to, filters.path]
    );

    const { data: retarget, error: retargetError } = useDashboardQuery(
      () => service.getRetargetTemplates({ from: filters.from, to: filters.to }),
      [service, filters.from, filters.to]
    );

    if (loading && !summary) return <Loading />;
    if (error && !summary) return <ErrorState message={error} />;
    if (!page && pageError) return <ErrorState message={pageError} />;
    if (!page) return <Loading />;

    const path = filters.path;
    const all = path === "all";
    const has = (p) => all || path === p;
    const pathInfo = PATH_BY_ID[path];
    const m = page.metricCards; // GET /metric-cards, always All paths
    const o = page.outcomes; // GET /outcomes
    const trend = (outcome) => (outcome.trend || []).map((d) => ({ label: dayLabel(d.date), value: d.count }));
    const rangeLabel = RANGE_LABELS[filters.range] || "Selected range";

    // KPI cards
    const kpis = (
      <>
      <div className="kpi-grid five">
        {/* <MetricCard icon="📨" value={fmt(m.messagesSent)} label="Messages Sent" detail={`${rangeLabel} · ${fmt(m.messagesPerDay)} per day`} /> */}

              <MetricCard icon="📨" value={fmt(m.messagesSent)} label="Customers Messaged" detail={`Unique customers · ${rangeLabel} · ${fmt(m.messagesPerDay)} per day`} />
        <MetricCard icon="📩" value={fmt(m.messagesDelivered)} label="Total Delivered" detail={`of ${fmt(m.messagesSent)} sent`} />
        <MetricCard icon="📬" value={percent(m.deliveryRate)} label="Delivery Rate" detail={`${fmt(m.messagesDelivered)} delivered · ${fmt(m.messagesFailed)} failed`} />
        <MetricCard icon="📖" value={percent(m.openRate)} label="Open Rate" detail={`${fmt(m.readReceipts)} read receipts`} />
        <MetricCard icon="👆" value={percent(m.clickRate)} label="Click Rate" detail={`${fmt(m.openerTaps)} opener taps`} />
      </div>

  {m.karixSent != null && (
          <>
            <div className="sechead"><h2>Total sent by Karix</h2><span>All campaign templates · every message counted (resends included)</span></div>
            <div className="kpi-grid five">
              <MetricCard icon="📤" value={fmt(m.karixSent)} label="Total Messages Sent" detail={`${rangeLabel} · opener + cohort + occasion`} />
              {/* <MetricCard icon="📩" value={fmt(m.karixDelivered)} label="Messages Delivered" detail={`of ${fmt(m.karixSent)} sent`} /> */}
              {/* <MetricCard icon="📬" value={percent(m.karixDeliveryRate)} label="Delivery Rate" detail={`${fmt(m.karixFailed)} failed`} /> */}
              {/* <MetricCard icon="📖" value={fmt(m.karixRead)} label="Messages Read" detail="read receipts" />
              <MetricCard icon="⚠️" value={fmt(m.karixFailed)} label="Messages Failed" detail="Karix failed status" /> */}
            </div>
          </>
        )}
  </>

    );

    // Outcome tiles
    const referralsApply = has("celebrating") || has("shopping");
    const outcomes = (
      <>
        <div className="sechead"><h2>Outcomes</h2><span>Hover a trend for the daily count</span></div>
        <div className="tiles">
          <OutcomeTile hero chip="New" label="Referral leads"
            value={referralsApply ? fmt(o.referralLeads.total) : "–"}
            foot={referralsApply ? "Husbands & wives referred, with mobile" : "Sparkle path has no referral step"}
            points={referralsApply ? trend(o.referralLeads) : null} color="#7A1F3D" />
          <OutcomeTile label="Ishara sent to husbands"
            value={has("celebrating") ? fmt(o.isharaSent.total) : "–"}
            foot={has("celebrating") ? "From “I’m celebrating” customers" : "Celebrating path only"}
            points={has("celebrating") ? trend(o.isharaSent) : null} color="#C83474" />
          <OutcomeTile label="Store visits booked" value={fmt(o.storeVisitsBooked.total)} foot="Booked in the WhatsApp Flow"
            points={trend(o.storeVisitsBooked)} color="#16A34A" />
          <OutcomeTile label="Buy-online clicks"
            value={has("shopping") ? fmt(o.buyOnlineClicks.total) : "–"}
            foot={has("shopping") ? "From “Shopping for her” customers" : "Shopping-for-her path only"}
            points={has("shopping") ? trend(o.buyOnlineClicks) : null} color="#B7800F" />
        </div>
      </>
    );

    // Bot flow drop-off (GET /flow-dropoff → stages) + live feed
    const stages = page.flowDropoff.stages;
    const maxStep = Math.max(1, ...stages.map((f) => f.count));
    const dropoff = (
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="panel">
          <PanelHeader icon="🔻" title="Bot Flow Drop-off"
            subtitle={`Customers at each step of ${all ? "all three paths" : `the “${pathInfo.toggleLabel}” path`} · % of opener taps`} />
          <div className="drop px-4 pb-5 pt-[18px] sm:px-[22px]">
            {stages.map((f, i) => (
              <div key={f.step} className="drow">
                <div className="drow-label">{f.label}</div>
                <div className="drow-track" data-tip={`${f.label}\n${fmt(f.count)} · ${percent(f.pct)} of opener taps`}>
                  <span style={{ width: `${Math.max(3, (100 * f.count) / maxStep)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}>{fmt(f.count)}</span>
                </div>
                <div className="drow-value">{fmt(f.count)}<small>({percent(f.pct, 2)})</small></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeader icon="🕐" title="Activity Feed" subtitle="Real-time events" />
          <div className="px-4 pb-5 pt-[18px] sm:px-[22px]">
            <div className="live">LIVE FEED</div>
            <ActivityFeed />
          </div>
        </section>
      </div>
    );

    // Categories + budgets
    const scope = all ? "All three paths" : `“${pathInfo.toggleLabel}” path`;
    const catStep = path === "shopping" ? "2A" : all ? "1A / 2A" : "1A";
    const budStep = path === "shopping" ? "2A-Budget" : all ? "2A-Budget / 1A-Budget" : "1A-Budget";
      // GET /category-budget-picks. "I'm celebrating" has no budget step (flow script v7): the backend sends
    // budgets.applicable = false there, so the Budget panel is hidden. On All paths budgets come from the other two paths.
    const { categories, budgets } = page.categoryBudgetPicks;
    const showBudget = budgets.applicable;
    const budgetScope = all ? "“Shopping for her” + “Here for the sparkle” paths" : scope;

    const picks = (
      <div className={`grid items-start gap-5${showBudget ? " xl:grid-cols-2" : ""}`}>
        <section className="panel">
          <PanelHeader icon="💎" title="Categories Picked"
            subtitle={`${scope} · carousel taps at Step ${catStep}${path === "sparkle" ? " · Mia Sutra not shown on this path" : ""}`} />
          <div className="px-4 pb-5 pt-[18px] sm:px-[22px]"><Bars rows={categories.rows} color="#7A1F3D" /></div>
        </section>
        {showBudget && (
          <section className="panel">
            <PanelHeader icon="💰" title="Budget Chosen" subtitle={`${budgetScope} · list message at Step ${budStep}`} />
            <div className="px-4 pb-5 pt-[18px] sm:px-[22px]"><Bars rows={budgets.rows} color="#C9A15A" /></div>
          </section>
        )}
      </div>
    );

    // The three paths (All paths only). GET /paths → paths[]: one item per path, `flow` = celebrating / shopping / sparkle.
    const pathCards = Object.fromEntries(summary.paths.paths.map((c) => [c.flow, c]));
    const threePaths = all && (
      <>
        <div className="sechead"><h2>The three paths</h2><span>Chosen on the opener</span></div>
        <div className="panel">
          <div className="px-4 py-4 sm:px-[22px]">
            <div className="split">
              {PATHS.map((p) => (
                <div key={p.id} style={{ width: `${pathCards[p.id]?.share || 0}%`, background: p.color }}
                  data-tip={`${p.toggleLabel}\n${fmt(pathCards[p.id]?.openerTaps)} taps`} />
              ))}
            </div>
            <div className="legend">
              {PATHS.map((p) => (
                <span key={p.id}><i className="dot" style={{ background: p.color }} />{p.toggleLabel} <b className="tabular-nums">{percent(pathCards[p.id]?.share)}</b></span>
              ))}
            </div>
          </div>
        </div>
        <div className="pcards">
          {PATHS.map((p) => (
            <div key={p.id} className="pcard">
              <div className="pcard-head"><i className="dot" style={{ background: p.color }} />{p.toggleLabel}</div>
              <div className="pcard-goal">{PATH_GOALS[p.id]}</div>
              <div className="pstats">
                {PATH_CARD_STATS[p.id].map(([label, key]) => (
                  <div key={key} className="pstat">
                    <div className="pstat-value">{fmt(pathCards[p.id]?.[key])}</div>
                    <div className="pstat-label">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );

    // return (
    //   <>
    //     {kpis}
    //     {outcomes}
    //     {dropoff}
    //     {picks}
    //     {threePaths}
    //   </>
    // );

      return (
      <>
        {kpis}
        {outcomes}
        {dropoff}
        {picks}
        {threePaths}
        <section className="panel">
          <PanelHeader icon="🔁" title="Re-target Templates" subtitle="Cohort & occasion templates · unique customers" />
          <div className="px-4 pb-5 pt-[18px] sm:px-[22px]">
            <RetargetTemplates data={retarget} error={retargetError} />
          </div>
        </section>
      </>
    );
  }
