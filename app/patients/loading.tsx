export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-6 w-48 rounded-lg bg-black/[.06] dark:bg-white/[.07]" />
      <div className="h-4 w-64 rounded bg-black/[.04] dark:bg-white/[.05]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-black/[.04] dark:bg-white/[.05]" />
        ))}
      </div>
    </div>
  );
}
