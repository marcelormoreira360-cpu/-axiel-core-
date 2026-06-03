"use client";

import { useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, KeyRound, Trash2 } from "lucide-react";
import { generateGrowthKeyAction, revokeGrowthKeyAction } from "@/app/settings/integrations/actions";

type KeyRow = {
  id: string;
  label: string | null;
  key_prefix: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

type GenState = { ok: boolean; error: string | null; rawKey?: string } | null;

async function genWrapped(_prev: GenState, fd: FormData): Promise<GenState> {
  return generateGrowthKeyAction(fd);
}
async function revokeWrapped(_prev: unknown, fd: FormData) {
  return revokeGrowthKeyAction(fd);
}

export function GrowthIntegrationCard({
  endpointUrl,
  keys,
}: {
  endpointUrl: string;
  keys: KeyRow[];
}) {
  const t = useTranslations("settings.integrations");
  const [genState, genAction, genPending] = useActionState<GenState, FormData>(genWrapped, null);
  const [, revokeAction] = useActionState(revokeWrapped, null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const activeKeys = keys.filter((k) => k.is_active);

  return (
    <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px]">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V10M12 20V4M20 20v-7" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("growthTitle")}</p>
            <p className="text-[12px] text-[#A09E98] mt-[1px]">{t("growthDesc")}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-[8px] py-[2px] rounded-full ${activeKeys.length ? "bg-[#E1F5EE] text-[#0F6E56]" : "bg-[#F4F3EF] dark:bg-white/[.06] text-[#A09E98]"}`}>
          {activeKeys.length ? t("connected") : t("notConnected")}
        </span>
      </div>

      {/* Endpoint URL */}
      <div className="mt-3">
        <p className="text-[11px] text-[#A09E98] mb-1">{t("growthEndpointLabel")}</p>
        <div className="flex items-center gap-2 bg-[#F4F3EF] dark:bg-white/[.04] rounded-[8px] px-[12px] py-[8px]">
          <span className="flex-1 break-all font-mono text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">{endpointUrl}</span>
          <button type="button" onClick={() => copy(endpointUrl, "url")}
            className="shrink-0 inline-flex items-center gap-1 rounded bg-black/[.06] dark:bg-white/[.08] px-2 py-1 text-[10px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] hover:bg-black/[.1] transition">
            {copied === "url" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {t("copy")}
          </button>
        </div>
      </div>

      {/* Newly generated key — shown once */}
      {genState?.ok && genState.rawKey && (
        <div className="mt-3 rounded-[8px] border border-[#9FE1CB] bg-[#E1F5EE] px-[12px] py-[10px]">
          <p className="text-[11px] font-semibold text-[#0F6E56] mb-1">{t("growthKeyOnce")}</p>
          <div className="flex items-center gap-2">
            <span className="flex-1 break-all font-mono text-[12px] text-[#0F1A2E]">{genState.rawKey}</span>
            <button type="button" onClick={() => copy(genState.rawKey!, "new")}
              className="shrink-0 inline-flex items-center gap-1 rounded bg-[#0F6E56] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#085041] transition">
              {copied === "new" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {t("copy")}
            </button>
          </div>
        </div>
      )}

      {/* Active keys list */}
      {activeKeys.length > 0 && (
        <div className="mt-3 space-y-2">
          {activeKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-2 bg-[#F4F3EF] dark:bg-white/[.04] rounded-[8px] px-[12px] py-[8px]">
              <KeyRound className="w-3.5 h-3.5 text-[#A09E98] shrink-0" />
              <span className="flex-1 text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">
                <span className="font-mono">{k.key_prefix}…</span>
                {k.label ? <span className="ml-2 text-[#0F1A2E] dark:text-[#E8E6E2]">{k.label}</span> : null}
              </span>
              <form action={revokeAction}>
                <input type="hidden" name="key_id" value={k.id} />
                <button type="submit" className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#DC2626] hover:underline">
                  <Trash2 className="w-3 h-3" />
                  {t("growthRevoke")}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Generate new key */}
      <form action={genAction} className="mt-3 flex gap-2">
        <input name="label" placeholder={t("growthKeyLabelPlaceholder")}
          className="flex-1 h-9 px-3 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#A09E98] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30" />
        <button type="submit" disabled={genPending}
          className="h-9 px-4 rounded-[8px] bg-[#0F1A2E] dark:bg-white/[.1] text-white text-[13px] font-medium hover:bg-[#1C2B45] transition disabled:opacity-50 shrink-0">
          {genPending ? t("growthGenerating") : t("growthGenerate")}
        </button>
      </form>

      {genState?.error && <p className="mt-2 text-[11px] text-red-500">{genState.error}</p>}

      <p className="mt-3 text-[11px] text-[#A09E98]">{t("growthHint")}</p>
    </div>
  );
}
