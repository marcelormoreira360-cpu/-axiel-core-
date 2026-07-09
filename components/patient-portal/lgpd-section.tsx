"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestDataDeletionAction } from "@/app/p/[token]/actions";

export function LgpdSection({ rawToken }: { rawToken: string }) {
  const t = useTranslations("portal.dashboard");
  const [requested, setRequested] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (requested) {
    return (
      <p className="text-sm text-[#0F6E56]">
        {t("lgpdRequested")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-black/60 leading-relaxed">
        {t("lgpdText")}
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-500 hover:text-red-700 underline transition"
        >
          {t("requestDeletion")}
        </button>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            {t("lgpdConfirmText")}
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                startTransition(async () => {
                  const result = await requestDataDeletionAction(rawToken);
                  if (result.ok) {
                    setRequested(true);
                  } else {
                    setError(result.error);
                  }
                });
              }}
              className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? t("sending") : t("confirmRequest")}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); }}
              className="text-sm text-black/50 hover:text-black/70 px-4 py-2 rounded-lg border border-black/10 transition"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
