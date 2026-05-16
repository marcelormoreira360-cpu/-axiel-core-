import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/card";
import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { getTerm } from "@/modules/ui/terminology";

type InsightItem = {
  title: string;
  text: string;
};

type GuidedAiInsightsPanelProps = {
  title?: string;
  summary: string;
  patterns?: InsightItem[];
  nextSteps?: InsightItem[];
  compact?: boolean;
};

export function GuidedAiInsightsPanel({
  title = `AI ${getTerm("insight", "plural")}`,
  summary,
  patterns = [],
  nextSteps = [],
  compact = false,
}: GuidedAiInsightsPanelProps) {
  return (
    <Card className={compact ? "p-5" : "p-6"}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-axiel-soft">
          <Sparkles className="h-5 w-5 text-axiel-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={compact ? "text-xl font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"}>{title}</h2>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-axiel-soft px-3 py-1.5 text-xs font-semibold text-black/55">
              <ShieldCheck className="h-3.5 w-3.5" /> Placeholder
            </span>
          </div>
          <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900/80">{AI_INSIGHT_LABEL}</p>
          <p className="mt-4 text-sm leading-6 text-black/60">{summary}</p>
        </div>
      </div>

      <div className={compact ? "mt-4 grid gap-3" : "mt-5 grid gap-4 md:grid-cols-2"}>
        <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-sm font-semibold text-black/80">Patterns</p>
          <div className="mt-3 grid gap-3">
            {(patterns.length ? patterns : [{ title: "No pattern yet", text: "The system will show simple trends when more data is available." }]).map((item) => (
              <div key={`${item.title}-${item.text}`}>
                <p className="text-sm font-semibold text-black/75">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-black/50">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-sm font-semibold text-black/80">{getTerm("nextStep", "plural")}</p>
          <div className="mt-3 grid gap-3">
            {(nextSteps.length ? nextSteps : [{ title: "Keep the record updated", text: "Add notes after the next interaction so the dashboard can guide the team." }]).map((item) => (
              <div key={`${item.title}-${item.text}`} className="flex gap-2">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-axiel-gold" />
                <div>
                  <p className="text-sm font-semibold text-black/75">{item.title}</p>
                  <p className="mt-1 text-sm leading-5 text-black/50">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
