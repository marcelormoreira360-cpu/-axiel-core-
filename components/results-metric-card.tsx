import { Card } from "@/components/ui/card";
import type { ResultsMetric } from "@/modules/results/analytics-types";

export function ResultsMetricCard({ metric }: { metric: ResultsMetric }) {
  return (
    <Card>
      <p className="text-sm text-axiel-text-secondary">{metric.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-axiel-text-primary">{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-axiel-text-secondary">{metric.helper}</p>
    </Card>
  );
}
