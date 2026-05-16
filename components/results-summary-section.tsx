import { Card } from "@/components/ui/card";
import type { ResultsMetric } from "@/modules/results/analytics-types";

export function ResultsSummarySection({ metrics }: { metrics: ResultsMetric[] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-axiel-text-primary">Clinic activity</h2>
          <p className="mt-1 text-sm text-axiel-text-secondary">A simple view of what is moving.</p>
        </div>
        <details className="text-sm text-axiel-text-secondary">
          <summary className="cursor-pointer rounded-xl border border-axiel-line px-4 py-2">View details</summary>
          <p className="mt-3 max-w-xs text-xs leading-5">
            Advanced analytics, trends, exports, and comparisons will be added in a future phase.
          </p>
        </details>
      </div>

      <div className="mt-6 grid gap-3">
        {metrics.slice(0, 5).map((metric) => (
          <div
            key={metric.key}
            className="flex items-center justify-between rounded-2xl border border-axiel-line bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-axiel-text-primary">{metric.label}</p>
              <p className="text-xs text-axiel-text-secondary">{metric.helper}</p>
            </div>
            <p className="text-lg font-semibold text-axiel-text-primary">{metric.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
