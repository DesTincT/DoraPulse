export function StatusDot({ ok, label }) {
  const color = ok ? 'bg-green-500' : 'bg-base-300';
  return (
    <div className="flex items-center gap-2 text-sm text-base-content/80">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
