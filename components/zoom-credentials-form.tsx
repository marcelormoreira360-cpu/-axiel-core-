"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { saveZoomCredentialsAction, removeZoomCredentialsAction } from "@/app/settings/integrations/actions";

export function ZoomCredentialsForm({ hasClinicCreds }: { hasClinicCreds: boolean }) {
  const t = useTranslations("settings.integrations");
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const result = await saveZoomCredentialsAction(fd);
      if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else setError(result.error);
    });
  }

  function handleRemove() {
    if (!confirm(t("zoomConfirmRemove"))) return;
    startRemove(async () => {
      await removeZoomCredentialsAction();
      setRemoved(true);
    });
  }

  if (removed) {
    return <p className="text-[12px] text-[#0F6E56] mt-3">{t("zoomRemoved")}</p>;
  }

  return (
    <div className="mt-4 border-t border-black/[.06] pt-4">
      <p className="text-[12px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-1">
        {t("zoomOwnCreds")} <span className="text-[10px] font-normal text-[#A09E98]">{t("zoomOwnCredsOpt")}</span>
      </p>
      <p className="text-[11px] text-[#A09E98] mb-3">
        {t.rich("zoomOwnCredsDesc", {
          b: (c) => <strong>{c}</strong>,
          a: (c) => <a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] underline">{c}</a>,
        })}
      </p>

      {hasClinicCreds && (
        <div className="flex items-center justify-between bg-[#E1F5EE] rounded-xl px-3 py-2 mb-3">
          <p className="text-[12px] text-[#0F6E56] font-medium">{t("zoomConfigured")}</p>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 transition disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            {t("zoomRemove")}
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-2">
        <input
          name="zoom_account_id"
          placeholder={t("zoomAccountId")}
          className="w-full rounded-xl border border-black/[.10] bg-[#FAFAF8] px-3 py-2 text-[13px] text-[#0F1A2E] placeholder:text-black/30 outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
        />
        <input
          name="zoom_client_id"
          placeholder={t("zoomClientId")}
          className="w-full rounded-xl border border-black/[.10] bg-[#FAFAF8] px-3 py-2 text-[13px] text-[#0F1A2E] placeholder:text-black/30 outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
        />
        <div className="relative">
          <input
            name="zoom_client_secret"
            type={showSecret ? "text" : "password"}
            placeholder={t("zoomClientSecret")}
            className="w-full rounded-xl border border-black/[.10] bg-[#FAFAF8] px-3 py-2 pr-9 text-[13px] text-[#0F1A2E] placeholder:text-black/30 outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] disabled:opacity-50 px-4 py-2 rounded-xl transition"
        >
          {saving ? t("zoomSaving") : saved ? t("zoomSavedBtn") : t("zoomSave")}
        </button>
      </form>
    </div>
  );
}
