import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Brain, ChevronDown, RefreshCw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AiInsightReviewCard } from "@/components/ai-insight-review-card";
import type { AiInsight, Patient } from "@/lib/types";
import { liveIdentificacaoPt } from "@/lib/patient-demographics";
import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { aiInsightStatusLabel } from "@/modules/ai-insights/status-labels";
import type { AiValidationEvent } from "@/services/ai-insight-service";
import { generateAiInsightAction, resendApprovedInsightAction } from "@/app/patients/[id]/insights/actions";

const EVENT_KEYS = new Set<AiValidationEvent["action"]>([
  "approved_final",
  "requested_changes",
  "generated_pending_review",
  "archived",
  "reopened",
]);

export async function AiInsightPanel({
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
  const t = await getTranslations("insights.reviewPanel");
  const locale = await getLocale();
  const generateAction = generateAiInsightAction.bind(null, patient.id);
  const resendAction = resendApprovedInsightAction.bind(null, patient.id);
  const output = insight?.review_status === "final" && insight.final_output ? insight.final_output : insight?.output;
  const isFinal = insight?.review_status === "final";
  const hasContact = Boolean(patient.email || patient.phone);
  const liveId = liveIdentificacaoPt(patient); // demografia ao vivo do cadastro (igual ao PDF)

  const eventLabel = (action: AiValidationEvent["action"]) =>
    EVENT_KEYS.has(action) ? t(`events.${action}`) : action;

  return (
    <div className="space-y-5">
      <Card className="bg-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-axiel-soft dark:bg-white/[.04]">
              <Brain className="h-6 w-6 text-axiel-gold dark:text-[#9FE1CB]" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-black/35">{t("eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black/85 dark:text-white/85 md:text-4xl">{t("title")}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {isFinal ? (
              <form action={resendAction}>
                <Button variant="secondary" className="min-h-12 w-full px-5" disabled={!hasContact} title={hasContact ? undefined : t("resendNoContact")}>
                  <Send className="h-4 w-4" /> {t("resend")}
                </Button>
              </form>
            ) : null}
            <form action={generateAction}>
              <Button variant="secondary" className="min-h-12 w-full px-5">
                <RefreshCw className="h-4 w-4" /> {t("generateNew")}
              </Button>
            </form>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-100 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t("updateErrorTitle")}</p>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        </Card>
      ) : null}

      {!insight || !output ? (
        <Card>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-black/35" />
            <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
            {t("emptyText")}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          <AiInsightReviewCard patientId={patient.id} insight={insight} liveId={liveId} />

          <details className="group rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-black/55">
              <span>{t("viewDetails")}</span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>

            <div className="mt-5 grid gap-5 border-t border-black/[0.06] dark:border-white/[.07] pt-5 lg:grid-cols-2">
              <div className="rounded-3xl bg-axiel-soft dark:bg-white/[.04] p-5">
                <p className="text-sm font-semibold text-black/70">{t("nextSteps")}</p>
                <div className="mt-3 space-y-2">
                  {output.practitioner_review_points.slice(0, 5).map((item) => (
                    <p key={item} className="rounded-2xl bg-white px-4 py-3 text-sm text-black/55">{item}</p>
                  ))}
                  {output.practitioner_review_points.length === 0 ? <p className="text-sm text-black/45">{t("noReviewPoints")}</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-axiel-soft dark:bg-white/[.04] p-5">
                <p className="text-sm font-semibold text-black/70">{t("validationHistory")}</p>
                <div className="mt-3 space-y-2">
                  {validationEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-black/70">{eventLabel(event.action)}</p>
                      <p className="mt-1 text-xs text-black/40">
                        {new Date(event.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  ))}
                  {validationEvents.length === 0 ? <p className="text-sm text-black/45">{t("noValidationHistory")}</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-amber-50 dark:bg-amber-500/10 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t("safetyNote")}</p>
                <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{AI_INSIGHT_LABEL}</p>
                <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{t("status", { status: aiInsightStatusLabel(insight.review_status) })}</p>
                {output.safety_note ? <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{output.safety_note}</p> : null}
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="pt-2">
        <Link href={`/patients/${patient.id}`} className="rounded-lg border border-axiel-line bg-white px-4 py-3 text-sm font-semibold text-black/60">
          {t("backToProfile")}
        </Link>
      </div>
    </div>
  );
}
