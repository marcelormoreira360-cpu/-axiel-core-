"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, X, AlertCircle, ClipboardList } from "lucide-react";
import { saveAssessmentAction, type AssessmentState } from "@/app/patients/[id]/assessment/actions";

type Props = {
  patientId: string;
  anamnese: string | null;
  antecedents: string | null;
  painLevel: number | null;
  painLocation: string | null;
  treatmentNote: string | null;
};

const inputCls =
  "w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition";

export function PatientAssessmentPanel({
  patientId, anamnese, antecedents, painLevel, painLocation, treatmentNote,
}: Props) {
  const t = useTranslations("patientAssessment");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState<AssessmentState, FormData>(
    async (prev, fd) => {
      const res = await saveAssessmentAction(patientId, prev, fd);
      if (res?.ok) setEditing(false);
      return res;
    },
    null,
  );

  const hasContent = Boolean(anamnese || antecedents || painLevel !== null || painLocation || treatmentNote);

  function Field({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
      <div>
        <p className="text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[2px]">{label}</p>
        <p className="text-[12px] text-[#0F1A2E] whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px] mb-5">
      <div className="flex items-center justify-between gap-2 mb-[10px]">
        <div className="flex items-center gap-[7px]">
          <ClipboardList className="h-3.5 w-3.5 text-[#0F6E56]" />
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
            <p className="text-[10px] text-[#A09E98] leading-tight">{t("subtitle")}</p>
          </div>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition">
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="space-y-[10px]">
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("anamnese")}</label>
            <textarea name="anamnese" defaultValue={anamnese ?? ""} rows={4} placeholder={t("anamnesePh")} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("antecedents")}</label>
            <textarea name="antecedents" defaultValue={antecedents ?? ""} rows={3} placeholder={t("antecedentsPh")} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-3 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("painLevel")}</label>
              <input type="number" min={0} max={10} step="1" inputMode="numeric" name="pain_level" defaultValue={painLevel ?? ""} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("painLocation")}</label>
              <input name="pain_location" defaultValue={painLocation ?? ""} placeholder={t("painLocationPh")} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-[#A09E98] -mt-[4px]">{t("painMapHint")}</p>
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("treatment")}</label>
            <textarea name="treatment_note" defaultValue={treatmentNote ?? ""} rows={3} placeholder={t("treatmentPh")} className={`${inputCls} resize-none`} />
          </div>
          {state?.error && (
            <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</p>
          )}
          <div className="flex items-center gap-[8px]">
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[14px] py-[7px] transition">
              <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] rounded-[8px] px-[12px] py-[7px] transition">
              <X className="h-3.5 w-3.5" /> {t("cancel")}
            </button>
          </div>
        </form>
      ) : hasContent ? (
        <div className="space-y-[10px]">
          <Field label={t("anamnese")} value={anamnese} />
          <Field label={t("antecedents")} value={antecedents} />
          {(painLevel !== null || painLocation) && (
            <Field label={t("pain")} value={[painLevel !== null ? `${painLevel}/10` : null, painLocation].filter(Boolean).join(" · ")} />
          )}
          <Field label={t("treatment")} value={treatmentNote} />
        </div>
      ) : (
        <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      )}
    </div>
  );
}
