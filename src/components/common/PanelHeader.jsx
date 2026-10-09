// Reference panel header: round icon (emoji or lucide component), Fraunces title, small subtitle, optional right-side content.
export default function PanelHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="panel-header">
      {Icon && (
        <div className="panel-icon" aria-hidden="true">
          {typeof Icon === "string" ? <span className="text-lg">{Icon}</span> : <Icon size={18} strokeWidth={1.7} />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="muted m-0">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
