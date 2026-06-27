"use client";

import { useTranslations } from "next-intl";
import { ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import {
  movePatientSectionAction,
  togglePatientSectionVisibilityAction,
} from "@/app/settings/secoes/actions";
import type { ClinicPatientSection } from "@/lib/types";

export function PatientSectionsForm({ initial }: { initial: ClinicPatientSection[] }) {
  const t = useTranslations("settings.patientSections");

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-[#6B6A66] mb-2">{t("listLabel")}</p>
      {initial.map((s, i) => (
        <div
          key={s.id}
          className={`border border-black/[.07] rounded-[10px] px-3 py-2.5 flex items-center gap-3 ${s.is_visible ? "" : "bg-[#FAFAF8]"}`}
        >
          <div className="flex flex-col gap-0.5 shrink-0">
            <button type="button" disabled={i === 0} onClick={() => movePatientSectionAction(s.id, "up")}
              className="text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition" title={t("moveUp")}>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={i === initial.length - 1} onClick={() => movePatientSectionAction(s.id, "down")}
              className="text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition" title={t("moveDown")}>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-medium ${s.is_visible ? "text-[#0F1A2E]" : "text-[#A09E98]"}`}>
              {t(`labels.${s.section_key}`)}
            </span>
            {!s.is_visible && (
              <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t("hidden")}</span>
            )}
          </div>
          <button type="button" onClick={() => togglePatientSectionVisibilityAction(s.id, !s.is_visible)}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#6B6A66] hover:text-[#0F6E56] border border-black/[.08] rounded-[8px] px-[10px] py-[5px] transition"
            title={s.is_visible ? t("hide") : t("show")}>
            {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {s.is_visible ? t("hide") : t("show")}
          </button>
        </div>
      ))}
    </div>
  );
}
