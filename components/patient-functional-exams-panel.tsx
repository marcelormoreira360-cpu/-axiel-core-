"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, Plus, X, Trash2, ChevronDown, Sparkles, Check } from "lucide-react";
import type { PatientFunctionalExam } from "@/services/functional-exams-service";
import { EXAM_METRIC_META } from "@/modules/neuro-id/exam-metrics";
import { addFunctionalExamAction, deleteFunctionalExamAction, reviewExamMetricsAction } from "@/app/patients/[id]/functional-exams/actions";

function typeLabel(t: ReturnType<typeof useTranslations>, exam: PatientFunctionalExam): string {
  if (exam.exam_type === "neurometria") return t("typeNeurometria");
  if (exam.exam_type === "biorressonancia") return t("typeBiorressonancia");
  return exam.title || t("typeOutro");
}

export function PatientFunctionalExamsPanel({
  exams,
  patientId,
}: {
  exams: PatientFunctionalExam[];
  patientId: string;
}) {
  const t = useTranslations("patientPanels.functionalExams");
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const [examType, setExamType] = useState<string>("neurometria");

  const inputCls =
    "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56]/50 transition";

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[10px]">
        <p className="text-[13px] font-medium text-[#0F1A2E]">
          {t("title")} · {exams.length}
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] hover:text-[#085041] dark:hover:text-[#9FE1CB] transition"
        >
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {adding ? t("cancel") : t("add")}
        </button>
      </div>

      {adding && (
        <form action={addFunctionalExamAction} className="space-y-[8px] mb-[12px] bg-[#FAFAF8] rounded-[10px] p-[12px]">
          <input type="hidden" name="patient_id" value={patientId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
            <div>
              <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("typeLabel")}</label>
              <select name="exam_type" value={examType} onChange={(e) => setExamType(e.target.value)} className={inputCls}>
                <option value="neurometria">{t("typeNeurometria")}</option>
                <option value="biorressonancia">{t("typeBiorressonancia")}</option>
                <option value="outro">{t("typeOutro")}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("dateLabel")}</label>
              <input type="date" name="exam_date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
            </div>
          </div>
          {examType === "outro" && (
            <div>
              <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("titleLabel")}</label>
              <input name="title" placeholder={t("titlePlaceholder")} maxLength={120} className={inputCls} />
            </div>
          )}
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("fileLabel")}</label>
            <input type="file" name="exam_file" accept="application/pdf" className={inputCls + " text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[#0F6E56]/10 file:px-2 file:py-1 file:text-[#0F6E56]"} />
            <p className="text-[9px] text-[#A09E98] mt-[3px]">{t("fileHint")}</p>
          </div>
          <button
            type="submit"
            className="w-full text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] py-[9px] transition"
          >
            {t("save")}
          </button>
        </form>
      )}

      {exams.length === 0 && !adding ? (
        <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      ) : (
        <div className="space-y-[8px]">
          {exams.map((exam) => (
            <details key={exam.id} className="group border border-black/[.06] rounded-[10px] px-[12px] py-[10px]">
              <summary className="flex items-center justify-between gap-[8px] cursor-pointer list-none">
                <div className="flex items-center gap-[7px] min-w-0">
                  <Activity className="h-[14px] w-[14px] text-[#0F6E56] dark:text-[#9FE1CB] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{typeLabel(t, exam)}</p>
                    <p className="text-[10px] text-[#A09E98]">
                      {new Date(exam.exam_date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#A09E98] transition group-open:rotate-180" />
              </summary>
              {exam.summary && (
                <p className="text-[11px] text-[#6B6A66] mt-[10px] whitespace-pre-wrap leading-relaxed">{exam.summary}</p>
              )}
              <MetricsGate exam={exam} patientId={patientId} t={t} locale={locale} />
              <form action={deleteFunctionalExamAction.bind(null, exam.id, patientId)} className="mt-[8px]">
                <button type="submit" className="inline-flex items-center gap-1 text-[10px] font-medium text-[#B42318]/80 dark:text-[#F2B8B5]/80 hover:text-[#B42318] dark:hover:text-[#F2B8B5] transition" aria-label={t("delete")}>
                  <Trash2 className="h-[12px] w-[12px]" /> {t("delete")}
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Gate humano (incremento 4): mostra as métricas Bio³ que a IA extraiu do PDF,
 * editáveis, para o terapeuta revisar e CONFIRMAR. Só depois entram na pirâmide.
 * Aparece só quando há rascunho (neurometria/biorressonância com PDF lido).
 */
function MetricsGate({
  exam,
  patientId,
  t,
  locale,
}: {
  exam: PatientFunctionalExam;
  patientId: string;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const draft = exam.metrics_draft;
  if (!draft || Object.keys(draft).length === 0) return null;
  const reviewed = !!exam.metrics_reviewed_at;
  const current = exam.metrics_values ?? draft;
  const codes = Object.keys(draft);

  const numCls =
    "w-[88px] text-[12px] text-[#0F1A2E] bg-white border border-black/[.10] dark:border-white/[.10] rounded-[7px] px-[8px] py-[5px] outline-none focus:border-[#0F6E56]/50 transition";

  return (
    <div className="mt-[12px] border border-[#0F6E56]/15 bg-[#0F6E56]/[.03] rounded-[10px] p-[12px]">
      <div className="flex items-center justify-between gap-[8px] mb-[8px]">
        <span className="inline-flex items-center gap-[5px] text-[11px] font-medium text-[#0F1A2E]">
          <Sparkles className="h-[13px] w-[13px] text-[#0F6E56] dark:text-[#9FE1CB]" /> {t("metrics.title")}
        </span>
        {reviewed ? (
          <span className="inline-flex items-center gap-[3px] text-[10px] font-medium text-[#0F6E56] dark:text-[#9FE1CB]">
            <Check className="h-[11px] w-[11px]" /> {t("metrics.reviewed")}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-[#B7791F] dark:text-[#E8B04B]">{t("metrics.pending")}</span>
        )}
      </div>
      <p className="text-[10px] text-[#6B6A66] mb-[10px] leading-relaxed">{t("metrics.hint")}</p>

      <form action={reviewExamMetricsAction.bind(null, exam.id, patientId, exam.exam_type)} className="space-y-[6px]">
        {codes.map((code) => {
          const meta = EXAM_METRIC_META[code];
          return (
            <div key={code} className="flex items-center justify-between gap-[8px]">
              <label htmlFor={`${exam.id}-${code}`} className="text-[11px] text-[#3B3A36] dark:text-[#E8E6E2] min-w-0 truncate">
                {meta?.label ?? code}
                {meta?.unit ? <span className="text-[#A09E98]"> ({meta.unit})</span> : null}
              </label>
              <input
                id={`${exam.id}-${code}`}
                name={code}
                type="number"
                step="any"
                // Após a revisão, semeia só dos valores CONFIRMADOS (current = metrics_values):
                // uma métrica que o terapeuta apagou fica vazia e PERMANECE removida do mapa.
                // Antes da revisão, current = draft, então mostra a sugestão da IA.
                // O placeholder preserva o valor que a IA leu, sem reintroduzi-lo.
                defaultValue={current[code] ?? ""}
                placeholder={draft[code] != null ? String(draft[code]) : undefined}
                className={numCls}
              />
            </div>
          );
        })}
        <button
          type="submit"
          className="mt-[4px] w-full text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[7px] py-[7px] transition"
        >
          {reviewed ? t("metrics.update") : t("metrics.confirm")}
        </button>
        {reviewed && exam.metrics_reviewed_at && (
          <p className="text-[9px] text-[#A09E98] text-center">
            {t("metrics.reviewedOn", {
              date: new Date(exam.metrics_reviewed_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
            })}
          </p>
        )}
      </form>
    </div>
  );
}
