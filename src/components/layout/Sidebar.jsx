import { useDashboard } from "../../context/DashboardContext";
import { BarChart3, ContactRound, Gem, LayoutDashboard, MessageCircle, Store } from "lucide-react";

export const NAV = [
  ["overview", "Overview", LayoutDashboard],
  ["conversations", "Conversations", MessageCircle],
  ["referrals", "Referral Leads", ContactRound],
  ["audiences", "Cohorts", BarChart3],
  ["visits", "Store Visits", Store]
];

export default function Sidebar({ view, onNavigate }) {
  // Counts for the current range and path (reference: .menu .count).
  const { summary } = useDashboard();
    // Conversations: opener taps for the current range and path (GET /metric-cards → openerTaps).
  // Referral Leads: always every path (GET /paths → husbandsReferred on "celebrating" + wivesReferred on "shopping").
  const pathCard = (flow) => summary?.paths?.paths?.find((c) => c.flow === flow) || {};
  const counts = summary
    ? {
        conversations: summary.metricCards.openerTaps,
        referrals: (pathCard("celebrating").husbandsReferred || 0) + (pathCard("shopping").wivesReferred || 0)
      }
    : {};


  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 border-r border-kc-line bg-kc-side lg:flex lg:flex-col">
      <div className="grid gap-2 px-6 pb-[18px] pt-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-mia-700 text-gold-500">
            <Gem size={20} strokeWidth={1.6} />
          </div>
          <div className="font-display text-[23px] font-medium leading-none text-kc-deep">Mia by Tanishq</div>
        </div>
        <div className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-kc-rose">Karwa Chauth CRM</div>
      </div>

      <nav className="grid flex-1 content-start gap-1 overflow-y-auto px-3.5 py-2.5" aria-label="Sections">
        {NAV.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={view === id ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors ${
              view === id
                ? "bg-kc-accentSoft font-medium text-mia-700"
                : "text-kc-ink2 hover:bg-kc-panel2"
            }`}
          >
            <Icon size={19} strokeWidth={1.5} className={view === id ? "text-mia-700" : "text-kc-ink3"} />
            {label}
            {counts[id] != null && <span className="nav-count">{counts[id].toLocaleString("en-IN")}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4">
        <div className="grid gap-1 rounded-[14px] bg-kc-deep px-3 pb-3.5 pt-4 text-center">
          <span className="text-[11px] font-medium tracking-[0.16em] text-gold-500">POWERED BY</span>
          <span className="font-display text-lg font-medium text-[#FFF6F0]">RightLeft AI</span>
        </div>
      </div>
    </aside>
  );
}
