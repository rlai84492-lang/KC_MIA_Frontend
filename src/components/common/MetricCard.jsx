// KPI card (reference: .card). `icon` is an emoji (as in the reference) or a lucide icon component.
export default function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="kpi">
      {Icon && (
        <div className="kpi-icon text-[19px]" aria-hidden="true">
          {typeof Icon === "string" ? Icon : <Icon size={19} strokeWidth={1.7} />}
        </div>
      )}
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}
