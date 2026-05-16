import type { AiInsightReviewStatus } from "@/lib/types";

export type VisibleAiInsightReviewStatus = Exclude<AiInsightReviewStatus, "archived">;

export function isVisibleAiInsightStatus(status?: AiInsightReviewStatus | null) {
  return status !== "archived";
}

export function aiInsightStatusLabel(status?: AiInsightReviewStatus | null) {
  switch (status) {
    case "final":
      return "Final";
    case "needs_changes":
      return "Needs Adjustment";
    case "pending_review":
    default:
      return "In Review";
  }
}

export function aiInsightStatusTone(status?: AiInsightReviewStatus | null) {
  return status === "final" ? "final" : "review";
}
