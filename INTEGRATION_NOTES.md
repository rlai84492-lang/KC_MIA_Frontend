# Karwa Chauth Dashboard — Integration Notes

This file records every data-related change to the dashboard and explains how each feature will get real data from the Karix WhatsApp API. It is updated after every change.

---

## Going live with real data

_Last updated: Change 12 (Overview "Total Delivered" card). The dashboard reads only the developer's backend, `DashboardController`, with its exact endpoint, parameter and field names._

### Overall flow

```text
Karix WhatsApp API
   │  webhooks: message status (sent / delivered / read / failed)
   │            inbound messages: button replies, list replies, typed text, WhatsApp Flow responses
   ▼
Chatbot backend (Spring Boot, the developer's)
   • stores messages, sessions, button taps, leads and bookings in MySQL
   • DashboardController serves the dashboard: base path /api/dashboard, port 8086 on the server
   • Azure VM: https://karvachauth-rlai.indiasouthcentral.cloudapp.azure.com (nginx forwards /api/ to 127.0.0.1:8086)
   ▼
Backend API endpoints (DASHBOARD_ENDPOINTS in dashboardContract.js)
   Overview       /metric-cards · /outcomes · /flow-dropoff · /activity · /paths · /category-budget-picks
   Conversations  /conversations/summary · /conversations · /conversations/export
   Referral Leads /referral-leads/summary · /referral-leads · /referral-leads/export
   Store Visits   /store-visits/summary · /store-visits/bookings
   Cohorts        /cohorts/summary · one /cohorts/<key> per card (8)
   ▼
Dashboard (this React app): reads every field exactly as the backend names it
```

The Karix API key and webhook secret live **only on the backend**. They must never be put in this React app, because anything in the frontend can be read by anyone who opens the dashboard.

### How the dashboard gets its data

1. Every screen gets its data only through `dashboardService` (`src/services/dashboardService.js`). Screens may import `src/data/campaignConfig.js`, which is flow configuration (labels, step order, colours, card text), not data. There is no sample data in the app.
2. `dashboardService` has one method per backend endpoint (16 in all, `getCohortSegment(key, …)` covers the 8 cohort downloads). It calls `apiDashboardProvider.js`, which always adds `range=custom`, so the backend uses the dashboard's `from` / `to`.
3. `.env.local` sets where requests go:
   ```env
   VITE_API_BASE_URL=     # empty = same origin (/api/dashboard/...), so no CORS is needed
   BACKEND_URL=https://karvachauth-rlai.indiasouthcentral.cloudapp.azure.com   # npm run dev forwards /api here
   ```
   In `npm run dev` the Network tab shows `http://localhost:5173/api/dashboard/...`; Vite forwards each request to `BACKEND_URL`. A response with `Server: nginx` came from the Azure VM. Restart `npm run dev` after changing `.env.local`.
4. In production the built dashboard (`dist/`) should be served by the same nginx as the backend, so `/api/` stays same-origin and `VITE_API_BASE_URL` stays empty.
5. Rule for every future change: a method added to `dashboardService` must exist in `apiDashboardProvider.js`, use the backend's exact field names, and be documented in `dashboardContract.js`.

### Dates and time zone

- Every date range and daily count is in **India Standard Time (Asia/Kolkata)**. The dashboard sends `range=custom` with `from` and `to` as inclusive IST dates (`YYYY-MM-DD`).
- The backend sends times **without a time zone** (e.g. `2026-10-08T14:30:00`). They are IST, so **the backend server must run in IST**. The dashboard reads them as IST (`asIst()` in `src/utils/format.js`).
- "How long ago" uses the backend's `minutesAgo`. Export times come already formatted (`08-10-2026 14:30`).
- "Today" is the real current IST date.

### How the dashboard stays up to date

- **Auto-refresh every 30 seconds** (`AUTO_REFRESH_MS` in `src/context/DashboardContext.jsx`):
  - `/metric-cards` and `/paths` (used by the sidebar counts and the Overview) and the page on screen re-fetch.
  - The Activity Feed keeps its own 15-second update.
  - Nothing the user set is reset: table page, filters, search, sort and the "Full mobile numbers" tick all stay.
  - Old data stays on screen until the new data arrives, so nothing flashes.
- **Hidden tab:** polling pauses while the browser tab is hidden. When the tab becomes visible again, the dashboard refreshes immediately (`src/hooks/usePolling.js`).
- **Refresh button:** refreshes at once and confirms with "Dashboard refreshed".
- **"Updated" time** in the header shows when data last arrived (IST).
- **Past midnight IST:** if the dashboard is left open, "Today", "7 Days" and "30 Days" move forward to the new day on the next refresh.
- **When the backend fails:**
  - A request that takes more than **15 seconds** is cancelled (`REQUEST_TIMEOUT_MS` in `apiDashboardProvider.js`).
  - If a refresh fails, the last good data stays on screen with a "Couldn't refresh" banner and Retry. The dashboard keeps trying every 30 seconds.
  - If a page has never loaded, it shows "Couldn't load this page" with a reason (e.g. 403, 404, 503, unreachable) and **Retry now**.
- **Load on the backend:** each open dashboard makes a few requests every 30 seconds (2 for the sidebar plus 1–3 for the page), plus 1 every 15 seconds for the Overview feed. Tables are paged at 50 rows, so a page load stays small even with 500,000 customers; only "Download as CSV" asks for every matching row.

### Open items for the backend

1. **Azure VM: resolved (checked 12 Oct 2026).** The 404 from 9 Oct is fixed: the dashboard APIs exist on the VM and answer `401 Unauthorized` until you sign in. The developer's build of the dashboard is live at `https://karvachauth-rlai.indiasouthcentral.cloudapp.azure.com/dashboard/`, and `npm run dev` with `BACKEND_URL` set to the VM shows live data after signing in.
2. **Security: login is in place.** The developer added a login (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, session cookie; see `src/services/authApi.js`). Every dashboard API needs it, and any 401 sends the dashboard back to the login page. Credentials come from the developer and are never stored in this app.
3. **Budget labels:** `BUDGET_LABELS` in `DashboardServiceImple.java` uses "Less than ₹20,000", "₹20,000 – ₹50,000", "Above ₹50,000". They must be exactly "Less than 20,000", "20,000 - 50,000", "Above 50,000" (no ₹, plain hyphen). They show in the Overview "Budget Chosen" panel, the Conversations Budget column and the cohort downloads.
4. **Activity Feed event id:** `/activity` has no event id; the feed tells events apart by `timestamp` + `summary`. An id would be more reliable.
5. **Full phone numbers in exports:** `/conversations/export` and `/referral-leads/export` send full numbers. The dashboard masks them in the CSV, but masking them on the server would be safer. Cohort downloads follow `fullMobile` correctly; the controller's default for `fullMobile` should be `false`.
6. **Referral leads timing:** the backend counts a referral lead when the consent is answered. The agreed rule was to count it when the details are shared.
7. **"Download as CSV" size:** `scope=all` has no row limit. With 500,000 customers a very wide download can be large; a cap or a background export may be needed later.
8. **Server time zone:** the server must stay in IST (see "Dates and time zone").
9. **Karix credentials** stay on the backend. The dashboard only needs `VITE_API_BASE_URL` and, in development, `BACKEND_URL`.
10. **CORS (only if `VITE_API_BASE_URL` is set to the Azure URL):** the backend must allow the dashboard's origin with credentials, because `apiDashboardProvider.js` sends `credentials: "include"`. Not needed while `VITE_API_BASE_URL` is empty.

### Field checklist

The dashboard reads these exact names. The full shapes are in `dashboardContract.js`. "Backend" = the developer's endpoint returns it (code reviewed, and confirmed live through the ngrok backend before the move to Azure; `/category-budget-picks` is code-reviewed only). The Azure backend is now live behind the login (open item 1), so each row should be re-checked there after signing in.

