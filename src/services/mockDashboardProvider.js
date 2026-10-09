// Mock implementation of the dashboard provider (sample data). Every method the pages use returns exactly the
// backend's shape, documented in dashboardContract.js, so apiDashboardProvider.js can replace it without screen changes.
//
// Raw mock data is messages + events (see src/data/mockData.js). Like the real backend, this provider
// derives sessions, referrals and store visits from the events, "as of now": anything with a timestamp
// in the future is not visible yet.

import { createMockDashboardData } from "../data/mockData";
import { AUDIENCE_SEGMENTS, BUDGETS, CATEGORIES, CATEGORY_CODES, CATEGORY_EXCLUDED_ON, PATHS, PATH_BY_ID, stepDef } from "../data/campaignConfig";
import { IST_TIME_ZONE, istDatesBetween, istDayEnd, istDayStart, toIstDate, shiftIstDate } from "../utils/istDates";
import { fullPhone, maskPhone } from "../utils/format";

const PATH_IDS = PATHS.map((p) => p.id);
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW = 60 * 60 * 1000; // matches the flow script's 1-hour IDLE re-engagement rule

let data;
let snap;

function getData() {
  if (!data) data = createMockDashboardData();
  return data;
}

// ───────── as-of-now projection (what the backend would have stored by now) ─────────

function snapshot() {
  const now = Date.now();
  // Recompute at most every 5 seconds.
  if (snap && now - snap.now < 5000) return snap;
  const raw = getData();

  const messages = [];
  const messageById = new Map();
  for (const m of raw.messages) {
    if (Date.parse(m.sentAt) > now) continue;
    const seen = (iso) => (iso && Date.parse(iso) <= now ? iso : null);
    const msg = { ...m, deliveredAt: seen(m.deliveredAt), readAt: seen(m.readAt), failedAt: seen(m.failedAt) };
    msg.status = msg.readAt ? "read" : msg.deliveredAt ? "delivered" : msg.failedAt ? "failed" : "sent";
    if (msg.status !== "failed") msg.failureReason = null;
    messages.push(msg);
    messageById.set(msg.messageId, msg);
  }

  const events = raw.events.filter((e) => Date.parse(e.timestamp) <= now);
  const { sessions, referrals, visits } = deriveFromEvents(events, messageById, now);

  snap = { now, messages, events, sessions, referrals, visits };
  return snap;
}

function deriveFromEvents(events, messageById, now) {
  const bySession = new Map();
  for (const e of events) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    bySession.get(e.sessionId).push(e);
  }

  const sessions = [];
  const referrals = [];
  const visits = [];

  for (const [sessionId, evs] of bySession) {
    evs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = evs[0];
    const msg = messageById.get(first.messageId);
    const s = {
      sessionId,
      userId: first.userId,
      messageId: first.messageId,
      customer: msg ? msg.customer : { name: "Unknown", firstName: "", lastName: "", phone: "" },
      path: first.path,
      pathLabel: PATH_BY_ID[first.path].shortLabel,
      flowStep: "0",
      flowStepLabel: "Opener",
      stepsReached: [],
      category: null,
      budget: null,
      product: null,
      pieces: [],
      piecesShortlisted: 0,
      hintCreated: false,
      hintSent: false,
      buyOnline: false,
      formOpened: false,
      visitBooked: false,
      detailsCaptured: false,
      consent: null,
      keepPosted: false,
      status: "Idle",
      createdAt: first.timestamp,
      lastActivityAt: evs[evs.length - 1].timestamp
    };
    let referral = null;

    for (const e of evs) {
      if (e.flowStep) {
        s.flowStep = e.flowStep;
        if (!s.stepsReached.includes(e.flowStep)) s.stepsReached.push(e.flowStep);
      }
      if (e.atStep && e.atStep !== "0" && !s.stepsReached.includes(e.atStep)) s.stepsReached.push(e.atStep);
      const md = e.metadata || {};
      switch (e.eventType) {
        case "CATEGORY_SELECTED": s.category = md.category; break;
        case "BUDGET_SELECTED": s.budget = md.budget; break;
        case "HINT_SENT": s.hintSent = true; break;
        case "STORE_VISIT_FORM_OPENED": s.formOpened = true; break;
        case "STORE_VISIT_BOOKED": {
          s.visitBooked = true;
          const bookedOn = toIstDate(new Date(e.timestamp));
          visits.push({
            visitId: md.visitId,
            ref: md.ref,
            sessionId,
            userId: s.userId,
            customerName: s.customer.name,
            phone: s.customer.phone,
            path: s.path,
            store: md.store,
            pinCode: md.pinCode,
            day: md.day,
            slot: md.slot,
            bookingDate: visitDate(bookedOn, md.day),
            reserved: md.reserved,
            product: md.reserved[0],
            createdAt: e.timestamp
          });
          break;
        }
        case "DETAILS_CAPTURED":
          s.detailsCaptured = true;
          referral = {
            referralId: `REF-${sessionId.slice(4)}`,
            sessionId,
            userId: s.userId,
            path: s.path,
            flowStep: e.atStep,
            customerName: s.customer.name,
            customerPhone: s.customer.phone,
            referredName: md.referredName,
            referredPhone: md.referredPhone,
            relationship: md.relationship,
            keyDateType: md.keyDateType,
            keyDate: md.keyDate,
            consent: null,
            status: "new",
            createdAt: e.timestamp
          };
          referrals.push(referral);
          break;
        case "BUTTON_CLICK":
          if (e.buttonId === "ADD_TO_LIST") { s.pieces.push(md.product); s.product = md.product; }
          if (e.buttonId === "BUY_THIS_FOR_HER") s.product = md.product;
          if (e.buttonId === "SEND_MY_ISHARA") s.hintCreated = true;
          if (e.buttonId === "BUY_ONLINE") s.buyOnline = true;
          if (e.buttonId === "KEEP_ME_POSTED") s.keepPosted = true;
          if (e.buttonId === "CONSENT_YES" || e.buttonId === "CONSENT_NO") {
            s.consent = e.buttonId === "CONSENT_YES";
            if (referral) referral.consent = s.consent;
          }
          break;
        default:
          break;
      }
    }

    s.piecesShortlisted = s.pieces.length;
    s.flowStepLabel = stepDef(s.path, s.flowStep)?.label || s.flowStep;
    const idleFor = now - Date.parse(s.lastActivityAt);
    s.status = s.flowStep === "E1" ? "Completed" : idleFor < ACTIVE_WINDOW ? "Active" : "Idle";
    if (referral) referral.status = mockReferralStatus(referral, now);
    sessions.push(s);
  }

  return { sessions, referrals, visits };
}

