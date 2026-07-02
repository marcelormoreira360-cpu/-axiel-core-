"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, X, AlertCircle, Stethoscope } from "lucide-react";
import { saveCaseSummaryAction, type CaseSummaryState } from "@/app/patients/[id]/case-summary/actions";

type Props = {
  patientId: string;
  chiefComplaint: string | null;
  caseSummary: string | null;
};

export function PatientCaseSummaryCard({ patientId, chiefComplaint, caseSummary }: Props) {
  const t = useTranslations("patientProfile.caseSummary");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState<CaseSummaryState, FormData>(
    async (prev, fd) => {
      const res = await saveCaseSummaryAction(patientId, prev, fd);
      if (res?.ok) setEditing(false);
      return res;
    },
    null,
  );

  const hasContent = Boolean(chiefComplaint || caseSummary);

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px] mb-5">
      <div className="flex items-center justify-between gap-2 mb-[10px]">
        <div className="flex items-center gap-[7px]">
          <Stethoscope className="h-3.5 w-3.5 text-[#0F6E56] dark:text-[#9FE1CB]" />
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] hover:text-[#085041] dark:hover:text-[#9FE1CB] transition"
          >
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="space-y-[10px]">
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("chiefLabel")}</label>
            <input
              name="chief_complaint"
              defaultValue={chiefComplaint ?? ""}
              placeholder={t("chiefPlaceholder")}
              className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("summaryLabel")}</label>
            <textarea
              name="case_summary"
              defaultValue={caseSummary ?? ""}
              rows={4}
              placeholder={t("summaryPlaceholder")}
              className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
            />
          </div>
          {state?.error && (
            <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</p>
          )}
          <div className="flex items-center gap-[8px]">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[14px] py-[7px] transition"
            >
              <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] rounded-[8px] px-[12px] py-[7px] transition"
            >
              <X className="h-3.5 w-3.5" /> {t("cancel")}
            </button>
          </div>
        </form>
      ) : hasContent ? (
        <div className="space-y-[8px]">
          {chiefComplaint && (
            <div>
              <p className="text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[2px]">{t("chiefLabel")}</p>
              <p className="text-[13px] font-medium text-[#0F1A2E]">{chiefComplaint}</p>
            </div>
          )}
          {caseSummary && (
            <div>
              <p className="text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[2px]">{t("summaryLabel")}</p>
              <p className="text-[12px] text-[#6B6A66] leading-relaxed whitespace-pre-wrap">{caseSummary}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      )}
    </div>
  );
}
