// Small area trend for the outcome tiles (reference: spark()). Hovering a day shows its value.
// points: [{ label, value }]
export default function Sparkline({ points, color, format = String }) {
  const W = 200;
  const H = 34;
  const pad = 3;
  const n = points.length;
  if (!n) return <div style={{ height: H }} />;

  const values = points.map((p) => p.value);
  let max = Math.max(...values);
  let min = Math.min(...values);
  if (max === min) { max += 1; min -= 1; }
  const x = (i) => (n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  const coords = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const slot = n === 1 ? W : (W - 2 * pad) / (n - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M${x(0)},${H} L${coords.join(" L")} L${x(n - 1)},${H} Z`} style={{ fill: color }} opacity=".12" />
      <polyline points={coords.join(" ")} fill="none" style={{ stroke: color }} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r="2.8" style={{ fill: color }} />
      {points.map((p, i) => (
        <rect key={p.label} x={(x(i) - slot / 2).toFixed(1)} y="0" width={slot.toFixed(1)} height={H} fill="transparent" data-tip={`${p.label}\n${format(p.value)}`} />
      ))}
    </svg>
  );
}