| Endpoint | Fields the dashboard reads | Backend |
|---|---|---|
| `/metric-cards` | messagesSent, messagesPerDay, messagesDelivered, messagesFailed, deliveryRate, readReceipts, openRate, openerTaps, clickRate | ✅ |
| `/outcomes` | referralLeads, isharaSent, storeVisitsBooked, buyOnlineClicks → each { total, trend [{ date, count }] } | ✅ |
| `/flow-dropoff` | stages [{ step, label, count, pct }] | ✅ |
| `/paths` | paths [{ flow, openerTaps, share, isharaSent, husbandsReferred, buyOnlineClicks, wivesReferred, piecesShortlisted, keepMePosted, visitsBooked }] | ✅ |
| `/activity` | events [{ badge, summary, timestamp, minutesAgo }] | ✅ (no event id) |
| `/category-budget-picks` | categories { total, rows [{ key, label, customers, pct }] }, budgets { total, rows, applicable } | ✅ (code reviewed; budget label text, open item 3) |
| `/conversations/summary` | totalSessions, enteredDiscovery, carouselReached, isharaSent, visitsBooked | ✅ |
| `/conversations` | rows [{ sessionId, customerName, phone, flow, stepCode, stepLabel, status, categoryLabel, budgetLabel, lastActivity, minutesAgo }], showBudget, size, totalElements | ✅ |
| `/conversations/export` | columns, rows | ✅ |
| `/referral-leads/summary` | referralLeads, husbandsReferred, wivesReferred, consentGivenPct, canBeMessaged, isharaForwards, optInLeads { optedIn, pctOfSparkleOpenerTaps, sparkleOpenerTaps } | ✅ |
| `/referral-leads` | rows [{ leadId, referredBy, flow, pathLabel, capturedAt, minutesAgo, contactName, contactStep, relation, mobile, keyDateLabel, consentLabel }], size, totalElements | ✅ |
| `/referral-leads/export` | columns, rows | ✅ |
| `/store-visits/summary` | visitsBooked, bookingFormOpened, completedPct, mostPickedSlot { timeSlot, pctOfBookings } | ✅ |
| `/store-visits/bookings` | rows [{ bookingId, bookingRef, customerName, flow, storeName, slotLabel, reservedLabel, bookedAt, minutesAgo }], size, totalElements | ✅ |
| `/cohorts/summary` | engagedNotFinished, completedOrOptedIn, whereTheyStopped / completedOrOptedInSegments { total, segments [{ key, label, flows, priority, count }] } | ✅ |
| `/cohorts/<key>` | columns, rows (mobiles full or masked by `fullMobile`) | ✅ |

---

## Change log

> Changes 1, 1b and 2 below are kept for history. **Phase 1 replaced parts of them:**
> - Step codes "1A-B" / "2A-B" / "1-S" became "1A-Budget" / "2A-Budget" / "1-Sparkle", the flow script's own codes.
> - `REPORTING_ANCHOR` was removed; "Today" is now the real date.
> - Referral `status` values changed.
> - The generic steps (`currentStep`, `currentStepLabel`, `STEPS`) were removed.
>
> The current rules are in the Phase 1 entry and in `dashboardContract.js`.
>
> Change 11 removed the mock provider and the sample data. Older entries that mention `mockDashboardProvider.js`, `mockData.js`, `VITE_DASHBOARD_PROVIDER` or "Mock-only items" are kept as history.


### Change 1 — Fix the Referral Leads path filter

**What changed and why**
The Referral Leads page filters records by the selected path, but mock referral records had no `path` field. So choosing any single path ("I'm celebrating", etc.) showed zero referrals, even when there were some. Every mock referral now carries the path of the session that created it, and the referral record shape is now written up in the contract.

**Files touched**
- `src/data/mockData.js`: added `path: path.id` to each referral record. No random values are consumed, so all other mock values stay identical.
- `src/services/dashboardContract.js`: added the "Normalized referral contract" block.

No screen files and no service methods changed. The filter in `mockDashboardProvider.js` (`matchesPath`) already expected `path`.

**New data fields / service methods**

| Name | Type | Example | Used by |
|---|---|---|---|
| `referral.path` | `"wife" \| "husband" \| "sparkle"` | `"wife"` | Referral Leads page (via the path toggle → `getReferrals({ path })`) |

**Contract update** (added to `dashboardContract.js`)

```js
/**
 * Normalized referral contract (rows of GET /api/dashboard/referrals):
 *
 * {
 *   referralId: string,
 *   sessionId: string,
 *   userId: string,
 *   path: "wife" | "husband" | "sparkle",  // path of the session that created the referral; required for the path filter
 *   customerName: string,
 *   customerPhone: string,
 *   referredName: string,
 *   referredPhone: string,
 *   relationship: string,
 *   status: string,
 *   createdAt: ISO string
 * }
 *
 * The `path` query parameter (all | wife | husband | sparkle) must filter rows by `path`.
 */
```

**Real data mapping**

| Field | Karix source | What the backend must do |
|---|---|---|
| `referral.path` | The **interactive button reply** on the opener message ("I'm celebrating" / "I'm shopping for her" / "Here for the sparkle"), received as an inbound-message webhook. Exact payload field for the button id: TBD – verify against Karix webhook documentation. | When the opener button reply arrives, map the button to `wife` / `husband` / `sparkle` and store it on the **session**. When a referral is later captured in that session, copy the session's path onto the referral record. Do not re-derive it from the referral message itself. |
| `referral.referredName`, `referredPhone` (existing, documented now) | Inbound message(s) in which the customer shares the contact's details. Whether these arrive as free text, a WhatsApp Flow form response or a shared contact depends on how the bot flow is built. Exact payload fields: TBD – verify against Karix webhook documentation. | Parse and validate the name and mobile number, then store them with `sessionId`, `userId` and `path`. |

**Mock-only items**
- The mock data creates referrals only on the "I'm celebrating" path (wives referring husbands), and only a few fall inside the default 7-day range. Wives referred by husbands, consent and key dates are Priority 3 items and still need decisions.

---

### Change 1b — Date ranges use IST, not UTC

**What changed and why**
The default 7-day range and the Today / 7 Days / 30 Days buttons built their dates with `toISOString()`, which converts to UTC. Midnight IST on 1 Oct is still 30 Sep in UTC, so every range ended a day early and "Today" actually showed yesterday. Date ranges are now worked out as IST calendar dates by one shared helper, and the contract states that all ranges and daily counts are in IST.

**Files touched**
- `src/utils/istDates.js` (new): `toIstDate`, `shiftIstDate`, `istDateRange` and `REPORTING_ANCHOR`.
- `src/context/DashboardContext.jsx`: `getDefaultDates()` now returns `istDateRange(7)`.
- `src/components/layout/Topbar.jsx`: `setRange()` now uses `istDateRange(range)`. The filter state shape (`range`, `from`, `to`) is unchanged.
- `src/services/dashboardContract.js`: added the "Dates and time zone" note and the `DATE_TIME_ZONE` constant.

No service methods or mock data changed. `mockDashboardProvider.js` already read `from` / `to` as IST days (`T00:00:00+05:30` … `T23:59:59+05:30`), so the bug was only in how the dashboard picked the dates.

**Result (mock data, ending on 1 Oct 2026)**

| Range | Before | After |
|---|---|---|
| Today | 2026-09-30 | 2026-10-01 |
| 7 Days | 2026-09-24 → 2026-09-30 | 2026-09-25 → 2026-10-01 |
| 30 Days | 2026-09-01 → 2026-09-30 | 2026-09-02 → 2026-10-01 |

These dates are the same whatever time zone the viewer's computer is set to.

**New data fields / service methods**

| Name | Type | Example | Used by |
|---|---|---|---|
| `DATE_TIME_ZONE` (contract constant) | string | `"Asia/Kolkata"` | `src/utils/istDates.js` |
| `istDateRange(days)` (frontend helper, not a service method) | `(number \| string) → { from, to }` | `istDateRange(7)` → `{ from: "2026-09-25", to: "2026-10-01" }` | `DashboardContext` defaults, `Topbar` range buttons |

No response fields were added.

**Contract update** (added to `dashboardContract.js`)

```js
/**
 * Dates and time zone:
 *
 * All date ranges and daily counts are in India Standard Time (Asia/Kolkata, UTC+05:30).
 *
 * - `from` and `to` query parameters are IST calendar dates in "YYYY-MM-DD" form and are inclusive:
 *   an event belongs to the range if its timestamp falls between `from` 00:00:00 IST and `to` 23:59:59 IST.
 *   Example: range=7 ending on 2026-10-01 → from=2026-09-25, to=2026-10-01. range=1 (Today) → from=to.
 * - Any per-day series (daily counts, trends) must group events by their IST calendar day,
 *   not by UTC day. Karix webhook timestamps must be converted to IST before grouping.
 * - Timestamps in responses (createdAt, lastActivityAt, timestamp, …) stay full ISO 8601 strings
 *   with an offset (e.g. "2026-10-01T03:30:00.000Z"); the dashboard formats them for display.
 */
export const DATE_TIME_ZONE = "Asia/Kolkata";
```

**Real data mapping**

