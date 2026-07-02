"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Package, X, StopCircle, Trash2, RefreshCw } from "lucide-react";
import type { PatientPackage } from "@/services/package-service";
import {
  addPackageAction,
  deactivatePackageAction,
  deletePackageAction,
} from "@/app/patients/[id]/packages/actions";

function ProgressRing({ used, total }: { used: number; total: number }) {
  const t = useTranslations("patientPanels.packages");
  const pct = Math.min(used / total, 1);
  const remaining = total - used;
  const isOver = used > total;

  return (
    <div className="flex items-center gap-[12px]">
      <div className="relative w-[52px] h-[52px] shrink-0">
        <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
          <circle cx="26" cy="26" r="22" fill="none" stroke="#F4F3EF" strokeWidth="4" />
          <circle
            cx="26" cy="26" r="22" fill="none"
            stroke={isOver ? "#EF4444" : pct >= 0.8 ? "#F59E0B" : "#0F6E56"}
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct)}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-semibold text-[#0F1A2E] leading-none">{used}</span>
          <span className="text-[9px] text-[#A09E98] leading-none mt-[1px]">/{total}</span>
        </div>
      </div>
      <div>
        <p className="text-[13px] font-medium text-[#0F1A2E]">
          {isOver
            ? t("over", { count: used - total })
            : remaining === 0
            ? t("complete")
            : t("remaining", { count: remaining })}
        </p>
        <p className="text-[11px] text-[#A09E98] mt-[1px]">
          {t("used", { used, total })}
        </p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, patientId }: { pkg: PatientPackage; patientId: string }) {
  const t = useTranslations("patientPanels.packages");
  const locale = useLocale();
  const since = new Date(pkg.start_date + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className={[
      "rounded-[12px] border px-[14px] py-[14px] transition",
      pkg.is_active ? "bg-white border-black/[.07]" : "bg-[#FAFAF8] border-black/[.05] opacity-60",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-2 mb-[12px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-7 h-7 rounded-[7px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
            <Package className="h-3.5 w-3.5 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E] flex items-center gap-[6px]">
              {pkg.name}
              {pkg.auto_renew && (
                <span className="inline-flex items-center gap-[3px] text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] rounded-full px-[6px] py-[2px]">
                  <RefreshCw className="h-2 w-2" /> {t("auto")}
                </span>
              )}
            </p>
            <p className="text-[11px] text-[#A09E98]">{t("start", { date: since })}</p>
          </div>
        </div>
        {pkg.is_active && (
          <div className="flex items-center gap-[4px] shrink-0">
            <form action={deactivatePackageAction.bind(null, pkg.id, patientId)}>
              <button
                type="submit"
                title={t("endTitle")}
                className="w-6 h-6 flex items-center justify-center rounded text-[#D3D1C7] hover:text-amber-500 transition"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </button>
            </form>
            <form action={deletePackageAction.bind(null, pkg.id, patientId)}>
              <button
                type="submit"
                title={t("removeTitle")}
                className="w-6 h-6 flex items-center justify-center rounded text-[#D3D1C7] hover:text-red-400 transition"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </form>
          </div>
        )}
      </div>

      <ProgressRing used={pkg.sessions_used} total={pkg.sessions_total} />

      {/* Progress bar */}
      <div className="mt-[12px] h-[4px] bg-[#F4F3EF] rounded-full overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            pkg.sessions_used > pkg.sessions_total
              ? "bg-red-400"
              : pkg.sessions_used / pkg.sessions_total >= 0.8
              ? "bg-amber-400"
              : "bg-[#0F6E56]",
          ].join(" ")}
          style={{ width: `${Math.min((pkg.sessions_used / pkg.sessions_total) * 100, 100)}%` }}
        />
      </div>

      {pkg.notes && (
        <p className="text-[11px] text-[#6B6A66] mt-[10px]">{pkg.notes}</p>
      )}
    </div>
  );
}

function AddPackageForm({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const t = useTranslations("patientPanels.packages.form");
  const tCommon = useTranslations("common.actions");
  const [autoRenew, setAutoRenew] = useState(false);

  async function submit(formData: FormData) {
    await addPackageAction(formData);
    onClose();
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-[14px] py-[12px] bg-[#FAFAF8] border-b border-black/[.06]">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
        <button type="button" onClick={onClose} aria-label={tCommon("close")} className="text-[#A09E98] hover:text-[#0F1A2E]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form action={submit} className="px-[14px] py-[14px] space-y-[10px]">
        <input type="hidden" name="patient_id" value={patientId} />
        <input type="hidden" name="auto_renew" value={autoRenew ? "true" : "false"} />

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("name")}</label>
          <input
            type="text"
            name="name"
            required
            placeholder={t("namePlaceholder")}
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("total")}</label>
            <input
              type="number"
              name="sessions_total"
              required
              min="1"
              placeholder="10"
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("startDate")}</label>
            <input
              type="date"
              name="start_date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("notes")}</label>
          <input
            type="text"
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div
          onClick={() => setAutoRenew((v) => !v)}
          className="flex items-center justify-between rounded-[8px] border border-black/[.08] px-[10px] py-[8px] cursor-pointer hover:bg-[#FAFAF8] transition select-none"
        >
          <div className="flex items-center gap-[7px]">
            <RefreshCw className="h-3 w-3 text-[#0F6E56]" />
            <span className="text-[12px] text-[#0F1A2E]">{t("autoRenew")}</span>
          </div>
          <div className={[
            "w-8 h-4 rounded-full transition-colors duration-200 relative",
            autoRenew ? "bg-[#0F6E56]" : "bg-[#D3D1C7]",
          ].join(" ")}>
            <div className={[
              "absolute top-[2px] w-3 h-3 bg-white rounded-full shadow transition-transform duration-200",
              autoRenew ? "translate-x-[18px]" : "translate-x-[2px]",
            ].join(" ")} />
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

export function PatientPackagePanel({
  packages,
  patientId,
}: {
  packages: PatientPackage[];
  patientId: string;
}) {
  const t = useTranslations("patientPanels.packages");
  const [adding, setAdding] = useState(false);

  const active = packages.filter((p) => p.is_active);
  const inactive = packages.filter((p) => !p.is_active);

  return (
    <div className="space-y-[8px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#6B6A66]">
          {t("title")} · {t("activeCount", { count: active.length })}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Plus className="h-3 w-3" /> {t("add")}
          </button>
        )}
      </div>

      {adding && <AddPackageForm patientId={patientId} onClose={() => setAdding(false)} />}

      {active.length === 0 && !adding ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[12px]">
          <p className="text-[12px] text-[#D3D1C7]">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-[8px]">
          {active.map((p) => <PackageCard key={p.id} pkg={p} patientId={patientId} />)}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-[8px] mt-[4px]">
          <p className="text-[10px] font-medium text-[#D3D1C7] uppercase tracking-[.06em] px-[2px]">{t("ended")}</p>
          {inactive.map((p) => <PackageCard key={p.id} pkg={p} patientId={patientId} />)}
        </div>
      )}
    </div>
  );
}
