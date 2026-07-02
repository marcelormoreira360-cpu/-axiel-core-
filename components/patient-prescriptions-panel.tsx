"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Pill, Leaf, X, StopCircle, Printer } from "lucide-react";
import type { Prescription } from "@/services/exams-service";
import {
  addPrescriptionAction,
  deactivatePrescriptionAction,
  deletePrescriptionAction,
} from "@/app/patients/[id]/prescriptions/actions";

function PrescriptionCard({ item, patientId }: { item: Prescription; patientId: string }) {
  const t = useTranslations("patientPanels.prescriptions");
  const locale = useLocale();
  const isMed = item.type === "medication";
  const since = item.start_date
    ? new Date(item.start_date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })
    : null;

  return (
    <div className={[
      "flex items-start gap-[10px] rounded-[10px] px-[12px] py-[10px] border transition",
      item.is_active
        ? "bg-white border-black/[.07]"
        : "bg-[#FAFAF8] border-black/[.05] dark:border-white/[.06] opacity-50",
    ].join(" ")}>
      <div className={[
        "w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 mt-[1px]",
        isMed ? "bg-[#FFF3E0] dark:bg-[#C77D17]/[.15] text-[#E8A100]" : "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#0F6E56] dark:text-[#9FE1CB]",
      ].join(" ")}>
        {isMed ? <Pill className="h-3.5 w-3.5" /> : <Leaf className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{item.name}</p>
        <p className="text-[11px] text-[#A09E98] mt-[1px]">
          {[item.dosage, item.frequency, since ? t("since", { date: since }) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {item.notes && <p className="text-[11px] text-[#6B6A66] mt-[3px]">{item.notes}</p>}
      </div>
      {item.is_active && (
        <div className="flex items-center gap-[4px] shrink-0">
          <form action={deactivatePrescriptionAction.bind(null, item.id, patientId)}>
            <button
              type="submit"
              title={t("endTitle")}
              className="w-6 h-6 flex items-center justify-center rounded text-[#D3D1C7] dark:text-white/25 hover:text-amber-500 transition"
            >
              <StopCircle className="h-3.5 w-3.5" />
            </button>
          </form>
          <form action={deletePrescriptionAction.bind(null, item.id, patientId)}>
            <button
              type="submit"
              title={t("removeTitle")}
              className="w-6 h-6 flex items-center justify-center rounded text-[#D3D1C7] dark:text-white/25 hover:text-red-400 transition"
            >
              <X className="h-3 w-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AddPrescriptionForm({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const t = useTranslations("patientPanels.prescriptions.form");
  const tCommon = useTranslations("common.actions");
  const [type, setType] = useState<"medication" | "supplement">("supplement");

  async function submit(formData: FormData) {
    await addPrescriptionAction(formData);
    onClose();
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-[14px] py-[12px] bg-[#FAFAF8] border-b border-black/[.06]">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
        <button type="button" onClick={onClose} aria-label={tCommon("close")} className="text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form action={submit} className="px-[14px] py-[14px] space-y-[10px]">
        <input type="hidden" name="patient_id" value={patientId} />
        <input type="hidden" name="type" value={type} />

        {/* Type toggle */}
        <div className="flex gap-[6px]">
          {(["supplement", "medication"] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setType(pt)}
              className={[
                "flex items-center gap-[5px] text-[11px] font-medium rounded-[7px] px-[10px] py-[6px] border transition",
                type === pt
                  ? pt === "supplement"
                    ? "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border-[#0F6E56]/30 text-[#085041] dark:text-[#9FE1CB]"
                    : "bg-[#FFF3E0] dark:bg-[#C77D17]/[.15] border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "bg-[#FAFAF8] border-black/[.08] text-[#A09E98]",
              ].join(" ")}
            >
              {pt === "supplement" ? <Leaf className="h-3 w-3" /> : <Pill className="h-3 w-3" />}
              {pt === "supplement" ? t("supplement") : t("medication")}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("name")}</label>
          <input
            type="text"
            name="name"
            required
            placeholder={type === "supplement" ? t("supplementPlaceholder") : t("medicationPlaceholder")}
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("dosage")}</label>
            <input
              type="text"
              name="dosage"
              placeholder={t("dosagePlaceholder")}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("frequency")}</label>
            <input
              type="text"
              name="frequency"
              placeholder={t("frequencyPlaceholder")}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("start")}</label>
            <input
              type="date"
              name="start_date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("notes")}</label>
            <input
              type="text"
              name="notes"
              placeholder={t("notesPlaceholder")}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[8px] transition"
          >
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function PatientPrescriptionsPanel({
  prescriptions,
  patientId,
}: {
  prescriptions: Prescription[];
  patientId: string;
}) {
  const t = useTranslations("patientPanels.prescriptions");
  const [adding, setAdding] = useState(false);

  const active = prescriptions.filter((p) => p.is_active);
  const inactive = prescriptions.filter((p) => !p.is_active);
  const meds = active.filter((p) => p.type === "medication");
  const supps = active.filter((p) => p.type === "supplement");

  return (
    <div className="space-y-[8px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#6B6A66]">
          {t("title")} · {t("activeCount", { count: active.length })}
        </p>
        <div className="flex items-center gap-[10px]">
          {active.length > 0 && (
            <Link
              href={`/patients/${patientId}/prescriptions/print`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
            >
              <Printer className="h-3 w-3" /> {t("print")}
            </Link>
          )}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] hover:text-[#085041] dark:hover:text-[#9FE1CB] transition"
            >
              <Plus className="h-3 w-3" /> {t("add")}
            </button>
          )}
        </div>
      </div>

      {adding && <AddPrescriptionForm patientId={patientId} onClose={() => setAdding(false)} />}

      {active.length === 0 && !adding ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[12px]">
          <p className="text-[12px] text-[#D3D1C7] dark:text-white/25">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-[4px]">
          {meds.length > 0 && (
            <div className="space-y-[4px]">
              <p className="text-[10px] font-medium text-[#A09E98] uppercase tracking-[.06em] px-[2px]">{t("medications")}</p>
              {meds.map((p) => <PrescriptionCard key={p.id} item={p} patientId={patientId} />)}
            </div>
          )}
          {supps.length > 0 && (
            <div className="space-y-[4px] mt-[8px]">
              <p className="text-[10px] font-medium text-[#A09E98] uppercase tracking-[.06em] px-[2px]">{t("supplements")}</p>
              {supps.map((p) => <PrescriptionCard key={p.id} item={p} patientId={patientId} />)}
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-[4px] mt-[8px]">
              <p className="text-[10px] font-medium text-[#D3D1C7] dark:text-white/25 uppercase tracking-[.06em] px-[2px]">{t("ended")}</p>
              {inactive.map((p) => <PrescriptionCard key={p.id} item={p} patientId={patientId} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
