/*
 * Frontend ⇄ backend contract for the Karwa Chauth dashboard.
 *
 * The backend is the developer's DashboardController (base path /api/dashboard, port 8086 in development).
 * Every endpoint, parameter and field name below is exactly the backend's: the dashboard reads them as they
 * come and never renames them.
 *
 * Flow definitions (steps, buttons, categories, budgets) come from "Karwa Chauth Chatbot Flow Script v7"
 * and live in src/data/campaignConfig.js.
 */

// Backend endpoints (DashboardController, base path /api/dashboard). Every path here is exactly the backend's.
export const DASHBOARD_ENDPOINTS = {
  // Overview
  metricCards: "/api/dashboard/metric-cards",
  outcomes: "/api/dashboard/outcomes",
  flowDropoff: "/api/dashboard/flow-dropoff",
  activity: "/api/dashboard/activity",
  paths: "/api/dashboard/paths",
  categoryBudgetPicks: "/api/dashboard/category-budget-picks",

  // Conversations
  conversationsSummary: "/api/dashboard/conversations/summary",
  conversations: "/api/dashboard/conversations",
  conversationsExport: "/api/dashboard/conversations/export",

  // Store Visits
  storeVisitsSummary: "/api/dashboard/store-visits/summary",
  storeVisitsBookings: "/api/dashboard/store-visits/bookings",

  // Referral Leads
  referralLeadsSummary: "/api/dashboard/referral-leads/summary",
  referralLeads: "/api/dashboard/referral-leads",
  referralLeadsExport: "/api/dashboard/referral-leads/export",

  // Cohorts
  cohortsSummary: "/api/dashboard/cohorts/summary",
  // One download endpoint per card. Each key is the backend's segment `key` (from /cohorts/summary).
  cohortSegments: {
    "hint-sent-no-visit": "/api/dashboard/cohorts/hint-sent-no-visit",
    "list-started-no-hint": "/api/dashboard/cohorts/list-started-no-hint",
    "browsing-no-purchase": "/api/dashboard/cohorts/browsing-no-purchase",
    "shortlisted-no-visit": "/api/dashboard/cohorts/shortlisted-no-visit",
    "store-visit-booked": "/api/dashboard/cohorts/store-visit-booked",
    "clicked-buy-online": "/api/dashboard/cohorts/clicked-buy-online",
    "referred-consent-given": "/api/dashboard/cohorts/referred-consent-given",
    "opted-in-new-arrivals": "/api/dashboard/cohorts/opted-in-new-arrivals"
  }
};


/**
 * Dates and time zone:
 *
 * All date ranges and daily counts are in India Standard Time (Asia/Kolkata, UTC+05:30).
 *
 * - The dashboard always sends range=custom with `from` and `to` as IST calendar dates ("YYYY-MM-DD"), inclusive.
 *   Today → from = to = today; 7 Days → the last 7 IST days including today; 30 Days → the last 30.
 * - The backend sends times without a zone ("2026-10-08T14:30:00"), in IST: the server must run in IST.
 *   The dashboard reads them as IST (asIst() in src/utils/format.js).
 * - "How long ago" comes from the backend's `minutesAgo`; the dashboard only formats it ("12m ago").
 * - Export times are already formatted by the backend ("08-10-2026 14:30").
 */
export const DATE_TIME_ZONE = "Asia/Kolkata";

/**
 * Common query parameters:
 *   range      always "custom" (sent by apiDashboardProvider)
 *   from, to   IST dates, see above
 *   flow       "all" | "celebrating" | "shopping" | "sparkle"   (not on /paths or the Cohorts endpoints)
 * Paged tables: page (0-based). The backend always returns 50 rows per page (`size`).
 *
 * Paths: celebrating = "I'm celebrating" (the backend's WIFE path), shopping = "I'm shopping for her" (HUSBAND),
 * sparkle = "Here for the sparkle" (SPARKLE). Percentages from the backend are already 0–100.
 */
