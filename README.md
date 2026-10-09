# Mia by Tanishq — Karwa Chauth Campaign Dashboard

React 19 + Vite 6 + Tailwind 3 dashboard for the Karwa Chauth WhatsApp campaign (Karix). It has five pages: Overview, Conversations, Referral Leads, Cohorts and Store Visits. Live data comes from the chatbot backend's dashboard APIs, and the dashboard refreshes itself every 30 seconds.

## Pages

| Page | What it shows | Export |
|---|---|---|
| Overview | KPI cards, outcome tiles with trends, bot flow drop-off, categories and budgets, the three paths, live Activity Feed | — |
| Conversations | 5 KPI cards; every session with path, step, category, budget and last activity; filters, search, sorting; 50 rows per page | **Download as CSV** (all matching rows, phones masked) |
| Referral Leads | 5 KPI cards; contacts customers shared (husband / wife) with relation, mobile, key date and consent; Sparkle opt-ins; 50 rows per page | **Download as CSV** (phones masked) |
| Cohorts | 2 KPI cards (Engaged, Not Finished · Completed or Opted In); 4 "Where they stopped" and 4 "Completed or opted in" segments | **Download CSV** per segment. Phones are masked unless "Full mobile numbers in downloads" is ticked |
| Store Visits | 3 KPI cards; boutique bookings with slot, reserved pieces and reference; 50 rows per page | — |

Referral Leads, Cohorts and Store Visits always cover all paths. CSV files are named `mia-kc26-<page or segment>-<range>.csv`, e.g. `mia-kc26-conversations-7days.csv`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run build      # production build in dist/
npm run preview    # serve the production build locally
npm run lint       # code checks (should report no problems)
```

## Configuration

`.env.local` (copy `.env.example` if it is missing) sets:

| Variable | Values | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | empty (recommended) or a URL | Where the browser sends API requests. Empty = same address as the dashboard (`/api/dashboard/...`), so no CORS is needed. A full URL makes the browser call the backend directly, which needs CORS on the backend. |
| `BACKEND_URL` | a URL | Only for `npm run dev`: Vite forwards `/api` to this backend (see `vite.config.js`). Currently the Azure VM, `https://karvachauth-rlai.indiasouthcentral.cloudapp.azure.com`. If it is not set, Vite uses `http://localhost:8086`. |

Vite reads these when it starts, so restart `npm run dev` (or rebuild) after changing them. Open backend items are listed in `INTEGRATION_NOTES.md`.

The dashboard has no sample data: it always reads the backend. If the backend is unreachable or returns an error, pages show "Couldn't load this page" with the reason and keep retrying every 30 seconds.

**Never put the Karix API key or webhook secret in this app.** Anything in the frontend can be read by anyone who opens the dashboard. Karix credentials belong to the backend only.

## How data flows

```text
Karix WhatsApp API ──webhooks──▶ chatbot backend (Spring Boot, MySQL)
                                     │  DashboardController: /api/dashboard/* (port 8086; Azure VM behind nginx)
                                     ▼
pages ──▶ dashboardService ──▶ apiDashboardProvider ──▶ /api/dashboard/*
                                                      (npm run dev: Vite forwards /api to BACKEND_URL)
```

- **Pages only use `dashboardService`.** It has one method per backend endpoint. Pages never call `fetch` themselves.
- **Exact backend names.** Pages send the backend's parameter names (`flow`, `from`, `to`, `search`, `step`, `show`, `page`, `fullMobile` …) and read the backend's field names as they come.
- **Every endpoint, parameter and field is documented** in `src/services/dashboardContract.js`.
- **The integration guide** is `INTEGRATION_NOTES.md`, starting with "Going live with real data". It lists the open backend items, how up to date the dashboard is, and the field checklist. Its change log records every change.

## Real-time behaviour

- **Every 30 seconds:** the sidebar counts and the current page reload. Table page, filters, search and sort are kept.
- **Hidden tab:** polling pauses, and the dashboard refreshes immediately when you come back.
- **Activity Feed:** the Overview feed updates every 15 seconds.
- **If the backend fails:** the last data stays on screen with a "Couldn't refresh" banner and Retry. Requests time out after 15 seconds.
- **All dates are India Standard Time (Asia/Kolkata).** The backend server must run in IST.

## Project layout

```text
src/
  pages/            Overview, Conversations, Referrals, Audiences (shown as "Cohorts"), StoreVisits
  components/       layout (sidebar, top bar), common (cards, toast, tooltip, errors), tables, charts, overview feed
  context/          DashboardContext: filters, sidebar data, refresh / auto-refresh
  hooks/            usePolling, useDashboardQuery
  services/         dashboardService, apiDashboardProvider (the HTTP calls), dashboardContract (the API contract)
  data/             campaignConfig (flow steps, labels, category codes, cohort card text)
  utils/            IST dates, number / phone / percentage formatting, CSV, saved preferences
```

The flow steps, labels and categories follow the chatbot flow script (v7: no budget question on "I'm celebrating"). Budget labels come from the backend: "Less than 20,000", "20,000 - 50,000", "Above 50,000".

**Naming:** the Cohorts page is called `audiences` inside the code (its page id and `Audiences.jsx`), so saved preferences keep working. Its data comes from the backend's `/cohorts/...` endpoints.
