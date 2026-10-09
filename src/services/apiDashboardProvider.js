import { DASHBOARD_ENDPOINTS } from "./dashboardContract";

// Base URL of the dashboard backend. Empty = same origin (e.g. a reverse proxy serving /api/dashboard/*).
// Only the backend holds Karix credentials; this app never sees them.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// A request that takes longer than this is cancelled and reported, instead of leaving the page waiting.
export const REQUEST_TIMEOUT_MS = 15000;

// Plain-language message for a failed HTTP status (shown in the error card / refresh banner).
function statusMessage(status) {
  if (status === 401) return "You’re signed out of the dashboard server (401).";
  if (status === 403) return "You don’t have access to this data (403).";
  if (status === 404) return "The dashboard server doesn’t have this endpoint yet (404).";
  if (status === 429) return "The dashboard server is busy. Too many requests (429).";
  if (status >= 500) return `The dashboard server had a problem (${status}).`;
  return `The dashboard server refused the request (${status}).`;
}

async function request(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const url = `${API_BASE_URL}${path}${query.toString() ? `?${query.toString()}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The dashboard server took too long to answer.");
    throw new Error("Can’t reach the dashboard server. Check the connection.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(statusMessage(response.status));

  try {
    return await response.json();
  } catch {
    throw new Error("The dashboard server sent an answer the dashboard couldn’t read.");
  }
}

// Every call sends the dashboard's IST dates as a custom range: range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD.
// (The backend's own "today" / "7d" / "30d" would follow the server clock instead.)
const withRange = (params = {}) => ({ range: "custom", ...params });
const get = (path) => (params) => request(path, withRange(params));

// Real backend (DashboardController). Parameter names and response fields are the backend's own:
// nothing is renamed here.
export const apiDashboardProvider = {
  // Overview
  getMetricCards: get(DASHBOARD_ENDPOINTS.metricCards),
  getOutcomes: get(DASHBOARD_ENDPOINTS.outcomes),
  getFlowDropoff: get(DASHBOARD_ENDPOINTS.flowDropoff),
  getActivity: get(DASHBOARD_ENDPOINTS.activity),
  getPaths: get(DASHBOARD_ENDPOINTS.paths),
  getCategoryBudgetPicks: get(DASHBOARD_ENDPOINTS.categoryBudgetPicks),

  // Conversations
  getConversationsSummary: get(DASHBOARD_ENDPOINTS.conversationsSummary),
  getConversations: get(DASHBOARD_ENDPOINTS.conversations),
  exportConversations: get(DASHBOARD_ENDPOINTS.conversationsExport),

  // Store Visits
  getStoreVisitsSummary: get(DASHBOARD_ENDPOINTS.storeVisitsSummary),
  getStoreVisitsBookings: get(DASHBOARD_ENDPOINTS.storeVisitsBookings),

  // Referral Leads
  getReferralLeadsSummary: get(DASHBOARD_ENDPOINTS.referralLeadsSummary),
  getReferralLeads: get(DASHBOARD_ENDPOINTS.referralLeads),
  exportReferralLeads: get(DASHBOARD_ENDPOINTS.referralLeadsExport),

  // Cohorts: one download endpoint per card; `key` is the card's `key` from /cohorts/summary
  getCohortsSummary: get(DASHBOARD_ENDPOINTS.cohortsSummary),
  getCohortSegment: (key, params) => {
    const path = DASHBOARD_ENDPOINTS.cohortSegments[key];
    if (!path) return Promise.reject(new Error(`Unknown cohort "${key}".`));
    return request(path, withRange(params));
  }
};