// "Today" / "Tomorrow" / "Sat" → the IST date the customer picked.
function visitDate(bookedOn, day) {
  if (day === "Today") return bookedOn;
  if (day === "Tomorrow") return shiftIstDate(bookedOn, 1);
  const weekday = new Date(`${bookedOn}T12:00:00+05:30`).getUTCDay();
  return shiftIstDate(bookedOn, ((6 - weekday + 7) % 7) || 7);
}

// Mock-only: the CRM follow-up status. The real value comes from the CRM, not from Karix.
function mockReferralStatus(r, now) {
  if (r.consent === false) return "no_consent";
  if (r.consent === null || now - Date.parse(r.createdAt) < DAY) return "new";
  let h = 0;
  for (const c of r.referralId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const roll = h % 100;
  return roll < 30 ? "new" : roll < 65 ? "reminder_scheduled" : roll < 90 ? "messaged" : "visited_store";
}

// ───────── filters ─────────

function rangeTest({ from, to } = {}) {
  const start = from ? istDayStart(from) : -Infinity;
  const end = to ? istDayEnd(to) : Infinity;
  return (iso) => {
    const t = Date.parse(iso);
    return t >= start && t <= end;
  };
}

const pathTest = (path) => (item) => !path || path === "all" || item.path === path;
const ratio = (a, b) => (b ? a / b : 0);
const countBy = (list, key) => list.reduce((acc, x) => { const k = key(x); if (k != null) acc[k] = (acc[k] || 0) + 1; return acc; }, {});
const distinctSessions = (events) => new Set(events.map((e) => e.sessionId)).size;
const isOpenerTap = (e) => e.eventType === "BUTTON_CLICK" && e.atStep === "0";
const clicked = (id) => (e) => e.eventType === "BUTTON_CLICK" && e.buttonId === id;
const ofType = (type) => (e) => e.eventType === type;

function paginate(rows, { page = 0, pageSize = 20 } = {}) {
  const size = Math.max(1, Math.min(Number(pageSize) || 20, 5000));
  const p = Math.max(0, Number(page) || 0);
  return { page: p, pageSize: size, rows: rows.slice(p * size, p * size + size) };
}

// ───────── funnel (Bot Flow Drop-off) ─────────

// Path funnels: customers who reached each step ("0 Opener" = opener taps on that path).
const PATH_FUNNEL_STEPS = {
  celebrating: ["1A", "1B", "1C", "1G", "1H", "1I", "1J", "1K"], // no budget step on this path (flow script v7)
  shopping: ["2A", "2A-Budget", "2B", "2C", "2E", "2F", "2G"],
  sparkle: ["1A", "1A-Budget", "1B", "1C", "C2", "1I"]
};

// Paths that ask for a budget (flow script v7: not "I'm celebrating").
const hasBudgetStep = (e) => e.path !== "celebrating";

function reachedSessions(events, codes) {
  return new Set(events.filter((e) => codes.includes(e.flowStep) || codes.includes(e.atStep)).map((e) => e.sessionId)).size;
}

function buildFunnel(path, evs) {
  if (path && path !== "all") {
    const pe = evs.filter((e) => e.path === path);
    return [
      { key: "0", label: "Opener", count: distinctSessions(pe.filter(isOpenerTap)) },
      ...PATH_FUNNEL_STEPS[path].map((code) => ({ key: code, label: stepDef(path, code).label, count: reachedSessions(pe, [code]) }))
    ];
  }
  // All paths: the same positions summed across paths (wife/sparkle "1x" + husband "2x").
  const at = (codes) => reachedSessions(evs, codes);
  return [
    { key: "opener", label: "Opener Tapped", count: distinctSessions(evs.filter(isOpenerTap)) },
    { key: "category", label: "Category", count: at(["1A", "2A"]) },
    // Budget: "Shopping for her" + "Here for the sparkle" only ("I'm celebrating" has no budget step).
    { key: "budget", label: "Budget (Shopping for her + Sparkle)", count: reachedSessions(evs.filter(hasBudgetStep), ["1A-Budget", "2A-Budget"]) },
    { key: "carousel", label: "Carousel", count: at(["1B", "2B"]) },
    { key: "piece", label: "Added / Chose Piece", count: at(["1C", "2C"]) },
    { key: "hint", label: "Ishara Sent", count: distinctSessions(evs.filter(ofType("HINT_SENT"))) },
    { key: "visit", label: "Store Visit Booked", count: distinctSessions(evs.filter(ofType("STORE_VISIT_BOOKED"))) },
    { key: "referral", label: "Referral Leads", count: evs.filter(ofType("DETAILS_CAPTURED")).length }
  ];
}

// ───────── provider ─────────

// Sample-data version of the backend's activity `summary` sentence.
function feedSentence(r) {
  const d = r.details || {};
  const name = r.customerName;
  switch (r.kind) {
    case "hint": {
      const n = (d.pieces || []).length;
      return `${name} sent her Ishara to her husband (${n} ${n === 1 ? "piece" : "pieces"})`;
    }
    case "visit":
      return `${name} booked a visit · ${d.store}, ${d.day} ${d.slot}`;
    case "buy":
      return `${name} tapped Buy Online · ${d.product}`;
    case "lead":
      return d.relationship === "Wife" ? `${name} referred his wife · birthday + mobile` : `${name} referred her husband · anniversary + mobile`;
    default:
      if (r.eventType === "BUDGET_SELECTED") return `${name} picked ${d.category} · ${d.budget}`;
      if (r.buttonId === "ADD_TO_LIST") return `${name} added ${d.product} to her list`;
      return `${name} tapped “${PATH_BY_ID[r.path]?.toggleLabel || r.buttonLabel}”`;
  }
}

// Percentages with one / two decimals (0–100), the same way the backend rounds them.
const pct1 = (a, b) => (b ? Math.round((a * 1000) / b) / 10 : 0);
const pct2 = (a, b) => (b ? Math.round((a * 10000) / b) / 100 : 0);
// ───────── Conversations (sample data in the backend's shape) ─────────

// The sessions the backend's Conversations page lists: started in the range, on the path.
function conversationSessions(params = {}) {
  const inRange = rangeTest(params);
  return snapshot().sessions.filter((x) => inRange(x.createdAt) && pathTest(params.flow)(x));
}

// The table filters and sort, with the backend's parameter names: category, step, search, sort, direction.
function filterConversations(params = {}) {
  let rows = conversationSessions(params);
  if (params.category && params.category !== "all") rows = rows.filter((x) => CATEGORY_CODES[x.category] === params.category);
  if (params.step && params.step !== "all") rows = rows.filter((x) => x.flowStep === params.step);
  if (params.search) {
    const text = String(params.search).toLowerCase();
    const digits = text.replace(/\D/g, "");
    rows = rows.filter((x) => x.customer.name.toLowerCase().includes(text) || (digits && x.customer.phone.includes(digits)));
  }
  const sortValue = {
    customer: (x) => x.customer.name,
    phone: (x) => x.customer.phone,
    path: (x) => x.path,
    step: (x) => x.flowStep,
    category: (x) => x.category || "",
    budget: (x) => x.budget || "",
    lastActivity: (x) => x.lastActivityAt
  }[params.sort || "lastActivity"];
  const dir = params.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sortValue(a).localeCompare(sortValue(b)) * dir);
}