| Item | Karix source | What the backend must do |
|---|---|---|
| Event timestamps used for range filtering | Every Karix webhook (message status updates such as sent / delivered / read / failed, inbound messages, interactive button / list replies) carries a time for the event. Exact field name and format (epoch seconds vs ISO string, and its time zone): TBD – verify against Karix webhook documentation. | Parse the webhook time into an absolute instant and store it as UTC (or with an offset). For every query, treat `from` as `from 00:00:00 IST` and `to` as `to 23:59:59 IST`. |
| Daily counts (future trend charts) | Same webhooks | Group by the IST calendar date of each event, e.g. convert to Asia/Kolkata before truncating to the day. Never group on the UTC date. |
| Event ordering | Same webhooks | If Karix delivers webhooks late or out of order, filter on the event's own time, not on when our server received it. Whether Karix provides an event time separate from the delivery time: TBD – verify against Karix webhook documentation. |

**Mock-only items**
- `REPORTING_ANCHOR` is fixed at 1 Oct 2026 to match the mock data. On live data, "today" must be the real current date (`new Date()`); see "Going live with real data → Dates and time zone".
- Timestamps shown inside tables (Conversations "Last activity", Referrals "Created", Store Visits "Booking") are still formatted in the viewer's own time zone. They will be switched to IST when those columns are reworked in Changes 5–7.

---

### Change 2 — Path-specific flow step codes

**What changed and why**
The dashboard only knew ten generic steps ("Category selected", "Details captured", …), the same for every path. The bot flow script names its steps per path (1A, 1J, 2A, 2F, C2 …), and later features need those real names: the Conversations step filter, the referral "Step 1J/2F" column, the drop-off funnel and the audience segments. Each session, event and referral now also carries its path-specific step code. The full list of codes is in the contract, so the backend uses the same ones. The generic fields are kept, and no screen uses the new fields yet; Change 5 switches Conversations over.

**Files touched**
- `src/data/campaignConfig.js`: added `PATH_STEPS` (per-path step code, label, display tone, in flow order) and `VISIT_STEP` (C2).
- `src/data/mockData.js`: added the mock-only `FLOW_STEP_BY_GENERIC` map and `flowStepFor()`. Added `flowStep` and `flowStepLabel` to sessions, `flowStep` to every event and `flowStep` to referrals. No random values are consumed, so every existing value is unchanged (summary checked: 162 sessions, 143 delivered, 162 opener taps, 1 referral, 8 visits for 25 Sep – 1 Oct).
- `src/services/dashboardContract.js`: added the "Flow step codes" block, `FLOW_STEP_CODES`, and the new fields in the event, session and referral contracts.

No service methods and no screens changed.

**New data fields / service methods**

| Name | Type | Example | Used by |
|---|---|---|---|
| `session.flowStep` | string (code from `FLOW_STEP_CODES`) | `"1C"` | Conversations step column and filter (Change 5), audience segments (later) |
| `session.flowStepLabel` | string | `"Added to List"` | Conversations step column (Change 5) |
| `event.flowStep` | string | `"1A"` | Drop-off funnel and activity feed (Priority 2) |
| `referral.flowStep` | `"1J" \| "2F"` | `"1J"` | Referral Leads "Referred contact · Step 1J" (Change 7) |
| `PATH_STEPS`, `VISIT_STEP` (frontend config) | `{ [path]: { code, label, tone }[] }` | `PATH_STEPS.wife[5]` → `{ code: "1C", label: "Added to List", tone: "p-info" }` | Labels, ordering and pill colours on screens |
| `FLOW_STEP_CODES` (contract constant) | `{ wife, husband, sparkle, anyPath: string[] }` | `FLOW_STEP_CODES.anyPath` → `["C2"]` | Reference for the backend; validation in tests |

**Contract update** (added to `dashboardContract.js`)

```js
/**
 * Flow step codes:
 *
 * `flowStep` is the bot flow script's own step id for where a customer is (or where an event happened).
 * Codes are path-specific; the same code can appear on more than one path (e.g. "1A" on wife and sparkle),
 * so always read it together with `path`. The frontend's labels and order live in
 * src/data/campaignConfig.js → PATH_STEPS / VISIT_STEP; the backend must use exactly these codes.
 *
 *   wife    (I'm celebrating):      0 Opener → 1 Choose My Gift → 1A Category → 1A-B Budget → 1B Carousel →
 *                                   1C Added to List → 1G Ishara Created → 1H Ishara Sent → 1J His Details → 1K Consent
 *   husband (Shopping for her):     0 Opener → 2 Find Her a Gift → 2A Category → 2A-B Budget → 2B Carousel →
 *                                   2C Buy / Visit → 2E Her Details Ask → 2F Her Details → 2G Consent
 *   sparkle (Here for the sparkle): 0 Opener → 1-S Show Me → 1A Category → 1A-B Budget → 1B Carousel →
 *                                   1C Added to List → 1I Keep Me Posted
 *   any path:                       C2 Store Visit Booked (WhatsApp Flow booking confirmed)
 */
export const FLOW_STEP_CODES = {
  wife: ["0", "1", "1A", "1A-B", "1B", "1C", "1G", "1H", "1J", "1K"],
  husband: ["0", "2", "2A", "2A-B", "2B", "2C", "2E", "2F", "2G"],
  sparkle: ["0", "1-S", "1A", "1A-B", "1B", "1C", "1I"],
  anyPath: ["C2"]
};
```

Fields added to the existing contract blocks:

```js
// event
 *   flowStep: string,            // path-specific step code, see "Flow step codes" (added in Change 2)
// session
 *   flowStep: string,            // path-specific step code the customer last reached, e.g. "1C" (added in Change 2)
 *   flowStepLabel: string,       // its label, e.g. "Added to List" (added in Change 2)
// referral
 *   flowStep: "1J" | "2F",       // step where the contact's details were captured (added in Change 2)
```

**Real data mapping**

