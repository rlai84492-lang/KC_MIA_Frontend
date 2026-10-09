// Display formatting shared by every screen. All dates and times are shown in IST.
import { IST_TIME_ZONE, toIstDate } from "./istDates";

const numberFormat = new Intl.NumberFormat("en-IN");

export const RANGE_LABELS = { 1: "Today", 7: "7 Days", 30: "30 Days" };

// 12,345 (Indian digit grouping)
export const fmt = (n) => numberFormat.format(Math.round(Number(n) || 0));

// share of a in b, e.g. pct(15, 200) → "7.5%"
export const pct = (a, b, dp = 1) => (b ? `${((100 * a) / b).toFixed(dp)}%` : "0%");

// a percentage the backend already calculated (0–100), e.g. percent(94.3) → "94.3%"
export const percent = (value, dp = 1) => `${(Number(value) || 0).toFixed(dp)}%`;

// the backend's `minutesAgo` → "just now", "12m ago", "3h ago", "2d ago"
export function agoMinutes(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

const istDateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
});
const istDayFormat = new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, day: "numeric", month: "short", weekday: "short" });
const istTimeFormat = new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, hour: "2-digit", minute: "2-digit" });

// The backend sends IST times without a time zone ("2026-10-08T14:30:00"). This marks them as IST,
// so every browser reads them the same way. Times that already carry a zone are left as they are.
export const asIst = (t) => (t && !/(Z|[+-]\d\d:?\d\d)$/.test(t) ? `${t}+05:30` : t);

// "01 Oct, 04:30 pm"
export const istDateTime = (iso) => (iso ? istDateTimeFormat.format(new Date(iso)) : "");

// "04:30 pm"
export const istTime = (date = new Date()) => istTimeFormat.format(date);

// "YYYY-MM-DD" → "Today" or "Wed, 30 Sept"
export function dayLabel(ymd, today = toIstDate(new Date())) {
  return ymd === today ? "Today" : istDayFormat.format(new Date(`${ymd}T12:00:00+05:30`));
}

// "+919820012345" → "+91 98200 ••345". Full numbers are only shown in CSV downloads when asked for.
export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return phone || "";
  const local = digits.slice(-10);
  return `+91 ${local.slice(0, 5)} ••${local.slice(-3)}`;
}

// "+919820012345" → "+91 98200 12345"
export function fullPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone || "";
  const local = digits.slice(-10);
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
