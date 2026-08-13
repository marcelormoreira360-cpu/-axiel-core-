"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ClinicFeeConfig, FeeMode } from "@/services/fee-decision-service";
import { saveFeePolicyAction } from "../actions";

function centsToUnit(cents: number | null): string {
  return cents == null ? "" : String(Math.round(cents / 100));
}

function TypeBlock({
  prefix,
  label,
  mode,
  percent,
  minCents,
  maxCents,
  currency,
}: {
  prefix: "no_show" | "late_cancel";
  label: string;
  mode: FeeMode;
  percent: number | null;
  minCents: number | null;
  maxCents: number | null;
  currency: string;
}) {
  const t = useTranslations("feeDecisions");
  const [m, setM] = useState<FeeMode>(mode);

  return (
    <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-4">
      <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-3">{label}</p>

      <label className="block text-[11px] text-[#6B6A66] dark:text-[#9E9C97] mb-1">{t("cfgMode")}</label>
      <select
        name={`${prefix}_fee_mode`}
        value={m}
        onChange={(e) => setM(e.target.value as FeeMode)}
        className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#0d1420] px-2 py-1.5 mb-3 text-[#0F1A2E] dark:text-[#E8E6E2]"
      >
        <option value="percent">{t("cfgModePercent")}</option>
        <option value="fixed">{t("cfgModeFixed")}</option>
        <option value="none">{t("cfgModeNone")}</option>
      </select>

      {m === "percent" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-[#A09E98] mb-1">{t("cfgPercent")}</label>
            <input name={`${prefix}_fee_percent`} defaultValue={percent ?? 0} inputMode="numeric"
              className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#0d1420] px-2 py-1.5 text-[#0F1A2E] dark:text-[#E8E6E2]" />
          </div>
          <div>
            <label className="block text-[10px] text-[#A09E98] mb-1">{t("cfgMin", { currency })}</label>
            <input name={`${prefix}_fee_min`} defaultValue={centsToUnit(minCents)} inputMode="numeric"
              className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#0d1420] px-2 py-1.5 text-[#0F1A2E] dark:text-[#E8E6E2]" />
          </div>
          <div>
            <label className="block text-[10px] text-[#A09E98] mb-1">{t("cfgMax", { currency })}</label>
            <input name={`${prefix}_fee_max`} defaultValue={centsToUnit(maxCents)} inputMode="numeric"
              className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#0d1420] px-2 py-1.5 text-[#0F1A2E] dark:text-[#E8E6E2]" />
          </div>
        </div>
      )}

      {m === "fixed" && (
        <div>
          <label className="block text-[10px] text-[#A09E98] mb-1">{t("cfgFixed", { currency })}</label>
          <input name={`${prefix}_fee_min`} defaultValue={centsToUnit(minCents)} inputMode="numeric"
            className="w-40 text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#0d1420] px-2 py-1.5 text-[#0F1A2E] dark:text-[#E8E6E2]" />
          {/* mantém min/max escondidos para não zerar no submit quando o modo muda */}
          <input type="hidden" name={`${prefix}_fee_percent`} value={percent ?? 0} />
          <input type="hidden" name={`${prefix}_fee_max`} value={centsToUnit(maxCents)} />
        </div>
      )}

      {m === "none" && (
        <>
          <p className="text-[11px] text-[#A09E98]">{t("cfgNoneHint")}</p>
          <input type="hidden" name={`${prefix}_fee_percent`} value={percent ?? 0} />
          <input type="hidden" name={`${prefix}_fee_min`} value={centsToUnit(minCents)} />
          <input type="hidden" name={`${prefix}_fee_max`} value={centsToUnit(maxCents)} />
        </>
      )}
    </div>
  );
}

export function FeePolicyForm({ config, currency }: { config: ClinicFeeConfig; currency: string }) {
  const t = useTranslations("feeDecisions");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const res = await saveFeePolicyAction(formData);
      setMsg(res.error ? { error: res.error } : { ok: true });
    });
  }

  return (
    <form action={onSubmit} className="space-y-4 max-w-2xl">
      <TypeBlock
        prefix="no_show"
        label={t("cfgNoShow")}
        mode={config.no_show_fee_mode}
        percent={config.no_show_fee_percent}
        minCents={config.no_show_fee_min_cents}
        maxCents={config.no_show_fee_max_cents}
        currency={currency}
      />
      <TypeBlock
        prefix="late_cancel"
        label={t("cfgLateCancel")}
        mode={config.late_cancel_fee_mode}
        percent={config.late_cancel_fee_percent}
        minCents={config.late_cancel_fee_min_cents}
        maxCents={config.late_cancel_fee_max_cents}
        currency={currency}
      />

      <label className="flex items-center gap-2 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2]">
        <input type="checkbox" name="first_miss_courtesy" defaultChecked={config.first_miss_courtesy} className="accent-[#0F6E56]" />
        {t("cfgCourtesy")}
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-lg px-4 py-2 transition"
        >
          {isPending ? t("saving") : t("cfgSave")}
        </button>
        {msg?.ok && <span className="text-[11px] text-[#0F6E56]">{t("cfgSaved")}</span>}
        {msg?.error && <span className="text-[11px] text-rose-500">{msg.error}</span>}
      </div>
    </form>
  );
}