const CONVERSATIONS_PAGE_SIZE = 50;
const showBudgetFor = (flow) => flow !== "celebrating";

// "08-10-2026 14:30" in IST, like the backend's export.
const exportTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});
function exportTime(iso) {
  const p = Object.fromEntries(exportTimeFormat.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

// ───────── Referral Leads (sample data in the backend's shape) ─────────

const REFERRAL_PAGE_SIZE = 50;

// The backend's `show` values → the sample-data filters.
const referralShowParams = (show) => ({
  husbands: { relationship: "Husband" },
  wives: { relationship: "Wife" },
  consented: { consent: "yes" }
}[show] || {});

// "Anniversary 05/05" / "Birthday 06/01", like the backend.
const keyDateLabel = (x) => (x.keyDate ? `${x.keyDateType} ${x.keyDate.slice(8, 10)}/${x.keyDate.slice(5, 7)}` : "");

// ───────── Store Visits (sample data in the backend's shape) ─────────

const BOOKINGS_PAGE_SIZE = 50;

// "Today, 4:00 pm" / "Tomorrow, 6:30 pm" / "Sat, 12:30 pm" (within a week) / "18 Oct, 11:00 am", like the backend.
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
function slotLabel(visitDate, timeSlot) {
  const date = new Date(`${visitDate}T00:00:00Z`);
  const daysAhead = Math.round((date - new Date(`${toIstDate(new Date())}T00:00:00Z`)) / 86400000);
  const day = daysAhead === 0 ? "Today" : daysAhead === 1 ? "Tomorrow"
    : daysAhead > 1 && daysAhead < 7 ? weekdayFormat.format(date) : dayMonthFormat.format(date);
  return timeSlot ? `${day}, ${timeSlot}` : day;
}
// ───────── Cohorts (sample data in the backend's shape) ─────────

const COHORTS_STOPPED = ["hint-sent-no-visit", "list-started-no-hint", "browsing-no-purchase", "shortlisted-no-visit"];
const COHORTS_COMPLETED = ["store-visit-booked", "clicked-buy-online", "referred-consent-given", "opted-in-new-arrivals"];
const exportPhone = (phone, fullMobile) => (phone ? (fullMobile ? fullPhone(phone) : maskPhone(phone)) : "");
const byNewest = (key) => (a, b) => b[key].localeCompare(a[key]);

// One cohort's download, like the backend: { columns, rows }, each row keyed by its column header.
// Mobiles are full only when fullMobile is true (the "Full mobile numbers in downloads" box).
function cohortDownload(key, params = {}) {
  const s = snapshot();
  const inRange = rangeTest(params);
  const full = params.fullMobile === true || params.fullMobile === "true";
  const pathName = (p) => PATH_BY_ID[p]?.shortLabel || "";
  const members = (id) => audienceMembers(params).filter((m) => m.segmentId === id).sort(byNewest("lastActiveAt"));

  if (COHORTS_STOPPED.includes(key)) {
    return {
      columns: ["Customer", "Mobile", "Path", "Step", "Category", "Budget", "Pieces on List", "Started At", "Last Activity"],
      rows: members(key).map((m) => ({
        "Customer": m.customerName,
        "Mobile": exportPhone(m.mobile, full),
        "Path": pathName(m.path),
        "Step": `${m.stepCode} · ${m.lastStep}`,
        "Category": m.category || "",
        "Budget": m.budget || "",
        "Pieces on List": String(m.piecesShortlisted || 0),
        "Started At": exportTime(m.startedAt),
        "Last Activity": exportTime(m.lastActiveAt)
      }))
    };
  }
  switch (key) {
    case "store-visit-booked":
      return {
        columns: ["Customer", "Mobile", "Path", "Boutique", "Slot", "Reserved", "Booking Ref", "Booked At"],
        rows: s.visits.filter((v) => inRange(v.createdAt)).sort(byNewest("createdAt")).map((v) => ({
          "Customer": v.customerName,
          "Mobile": exportPhone(v.phone, full),
          "Path": pathName(v.path),
          "Boutique": v.store,
          "Slot": slotLabel(v.bookingDate, v.slot),
          "Reserved": v.reserved.length > 1 ? "Wishlist" : v.reserved[0] || "",
          "Booking Ref": v.ref,
          "Booked At": exportTime(v.createdAt)
        }))
      };
    case "clicked-buy-online":
      return {
        columns: ["Customer", "Mobile", "Path", "Product", "SKU", "Clicked At"],
        rows: members(key).map((m) => ({
          "Customer": m.customerName,
          "Mobile": exportPhone(m.mobile, full),
          "Path": pathName(m.path),
          "Product": m.piece || "",
          "SKU": "",
          "Clicked At": exportTime(m.lastActiveAt)
        }))
      };
    case "referred-consent-given":
      return {
        columns: ["Referred By", "Mobile", "Path", "Referred Contact", "Relation", "Contact Mobile", "Key Date", "Consent", "Captured At"],
        rows: s.referrals.filter((r) => inRange(r.createdAt) && r.consent === true).sort(byNewest("createdAt")).map((r) => ({
          "Referred By": r.customerName,
          "Mobile": exportPhone(r.customerPhone, full),
          "Path": pathName(r.path),
          "Referred Contact": r.referredName,
          "Relation": r.relationship,
          "Contact Mobile": exportPhone(r.referredPhone, full),
          "Key Date": keyDateLabel(r),
          "Consent": "Yes",
          "Captured At": exportTime(r.createdAt)
        }))
      };
    case "opted-in-new-arrivals":
      return {
        columns: ["Customer", "Mobile", "Path", "Opted In At"],
        rows: members(key).map((m) => ({
          "Customer": m.customerName,
          "Mobile": exportPhone(m.mobile, full),
          "Path": pathName(m.path),
          "Opted In At": exportTime(m.lastActiveAt)
        }))
      };
    default:
      throw new Error(`Unknown cohort "${key}".`);
  }
}

// A card as the backend describes it: key, label, flows, priority.
function cohortCard(key) {
  const g = AUDIENCE_SEGMENTS.find((x) => x.id === key);
  return { key, label: g.name, flows: g.paths, priority: g.priority ?? null };
}

export const mockDashboardProvider = {
  // ── Overview in the backend's exact shapes: GET /metric-cards, /outcomes, /flow-dropoff, /paths, /activity.
  //    Built from the sample-data methods further down. ──
  async getMetricCards(params = {}) {
    const s = await this.getSummary({ ...params, path: params.flow });
    return {
      messagesSent: s.sent,
      messagesPerDay: Math.round(s.sent / Math.max(1, s.days)),
      messagesDelivered: s.delivered,
      messagesFailed: s.failed,
      deliveryRate: pct1(s.delivered, s.sent),
      readReceipts: s.read,
      openRate: pct1(s.read, s.delivered),
      openerTaps: s.openerTaps,
      clickRate: pct1(s.openerTaps, s.delivered),
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async getOutcomes(params = {}) {
    const s = await this.getSummary({ ...params, path: params.flow });
    const flow = params.flow || "all";
    const all = flow === "all";
    const trend = (key) => s.daily.map((d) => ({ date: d.date, count: d[key] }));
    const notApplicable = { total: null, trend: [] };
    return {
      referralLeads: flow === "sparkle" ? notApplicable : {
        total: s.outcomes.referralLeads,
        husbandsReferred: s.outcomes.husbandsReferred,
        wivesReferred: s.outcomes.wivesReferred,
        trend: trend("referralLeads")
      },
      isharaSent: all || flow === "celebrating" ? { total: s.outcomes.hintsSent, trend: trend("hintsSent") } : notApplicable,
      storeVisitsBooked: { total: s.outcomes.visitsBooked, trend: trend("visitsBooked") },
      buyOnlineClicks: all || flow === "shopping" ? { total: s.outcomes.buyOnlineClicks, trend: trend("buyOnlineClicks") } : notApplicable,
      flow,
      range: "custom"
    };
  },

  async getFlowDropoff(params = {}) {
    const s = await this.getSummary({ ...params, path: params.flow });
    const base = s.funnel[0]?.count || 0;
    return {
      stages: s.funnel.map((f) => ({ step: f.key, label: f.label, count: f.count, pct: pct2(f.count, base) })),
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async getPaths(params = {}) {
    const s = await this.getSummary({ ...params, path: "all" });
    const taps = (flow) => s.pathCounts[flow] || 0;
    const total = taps("celebrating") + taps("shopping") + taps("sparkle");
    const card = (flow) => ({ flow, openerTaps: taps(flow), share: pct1(taps(flow), total) });
    const st = s.pathStats;
    return {
      totalOpenerTaps: total,
      paths: [
        { ...card("celebrating"), isharaSent: st.celebrating.hintsSent, visitsBooked: st.celebrating.visitsBooked, husbandsReferred: st.celebrating.husbandsReferred },
        { ...card("shopping"), buyOnlineClicks: st.shopping.buyOnlineClicks, visitsBooked: st.shopping.visitsBooked, wivesReferred: st.shopping.wivesReferred },
        { ...card("sparkle"), piecesShortlisted: st.sparkle.piecesShortlisted, visitsBooked: st.sparkle.visitsBooked, keepMePosted: st.sparkle.keepPosted }
      ],
      range: "custom"
    };
  },

    async getCategoryBudgetPicks(params = {}) {
    const flow = params.flow || "all";
    const s = await this.getSummary({ ...params, path: flow });
    // One panel like the backend's: a row per option in display order (0 when nobody picked it) + the total.
    const panel = (options, counts) => {
      const total = options.reduce((n, o) => n + (counts[o.label] || 0), 0);
      const rows = options.map((o) => ({ key: o.key, label: o.label, customers: counts[o.label] || 0, pct: pct1(counts[o.label] || 0, total) }));
      return { total, rows };
    };
    const excluded = CATEGORY_EXCLUDED_ON[flow] || [];
    const categories = CATEGORIES.filter((c) => !excluded.includes(c)).map((label) => ({ key: CATEGORY_CODES[label], label }));
    const budgetCodes = ["UNDER_20K", "20_50K", "ABOVE_50K"]; // the backend's budget codes, in BUDGETS order
    const budgets = BUDGETS.map((label, i) => ({ key: budgetCodes[i], label }));
    const applicable = flow !== "celebrating";
    return {
      categories: panel(categories, s.categoryCounts),
      budgets: { ...panel(budgets, applicable ? s.budgetCounts : {}), applicable },
      flow,
      range: "custom"
    };
  },

  async getActivity(params = {}) {
    const feed = await this.getActivityFeed({ path: params.flow, limit: params.limit });
    const badge = { msg: "MSG", hint: "ISHARA", visit: "VISIT", buy: "BUY", lead: "REFERRAL" };
    const now = Date.now();
    return {
      events: feed.rows.map((r) => ({
        badge: badge[r.kind],
        summary: feedSentence(r),
        path: r.path,
        timestamp: r.timestamp,
        minutesAgo: Math.floor((now - Date.parse(r.timestamp)) / 60000)
      })),
      flow: params.flow || "all"
    };
  },
  // ── Sample-data building blocks. The pages never call these: the backend-shaped methods above and below use them. ──

  async getSummary(params = {}) {
    const s = snapshot();
    const inRange = rangeTest(params);
    const onPath = pathTest(params.path);

    const msgs = s.messages.filter((m) => inRange(m.sentAt));
    const delivered = msgs.filter((m) => m.status === "delivered" || m.status === "read");
    const read = msgs.filter((m) => m.status === "read");
    const failed = msgs.filter((m) => m.status === "failed");

    const evsAll = s.events.filter((e) => inRange(e.timestamp));
    const evs = evsAll.filter(onPath);
    const sessions = s.sessions.filter((x) => inRange(x.lastActivityAt) && onPath(x));
    const openerTaps = evs.filter(isOpenerTap).length;

    const outcomeCounts = (list) => ({
      referralLeads: list.filter(ofType("DETAILS_CAPTURED")).length,
      husbandsReferred: list.filter((e) => e.eventType === "DETAILS_CAPTURED" && e.path === "celebrating").length,
      wivesReferred: list.filter((e) => e.eventType === "DETAILS_CAPTURED" && e.path === "shopping").length,
      consentGiven: list.filter(clicked("CONSENT_YES")).length,
      hintsCreated: list.filter(clicked("SEND_MY_ISHARA")).length,
      hintsSent: list.filter(ofType("HINT_SENT")).length,
      bookingFormsOpened: list.filter(ofType("STORE_VISIT_FORM_OPENED")).length,
      visitsBooked: list.filter(ofType("STORE_VISIT_BOOKED")).length,
      buyOnlineClicks: list.filter(clicked("BUY_ONLINE")).length,
      keepPosted: list.filter(clicked("KEEP_ME_POSTED")).length,
      piecesShortlisted: list.filter(clicked("ADD_TO_LIST")).length
    });

    const days = istDatesBetween(params.from || toIstDate(new Date(s.now)), params.to || toIstDate(new Date(s.now)));
    const daily = days.map((date) => {
      const inDay = rangeTest({ from: date, to: date });
      const dm = msgs.filter((m) => inDay(m.sentAt));
      const de = evs.filter((e) => inDay(e.timestamp));
      const o = outcomeCounts(de);
      return {
        date,
        sent: dm.length,
        delivered: dm.filter((m) => m.status === "delivered" || m.status === "read").length,
        read: dm.filter((m) => m.status === "read").length,
        openerTaps: de.filter(isOpenerTap).length,
        referralLeads: o.referralLeads,
        hintsSent: o.hintsSent,
        visitsBooked: o.visitsBooked,
        buyOnlineClicks: o.buyOnlineClicks
      };
    });

    const pathStats = Object.fromEntries(PATH_IDS.map((p) => {
      const pe = evsAll.filter((e) => e.path === p);
      return [p, { openerTaps: pe.filter(isOpenerTap).length, ...outcomeCounts(pe) }];
    }));

    return {
      source: "mock",
      generatedAt: new Date(s.now).toISOString(),
      from: params.from,
      to: params.to,
      days: days.length,
      totalSessions: sessions.length,
      uniqueUsers: new Set(sessions.map((x) => x.userId)).size,
      sent: msgs.length,
      delivered: delivered.length,
      undelivered: failed.length,
      failed: failed.length,
      read: read.length,
      deliveryRate: ratio(delivered.length, msgs.length),
      readRate: ratio(read.length, delivered.length),
      openerTaps,
      openerTapRate: ratio(openerTaps, delivered.length),
      activeSessions: sessions.filter((x) => x.status === "Active").length,
      completedSessions: sessions.filter((x) => x.status === "Completed").length,
      referrals: evs.filter(ofType("DETAILS_CAPTURED")).length,
      storeVisits: evs.filter(ofType("STORE_VISIT_BOOKED")).length,
      buttonCounts: countBy(evs.filter(ofType("BUTTON_CLICK")), (e) => e.buttonId),
      pathCounts: Object.fromEntries(PATH_IDS.map((p) => [p, evsAll.filter((e) => e.path === p && isOpenerTap(e)).length])),
      categoryCounts: countBy(evs.filter(ofType("CATEGORY_SELECTED")), (e) => e.metadata.category),
      budgetCounts: countBy(evs.filter((e) => e.eventType === "BUDGET_SELECTED" && hasBudgetStep(e)), (e) => e.metadata.budget),
      outcomes: outcomeCounts(evs),
      funnel: buildFunnel(params.path, evs),
      daily,
      pathStats
    };
  },

    // ── Conversations in the backend's exact shapes: GET /conversations/summary, /conversations, /conversations/export. ──
  async getConversationsSummary(params = {}) {
    const scoped = conversationSessions(params);
    return {
      totalSessions: scoped.length,
      enteredDiscovery: scoped.filter((x) => x.category).length,
      carouselReached: scoped.filter((x) => x.stepsReached.includes("1B") || x.stepsReached.includes("2B")).length,
      isharaSent: scoped.filter((x) => x.hintSent).length,
      visitsBooked: scoped.filter((x) => x.visitBooked).length,
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async getConversations(params = {}) {
    const rows = filterConversations(params);
    const page = Math.max(0, Number(params.page) || 0);
    const showBudget = showBudgetFor(params.flow);
    const now = Date.now();
    return {
      rows: rows.slice(page * CONVERSATIONS_PAGE_SIZE, (page + 1) * CONVERSATIONS_PAGE_SIZE).map((x) => ({
        sessionId: x.sessionId,
        customerName: x.customer.name,
        phone: maskPhone(x.customer.phone),
        flow: x.path,
        pathLabel: PATH_BY_ID[x.path].shortLabel,
        stepCode: x.flowStep,
        stepLabel: x.flowStepLabel,
        status: x.status,
        category: CATEGORY_CODES[x.category] || null,
        categoryLabel: x.category,
        ...(showBudget ? { budget: x.budget, budgetLabel: x.budget } : {}),
        startedAt: x.createdAt,
        lastActivity: x.lastActivityAt,
        minutesAgo: Math.floor((now - Date.parse(x.lastActivityAt)) / 60000)
      })),
      showBudget,
      page,
      size: CONVERSATIONS_PAGE_SIZE,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / CONVERSATIONS_PAGE_SIZE),
      flow: params.flow || "all",
      range: "custom",
      sort: params.sort || "lastActivity",
      direction: params.direction || "desc"
    };
  },

  async exportConversations(params = {}) {
    const rows = filterConversations(params);
    const showBudget = showBudgetFor(params.flow);
    const columns = ["Customer", "Phone", "Path", "Step", "Status", "Category", "Budget", "Started At", "Last Activity"]
      .filter((c) => showBudget || c !== "Budget");
    return {
      columns,
      rows: rows.map((x) => ({
        "Customer": x.customer.name,
        "Phone": fullPhone(x.customer.phone),
        "Path": PATH_BY_ID[x.path].shortLabel,
        "Step": `${x.flowStep} · ${x.flowStepLabel}`,
        "Status": x.status,
        "Category": x.category || "",
        ...(showBudget ? { "Budget": x.budget || "" } : {}),
        "Started At": exportTime(x.createdAt),
        "Last Activity": exportTime(x.lastActivityAt)
      })),
      scope: "all",
      totalElements: rows.length,
      exportedRows: rows.length,
      flow: params.flow || "all",
      range: "custom"
    };
  },
  // ── Referral Leads in the backend's exact shapes: GET /referral-leads/summary, /referral-leads, /referral-leads/export.
  //    Built from the sample-data getReferrals further down. ──
  async getReferralLeadsSummary(params = {}) {
    const flow = params.flow || "all";
    const r = await this.getReferrals({ ...params, path: flow, page: 0, pageSize: 1 });
    const k = r.kpis;
    const all = flow === "all";
    return {
      referralLeads: k.referralLeads,
      husbandsReferred: all || flow === "celebrating" ? k.husbandsReferred : null,
      wivesReferred: all || flow === "shopping" ? k.wivesReferred : null,
      consentGivenPct: k.referralLeads ? Math.round((100 * k.consentGiven) / k.referralLeads) : 0,
      canBeMessaged: k.consentGiven,
      isharaForwards: all || flow === "celebrating" ? k.hintsSent : null,
      optInLeads: {
        optedIn: r.optIn.keepPosted,
        pctOfSparkleOpenerTaps: pct1(r.optIn.keepPosted, r.optIn.sparkleOpenerTaps),
        sparkleOpenerTaps: r.optIn.sparkleOpenerTaps,
        optedOut: null // not in the sample data
      },
      flow,
      range: "custom"
    };
  },

  async getReferralLeads(params = {}) {
    const page = Math.max(0, Number(params.page) || 0);
    const r = await this.getReferrals({ ...params, ...referralShowParams(params.show), path: params.flow, page, pageSize: REFERRAL_PAGE_SIZE });
    const now = Date.now();
    return {
      rows: r.rows.map((x) => ({
        leadId: x.referralId,
        referredBy: x.customerName,
        flow: x.path,
        pathLabel: PATH_BY_ID[x.path].shortLabel,
        capturedAt: x.createdAt,
        minutesAgo: Math.floor((now - Date.parse(x.createdAt)) / 60000),
        contactName: x.referredName,
        contactStep: x.relationship === "Husband" ? "1J" : "2F",
        relation: x.relationship,
        mobile: maskPhone(x.referredPhone),
        keyDateType: x.keyDateType.toUpperCase(),
        keyDate: x.keyDate,
        keyDateLabel: keyDateLabel(x),
        consent: x.consent === true ? "YES" : x.consent === false ? "NO" : null,
        consentLabel: x.consent === true ? "Yes" : x.consent === false ? "No" : "",
        status: x.consent === true ? "NEW" : "CONSENT_NOT_GIVEN",
        statusLabel: x.consent === true ? "New" : "Consent not given"
      })),
      page,
      size: REFERRAL_PAGE_SIZE,
      totalElements: r.total,
      totalPages: Math.ceil(r.total / REFERRAL_PAGE_SIZE),
      show: params.show || "all",
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async exportReferralLeads(params = {}) {
    const r = await this.getReferrals({ ...params, ...referralShowParams(params.show), path: params.flow, page: 0, pageSize: 5000 });
    return {
      columns: ["Referred By", "Path", "Referred Contact", "Relation", "Mobile", "Key Date", "Consent", "Status", "Captured At"],
      rows: r.rows.map((x) => ({
        "Referred By": x.customerName,
        "Path": PATH_BY_ID[x.path].shortLabel,
        "Referred Contact": x.referredName,
        "Relation": x.relationship,
        "Mobile": fullPhone(x.referredPhone),
        "Key Date": keyDateLabel(x),
        "Consent": x.consent === true ? "Yes" : x.consent === false ? "No" : "",
        "Status": x.consent === true ? "New" : "Consent not given",
        "Captured At": exportTime(x.createdAt)
      })),
      scope: "all",
      totalElements: r.total,
      exportedRows: r.rows.length,
      show: params.show || "all",
      flow: params.flow || "all",
      range: "custom"
    };
  },


  async getReferrals(params = {}) {
    const s = snapshot();
    const inRange = rangeTest(params);
    const onPath = pathTest(params.path);
    const scoped = s.referrals.filter((r) => inRange(r.createdAt) && onPath(r));
    const evs = s.events.filter((e) => inRange(e.timestamp));

    const consentGiven = scoped.filter((r) => r.consent === true).length;
    const sparkleTaps = evs.filter((e) => e.path === "sparkle" && isOpenerTap(e)).length;
    const keepPosted = evs.filter(clicked("KEEP_ME_POSTED")).length;

    let rows = scoped;
    if (params.relationship && params.relationship !== "all") rows = rows.filter((r) => r.relationship === params.relationship);
    if (params.consent === "yes") rows = rows.filter((r) => r.consent === true);
    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      source: "mock",
      total: rows.length,
      kpis: {
        referralLeads: scoped.length,
        husbandsReferred: scoped.filter((r) => r.relationship === "Husband").length,
        wivesReferred: scoped.filter((r) => r.relationship === "Wife").length,
        consentGiven,
        consentRate: ratio(consentGiven, scoped.length),
        hintsSent: evs.filter((e) => onPath(e) && e.eventType === "HINT_SENT").length
      },
      optIn: { keepPosted, sparkleOpenerTaps: sparkleTaps, keepPostedRate: ratio(keepPosted, sparkleTaps) },
      ...paginate(rows, { page: params.page, pageSize: params.pageSize || 40 })
    };
  },
    // ── Store Visits in the backend's exact shapes: GET /store-visits/summary, /store-visits/bookings.
  //    Built from the sample-data getStoreVisits further down. ──
  async getStoreVisitsSummary(params = {}) {
    const v = await this.getStoreVisits({ ...params, path: params.flow, page: 0, pageSize: 1 });
    const k = v.kpis;
    return {
      visitsBooked: k.visitsBooked,
      bookingFormOpened: k.bookingFormsOpened,
      completedPct: pct1(k.visitsBooked, k.bookingFormsOpened),
      mostPickedSlot: {
        timeSlot: k.topSlot,
        bookings: Math.round(k.topSlotShare * k.visitsBooked),
        pctOfBookings: Math.round(k.topSlotShare * 1000) / 10
      },
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async getStoreVisitsBookings(params = {}) {
    const page = Math.max(0, Number(params.page) || 0);
    const v = await this.getStoreVisits({ ...params, path: params.flow, page, pageSize: BOOKINGS_PAGE_SIZE });
    const now = Date.now();
    return {
      rows: v.rows.map((x) => ({
        bookingId: x.visitId,
        bookingRef: x.ref,
        customerName: x.customerName,
        phone: maskPhone(x.phone),
        flow: x.path,
        pathLabel: PATH_BY_ID[x.path].shortLabel,
        storeName: x.store,
        visitDate: x.bookingDate,
        timeSlot: x.slot,
        slotLabel: slotLabel(x.bookingDate, x.slot),
        reservedLabel: x.reserved.length > 1 ? "Wishlist" : x.reserved[0] || null,
        reservedSkus: x.reserved,
        status: "BOOKED",
        bookedAt: x.createdAt,
        minutesAgo: Math.floor((now - Date.parse(x.createdAt)) / 60000)
      })),
      page,
      size: BOOKINGS_PAGE_SIZE,
      totalElements: v.total,
      totalPages: Math.ceil(v.total / BOOKINGS_PAGE_SIZE),
      flow: params.flow || "all",
      range: "custom"
    };
  },

  async getStoreVisits(params = {}) {
    const s = snapshot();
    const inRange = rangeTest(params);
    const onPath = pathTest(params.path);
    const rows = s.visits.filter((v) => inRange(v.createdAt) && onPath(v)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const formOpened = s.events.filter((e) => inRange(e.timestamp) && onPath(e) && e.eventType === "STORE_VISIT_FORM_OPENED").length;
    const slots = Object.entries(countBy(rows, (v) => v.slot)).sort((a, b) => b[1] - a[1]);

    return {
      source: "mock",
      total: rows.length,
      kpis: {
        visitsBooked: rows.length,
        bookingFormsOpened: formOpened,
        completionRate: ratio(rows.length, formOpened),
        topSlot: slots[0] ? slots[0][0] : null,
        topSlotShare: slots[0] ? ratio(slots[0][1], rows.length) : 0
      },
      ...paginate(rows, { page: params.page, pageSize: params.pageSize || 15 })
    };
  },

  async getActivityFeed(params = {}) {
    const s = snapshot();
    const onPath = pathTest(params.path);
    const sessionById = new Map(s.sessions.map((x) => [x.sessionId, x]));
    const kindOf = (e) => {
      if (isOpenerTap(e) || e.eventType === "BUDGET_SELECTED" || (e.eventType === "BUTTON_CLICK" && e.buttonId === "ADD_TO_LIST")) return "msg";
      if (e.eventType === "HINT_SENT") return "hint";
      if (e.eventType === "STORE_VISIT_BOOKED") return "visit";
      if (e.eventType === "BUTTON_CLICK" && e.buttonId === "BUY_ONLINE") return "buy";
      if (e.eventType === "DETAILS_CAPTURED") return "lead";
      return null;
    };
    const rows = [];
    for (let i = s.events.length - 1; i >= 0; i -= 1) {
      const e = s.events[i];
      const kind = kindOf(e);
      if (!kind || !onPath(e)) continue;
      const session = sessionById.get(e.sessionId);
      rows.push({
        eventId: e.eventId,
        kind,
        eventType: e.eventType,
        buttonId: e.buttonId,
        buttonLabel: e.buttonLabel,
        timestamp: e.timestamp,
        path: e.path,
        flowStep: e.flowStep,
        customerName: session ? session.customer.name : "",
        details: { ...e.metadata, category: e.metadata.category || session?.category || null }
      });
    }
    rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { source: "mock", rows: rows.slice(0, Math.min(Number(params.limit) || 20, 100)) };
  },
    // ── Cohorts in the backend's exact shapes: GET /cohorts/summary and one GET /cohorts/<key> per card. ──
  async getCohortsSummary(params = {}) {
    const card = (key) => ({ ...cohortCard(key), count: cohortDownload(key, params).rows.length });
    const stopped = COHORTS_STOPPED.map(card);
    const completed = COHORTS_COMPLETED.map(card);
    const sum = (list) => list.reduce((a, c) => a + c.count, 0);
    return {
      engagedNotFinished: sum(stopped),
      completedOrOptedIn: sum(completed),
      whereTheyStopped: { total: sum(stopped), segments: stopped },
      completedOrOptedInSegments: { total: sum(completed), segments: completed },
      range: "custom"
    };
  },

  async getCohortSegment(key, params = {}) {
    const card = cohortCard(key);
    const download = cohortDownload(key, params);
    return {
      segment: key,
      label: card.label,
      flows: card.flows,
      priority: card.priority,
      count: download.rows.length,
      columns: download.columns,
      rows: download.rows,
      exportedRows: download.rows.length,
      fullMobile: params.fullMobile === true || params.fullMobile === "true",
      range: "custom"
    };
  }
};

// Cohort members for the range. Cohorts always cover all paths (the `path` parameter is ignored).
function audienceMembers(params) {
  const s = snapshot();
  const inRange = rangeTest(params);
  const sessions = s.sessions.filter((x) => inRange(x.lastActivityAt));
  const out = [];
  const member = (segmentId, x, extra = {}) => ({
    segmentId,
    customerName: x.customer.name,
    mobile: x.customer.phone,
    path: x.path,
    stepCode: x.flowStep,
    lastStep: x.flowStepLabel,
    category: x.category,
    budget: x.budget,
    piecesShortlisted: x.piecesShortlisted,
    piece: x.product,
    startedAt: x.createdAt,
    lastActiveAt: x.lastActivityAt,
    consent: x.consent,
    ...extra
  });

  for (const x of sessions) {
    // "Where they stopped": exclusive, highest priority wins.
    const open = !x.visitBooked && !x.buyOnline;
    let journey = null;
    if (x.path === "celebrating" && x.hintSent && open) journey = "hint-sent-no-visit";
    else if (x.path === "celebrating" && x.piecesShortlisted > 0 && !x.hintSent && open) journey = "list-started-no-hint";
    else if (x.path === "shopping" && x.stepsReached.includes("2B") && open) journey = "browsing-no-purchase";
    else if (x.path === "sparkle" && x.piecesShortlisted > 0 && open) journey = "shortlisted-no-visit";
    if (journey) out.push(member(journey, x));

    // "Completed or opted in": can overlap.
    if (x.visitBooked) out.push(member("store-visit-booked", x));
    if (x.buyOnline) out.push(member("clicked-buy-online", x));
    if (x.keepPosted) out.push(member("opted-in-new-arrivals", x, { consent: true }));
  }

  // Referred contacts (the husband / wife), not the customer who referred them.
  for (const r of s.referrals.filter((x) => inRange(x.createdAt) && x.consent === true)) {
    out.push({
      segmentId: "referred-consent-given",
      customerName: r.referredName,
      mobile: r.referredPhone,
      path: r.path,
      lastStep: stepDef(r.path, r.flowStep)?.label || r.flowStep,
      category: null,
      budget: null,
      piecesShortlisted: 0,
      piece: null,
      lastActiveAt: r.createdAt,
      consent: true,
      referredBy: r.customerName,
      keyDateType: r.keyDateType,
      keyDate: r.keyDate
    });
  }

  return out;
}
