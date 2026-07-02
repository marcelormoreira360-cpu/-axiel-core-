export default function Loading() {
  return (
    <div className="animate-pulse p-6">
      <div className="h-6 w-40 rounded-lg bg-black/[.06] dark:bg-white/[.07] mb-2" />
      <div className="h-4 w-56 rounded bg-black/[.04] dark:bg-white/[.05] mb-6" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="h-5 w-24 rounded bg-black/[.06] dark:bg-white/[.07]" />
            {Array.from({ length: 2 }).map((_, row) => (
              <div key={row} className="h-24 rounded-xl bg-black/[.04] dark:bg-white/[.05]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