export const PATH_IDS = ["celebrating", "shopping", "sparkle"];

/**
 * Flow step codes (from the flow script; the backend's `stepCode` / `step` filter uses the same codes):
 *
 *   celebrating (I'm celebrating):     1 Choose My Gift → 1A Category → 1B Carousel (no budget step, v7) → 1C Added to List
 *                                     (→ 1D Adding More ↺) → 1G Ishara Created → 1H Ishara Sent → 1I Reminder Offer
 *                                     (→ 1I-nudge) → 1J His Details → 1K Consent
 *   shopping (Shopping for her):      2 Find Her a Gift → 2A Category → 2A-Budget → 2B Carousel → 2C Buy / Visit
 *                                     → 2E Her Details Ask → 2F Her Details → 2G Consent
 *   sparkle (Here for the sparkle):   1-Sparkle Show Me → 1A Category → 1A-Budget → 1B Carousel → 1C Added to List
 *                                     (→ 1D ↺) → [C2] → 1I Keep Me Posted
 *   any path:                         0 Opener · C2 Store Visit · E1 Closed
 *
 * The same code can appear on more than one path (e.g. "1A" on celebrating and sparkle), so read it with `flow`.
 */
export const FLOW_STEP_CODES = {
  celebrating: ["0", "1", "1A", "1B", "1C", "1D", "1G", "1H", "1I", "1I-nudge", "1J", "1K"], // v7: no 1A-Budget
  shopping: ["0", "2", "2A", "2A-Budget", "2B", "2C", "2E", "2F", "2G"],
  sparkle: ["0", "1-Sparkle", "1A", "1A-Budget", "1B", "1C", "1D", "1I"],
  anyPath: ["C2", "E1"]
};

/**
 * Overview
 *
 * GET /metric-cards (from, to, flow) →
 *   { messagesSent, messagesPerDay, messagesDelivered, messagesFailed, deliveryRate, readReceipts, openRate,
 *     openerTaps, clickRate, flow, range }
 *
 * GET /outcomes (from, to, flow) →
 *   { referralLeads: { total, husbandsReferred, wivesReferred, trend }, isharaSent: { total, trend },
 *     storeVisitsBooked: { total, trend }, buyOnlineClicks: { total, trend }, flow, range }
 *   trend = [{ date: "YYYY-MM-DD", count }] per IST day. An outcome that doesn't apply to the path has total = null.
 *
 * GET /flow-dropoff (from, to, flow) → { stages: [{ step, label, count, pct }], flow, range }
 *   pct = % of opener taps (0–100).
 *
 * GET /paths (from, to) → { totalOpenerTaps, paths: [ one item per path ], range }
 *   every item: { flow, openerTaps, share }
 *   celebrating: + isharaSent, visitsBooked, husbandsReferred
 *   shopping:    + buyOnlineClicks, visitsBooked, wivesReferred
 *   sparkle:     + piecesShortlisted, visitsBooked, keepMePosted
 *
 * GET /activity (from, to, flow, limit) → { events: [{ badge, summary, path, timestamp, minutesAgo }], flow }
 *   badge: MSG | ISHARA | VISIT | BUY | REFERRAL | OPT-IN | OPT-OUT | LEAD (colour class "k-" + badge in lower case).
 *   No event id yet: the feed tells events apart by timestamp + summary.
 *
 * GET /category-budget-picks (from, to, flow) →
 *   { categories: { total, rows }, budgets: { total, rows, applicable }, flow, range }
 *   row: { key, label, customers, pct }, one per option in display order (0 when nobody picked it);
 *   pct = the row's share of the panel total (0–100). Mia Sutra is left out on "sparkle".
 *   budgets.applicable = false on "celebrating" (no budget step; every budget row is 0).

 */

