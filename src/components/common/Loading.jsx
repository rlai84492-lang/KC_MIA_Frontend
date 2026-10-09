export default function Loading({ label = "Loading dashboard..." }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-sm text-stone-500">{label}</div>
    </div>
  );
}