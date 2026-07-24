export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-slate-500">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
