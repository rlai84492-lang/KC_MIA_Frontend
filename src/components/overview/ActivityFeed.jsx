import { useRef, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { usePolling } from "../../hooks/usePolling";
import { agoMinutes } from "../../utils/format";

const FEED_REFRESH_MS = 15000;

// GET /activity sends no event id yet, so an event is recognised by its time + sentence
// (used to highlight new events and as the list key). Switch to the id once the backend sends one.
const eventKey = (e) => `${e.timestamp}|${e.summary}`;

export default function ActivityFeed() {
  const { filters, service } = useDashboard();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const seen = useRef(null);
  const latestRequest = useRef(0);

  usePolling(async () => {
    const id = ++latestRequest.current;
    try {
      // GET /activity → { events: [{ badge, summary, path, timestamp, minutesAgo }] }, latest first
      const result = await service.getActivity({ from: filters.from, to: filters.to, flow: filters.path, limit: 20 });
      if (id !== latestRequest.current) return; // a newer request already answered
      const previous = seen.current;
      seen.current = new Set(result.events.map(eventKey));
      setRows(result.events.map((e) => ({ ...e, key: eventKey(e), isNew: Boolean(previous) && !previous.has(eventKey(e)) })));
      setError("");
    } catch (err) {
      if (id === latestRequest.current) setError(err.message || "Couldn’t load the feed.");
    }
  }, FEED_REFRESH_MS, [service, filters.path, filters.from, filters.to]);

  if (error && !rows) return <p className="muted m-0">Couldn’t load the activity feed. It will retry automatically.</p>;
  if (!rows) return <p className="muted m-0">Loading activity…</p>;
  if (!rows.length) return <p className="muted m-0">No activity yet on this path.</p>;

  return (
    <div className="feed">
      {rows.map((row) => (
        <div key={row.key} className={`ev k-${String(row.badge).toLowerCase()}${row.isNew ? " new" : ""}`}>
          <span className="ev-pin" aria-hidden="true" />
          <div className="ev-box">
            <div className="ev-top">
              <span className="ev-tag">{row.badge}</span>
              <span className="ev-time">{agoMinutes(row.minutesAgo)}</span>
            </div>
            <div className="ev-msg">{row.summary}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
