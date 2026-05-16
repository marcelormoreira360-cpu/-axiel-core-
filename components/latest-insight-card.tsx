import { Card } from "@/components/card";
import type { PatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";

export function LatestInsightCard({ snapshot }: { snapshot: PatientJourneySnapshot }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-axiel-text-secondary">Latest Insight</p>
          <h3 className="mt-2 text-xl font-semibold text-axiel-text-primary">{snapshot.latest_insight_title}</h3>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          {snapshot.latest_insight_status}
        </span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-axiel-text-secondary">{snapshot.latest_insight_summary}</p>
    </Card>
  );
}
