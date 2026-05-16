import type { PatientJourneyTimelineItem } from "@/modules/patient-journey/timeline-builder";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function PatientJourneyTimeline({ items }: { items: PatientJourneyTimelineItem[] }) {
  return (
    <section className="rounded-2xl border border-axiel-line bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-axiel-text-primary">Journey Timeline</h3>
      <div className="mt-4 space-y-3">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-2xl bg-axiel-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-axiel-text-primary">{item.title}</p>
              <span className="text-xs text-axiel-text-secondary">{formatDate(item.date)}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-axiel-secondary">{item.label}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-axiel-text-secondary">{item.description}</p>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-axiel-text-secondary">The patient journey will appear here.</p> : null}
      </div>
    </section>
  );
}
