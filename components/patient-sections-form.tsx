"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { SortableList } from "@/components/sortable-list";
import {
  reorderPatientSectionsAction,
  togglePatientSectionVisibilityAction,
} from "@/app/settings/secoes/actions";
import type { ClinicPatientSection } from "@/lib/types";

export function PatientSectionsForm({ initial }: { initial: ClinicPatientSection[] }) {
  const t = useTranslations("settings.patientSections");
  const [items, setItems] = useState(initial);

  function reorder(next: ClinicPatientSection[]) {
    setItems(next); // otimista: a UI muda já; o servidor persiste a ordem nova
    reorderPatientSectionsAction(next.map((i) => i.id));
  }

  function toggle(s: ClinicPatientSection) {
    const nextVisible = !s.is_visible;
    setItems((prev) => prev.map((i) => (i.id === s.id ? { ...i, is_visible: nextVisible } : i)));
    togglePatientSectionVisibilityAction(s.id, nextVisible);
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-[#6B6A66]">{t("listLabel")}</p>
      <p className="text-[11px] text-[#A09E98] mb-1">{t("dragHint")}</p>
      <SortableList
        items={items}
        getId={(s) => s.id}
        onReorder={reorder}
        className="space-y-2"
        render={(s, { setNodeRef, style, handleProps, isDragging }) => (
          <div
            ref={setNodeRef}
            style={style}
            className={`border border-black/[.07] rounded-[10px] px-3 py-2.5 flex items-center gap-2 bg-white ${isDragging ? "shadow-md" : ""} ${s.is_visible ? "" : "opacity-70"}`}
          >
            <button
              type="button"
              {...handleProps}
              className="shrink-0 cursor-grab active:cursor-grabbing text-[#C4C2BC] hover:text-[#6B6A66] dark:hover:text-[#9E9C97] touch-none p-0.5"
              title={t("drag")}
              aria-label={t("drag")}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className={`text-[13px] font-medium ${s.is_visible ? "text-[#0F1A2E]" : "text-[#A09E98]"}`}>
                {t(`labels.${s.section_key}`)}
              </span>
              {!s.is_visible && (
                <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t("hidden")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggle(s)}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#6B6A66] hover:text-[#0F6E56] dark:hover:text-[#9FE1CB] border border-black/[.08] rounded-[8px] px-[10px] py-[5px] transition"
              title={s.is_visible ? t("hide") : t("show")}
            >
              {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {s.is_visible ? t("hide") : t("show")}
            </button>
          </div>
        )}
      />
    </div>
  );
}
