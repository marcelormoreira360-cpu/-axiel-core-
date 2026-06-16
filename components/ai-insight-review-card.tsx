import { ChevronDown, RefreshCw } from "lucide-react";
import type { AiInsight } from "@/lib/types";
import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { Badge, type BadgeStatus } from "@/components/status-badge";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { approveAiInsightAction, generateAiInsightAction, requestAiInsightChangesAction } from "@/app/patients/[id]/insights/actions";
import { VoiceDictation } from "@/components/voice-dictation";

function insightOutput(insight: AiInsight) {
  return insight.final_output ?? insight.output;
}

function insightTitle(insight: AiInsight) {
  const output = insightOutput(insight);
  return (
    output?.patterns_and_correlations?.[0]?.title ||
    output?.structured_summary?.current_status ||
    "Insight ready for review"
  );
}

function shortSummary(insight: AiInsight) {
  const output = insightOutput(insight);
  return output?.structured_summary?.overview || "A short summary is ready for review.";
}

function simplifiedStatus(status: AiInsight["review_status"]): BadgeStatus {
  return status === "final" ? "final" : "review";
}

export function AiInsightReviewCard({ patientId, insight }: { patientId: string; insight: AiInsight }) {
  const approveAction = approveAiInsightAction.bind(null, patientId, insight.id);
  const requestChangeAction = requestAiInsightChangesAction.bind(null, patientId, insight.id);
  const generateAction = generateAiInsightAction.bind(null, patientId);
  const isFinal = insight.review_status === "final";
  const output = insightOutput(insight);

  return (
    <article className="bg-white rounded-2xl p-6 shadow-sm space-y-4 transition hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-axiel-text-primary">{insightTitle(insight)}</h3>
        <Badge status={simplifiedStatus(insight.review_status)} />
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-axiel-text-secondary">{shortSummary(insight)}</p>

      <div className="flex flex-wrap gap-3">
        <form action={approveAction} className="space-y-2">
          {!isFinal && (
            <>
              <VoiceDictation
                name="reviewer_notes"
                placeholder="Notas de revisão (opcional) — clique no 🎤 para ditar"
                rows={2}
              />
              <label className="flex items-start gap-2 text-xs text-axiel-text-secondary cursor-pointer">
                <input type="checkbox" name="send_to_patient" defaultChecked className="mt-[2px] h-[14px] w-[14px] accent-[#0F6E56]" />
                <span>Enviar o resumo ao paciente por e-mail e WhatsApp ao aprovar</span>
              </label>
            </>
          )}
          <ButtonPrimary type="submit" disabled={isFinal}>
            Approve
          </ButtonPrimary>
        </form>

        <form action={requestChangeAction}>
          <ButtonSecondary type="submit" disabled={isFinal}>
            Adjust
          </ButtonSecondary>
        </form>

        <form action={generateAction}>
          <button
            type="submit"
            className="rounded-xl px-4 py-3 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 hover:text-axiel-text-primary"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> New draft
            </span>
          </button>
        </form>
      </div>

      <p className="rounded-xl bg-yellow-50 px-4 py-3 text-xs font-medium text-yellow-800">{AI_INSIGHT_LABEL}</p>

      <details className="group rounded-xl bg-gray-50 px-4 py-3 text-sm text-axiel-text-secondary">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-axiel-text-primary">
          <span>View details</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>

        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {output?.structured_summary?.key_context?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">Key context</p>
              <ul className="mt-2 space-y-2">
                {output.structured_summary.key_context.slice(0, 4).map((item) => (
                  <li key={item} className="rounded-xl bg-white px-3 py-2 text-sm leading-5 text-axiel-text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {output?.patterns_and_correlations?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">Patterns</p>
              <div className="mt-2 space-y-2">
                {output.patterns_and_correlations.slice(0, 3).map((pattern) => (
                  <div key={pattern.title} className="rounded-xl bg-white px-3 py-2">
                    <p className="font-semibold text-axiel-text-primary">{pattern.title}</p>
                    <p className="mt-1 text-sm leading-5 text-axiel-text-secondary">{pattern.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-axiel-text-secondary">
            {insight.approved_at ? <p>Approved: {new Date(insight.approved_at).toLocaleString()}</p> : null}
            {insight.changes_made ? <p>Changes: {insight.changes_made}</p> : null}
          </div>
        </div>
      </details>
    </article>
  );
}
