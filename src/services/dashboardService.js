import { apiDashboardProvider } from "./apiDashboardProvider";
import { mockDashboardProvider } from "./mockDashboardProvider";

// Which provider the dashboard reads from: "mock" (default) or "api" (the real backend).
// Set VITE_DASHBOARD_PROVIDER in .env.local — see INTEGRATION_NOTES.md → "Going live with real data".
const providerName = import.meta.env.VITE_DASHBOARD_PROVIDER === "api" ? "api" : "mock";

const provider = providerName === "api" ? apiDashboardProvider : mockDashboardProvider;

// The only way screens get data. Each method matches one backend endpoint (DashboardController):
// screens pass the backend's parameter names (from, to, flow, search, step, …) and read the
// backend's field names exactly as the API returns them.
export const dashboardService = {
  providerName,

  // Overview
  getMetricCards: (params = {}) => provider.getMetricCards(params),
  getOutcomes: (params = {}) => provider.getOutcomes(params),
  getFlowDropoff: (params = {}) => provider.getFlowDropoff(params),
  getActivity: (params = {}) => provider.getActivity(params),
  getPaths: (params = {}) => provider.getPaths(params),
  getCategoryBudgetPicks: (params = {}) => provider.getCategoryBudgetPicks(params),

  // Conversations
  getConversationsSummary: (params = {}) => provider.getConversationsSummary(params),
  getConversations: (params = {}) => provider.getConversations(params),
  exportConversations: (params = {}) => provider.exportConversations(params),

  // Store Visits
  getStoreVisitsSummary: (params = {}) => provider.getStoreVisitsSummary(params),
  getStoreVisitsBookings: (params = {}) => provider.getStoreVisitsBookings(params),

  // Referral Leads
  getReferralLeadsSummary: (params = {}) => provider.getReferralLeadsSummary(params),
  getReferralLeads: (params = {}) => provider.getReferralLeads(params),
  exportReferralLeads: (params = {}) => provider.exportReferralLeads(params),

  // Cohorts
  getCohortsSummary: (params = {}) => provider.getCohortsSummary(params),
  getCohortSegment: (key, params = {}) => provider.getCohortSegment(key, params)
};

