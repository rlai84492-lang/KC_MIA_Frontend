// All dashboard date ranges are calendar dates in India Standard Time (Asia/Kolkata).
// See dashboardContract.js → "Dates and time zone".
import { DATE_TIME_ZONE } from "../services/dashboardContract";

export const IST_TIME_ZONE = DATE_TIME_ZONE;

const istFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

// Date -> "YYYY-MM-DD" as the calendar date in IST (never UTC).
export function toIstDate(date) {
  return istFormatter.format(date);
}

// "YYYY-MM-DD" shifted by whole days. Pure calendar arithmetic, independent of the browser's time zone.
export function shiftIstDate(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Range of `days` IST calendar days ending today (IST), inclusive.
// days = 1 → Today, 7 → last 7 days, 30 → last 30 days.
export function istDateRange(days, anchor = new Date()) {
  const to = toIstDate(anchor);
  return { from: shiftIstDate(to, -(Number(days) - 1)), to };
}

// Inclusive IST day bounds as epoch milliseconds.
export function istDayStart(ymd) {
  return Date.parse(`${ymd}T00:00:00+05:30`);
}

export function istDayEnd(ymd) {
  return Date.parse(`${ymd}T23:59:59.999+05:30`);
}

// Every IST date from `from` to `to`, inclusive.
export function istDatesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = shiftIstDate(d, 1)) out.push(d);
  return out;
}
