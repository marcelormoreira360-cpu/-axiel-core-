"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/card";
import {
  DEFAULT_VITAL_KEYS,
  slugifyVital,
  type SessionConfig,
  type VitalConfig,
} from "@/modules/session/session-config";

const DEFAULT_KEYS = new Set<string>(DEFAULT_VITAL_KEYS);

export function SessionConfigForm({
  config,
  action,
}: {
  config: SessionConfig;
  action: (config: SessionConfig) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("settings.session");
  const tp = useTranslations("session.panel");
  const [scaleMax, setScaleMax] = useState<number>(config.scaleMax);
  const [vitals, setVitals] = useState<VitalConfig[]>(config.vitals);
  const [isPending, startTransition] = useTransition();

  function patchVital(i: number, patch: Partial<VitalConfig>) {
    setVitals((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function removeVital(i: number) {
    setVitals((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addVital() {
    setVitals((prev) => [...prev, { key: "", label: "", low: "", high: "", color: "#0F6E56" }]);
  }

  function defaultLabel(v: VitalConfig): string {
    return DEFAULT_KEYS.has(v.key) ? tp(`vitals.${v.key}.label`) : t("labelPlaceholder");
  }
  function defaultLow(v: VitalConfig): string {
    return DEFAULT_KEYS.has(v.key) ? tp(`vitals.${v.key}.low`) : t("lowPlaceholder");
  }
  function defaultHigh(v: VitalConfig): string {
    return DEFAULT_KEYS.has(v.key) ? tp(`vitals.${v.key}.high`) : t("highPlaceholder");
  }

  function save() {
    const built: SessionConfig = {
      scaleMax,
      vitals: vitals
        .map((v) => ({ ...v, key: v.key || slugifyVital(v.label) }))
        .filter((v) => v.key.length > 0),
    };
    startTransition(async () => {
      try {
        const res = await action(built);
        if (res.ok) toast.success(t("saved"));
        else toast.error(t("error"));
      } catch {
        toast.error(t("error"));
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Escala */}
      <Card className="p-6">
        <p className="text-sm font-semibold text-[#0F1A2E]">{t("scaleTitle")}</p>
        <p className="mt-1 text-xs text-black/40">{t("scaleHint")}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-black/50">1</span>
          <span className="text-black/30">–</span>
          <input
            type="number"
            min={2}
            max={10}
            value={scaleMax}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setScaleMax(Number.isFinite(n) ? Math.min(10, Math.max(2, n)) : 5);
            }}
            className="w-[72px] rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
        </div>
      </Card>

      {/* Vitais */}
      <Card className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0F1A2E]">{t("vitalsTitle")}</p>
          <button
            type="button"
            onClick={addVital}
            className="flex items-center gap-1 text-xs font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-lg px-2.5 py-1.5 transition"
          >
            <Plus className="h-3 w-3" />
            {t("addVital")}
          </button>
        </div>
        <p className="mb-4 text-xs text-black/40">{t("vitalsHint")}</p>

        {vitals.length === 0 ? (
          <p className="text-xs text-[#A09E98]">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            {vitals.map((v, i) => (
              <div key={i} className="rounded-xl border border-black/[.08] p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : "#6B6A66"}
                    onChange={(e) => patchVital(i, { color: e.target.value })}
                    aria-label={t("colorLabel")}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-black/10 bg-transparent p-0"
                  />
                  <input
                    value={v.label}
                    onChange={(e) => patchVital(i, { label: e.target.value })}
                    placeholder={defaultLabel(v)}
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeVital(i)}
                    aria-label={t("removeVital")}
                    className="shrink-0 text-[#A09E98] hover:text-[#B42318] transition p-1.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={v.low}
                    onChange={(e) => patchVital(i, { low: e.target.value })}
                    placeholder={defaultLow(v)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-xs outline-none focus:border-black/30"
                  />
                  <input
                    value={v.high}
                    onChange={(e) => patchVital(i, { high: e.target.value })}
                    placeholder={defaultHigh(v)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-xs outline-none focus:border-black/30"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="min-h-[44px] rounded-lg bg-[#0F6E56] px-6 text-sm font-semibold text-white hover:bg-[#085041] disabled:opacity-50 transition"
      >
        {isPending ? t("saving") : t("save")}
      </button>
    </div>
  );
}
