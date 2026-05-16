import { Card } from "@/components/ui/card";
import { ButtonSecondary } from "@/components/ui/button";
import type { BusinessInsight } from "@/modules/results/analytics-types";

export function BusinessInsightCard({ insight }: { insight: BusinessInsight }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-axiel-text-primary">{insight.title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-axiel-text-secondary">{insight.message}</p>
        </div>
        <ButtonSecondary>{insight.actionLabel}</ButtonSecondary>
      </div>
    </Card>
  );
}
