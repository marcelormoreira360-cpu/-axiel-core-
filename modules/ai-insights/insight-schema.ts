import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import type { AiInsightOutput } from "@/lib/types";

export const aiInsightJsonShape = {
  label: AI_INSIGHT_LABEL,
  structured_summary: {
    overview: "Brief neutral summary of the available information.",
    key_context: ["Relevant non-diagnostic context point."],
    current_status: "Neutral current-status summary based only on the data.",
  },
  patterns_and_correlations: [
    {
      title: "Pattern title",
      insight: "Non-diagnostic observation connecting available data points.",
      related_inputs: ["Intake", "Session notes", "Patient history"],
    },
  ],
  practitioner_review_points: ["Questions or points the practitioner may review."],
  data_limitations: ["What data is missing or incomplete."],
  safety_note: "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
} satisfies AiInsightOutput;

export function coerceAiInsightOutput(value: unknown): AiInsightOutput {
  const object = typeof value === "object" && value !== null ? (value as Record<string, any>) : {};

  return {
    label: AI_INSIGHT_LABEL,
    structured_summary: {
      overview: String(object.structured_summary?.overview ?? "No summary was generated."),
      key_context: Array.isArray(object.structured_summary?.key_context)
        ? object.structured_summary.key_context.map(String).filter(Boolean).slice(0, 8)
        : [],
      current_status: String(object.structured_summary?.current_status ?? "Not enough information to summarize current status."),
    },
    patterns_and_correlations: Array.isArray(object.patterns_and_correlations)
      ? object.patterns_and_correlations.slice(0, 8).map((item: any) => ({
          title: String(item?.title ?? "Observed pattern"),
          insight: String(item?.insight ?? ""),
          related_inputs: Array.isArray(item?.related_inputs) ? item.related_inputs.map(String).filter(Boolean).slice(0, 5) : [],
        }))
      : [],
    practitioner_review_points: Array.isArray(object.practitioner_review_points)
      ? object.practitioner_review_points.map(String).filter(Boolean).slice(0, 10)
      : [],
    data_limitations: Array.isArray(object.data_limitations)
      ? object.data_limitations.map(String).filter(Boolean).slice(0, 10)
      : [],
    safety_note:
      "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
  };
}
