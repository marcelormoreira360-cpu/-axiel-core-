import Link from "next/link";
import { Brain, ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AiInsightReviewCard } from "@/components/ai-insight-review-card";
import type { AiInsight, Patient } from "@/lib/types";
import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { aiInsightStatusLabel } from "@/modules/ai-insights/status-labels";
import type { AiValidationEvent } from "@/services/ai-insight-service";
import { generateAiInsightAction } from "@/app/patients/[id]/insights/actions";

function eventLabel(action: AiValidationEvent["action"]) {
  switch (action) {
    case "approved_final":
      return "Approved";
    case "requested_changes":
      return "Adjustment requested";
    case "generated_pending_review":
      return "Created for review";
    case "archived":
      return "Hidden";
    case "reopened":
      return "Reopened";
    default:
      return action;
  }
}

export function AiInsightPanel({
  patient,
  insight,
  validationEvents = [],
  error,
}: {
  patient: Patient;
  insight: AiInsight | null;
  validationEvents?: AiValidationEvent[];
  error?: string;
}) {
  const generateAction = generateAiInsightAction.bind(null, patient.id);
  const output = insight?.review_status === "final" && insight.final_output ? insight.final_output : insight?.output;

  return (
    <div className="space-y-5">
      <Card className="bg-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-axiel-soft">
              <Brain className="h-6 w-6 text-axiel-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-black/35">AI INSIGHTS</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black/85 md:text-4xl">Simple insight review</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
                Review the insight, approve it, or request changes. Technical details stay hidden unless needed.
              </p>
            </div>
          </div>
          <form action={generateAction}>
            <Button variant="secondary" className="min-h-12 px-5">
              <RefreshCw className="h-4 w-4" /> Generate new draft
            </Button>
          </form>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-100 bg-red-50">
          <p className="text-sm font-semibold text-red-700">AI insight could not be updated.</p>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </Card>
      ) : null}

      {!insight || !output ? (
        <Card>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-black/35" />
            <h2 className="text-xl font-semibold">No insight yet</h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
            Generate a first draft. It will stay in review until someone approves it.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          <AiInsightReviewCard patientId={patient.id} insight={insight} />

          <details className="group rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-black/55">
              <span>View details</span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>

            <div className="mt-5 grid gap-5 border-t border-black/[0.06] pt-5 lg:grid-cols-2">
              <div className="rounded-3xl bg-axiel-soft p-5">
                <p className="text-sm font-semibold text-black/70">Next Steps</p>
                <div className="mt-3 space-y-2">
                  {output.practitioner_review_points.slice(0, 5).map((item) => (
                    <p key={item} className="rounded-2xl bg-white px-4 py-3 text-sm text-black/55">{item}</p>
                  ))}
                  {output.practitioner_review_points.length === 0 ? <p className="text-sm text-black/45">No review points available.</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-axiel-soft p-5">
                <p className="text-sm font-semibold text-black/70">Validation history</p>
                <div className="mt-3 space-y-2">
                  {validationEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-black/70">{eventLabel(event.action)}</p>
                      <p className="mt-1 text-xs text-black/40">
                        {new Date(event.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  ))}
                  {validationEvents.length === 0 ? <p className="text-sm text-black/45">No validation history yet.</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-amber-50 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-amber-900">Safety note</p>
                <p className="mt-2 text-sm leading-6 text-amber-800">{AI_INSIGHT_LABEL}</p>
                <p className="mt-2 text-sm leading-6 text-amber-800">Status: {aiInsightStatusLabel(insight.review_status)}</p>
                {output.safety_note ? <p className="mt-2 text-sm leading-6 text-amber-800">{output.safety_note}</p> : null}
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="pt-2">
        <Link href={`/patients/${patient.id}`} className="rounded-lg border border-axiel-line bg-white px-4 py-3 text-sm font-semibold text-black/60">
          Back to patient profile
        </Link>
      </div>
    </div>
  );
}
