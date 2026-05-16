import type { ResultsAnalyticsSummary, ResultsMetric } from "@/modules/results/analytics-types";
import { buildBusinessInsights } from "@/modules/results/business-insight-rules";

export function buildResultsSummary(metrics: ResultsMetric[]): ResultsAnalyticsSummary {
  const primaryKeys = ["revenue", "sessions", "conversion_rate"];

  const primaryMetrics = metrics.filter((metric) => primaryKeys.includes(metric.key)).slice(0, 3);
  const secondaryMetrics = metrics.filter((metric) => !primaryKeys.includes(metric.key)).slice(0, 5);

  return {
    primaryMetrics,
    secondaryMetrics,
    businessInsights: buildBusinessInsights(metrics),
  };
}
