import { Card } from "@/components/card";
import type { PatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";

export function NextStepCard({ snapshot }: { snapshot: PatientJourneySnapshot }) {
  return (
    <Card className="p-6">
      <p className="text-sm text-axiel-text-secondary">Next Step</p>
      <p className="mt-3 line-clamp-3 text-base leading-7 text-axiel-text-primary">{snapshot.next_step}</p>
    </Card>
  );
}
