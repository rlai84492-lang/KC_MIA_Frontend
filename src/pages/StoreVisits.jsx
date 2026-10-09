import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import { useDashboardQuery } from "../hooks/useDashboardQuery";
import MetricCard from "../components/common/MetricCard";
import Loading from "../components/common/Loading";
import ErrorState from "../components/common/ErrorState";
import PanelHeader from "../components/common/PanelHeader";
import { CustomerCell, PathPill } from "../components/tables/TableParts";
import { Pager } from "../components/tables/TableKit";
import { agoMinutes, asIst, fmt, istDateTime, percent } from "../utils/format";

export default function StoreVisits() {
  const { filters, service } = useDashboard();

  // A new date range goes back to page 1.
  const filterKey = [filters.from, filters.to].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;

  // Store Visits always covers every path (the top toggle only offers "All paths" here).
  const params = { from: filters.from, to: filters.to, flow: "all" };

  // GET /store-visits/summary: the 3 cards.
  const { data: cards, error: cardsError } = useDashboardQuery(
    () => service.getStoreVisitsSummary(params),
    [service, filters.from, filters.to]
  );

  // GET /store-visits/bookings: newest first, 50 rows per page.
  const { data, error } = useDashboardQuery(
    () => service.getStoreVisitsBookings({ ...params, page }),
    [service, filterKey, page]
  );

  if ((!data && error) || (!cards && cardsError)) return <ErrorState message={error || cardsError} />;
  if (!data || !cards) return <Loading />;

  const slot = cards.mostPickedSlot;
  return (
    <>
      <div className="kpi-grid three">
        <MetricCard icon="📍" value={fmt(cards.visitsBooked)} label="Visits Booked" detail="WhatsApp Flow · Step C2" />
        <MetricCard icon="📅" value={fmt(cards.bookingFormOpened)} label="Booking Form Opened" detail={`${percent(cards.completedPct, 0)} completed`} />
        <MetricCard icon="⏰" value={slot.timeSlot || "–"} label="Most Picked Slot" detail={slot.timeSlot ? `${percent(slot.pctOfBookings, 0)} of bookings` : "No bookings yet"} />
      </div>

      <section className="panel">
        <PanelHeader icon="🧾" title="Recent Bookings"
          subtitle={`Confirmation reference is sent in the chat · ${fmt(data.totalElements)} bookings, newest first`} />
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Path</th>
                <th>Boutique</th>
                <th>Slot</th>
                <th>Reserved</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((v) => (
                <tr key={v.bookingId}>
                  <td><CustomerCell name={v.customerName} sub={<span title={istDateTime(asIst(v.bookedAt))}>{agoMinutes(v.minutesAgo)}</span>} /></td>
                  <td><PathPill path={v.flow} /></td>
                  <td>{v.storeName}</td>
                  <td className="mono">{v.slotLabel}</td>
                  <td>{v.reservedLabel || <span className="text-kc-ink3">—</span>}</td>
                  <td className="mono">{v.bookingRef}</td>
                </tr>
              ))}
              {!data.rows.length && (
                <tr><td colSpan={6}><div className="empty">No visits booked in this range.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={data.size} total={data.totalElements} onPage={(p) => setPageState({ key: filterKey, page: p })} />
      </section>
    </>
  );
}
