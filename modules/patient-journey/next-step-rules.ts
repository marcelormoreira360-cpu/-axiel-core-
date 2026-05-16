import type { PatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";

export function getSnapshotPrimaryAction(snapshot: PatientJourneySnapshot) {
  if (snapshot.pending_reviews_count > 0) return "Review Insight";
  if (snapshot.follow_up_status !== "Clear") return "Create follow-up";
  return "Open patient";
}