/**
 * Conversations
 *
 * GET /conversations/summary (from, to, flow) →
 *   { totalSessions, enteredDiscovery, carouselReached, isharaSent, visitsBooked, flow, range }
 *
 * GET /conversations (from, to, flow, category, step, search, sort, direction, page) →
 *   { rows, showBudget, page, size, totalElements, totalPages, flow, range, sort, direction }
 *   category  a backend code: PENDANTS, MIA_SUTRA, PENDANT_CHAIN, NECKLACES, EARRINGS, RINGS, BRACELETS_BANGLES
 *             (CATEGORY_CODES in campaignConfig.js); left out = all categories
 *   step      a step code, e.g. "1B"; left out = all steps
 *   sort      customer | phone | path | step | category | budget | lastActivity;  direction  asc | desc
*   row: { sessionId, customerName, phone (masked), flow, pathLabel, stepCode, stepLabel, status, category,
 *          categoryLabel, productsChosen (null when nothing chosen), budget, budgetLabel, startedAt, lastActivity, minutesAgo }
 *   showBudget = false on "celebrating": the budget fields are then left out of the rows.
 *
 * GET /conversations/export (same filters + scope=all) →
 *   { columns, rows, scope, page, totalElements, totalPages, exportedRows, flow, range }
 *   columns: Customer, Phone, Path, Step, Status, Category, Products Chosen, Budget (not on celebrating), Started At, Last Activity.
 *   Each row is keyed by its column header. Phone is the full number; the dashboard masks it in the CSV.
 */

/**
 * Referral Leads (the page always sends flow=all)
 *
 * GET /referral-leads/summary (from, to, flow) →
 *   { referralLeads, husbandsReferred, wivesReferred, consentGivenPct, canBeMessaged, isharaForwards,
 *     optInLeads: { optedIn, pctOfSparkleOpenerTaps, sparkleOpenerTaps, optedOut }, flow, range }
 *   A card that doesn't apply to the path is null (shown as "–"). consentGivenPct is a whole number.
 *
 * GET /referral-leads (from, to, flow, show, page) → { rows, page, size, totalElements, totalPages, show, flow, range }
 *   show  all | husbands | wives | consented.  Newest first.
 *   row: { leadId, referredBy, flow, pathLabel, capturedAt, minutesAgo, contactName, contactStep, relation,
 *          mobile (masked), keyDateType, keyDate, keyDateLabel, consent, consentLabel, status, statusLabel }
 *
 * GET /referral-leads/export (same filters + scope=all) → { columns, rows, scope, page, totalElements, exportedRows, show, flow, range }
 *   columns: Referred By, Path, Referred Contact, Relation, Mobile, Key Date, Consent, Status, Captured At.
 *   The dashboard leaves out Status and masks Mobile in the CSV.
 */

/**
 * Store Visits (the page always sends flow=all)
 *
 * GET /store-visits/summary (from, to, flow) →
 *   { visitsBooked, bookingFormOpened, completedPct, mostPickedSlot: { timeSlot, bookings, pctOfBookings }, flow, range }
 *
 * GET /store-visits/bookings (from, to, flow, page) → { rows, page, size, totalElements, totalPages, flow, range }
 *   row: { bookingId, bookingRef, customerName, phone (masked), flow, pathLabel, storeName, visitDate, timeSlot,
 *          slotLabel, reservedLabel, reservedSkus, status, bookedAt, minutesAgo }
 */

/**
 * Cohorts (date range only; no path)
 *
 * GET /cohorts/summary (from, to) →
 *   { engagedNotFinished, completedOrOptedIn,
 *     whereTheyStopped: { total, segments }, completedOrOptedInSegments: { total, segments }, range }
 *   segment card: { key, label, flows, priority, count }   (priority is null on "Completed or opted in")
 *   The card text (definition, next step, use it for) is in campaignConfig.js → AUDIENCE_SEGMENTS, by `key`.
 *
 * GET /cohorts/<key> (from, to, fullMobile) →
 *   { segment, label, flows, priority, count, columns, rows, exportedRows, fullMobile, range }
 *   fullMobile = the "Full mobile numbers in downloads" tick-box: true → full numbers, false → masked.
 *   Each card has its own columns; each row is keyed by its column header.
 */
