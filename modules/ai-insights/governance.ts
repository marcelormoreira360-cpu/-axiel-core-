import { aiInsightLabel, getTerm } from "@/modules/ui/terminology";

export const aiInsightRequiredLabel = aiInsightLabel();

export const aiGovernanceRules = [
  "Do not generate diagnosis.",
  `Do not generate ${getTerm("session", "lower")} plans.`,
  "Do not prescribe medications or supplements.",
  "Use patient-friendly language.",
  `Show patterns and correlations only.`,
  `Generated outputs start as pending review, not final.`,
  "Require optional human validation before marking an AI output as final.",
  "Track who approved, when approval happened, and any changes made.",
] as const;

export function buildAiGovernanceNotice() {
  return `${aiInsightRequiredLabel}. These ${getTerm("insight", "lowerPlural")} are structured support only and require practitioner review.`;
}