| Field | Karix source | What the backend must do |
|---|---|---|
| `event.flowStep` | **Interactive button replies and list replies** (inbound-message webhooks) tell us which button or list row the customer tapped. Free-text replies (e.g. typed details) also arrive as inbound messages. Exact payload fields for the reply id / title: TBD – verify against Karix webhook documentation. | Keep a lookup from **our own** button / list-row ids to the step they lead to. When building the outgoing interactive messages, give each button an id that can be mapped back to its step. Store the resulting step code on the event. Do not rely on the visible button title, because it may change with copy edits. |
| `session.flowStep`, `flowStepLabel` | Derived from the session's events | After each event, set the session's `flowStep` to the furthest step reached on that path (in `FLOW_STEP_CODES` order). Labels come from the same table as the codes. |
| `flowStep = "C2"` | The **WhatsApp Flow** booking form completion arrives as an inbound message containing the form response. Exact message type and fields: TBD – verify against Karix webhook documentation. | Only mark C2 when the booking is actually confirmed (store and slot received), not when the form is opened. |
| `referral.flowStep` | The inbound message in which the customer submits the referred person's details | Store `1J` when details are captured on the celebrating path (husband's details) and `2F` on the shopping-for-her path (wife's details). |
| The step codes themselves | Not from Karix; they come from **our bot flow script** | If the flow script adds, removes or renumbers steps, update `FLOW_STEP_CODES` in the contract, `PATH_STEPS` in `campaignConfig.js` and the backend lookup together. |

**Mock-only items**
- Mock steps are produced by mapping the old generic progression onto each path (`FLOW_STEP_BY_GENERIC` in `mockData.js`). Because of how the mock progression works:
  - A session is only placed at **C2** if it actually has a booking; otherwise it stays at 1C / 2C. Currently 1 mock session sits at C2 as its last step; other sessions with bookings moved on to later steps.
  - No mock session currently stops at **1G Ishara Created**, **1H Ishara Sent** or **2E Her Details Ask**. Wife sessions jump from 1J to 1K. Ishara steps will come with the Priority 3 Ishara/hint data.
  - Sparkle sessions that reached the generic "Details captured" / "Hint sent" / "Completed" steps are shown as **1I Keep Me Posted**, the last sparkle step.
  - Husband sessions at the generic "Hint sent" / "Completed" steps are shown as **2G Consent**.
- Only **1J** referrals exist in mock data (wives referring husbands). **2F** (husbands referring wives) is a Priority 3 item.
- The generic `STEPS`, `currentStep` and `currentStepLabel` are still returned and still used by Conversations until Change 5. They can be retired later, once nothing reads them.


---

### Phase 1 — Data foundation: flow-script data model and all reference data

**What changed and why**
To show everything the reference dashboard shows, the data layer needed far more than it had: message sent/read/failed status, Ishara and Buy Online actions, the drop-off funnel, daily trends, an activity feed, referral consent and key dates, booking references and audience segments. The mock data was also out of line with the flow script (₹5,000-scale budgets, wrong categories, an "Added to list" step on the husband path). The data layer was rebuilt to follow the flow script exactly, in the same shape the real backend will use: raw **messages** (from Karix status webhooks) and **events** (from Karix inbound messages), with sessions, referrals and store visits **derived** from the events. Every new field and method is in the contract, and the real-API provider has the same methods as the mock one.

**Files touched**
- `src/data/campaignConfig.js`, rewritten from the flow script:
  - Paths; the 7 categories in carousel order (Mia Sutra excluded on sparkle); the 4 budgets.
  - Per-path step codes and labels (incl. 1D, 1I, 1I-nudge, C2, E1); all 28 button ids with their labels.
  - C2 day and time options; referral types; referral follow-up statuses; the 9 audience segments with their copy.
  - Removed the generic `STEPS` and `CTA_LABELS`.
- `src/data/mockData.js`, rewritten:
  - About 4,200 recipients over 30 IST days, ramping towards today with three broadcast waves.
  - Each recipient has sent / delivered / read / failed times. About 15% tap the opener and walk through their path as the flow script describes (wishlist, Ishara, Buy Online, C2 booking with ref, details with key date, consent, keep me posted, close).
  - Times are relative to page load. Some sends and replies are scheduled up to a few hours ahead.
- `src/services/mockDashboardProvider.js`, rewritten:
  - Builds an "as of now" view: hides future items and works out message status and session state at the current time.
  - Implements `getSummary`, `getConversations` (server-side filter / sort / paging + KPIs), `getReferrals`, `getStoreVisits`, `getActivityFeed` (new), `getAudiences` and `getAudienceMembers` (new).
- `src/services/dashboardService.js`: exposes the two new methods. An invalid `VITE_DASHBOARD_PROVIDER` value now falls back to mock.
- `src/services/apiDashboardProvider.js`: the two new methods; endpoint paths now come from `DASHBOARD_ENDPOINTS`.
- `src/services/dashboardContract.js`: rewritten to document every shape, parameter and counting rule (see "Contract update").
- `src/utils/istDates.js`: `istDateRange()` now ends on the real current IST date; added `istDayStart`, `istDayEnd`, `istDatesBetween`; removed `REPORTING_ANCHOR`.
- Pages, compatibility only (each is fully rebuilt in Phases 2–4):
  - `Conversations.jsx`: the step filter lists the flow-script steps and sends `flowStep`; the Step column shows `flowStepLabel`.
  - `Referrals.jsx`: the status pill shows the status label.
  - `StoreVisits.jsx`: the Status column was removed (bookings have no status in the flow script).

**Removed (not needed by the reference or the production model)**
- Generic steps `STEPS`, `session.currentStep`, `session.currentStepLabel`, `session.lastEventType` and `event.step`, replaced by the flow-script `flowStep` / `atStep`.
- `CAMPAIGN_DELIVERED` and `PRODUCT_VIEWED` event types. Delivery is now a message status, and WhatsApp cannot report that a carousel card was viewed.
- Store visit `status`. The flow script has no visit status; whether a customer actually came in would have to come from the store.
- `CTA_LABELS`, replaced by `BUTTONS`.

**New data fields / service methods** (full shapes in `dashboardContract.js`)

| Name | Type | Example | Used by |
|---|---|---|---|
| `summary.sent`, `read`, `failed`, `readRate` | number | `1479`, `984`, `75`, `0.701` | Overview KPI cards (Phase 2) |
| `summary.outcomes` | object of counts | `{ hintsSent: 15, visitsBooked: 26, buyOnlineClicks: 11, referralLeads: 16, … }` | Overview outcome tiles, path cards (Phase 2) |
| `summary.funnel` | `{ key, label, count }[]` | `[{ key: "opener", label: "Opener Tapped", count: 210 }, …]` | Overview Bot Flow Drop-off (Phase 2) |
| `summary.daily` | per-IST-day counts | `{ date: "2026-10-01", sent: 157, openerTaps: 21, … }` | Overview sparklines (Phase 2) |
| `summary.pathStats` | per-path counts | `{ wife: { openerTaps: 93, hintsSent: 15, … } }` | Overview "The three paths" cards (Phase 2) |
| `getActivityFeed({ path, limit })` | method → `{ rows }` | `{ kind: "hint", customerName: "Ritika Joshi", timestamp, … }` | Overview Activity Feed (Phase 2) |
| `getConversations` params `flowStep`, `status`, `sort`, `dir`, `page`, `pageSize`; result `kpis` | — | `kpis: { totalSessions: 215, enteredDiscovery: 142, … }` | Conversations (Phase 3) |
| session `messageId`, `stepsReached`, `pieces`, `piecesShortlisted`, `hintCreated`, `hintSent`, `buyOnline`, `formOpened`, `visitBooked`, `detailsCaptured`, `consent`, `keepPosted` | mixed | `hintSent: true` | Conversations, Audiences |
| referral `keyDateType`, `keyDate`, `consent`, new `status` ids | — | `"Anniversary"`, `"2016-12-20"`, `true`, `"reminder_scheduled"` | Referral Leads (Phase 3) |
| `getReferrals` params `relationship`, `consent`; result `kpis`, `optIn` | — | `kpis.consentRate: 0.5` | Referral Leads (Phase 3) |
| store visit `ref`, `pinCode`, `day`, `reserved` | — | `"MIA-5262"`, `"400070"`, `"Today"`, `["Wishlist"]` | Store Visits (Phase 3) |
| `getStoreVisits` result `kpis` | — | `{ visitsBooked: 26, bookingFormsOpened: 36, completionRate: 0.72, topSlot: "4:00 pm", topSlotShare: 0.62 }` | Store Visits (Phase 3) |
| `getAudiences` result `kpis`; `getAudienceMembers(params)` | method | `{ total: 18, rows: [{ segmentId: "list-no-hint", mobile: "+918863693824", … }] }` | Audiences (Phase 4) |

**Contract update**
`dashboardContract.js` was rewritten and now documents:
- `DASHBOARD_ENDPOINTS`, now 7 endpoints.
- The date and time zone rules, including which timestamp decides "in range" for each object.
- The common query parameters and paging.
- `FLOW_STEP_CODES` (flow-script codes), `EVENT_TYPES` (with each type's metadata) and `BUTTON_IDS`.
- The shapes of message, event, summary (incl. the exact FUNNEL definition), session + conversations parameters, referral, store visit, activity, and audiences + segment rules.

The file itself is the exact text; it is not repeated here to avoid two copies drifting apart.

**Real data mapping**

| Data | Karix source | What the backend must do |
|---|---|---|
| `message.sentAt / deliveredAt / readAt / failedAt / failureReason` | **Message status webhooks** for the campaign template message (sent, delivered, read, failed). Exact status values, timestamp field and error / reason fields: TBD – verify against Karix webhook documentation. | Store one row per campaign message, keyed by the message id Karix returns when we send. Update the status times as webhooks arrive; they can arrive out of order, so never move a status backwards (read beats delivered). `sent / delivered / read / failed` in the summary = messages sent in the range by their latest status. |
| Opener tap → `path`, session start | **Inbound interactive button reply** to the opener template, carrying our button id (IM_CELEBRATING / SHOPPING_FOR_HER / HERE_FOR_SPARKLE). Field holding the reply id, and how it links to the original message: TBD – verify against Karix webhook documentation. | Create a session (sessionId, userId, messageId) and set its `path`. Store a BUTTON_CLICK event with `atStep = "0"` and `flowStep` = 1 / 2 / 1-Sparkle. |
| Every other button tap (`BUTTON_CLICK`, `HINT_SENT`) | Inbound **button reply** webhooks | Map our button id to `atStep` / `flowStep` (see `BUTTONS` and `FLOW_STEP_CODES`). "Send to Husband" is stored as `HINT_SENT`. It only opens WhatsApp's forward sheet, so we can count the **tap**, never whether she actually forwarded it. |
| `CATEGORY_SELECTED` | Inbound reply to the 1A / 2A **carousel** ("Browse these" on a category card). Whether this arrives as a button reply or a quick-reply payload depends on how the carousel template is set up: TBD – verify against Karix webhook documentation. | Store the category from our own card / button id, not the visible text. |
| `BUDGET_SELECTED` | Inbound **list reply** (1A-Budget / 2A-Budget). Row id field: TBD – verify against Karix webhook documentation. | Map our row id to the budget band. |
| `ADD_TO_LIST` / `BUY_THIS_FOR_HER` product | Inbound reply to a **product carousel** card button | The card button id must identify the product, e.g. contain our SKU, so `metadata.product` can be stored. |
| `BUY_ONLINE` | Inbound button reply at 2C | Count the tap. Purchases happen on the website and are **not** visible to Karix; showing real purchases would need order data from the e-commerce side. |
| `STORE_VISIT_FORM_OPENED` | Inbound **list reply** "Open booking form" at C2 | Store the event (no step change). Feeds "Booking Form Opened". |
| `STORE_VISIT_BOOKED` → store visit | **WhatsApp Flow completion** (the form response: PIN code, store, day, time). Message type and response field names: TBD – verify against Karix webhook documentation. | Validate, generate the confirmation `ref` (e.g. MIA-4821, the same one sent to the customer), store the visit and an event with `flowStep = "C2"`. `bookingDate` = the IST date that "Today / Tomorrow / Sat" meant at booking time. |
| `DETAILS_CAPTURED` → referral | Three **inbound text messages** at 1J / 2F (name, DD/MM/YYYY date, 10-digit mobile) | Validate each answer as the flow script says. After all three are valid, store one DETAILS_CAPTURED event and a referral (`keyDate` as YYYY-MM-DD, `referredPhone` in E.164). |
| `referral.consent` | Inbound button reply at 1K / 2G (CONSENT_YES / CONSENT_NO) | Set `consent` on the referral. Until answered, `consent = null`. |
| `referral.status` | **Not from Karix.** Set by the CRM's follow-up (reminder scheduled, messaged, visited store) | The CRM must write the status back, or the backend must join with CRM data. `no_consent` is set automatically when consent = no. In mock data the status is generated (mock-only). |
| `KEEP_ME_POSTED` | Inbound button reply at sparkle 1I | Store the event; it marks an opt-in for new arrivals. |
| `session.status` | Derived | `Completed` = reached E1; `Active` = last inbound message less than 60 minutes ago (the flow script's IDLE rule); otherwise `Idle`. |
| `customer` (name, phone) | The **CRM** recipient list used to send the campaign; the phone is also on every Karix webhook | Store with the message at send time. Display names come from the CRM, not from WhatsApp. |
| `summary.daily` | All of the above | Group by IST day of each record's own timestamp (see "Dates and time zone"). |

**Mock-only items**
- **Referral `status`:** generated from the referral id and age, because the real value comes from the CRM.
- **Customer names and phone numbers:** made up. Phone numbers look real but are random, and nothing is ever sent to them.
- **Flow behaviour:**
  - The C2 day/time choice and the store list are generated. The demo store lookup in the flow script returns a fixed 3-store list; the mock uses 5 stores.
  - The **husband funnel** can show more customers at 2E than at 2C. Customers who book a visit straight from step 2 or 2B skip 2C but are then asked for her details. The flow script allows this, so it is correct, not a bug.
  - Sparkle customers only reach "Keep me posted" (1I) after booking a visit, as the flow script says, so opt-ins are few.


---

### Phase 2 — Shared UI pieces + Overview page matching the reference

**What changed and why**
The Overview page was rebuilt to show exactly what the reference Overview shows:
- **KPI cards:** Messages Sent, Delivery Rate, Open Rate and Click Rate.
- **Outcomes:** four tiles with daily trend lines (Referral leads, Ishara sent to husbands, Store visits booked, Buy-online clicks). A tile shows "–" with the reason when the selected path doesn't have that step.
- **Bot Flow Drop-off:** follows the selected path.
- **Activity Feed:** a live feed that refreshes on its own.
- **Categories Picked and Budget Chosen:** count and %, with path-aware subtitles.
- **The three paths:** a split bar plus three path cards, shown on All paths only.

Panels that are not in the reference were removed: Delivery health, Button / CTA activity and Path-wise performance. Their information is now in the KPI cards, the drop-off and "The three paths". Shared pieces used by later phases were also added: a hover tooltip, toast messages, formatting helpers and a polling hook.

**Files touched**
- `src/pages/Overview.jsx`: rebuilt as described above.
- `src/components/overview/ActivityFeed.jsx` (new): reads `getActivityFeed({ path, limit: 20 })`, refreshes every 15 s, animates new events in, and shows a message instead of breaking if the request fails.
- `src/components/charts/Sparkline.jsx` (new): trend line with per-day hover values.
- `src/components/common/Tooltip.jsx` (new): one app-wide hover tooltip for any element with `data-tip`. Text only, never HTML.
- `src/components/common/Toast.jsx` (new): `ToastProvider` + `useToast()`; announced to screen readers.
- `src/hooks/usePolling.js` (new): run now, then every N ms while the tab is visible; pause when hidden; run again when visible.
- `src/utils/format.js` (new): number, percentage, "3h ago", IST date/time and phone masking (`+91 98200 ••345`) helpers.
- `src/components/common/MetricCard.jsx`, `src/components/common/PanelHeader.jsx`: accept an emoji icon, as in the reference.
- `src/App.jsx`: mounts the tooltip and the toast provider.
- `src/styles/index.css`: reference styles for outcome tiles, drop-off bars, feed, split bar, legend, path cards, tooltip and toast.

**New data fields / service methods**
None. The Overview reads only fields added in Phase 1: `summary.sent / read / failed / openerTaps / outcomes / funnel / daily / pathCounts / pathStats / categoryCounts / budgetCounts`, and `getActivityFeed`.

| Overview element | Field(s) used |
|---|---|
| Messages Sent card | `summary.sent`, `summary.days` |
| Delivery Rate card | `summary.delivered ÷ summary.sent`, `summary.failed` |
| Open Rate card | `summary.read ÷ summary.delivered` |
| Click Rate card | `summary.openerTaps ÷ summary.delivered` |
| Outcome tiles | `summary.outcomes.referralLeads / hintsSent / visitsBooked / buyOnlineClicks` + `summary.daily[*]` for the trend |
| Bot Flow Drop-off | `summary.funnel` (percentages are of the first row, opener taps) |
| Activity Feed | `getActivityFeed({ path, limit: 20 })` |
| Categories Picked / Budget Chosen | `summary.categoryCounts`, `summary.budgetCounts` |
| The three paths | `summary.pathCounts`, `summary.pathStats` |

**Contract update**
None. Everything used was already in the contract from Phase 1.

**Real data mapping**
No new fields. Two notes for the backend that follow from what this page shows:
- **Open Rate** = read receipts ÷ delivered. Customers can switch read receipts off in WhatsApp, so this under-counts real opens. That's a WhatsApp limitation, not something the backend can fix.
- **Activity Feed** is polled every 15 s with `limit=20`. The `/api/dashboard/activity` endpoint should be cheap: an index on event timestamp, newest first, no date range.

**Mock-only items**
- None beyond Phase 1.


---

### Phase 3 — Conversations, Referral Leads and Store Visits matching the reference

**What changed and why**
The three table pages were rebuilt to show exactly what the reference shows.
- **Conversations:**
  - 5 KPI cards and a subtitle with range and path.
  - Path chips that drive the same path filter as the top toggle, so there is still only one filter.
  - Category and Step filters, search, and "Copy as CSV (N)".
  - Every column sortable (↓ ↑ ⇅); 12 rows per page with Previous / Next.
- **Referral Leads:**
  - 5 KPI cards, showing "–" when the selected path has no such step.
  - Show chips (All / Husbands / Wives / Consent: yes) and Copy as CSV.
  - The reference columns, incl. key date, consent and follow-up status; latest 40.
  - Opt-in Leads panel.
- **Store Visits:**
  - 3 KPI cards (Visits Booked, Booking Form Opened, Most Picked Slot).
  - "Recent Bookings" with Customer / Path / Boutique / Slot / Reserved / Ref; latest 15.

All three pages:
- Phone numbers are masked (`+91 98200 ••345`). Times show as "3h ago", with the exact IST time on hover.
- They keep their rows on screen while refreshing.
- The Refresh button now reloads them too, not only the Overview, without losing the current table page, filters or sorting.

**Files touched**
- `src/pages/Conversations.jsx`, `src/pages/Referrals.jsx`, `src/pages/StoreVisits.jsx`: rebuilt as described.
- `src/components/tables/TableKit.jsx` (new): `SortHeader` (with `aria-sort`), `nextSort`, `Pager`.
- `src/hooks/useDashboardQuery.js` (new): loads page data through the service; re-runs on filter change and on Refresh; keeps old data while loading; ignores out-of-order answers.
- `src/utils/csv.js` (new): `toCsv`, `copyText` (with a fallback when the clipboard API is blocked), `downloadCsv` (UTF-8 with BOM so Excel shows ₹ correctly; used by Audiences in Phase 4).
- `src/context/DashboardContext.jsx`: added `refreshTick`. `refresh()` now bumps it, so every page re-fetches (Phase 5's auto-refresh uses the same mechanism).
- `src/components/tables/TableParts.jsx`: path pills use the short label (Celebrating / Shopping for her / Sparkle) as in the reference.
- `src/styles/index.css`: chips, buttons, sortable headers, pager, empty state, 5- and 3-column KPI rows, compact table variant.
- `src/data/mockData.js`: raised three rates on the "I'm celebrating" path ("Send to Husband" 70→80%, "Add his details" 48→72%, nudge "Yes, go ahead" 35→50%). This is the extra husband referrals requested before the Referral Leads work: 30 days now has **39 husband referrals (+15)** and 59 in total, spread over 22 days, so chips, CSV and the 40-row limit can be tested properly.

**New data fields / service methods**
None. These pages use the Phase 1 contract: `getConversations` (incl. `kpis`, `query`, `category`, `flowStep`, `sort`, `dir`, `page`, `pageSize`), `getReferrals` (incl. `kpis`, `optIn`, `relationship`, `consent`), `getStoreVisits` (incl. `kpis`).

**How the CSV copies work**
"Copy as CSV" asks the service for all matching rows (`page=0, pageSize=5000`), not just the visible page, then copies them. The backend must allow `pageSize` up to 5,000 on `/conversations` and `/referrals`. Phone numbers in these copies are **masked**, the same as on screen. Full numbers are only offered in the Audiences downloads (Phase 4), and only when the user ticks "Full mobile numbers".

**Contract update**
None.

**Real data mapping**
No new fields. Points for the backend that follow from these pages:
- Sorting and paging happen **on the server** (`sort`, `dir`, `page`, `pageSize`). With real volumes, the dashboard must never download every session to sort it in the browser.
- The Conversations search box sends `query` after the user stops typing for 250 ms. It should match name, phone digits and session id, ignoring spaces.
- The Referral Leads "Status" column (New / Reminder scheduled / Messaged / Visited store / Consent not given) is CRM follow-up data, not Karix data (see Phase 1).

**Mock-only items**
- The three raised rates above are mock tuning only.

---

### Phase 4 — Audiences matching the reference

**What changed and why**
The Audiences page was rebuilt to show what the reference shows. It covers **all paths only**; the top toggle offers just "All paths" here.
- **KPI cards (4):**
  - Ready-made Segments
  - Engaged, Not Finished
  - Never Engaged
  - Completed or Opted In
- **"Where they stopped":**
  - A heading with the customer total.
  - The priority strip (1 Hint sent → 2 List started → 3 Browsing / shortlisted → 4 Never engaged).
  - The **"Full mobile numbers in downloads"** tick-box.
  - 5 segment cards. "Received, never engaged" spans the full width.
- **"Completed or opted in":** 4 segment cards.
- **What each segment card shows:**
  - name and count
  - definition
  - path pills and priority
  - suggested next step
  - "Use it for"
  - a **Download CSV** button, disabled when the count is 0
- **Build a Custom Audience:**
  - Filters: Segment, Category picked, Budget chosen, Last active (any time in range / last 24 hours / last 3 days).
  - A live count of matching customers.
  - Download CSV.
- **Removed:** the placeholder "Audience architecture" note, now that the real segments are built.

**Downloads**
- **Columns:** Customer, Mobile, Segment, Path, Last step reached, Category, Budget, Pieces shortlisted, Piece, Last active (IST), Suggested next step, Consent.
- **File name:** `mia-kc26-<segment>-<range>.csv`, e.g. `mia-kc26-list-started-hint-not-sent-7days.csv`. The custom builder uses `custom-audience`, or `<segment>-filtered`.
- **Encoding:** UTF-8 with BOM, so ₹ shows correctly in Excel.
- **Mobile numbers:**
  - Masked by default (`+91 88636 ••824`).
  - Full numbers only when the user ticks the box.
  - The reference has the box pre-ticked. We leave it **unticked** on purpose, so full numbers are always a deliberate choice.
- **After download:** a toast confirms it ("Downloaded 20 customers · <file>").

**Files touched**
- `src/pages/Audiences.jsx`: rebuilt.
- `src/styles/index.css`: segment cards (`.segcards`, `.segcard`, `.segcard.wide`), priority strip, tick-box, builder and result row, `.btn.sm`.

**New data fields / service methods**
None. The page uses the existing Phase 1 contract:
- `getAudiences({ from, to })` provides the counts and kpis.
- `getAudienceMembers({ from, to, segmentId, category, budget, activeWithinMinutes, page, pageSize })` provides the downloads.
- The builder's live count calls `getAudienceMembers` with `pageSize: 1` and reads `total`.

**Contract update**
None.

**Real data mapping**
- The segment rules are in `dashboardContract.js` (Audiences section). The backend must apply them to stored sessions and events.
- **"Where they stopped" is exclusive:** one segment per customer, decided by priority.
- **"Completed or opted in" can overlap.** So the builder's "All segments" count can include the same customer twice, as in the reference.
- **Full mobile numbers are personal data.**
  - `/audience-members` returns the full number, so this endpoint must be behind login and limited to staff allowed to export.
  - The backend should log exports: who, which segment, how many rows.
- **"Never engaged":** comes from Karix delivery and read status for the opener, plus the absence of any inbound reply.
- **Status field names:** exact Karix status field names are TBD – verify against Karix webhook documentation.

**Mock-only items**
- None new.

---


### Phase 5 — Real-time updates and production hardening

**What changed and why**
- **Auto-refresh every 30 seconds:**
  - Uses the same `refreshTick` as the Refresh button, so every page re-fetches without resetting the table page, filters, search or sort.
  - Pauses while the tab is hidden; refreshes immediately when it becomes visible.
  - Moves the date range forward when the IST day changes.
- **Summary guard:** the summary load now ignores late answers from older requests, as the pages already did. Fast filter changes can't show the wrong numbers.
- **Header:**
  - The "Updated" time comes from the last successful load, in IST.
  - Refresh shows "Dashboard refreshed" (or "Couldn't refresh...").
  - The "Data source: mock" pill is replaced by **"Sample data"**, shown only on mock data.
  - Conversations and Store Visits subtitles now use the reference's wording.
- **Sidebar counts:** sessions next to Conversations (`summary.totalSessions`) and referral leads next to Referral Leads (`summary.referrals`). Both follow the selected range and path.
- **Remembers your place:** the last page, path and range are saved in this browser (`localStorage`, key `mia-kc26-dashboard`) and restored on reload. If storage is blocked, the defaults are used.
- **Error states:**
  - "Couldn't load this page" card with Retry when a page has never loaded.
  - "Couldn't refresh" banner with Retry when a refresh fails but older data is on screen.
- **API provider:**
  - 15-second timeout (AbortController).
  - Plain-language messages for unreachable, timeout, 401, 403, 404, 429, 5xx and unreadable answers.
- **Production build:** no source maps in `dist` (`vite.config.js`), so the readable source isn't published with the site.
- **Lint:** `npm run lint` works again. The ESLint 9 flat config can't use `extends`, so the recommended rules are now their own entry, with the official Vite React settings for JSX components. It passes with 0 errors and 0 warnings. Also removed one unused import from the mock provider.
- **Favicon:** added (`public/favicon.svg`); the 404 in the console is gone. The browser tab title is now "Mia Karwa Chauth CRM".
- **README:** rewritten (run, configure, go live, project layout). `.env.example` now explains both settings and warns that `VITE_` values are visible in the browser.
- **Removed `recharts`:** the dependency was never used; all charts are hand-built SVG/CSS as in the reference.

**Files touched**
- New:
  - `src/utils/prefs.js`
  - `src/components/common/ErrorState.jsx`
  - `src/components/common/RefreshBanner.jsx`
  - `public/favicon.svg`
- Changed:
  - `src/context/DashboardContext.jsx`, `src/hooks/usePolling.js` (new `immediate` option), `src/App.jsx`
  - `src/components/layout/Topbar.jsx`, `src/components/layout/Sidebar.jsx`
  - all 5 pages (error card)
  - `src/services/apiDashboardProvider.js`, `src/services/mockDashboardProvider.js` (unused import only)
  - `src/styles/index.css`, `index.html`, `vite.config.js`, `eslint.config.js`, `README.md`

**How it was tested**
- **Fake backend:** the dashboard ran with `VITE_DASHBOARD_PROVIDER=api`, and a test backend served the mock data over HTTP. All 5 pages loaded through the real API provider with the same numbers as mock mode. This shows the contract and `apiDashboardProvider.js` work end to end.
- **Auto-refresh:**
  - On a visible tab, exactly `summary` and the current page were requested every 30 seconds, with page, filter, search and sort unchanged.
  - On a hidden tab, there were no requests for 30+ seconds.
  - On becoming visible, there was an immediate refresh.
- **Backend failure:**
  - With the backend returning 503, the banner and toast appeared and the old numbers stayed.
  - A page opened during the outage showed the error card; Retry recovered it.
  - With the backend not answering, the 15-second timeout showed the banner.
- **Remembering your place:** reloading restored the page (Store Visits), path (Shopping for her) and range (30 Days).

**New data fields / service methods**
None. The sidebar counts use existing summary fields.

**Contract update**
None.

**Real data mapping**
See "What the backend must provide before switching" at the top.

**Mock-only items**
- None new.


---

### Change v7 — Flow script v7: no budget step on "I'm celebrating"; Referral Leads and Store Visits show All paths only

**What changed and why**
Flow script v7 removes the budget question from the "I'm celebrating" path: she goes from Step 1A (category) straight to Step 1B (carousel, full category). The v6 → v7 text diff has no other change. Separately, the user asked for Referral Leads and Store Visits to show only the "All paths" toggle.

- **Overview:**
  - On "I'm celebrating", the **Budget Chosen** panel is removed (Categories Picked takes the full row) and the drop-off has no Budget step.
  - On **All paths**, Budget Chosen and the drop-off's Budget bar count **Shopping for her + Here for the sparkle only**. The bar is labelled "Budget (Shopping for her + Sparkle)" because it is smaller than the Carousel bar after it: celebrating customers skip it.
  - Shopping for her and Here for the sparkle are unchanged.
- **Conversations:** on "I'm celebrating" the Budget column is hidden in the table and in "Copy as CSV". If the table was sorted by Budget, it falls back to latest activity first. Other paths are unchanged.
- **Referral Leads and Store Visits:**
  - The top toggle offers **All paths** only, the same rule as Audiences (`ALL_PATHS_ONLY` in `Topbar.jsx`).
  - Both pages always request `path=all`, so a path picked on another page doesn't filter them. That path is kept and comes back when you return to Overview or Conversations.
  - The sidebar's Referral Leads count now adds up all paths (from `summary.pathStats`), so it matches the page.

**Files touched**
- `src/data/campaignConfig.js`: removed 1A-Budget from the wife step list.
- `src/data/mockData.js`: celebrating customers no longer pick a budget. The change uses the same random draws in the same order, so **every Shopping-for-her and Sparkle sample number is exactly as before** (checked by comparing old and new summaries). On the celebrating path only the budget figures and the drop-off changed.
- `src/services/mockDashboardProvider.js`: wife funnel without 1A-Budget; All-paths Budget step and `budgetCounts` exclude the wife path.
- `src/pages/Overview.jsx`, `src/pages/Conversations.jsx`, `src/pages/Referrals.jsx`, `src/pages/StoreVisits.jsx`, `src/components/layout/Topbar.jsx`, `src/components/layout/Sidebar.jsx`.
- `src/services/dashboardContract.js`: v7 reference, wife step codes, event notes, `budgetCounts` and FUNNEL rules.

**New data fields / service methods**
None.

**Contract update**
- `FLOW_STEP_CODES.wife` no longer has `1A-Budget`.
- On the wife path, `CATEGORY_SELECTED` moves the customer to `1B`, and `BUDGET_SELECTED` never occurs.
- `budgetCounts` and the All-paths funnel "budget" step **must exclude path "wife"**, even if older (v6-era) events contain wife budgets.

**Real data mapping**
- Celebrating customers' replies go category → carousel with no budget list reply in between, so their session `budget` is `null`.
- Karix payload field names for list replies: TBD – verify against Karix webhook documentation.

**Mock-only items**
- None new.


---

### Change 8 — Page clean-up: Cohorts, CSV downloads, fewer columns and cards

**What changed and why**
The user simplified three pages and the wording of the exports. Only screens changed; data, services, the contract and the API are unchanged.

- **Audiences renamed to Cohorts:**
  - The sidebar and the page title now say **Cohorts**.
  - The internal page id stays `audiences`, so the last-open page saved in the browser still works. The file `Audiences.jsx`, the service methods (`getAudiences`, `getAudienceMembers`) and the API endpoints (`/api/dashboard/audiences`, `/audience-members`) keep their names.
- **Cohorts page:**
  - **Removed** the "Received, never engaged" segment card. "Where they stopped" now shows 4 cards, and its "· N customers" total no longer includes never-engaged.
  - **Removed** "Never engaged" from the priority strip, which is now 1 Hint sent → 2 List started → 3 Browsing / shortlisted.
  - **Removed** the Ready-made Segments and Never Engaged KPI cards. Two small cards remain, **Engaged, Not Finished** and **Completed or Opted In**, in the normal 4-column card row, with the rest of the row left empty. As on other pages, the first card is the dark highlighted one.
  - **Removed** "Build a Custom Audience": the builder, its live count and its download.
  - The 8 remaining segment cards still have Download CSV, with the "Full mobile numbers" tick-box.
- **Referral Leads:** **removed the Status column** (New / Reminder scheduled / Messaged / Visited store / Consent not given) from the table and from the CSV. The table has 6 columns, the CSV 8. That status is CRM follow-up data, which the bot doesn't have yet (see Phase 1).
- **Conversations and Referral Leads:** **"Copy as CSV" is now "Download as CSV"**, with a download icon.
  - It **downloads a `.csv` file** instead of copying to the clipboard, the same way the Cohorts segment downloads work. The file is UTF-8 with BOM, so Excel shows ₹ correctly.
  - File names: `mia-kc26-conversations-<range>.csv` and `mia-kc26-referral-leads-<range>.csv`, e.g. `mia-kc26-conversations-7days.csv`.
  - The toast says "Downloaded N rows · <file name>". Rows and masked phone numbers are the same as before. Conversations still drops the Budget column on "I'm celebrating" (Change v7).

**Files touched**
- `src/components/layout/Sidebar.jsx`: menu label "Cohorts".
- `src/components/layout/Topbar.jsx`: page title "Cohorts".
- `src/pages/Audiences.jsx`: never-engaged card and priority step, two KPI cards and the builder removed; unused imports removed (`BUDGETS`, `CATEGORIES`, `PanelHeader`).
- `src/pages/Referrals.jsx`: Status column and CSV column removed; download instead of copy.
- `src/pages/Conversations.jsx`: download instead of copy.

Lint and build pass.

**Left in place on purpose:**
- `REFERRAL_STATUSES` and the never-engaged entry in `AUDIENCE_SEGMENTS` (`campaignConfig.js`).
- `copyText` in `src/utils/csv.js`.
- The `.segcard.wide` and builder styles in `index.css`.

They are unused now, but keeping them means the removed parts can be brought back by editing the page only.

**New data fields / service methods**
None. The builder's `pageSize: 1` count request is gone, so the Cohorts page now makes one request per refresh (`getAudiences`) plus one `getAudienceMembers` call per download.

**Contract update**
None. `dashboardContract.js` is unchanged. The backend should still return referral `status`, `kpis.segments`, `kpis.neverEngaged` and the `never-engaged` count, which keeps the contract stable; the dashboard simply doesn't show them now. `getAudienceMembers` filters `category`, `budget` and `activeWithinMinutes` stay supported but are no longer sent by the page.

**Real data mapping**
- No change.
- `/audience-members` still returns full mobile numbers for the segment downloads, so it still needs the access restriction described in "What the backend must provide".

**Mock-only items**
- None new.

---

### Change 9 — Connected to the developer's backend (exact field names)

**What changed and why**
The developer built the dashboard APIs in the chatbot backend (`DashboardController`, base `/api/dashboard`, port 8086). The dashboard was changed, step by step, to call those endpoints and to read **every field exactly as the backend names it**. Nothing is renamed on the dashboard side. The earlier `karwa-chauth-dashboard-api` code is no longer what the dashboard expects.

- **Connection (Step 1):** the Vite dev proxy points `/api` at `http://localhost:8086`. `.env.local` holds `VITE_DASHBOARD_PROVIDER` (still `mock`) and `VITE_API_BASE_URL`. `DASHBOARD_ENDPOINTS` lists the backend's 22 paths.
- **Path ids (Step 2):** `wife` → `celebrating` and `husband` → `shopping`, the backend's `flow` values. `sparkle` is unchanged.
- **Budget bands:** "Less than 20,000", "20,000 - 50,000", "Above 50,000". Only "Shopping for her" and "Here for the sparkle" ask the budget.
- **Service layer (Step 3):** `dashboardService` has one method per backend endpoint. `apiDashboardProvider` always sends `range=custom` with `from` / `to`.
- **Overview, sidebar and Activity Feed (Step 4):** `/metric-cards`, `/outcomes`, `/flow-dropoff`, `/paths`, `/activity`. Percentages come ready-made (0–100). Feed badges come from the backend (`MSG`, `ISHARA`, `VISIT`, `BUY`, `REFERRAL`, `OPT-IN`, `OPT-OUT`, `LEAD`) with matching colours. Categories Picked / Budget Chosen show "Not available yet" because the backend doesn't send those counts.
- **Conversations (Step 5):** `/conversations/summary`, `/conversations`, `/conversations/export`. The backend's parameter names (`flow`, `category` as a code like `PENDANT_CHAIN`, `step`, `search`, `sort`, `direction`, `page`). 50 rows per page. The CSV uses the backend's columns, with phones masked.
- **Referral Leads (Step 6):** `/referral-leads/summary`, `/referral-leads` (`show` = all / husbands / wives / consented), `/referral-leads/export`. A pager was added (50 per page; previously only the latest 40 were shown). The CSV leaves out the backend's Status column and masks mobiles.
- **Store Visits (Step 7):** `/store-visits/summary`, `/store-visits/bookings`. A pager was added (50 per page; previously the latest 15). Slot and Reserved text come from the backend (`slotLabel`, `reservedLabel`).
- **Cohorts (Step 8):** `/cohorts/summary` and one `/cohorts/<key>` per card. The segment ids in `AUDIENCE_SEGMENTS` were renamed to the backend's keys. The card text (definition, next step, use it for) stays in `campaignConfig.js`. Downloads use each card's own columns; the backend masks mobiles unless "Full mobile numbers in downloads" is ticked (`fullMobile`).
- **Clean-up (Step 9):**
  - The old service methods (`getSummary`, `getReferrals`, `getStoreVisits`, `getActivityFeed`, `getAudiences`, `getAudienceMembers`) were removed from `dashboardService`.
  - The mock's `getAudiences` / `getAudienceMembers` and its never-engaged rows were removed. `getSummary`, `getReferrals`, `getStoreVisits` and `getActivityFeed` stay in the mock only as building blocks for the backend-shaped methods.
  - `REFERRAL_STATUSES`, the never-engaged entry in `AUDIENCE_SEGMENTS`, and `rate` / `ago` in `format.js` were removed. Change 8 kept them so those parts could come back, but the backend has no never-engaged segment or referral follow-up status, so that would now need backend work first.
  - `dashboardContract.js` now documents the backend's endpoints and fields instead of the old shapes.

**Files touched**
- `vite.config.js`, `.env.local`, `.env.example`
- `src/services/`: `dashboardContract.js`, `dashboardService.js`, `apiDashboardProvider.js`, `mockDashboardProvider.js`
- `src/data/`: `campaignConfig.js` (path ids, budgets, `CATEGORY_CODES`, segment ids), `mockData.js` (path ids, budgets)
- `src/context/DashboardContext.jsx`, `src/components/layout/Sidebar.jsx`, `src/components/overview/ActivityFeed.jsx`
- `src/pages/`: `Overview.jsx`, `Conversations.jsx`, `Referrals.jsx`, `StoreVisits.jsx`, `Audiences.jsx`
- `src/utils/format.js` (`percent`, `agoMinutes`, `asIst`), `src/styles/index.css` (feed badge colours)

Lint and build pass, and every page was checked on sample data.

**New data fields / service methods**
All 15 `dashboardService` methods are new, one per backend endpoint (see "Field checklist").

**Contract update**
`dashboardContract.js` was rewritten to document the backend's endpoints, parameters and fields exactly.

**Real data mapping**
See "Before switching to `api`: open items for the backend" at the top of this file. The 403 must be fixed before switching `VITE_DASHBOARD_PROVIDER` to `api`.

**Mock-only items**
- Sample `optInLeads.optedOut` is `null`, and the sample "Clicked Buy Online" download has an empty SKU column.
- The sample "Completed or Opted In" total adds up the 4 cards. The backend counts each customer once.

---

### Change 10 — Categories Picked / Budget Chosen from the backend; Azure backend; Conversations path chips hidden

**What changed and why**
- **Categories Picked / Budget Chosen:** the developer added `GET /api/dashboard/category-budget-picks`. The Overview panels now show its rows exactly as sent: `label`, `customers` and the ready-made `pct` for each option. Before this, the panels said "Not available yet". The Budget panel is hidden when the backend sends `budgets.applicable = false` ("I'm celebrating" has no budget step).
- **Backend address:** `npm run dev` now forwards `/api` to `BACKEND_URL` in `.env.local`. This replaced the fixed `http://localhost:8086` and later the ngrok URL. It is now the Azure VM, `https://karvachauth-rlai.indiasouthcentral.cloudapp.azure.com`. `VITE_API_BASE_URL` stays empty, so the browser only calls its own address and no CORS is needed.
- **Conversations:** the Path chips above the table were hidden (commented out in `Conversations.jsx`). The table still follows the path chosen at the top of the page.

**Files touched**
- `vite.config.js` (proxy target from `BACKEND_URL`), `.env.local`
- `src/services/`: `dashboardContract.js` (`categoryBudgetPicks` endpoint and its documented shape), `apiDashboardProvider.js` and `dashboardService.js` (`getCategoryBudgetPicks`), `mockDashboardProvider.js` (same shape; removed in Change 11)
- `src/pages/Overview.jsx` (loads `/category-budget-picks` with `/outcomes` and `/flow-dropoff`; new `Bars` rows), `src/pages/Conversations.jsx` (Path chips hidden; `PATHS` / `setFilters` no longer imported there)

Lint and build pass. All path tabs were checked.

**New data fields / service methods**
- `getCategoryBudgetPicks(params)` → `{ categories: { total, rows }, budgets: { total, rows, applicable }, flow, range }`, row `{ key, label, customers, pct }`.

**Contract update**
`DASHBOARD_ENDPOINTS.categoryBudgetPicks` added and the response documented in `dashboardContract.js`.

**Real data mapping**
Category keys are the backend's codes (`PENDANTS`, `MIA_SUTRA` …); Mia Sutra is left out on "sparkle". Budget keys are `UNDER_20K`, `20_50K`, `ABOVE_50K`. The budget label text still needs the backend change in open item 3.

---

### Change 11 — Mock data removed

**What changed and why**
The dashboard now reads only the real backend. The mock provider, the sample data and the `VITE_DASHBOARD_PROVIDER` switch were removed, together with code that only the mock used. Pages did not change: they already called only `dashboardService`. If the backend is unreachable or returns an error, pages show "Couldn't load this page" with the reason and keep retrying.

**Files touched**
- Deleted: `src/services/mockDashboardProvider.js`, `src/data/mockData.js`, the `.gitkeep` files in `src/components/charts/` and `src/components/tables/`, and the empty `src/components/filters/` folder
- `src/services/dashboardService.js`: always uses `apiDashboardProvider`; `providerName` removed
- `src/components/layout/Topbar.jsx`: "Sample data" badge removed
- Unused code removed:
  - `campaignConfig.js`: `CATEGORY_EXCLUDED_ON`, `BUDGETS`, `BUTTONS`, `VISIT_DAYS`, `VISIT_SLOTS`, `REFERRAL_TYPES`
  - `TableParts.jsx`: `StatusPill`
  - `csv.js`: `copyText`
  - `format.js`: `pct`, `fullPhone`
  - `istDates.js`: `istDayStart`, `istDayEnd`, `istDatesBetween`
- `dashboardContract.js` (comment), `.env.local` and `.env.example` (no `VITE_DASHBOARD_PROVIDER`; `.env.example` now shows `BACKEND_URL`), `README.md`, this file

Lint and build pass. All 5 pages, on every path tab, were checked against a test backend serving the backend's exact shapes: 70 requests, all 200, no errors.

**New data fields / service methods**
None. `dashboardService` keeps its 16 methods.

**Contract update**
No endpoint or field changes. `FLOW_STEP_CODES` stays in `dashboardContract.js` as documentation of the backend's step codes.

**Real data mapping**
Unchanged. See "Open items for the backend" at the top of this file; item 1 (the Azure 404) blocks all live data.

**Mock-only items**
None any more. The "Mock-only items" notes in older entries describe the removed sample data.

---

### Change 12 — Overview: "Total Delivered" card

**What changed and why**
A **Total Delivered** card was added to the Overview's top row, between "Messages Sent" and "Delivery Rate". It shows how many messages reached customers, with "of N sent" underneath. Like the other cards it follows the path tabs and the Today / 7 Days / 30 Days range. The row now holds 5 cards on wide screens (the existing `kpi-grid five` layout, also used on Conversations) and wraps 2 per row on phones. Nothing else on the page changed.

**Files touched**
- `src/pages/Overview.jsx`: `kpi-grid` → `kpi-grid five`; one new `MetricCard`

Lint and build pass. Checked at desktop, mid and phone widths.

**New data fields / service methods**
None. The card reads `messagesDelivered` and `messagesSent` from `GET /metric-cards`, which the dashboard already loads (the Delivery Rate card already showed `messagesDelivered` in its small text).

**Contract update**
None. `messagesDelivered` is already documented for `/metric-cards` in `dashboardContract.js` and in the field checklist above.

**Real data mapping**
`messagesDelivered` = messages with a "delivered" status from Karix in the selected range and path, as counted by the backend.

