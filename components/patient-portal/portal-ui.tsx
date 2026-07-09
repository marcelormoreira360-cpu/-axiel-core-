"use client";

export function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function formatDateTime(value: string | null | undefined, locale: string, at: string) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} ${at} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

export function shortText(value: string | null | undefined, fallback: string, max = 180) {
  const clean = value?.trim();
  if (!clean) return fallback;
  return clean.length > max ? `${clean.slice(0, max - 3)}…` : clean;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{title}</p>
      {children}
    </div>
  );
}
