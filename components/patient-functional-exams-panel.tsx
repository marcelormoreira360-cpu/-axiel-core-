"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, Plus, X, Trash2 } from "lucide-react";
import type { PatientFunctionalExam } from "@/services/functional-exams-service";
import { addFunctionalExamAction, deleteFunctionalExamAction } from "@/app/patients/[id]/functional-exams/actions";

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
    "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56]/50 transition";

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[10px]">
        <p className="text-[13px] font-medium text-[#0F1A2E]">
          {t("title")} · {exams.length}
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
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
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("summaryLabel")}</label>
            <textarea name="summary" rows={4} placeholder={t("summaryPlaceholder")} className={inputCls + " resize-none"} />
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
            <div key={exam.id} className="border border-black/[.06] rounded-[10px] px-[12px] py-[10px]">
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex items-center gap-[7px] min-w-0">
                  <Activity className="h-[14px] w-[14px] text-[#0F6E56] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{typeLabel(t, exam)}</p>
                    <p className="text-[10px] text-[#A09E98]">
                      {new Date(exam.exam_date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <form action={deleteFunctionalExamAction.bind(null, exam.id, patientId)}>
                  <button type="submit" className="text-[#C4C2BC] hover:text-[#B42318] transition" aria-label={t("delete")}>
                    <Trash2 className="h-[13px] w-[13px]" />
                  </button>
                </form>
              </div>
              {exam.summary && (
                <p className="text-[11px] text-[#6B6A66] mt-[8px] whitespace-pre-wrap leading-relaxed">{exam.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
