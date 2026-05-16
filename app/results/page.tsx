import { Shell } from "@/components/shell";
import { ResultsMetricCard } from "@/components/results-metric-card";
import { ResultsSummarySection } from "@/components/results-summary-section";
import { BusinessInsightCard } from "@/components/business-insight-card";
import { getCurrentClinic } from "@/services/clinic-service";
import { getResultsAnalyticsSummary } from "@/services/results-analytics-service";

export default async function ResultsPage() {
  const clinic = await getCurrentClinic();
  const summary = clinic
    ? await getResultsAnalyticsSummary(clinic.id)
    : {
        primaryMetrics: [],
        secondaryMetrics: [],
        businessInsights: [],
      };

  return (
    <Shell>
      <div className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
        <header>
          <p className="text-sm font-medium text-axiel-text-secondary">Results</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-axiel-text-primary">
            Results Dashboard
          </h1>
          <p className="mt-2 text-axiel-text-secondary">Understand your clinic’s progress.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {summary.primaryMetrics.map((metric) => (
            <ResultsMetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <ResultsSummarySection metrics={summary.secondaryMetrics} />

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-axiel-text-primary">Business Insights</h2>
              <p className="mt-1 text-sm text-axiel-text-secondary">
                Simple suggestions to help the clinic move forward.
              </p>
            </div>

            {summary.businessInsights.slice(0, 5).map((insight) => (
              <BusinessInsightCard key={insight.title} insight={insight} />
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
