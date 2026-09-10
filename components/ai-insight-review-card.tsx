import { ChevronDown, RefreshCw, AlertTriangle, FileDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { AiInsight } from "@/lib/types";
import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { Badge, type BadgeStatus } from "@/components/status-badge";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";
import { approveAiInsightAction, generateAiInsightAction, requestAiInsightChangesAction, resendApprovedInsightAction, sendSupplementToPatientAction, sendHypersensitivityToPatientAction } from "@/app/patients/[id]/insights/actions";
import { VoiceDictation } from "@/components/voice-dictation";
import { NeuroId360Documents } from "@/components/neuro-id-360-documents";
import { InsightEditor } from "@/components/insight-editor";
import { SupplementEditor } from "@/components/supplement-editor";
import { HypersensitivityEditor } from "@/components/hypersensitivity-editor";
import { getPatientById } from "@/services/patient-service";
import { resolveSupplementCountry } from "@/services/supplement-service";
import { Bio3Ring, type Bio3RingDatum } from "@/components/bio3-ring";
import { dysfunctionToBalance } from "@/modules/neuro-id/bands";
import type { NeuroPillar } from "@/modules/neuro-id/catalog";
import { hasPersuasiveDoc1 } from "@/modules/ai-insights/patient-text-guardrails";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { countExamsPendingMetricsReview } from "@/services/functional-exams-service";
import { DeleteInsightButton } from "@/components/delete-insight-button";
import type { PatientIdentificacao } from "@/lib/patient-demographics";

function insightOutput(insight: AiInsight) {
  return insight.final_output ?? insight.output;
}

/**
 * Versão de conteúdo do insight (hash determinístico do output). Vai como `&v=` no
 * link do PDF: quando o terapeuta edita o relatório, o output muda, o hash muda e a
 * URL do PDF muda, então o navegador NUNCA serve a versão anterior em cache (o Safari
 * cacheia PDF inline por URL). Combina com o Cache-Control: no-store da rota.
 */
function contentVersion(insight: AiInsight): string {
  const s = JSON.stringify(insight.final_output ?? insight.output ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function simplifiedStatus(status: AiInsight["review_status"]): BadgeStatus {
  return status === "final" ? "final" : "review";
}

export async function AiInsightReviewCard({ patientId, insight, liveId }: { patientId: string; insight: AiInsight; liveId?: PatientIdentificacao }) {
  const t = await getTranslations("insights.reviewCard");
  const locale = await getLocale();
  const approveAction = approveAiInsightAction.bind(null, patientId, insight.id);
  const requestChangeAction = requestAiInsightChangesAction.bind(null, patientId, insight.id);
  const generateAction = generateAiInsightAction.bind(null, patientId);
  const isFinal = insight.review_status === "final";
  const output = insightOutput(insight);
  // Estilo dos links "abrir PDF" (ver/imprimir/entregar em mão). O gerador é o MESMO do
  // envio ao paciente, então o PDF baixado é idêntico ao que o paciente receberia.
  const pdfLinkClass = "inline-flex items-center gap-2 rounded-xl border border-black/[.08] dark:border-white/[.10] px-4 py-2.5 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06] hover:text-axiel-text-primary dark:hover:text-[#E8E6E2]";
  const pdfVersion = contentVersion(insight);
  const pdfHref = (docType: string) => `/api/patients/${patientId}/neuro-id/pdf?doc=${docType}&insight=${insight.id}&v=${pdfVersion}`;

  // Prévia do Anel Bio³ na própria mesa de revisão: quando o Doc 1 é o persuasivo,
  // mostra o MESMO gráfico do painel e do PDF do paciente (o app migrou da pirâmide
  // para o círculo), para o revisor ver o entregável completo sem abrir o PDF.
  const hasReport = hasPersuasiveDoc1(output?.mapa_integrativo);
  const neuroMap = hasReport ? await getLatestNeuroIdMap(patientId) : null;
  const tNeuro = await getTranslations("neuroId");

  // Anel de equilíbrio (mesma convenção do NeuroId360Documents / drawBio3RingPanel):
  // três fatias iguais, cor/estado da disfunção crua, número exibido = equilíbrio,
  // prioridade destacada pela borda mais grossa (priority_pillar único).
  const RING_ICON = { fisico: "person", bioquimico: "atom", emocional: "brain" } as const;
  let ringData: Bio3RingDatum[] | null = null;
  let ringGeneralBalance: number | null = null;
  let ringAria = "";
  if (neuroMap) {
    const dys: Record<NeuroPillar, number | null> = {
      fisico: neuroMap.fisico_pct, bioquimico: neuroMap.bioquimico_pct, emocional: neuroMap.emocional_pct,
    };
    ringData = (["fisico", "bioquimico", "emocional"] as NeuroPillar[]).map((p) => ({
      dys: dys[p], balance: dysfunctionToBalance(dys[p]), isPriority: neuroMap.priority_pillar === p, label: tNeuro(`pillar.${p}`), icon: RING_ICON[p],
    }));
    ringGeneralBalance = dysfunctionToBalance(neuroMap.indice_geral);
    ringAria = `${tNeuro("title")}: ${ringData.map((d) => `${d.label} ${d.balance === null ? "—" : `${d.balance}%`}`).join(", ")}.`;
  }

  // Aviso de degradação silenciosa: exames com métricas extraídas mas NÃO
  // confirmadas não entram no relatório. Só relevante enquanto não-final.
  const pendingMetrics = !isFinal ? await countExamsPendingMetricsReview(patientId) : 0;

  // Documento 2 (Suplementação): país do paciente decide a saída (BR fórmula / US link).
  const patient = await getPatientById(patientId);
  const supplementCountry = resolveSupplementCountry(patient?.country ?? null, patient?.locale ?? null);
  const protocolo = output?.protocolo_suplementacao ?? null;
  const hasSupplement = !!protocolo?.itens?.some((i) => i.nome?.trim())
    || !!protocolo?.formulas?.some((f) => f.nome?.trim() || (f.composicao?.length ?? 0) > 0);
  const sendSupplementAction = sendSupplementToPatientAction.bind(null, patientId);
  const resendReportAction = resendApprovedInsightAction.bind(null, patientId);

  // Documento 3 (Hipersensibilidade): só existe quando o paciente fez o exame de cabelo.
  const relatorioHyper = output?.relatorio_hipersensibilidade ?? null;
  const hasHyper = !!relatorioHyper && (
    (relatorioHyper.achados_prioritarios?.length ?? 0) > 0 ||
    (relatorioHyper.retirada_alta?.length ?? 0) > 0 ||
    (relatorioHyper.padroes?.length ?? 0) > 0 ||
    (relatorioHyper.fases?.length ?? 0) > 0
  );
  const sendHyperAction = sendHypersensitivityToPatientAction.bind(null, patientId);

  // Ações do Relatório (Doc 1): abrir PDF + editar textos, renderizadas DENTRO do
  // retângulo do Documento 1 (via NeuroId360Documents). Só quando há Doc 1 persuasivo.
  const reportActions = hasReport ? (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/[.06] dark:border-white/[.08] pt-4">
      <a href={pdfHref("report")} target="_blank" rel="noopener noreferrer" className={pdfLinkClass} title={t("downloadHint")}>
        <FileDown className="h-3.5 w-3.5" /> {t("downloadReport")}
      </a>
      {output ? <InsightEditor patientId={patientId} insightId={insight.id} output={output} className="basis-full" /> : null}
    </div>
  ) : null;

  // Ações da Suplementação (Doc 2): editar + PDF + enviar, DENTRO do retângulo do
  // Documento 2 (Suplementação). País decide fórmula BR / link US.
  const supplementActions = output ? (
    <div className="mt-4 space-y-3 border-t border-[#D9A441]/30 pt-4">
      <div className="flex items-center justify-end">
        <span className="rounded-full bg-white/70 dark:bg-white/[.08] px-2 py-[2px] text-[11px] font-medium text-axiel-text-secondary">
          {supplementCountry === "US" ? t("supplementUs") : t("supplementBr")}
        </span>
      </div>
      <SupplementEditor patientId={patientId} insightId={insight.id} protocolo={protocolo} country={supplementCountry} />
      {hasSupplement ? (
        <a href={pdfHref("supplement")} target="_blank" rel="noopener noreferrer" className={pdfLinkClass}>
          <FileDown className="h-3.5 w-3.5" /> {t("downloadSupplement")}
        </a>
      ) : null}
      {isFinal && hasSupplement ? (
        <form action={sendSupplementAction}>
          <ButtonPrimary type="submit">{t("sendSupplement")}</ButtonPrimary>
        </form>
      ) : !hasSupplement ? (
        <p className="text-xs text-axiel-text-secondary">{t("supplementEmpty")}</p>
      ) : null}
    </div>
  ) : null;

  return (
    <article className="bg-white rounded-2xl p-6 shadow-sm space-y-4 transition hover:shadow-md">
      {/* Só o status: título e resumo saíram (já aparecem acima, no topo da lista de insights). */}
      <div className="flex items-center justify-end">
        <Badge status={simplifiedStatus(insight.review_status)} />
      </div>

      {/* Aviso: métricas de exame extraídas mas não confirmadas não entram no relatório */}
      {pendingMetrics > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 px-4 py-3 text-xs font-medium text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
          {t("pendingMetricsWarn", { count: pendingMetrics })}
        </p>
      ) : null}

      {/* Prévia do Anel Bio³ (mesmo gráfico do painel e do PDF do paciente) na mesa de revisão */}
      {ringData ? (
        <div className="flex items-center gap-4 rounded-2xl bg-gray-50 dark:bg-white/[.05] px-4 py-3">
          <div className="w-[132px] shrink-0">
            <Bio3Ring data={ringData} ariaLabel={ringAria} className="w-full h-auto" />
          </div>
          <p className="text-xs leading-5 text-axiel-text-secondary">
            <span className="font-semibold text-axiel-text-primary">{ringGeneralBalance === null ? "—" : `${ringGeneralBalance}%`}</span>{" · "}{tNeuro("indexCaption")}
          </p>
        </div>
      ) : null}

      {/* Neuro ID 360 — os 3 documentos. As ações de Editar/PDF vão DENTRO dos retângulos:
          reportActions no Doc 1 (relatório) e supplementActions no Doc 2 (suplementação). */}
      <NeuroId360Documents output={output} liveId={liveId} bio3Map={neuroMap} reportActions={reportActions} supplementActions={supplementActions} />

      <div className="flex flex-wrap gap-3">
        <form action={approveAction} className="space-y-2">
          {!isFinal && (
            <>
              <VoiceDictation
                name="reviewer_notes"
                placeholder={t("reviewerNotesPlaceholder")}
                rows={2}
              />
              <label className="flex items-start gap-2 text-xs text-axiel-text-secondary cursor-pointer">
                <input type="checkbox" name="send_to_patient" defaultChecked className="mt-[2px] h-[14px] w-[14px] accent-[#0F6E56]" />
                <span>{t("sendOnApprove")}</span>
              </label>
            </>
          )}
          <ButtonPrimary type="submit" disabled={isFinal}>
            {t("approve")}
          </ButtonPrimary>
        </form>

        <form action={requestChangeAction}>
          <ButtonSecondary type="submit" disabled={isFinal}>
            {t("adjust")}
          </ButtonSecondary>
        </form>

        {isFinal ? (
          <form action={resendReportAction}>
            <ButtonSecondary type="submit">{t("resendReport")}</ButtonSecondary>
          </form>
        ) : null}

        <form action={generateAction}>
          <SubmitButton
            className="rounded-xl px-4 py-3 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06] hover:text-axiel-text-primary dark:hover:text-[#E8E6E2]"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> {t("newDraft")}
            </span>
          </SubmitButton>
        </form>

        <DeleteInsightButton patientId={patientId} insightId={insight.id} />
      </div>

      {/* Documento 3 — Hipersensibilidade (exame de cabelo): só aparece quando há dados do teste capilar */}
      {hasHyper ? (
        <div className="space-y-3 rounded-2xl border border-[#7C5CBF]/30 dark:border-[#7C5CBF]/25 p-4">
          <p className="text-sm font-semibold text-axiel-text-primary">{t("hyperSection")}</p>
          <HypersensitivityEditor patientId={patientId} insightId={insight.id} relatorio={relatorioHyper} />
          <a href={pdfHref("hypersensitivity")} target="_blank" rel="noopener noreferrer" className={pdfLinkClass}>
            <FileDown className="h-3.5 w-3.5" /> {t("downloadHyper")}
          </a>
          {isFinal ? (
            <form action={sendHyperAction}>
              <ButtonPrimary type="submit">{t("sendHyper")}</ButtonPrimary>
            </form>
          ) : null}
        </div>
      ) : null}

      <p className="rounded-xl bg-yellow-50 dark:bg-yellow-500/10 px-4 py-3 text-xs font-medium text-yellow-800 dark:text-yellow-300">{AI_INSIGHT_LABEL}</p>

      <details className="group rounded-xl bg-gray-50 dark:bg-white/[.05] px-4 py-3 text-sm text-axiel-text-secondary">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-axiel-text-primary">
          <span>{t("viewDetails")}</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>

        <div className="mt-4 space-y-4 border-t border-gray-100 dark:border-white/[.08] pt-4">
          {output?.structured_summary?.key_context?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("keyContext")}</p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("patterns")}</p>
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
            {insight.approved_at ? <p>{t("approvedAt", { date: new Date(insight.approved_at).toLocaleString(locale) })}</p> : null}
            {insight.changes_made ? <p>{t("changes", { changes: insight.changes_made })}</p> : null}
          </div>
        </div>
      </details>
    </article>
  );
}
