"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveNfseConfigAction } from "./actions";
import type { NfseConfig } from "@/services/nfse-service";

interface Props {
  config: NfseConfig | null;
}

export function NfseConfigForm({ config }: Props) {
  const t = useTranslations("settings.nfse");
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveNfseConfigAction(fd);
      if (r.error) { setError(r.error); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || success) && (
        <div className={`rounded-lg px-4 py-2.5 text-[12px] ${error ? "bg-red-50 text-red-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
          {error ?? t("saved")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            {t("apiKey")} <span className="text-red-400">*</span>
          </label>
          <input
            name="api_key"
            type="password"
            defaultValue={config?.api_key ?? ""}
            placeholder={t("apiKeyPlaceholder")}
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">
            {t.rich("apiKeyHint", { a: (c) => <a href="https://app.nfe.io/account/apikeys" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">{c}</a> })}
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            {t("companyId")} <span className="text-red-400">*</span>
          </label>
          <input
            name="company_id"
            type="text"
            defaultValue={config?.company_id ?? ""}
            placeholder={t("companyIdPlaceholder")}
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">
            {t.rich("companyIdHint", { a: (c) => <a href="https://app.nfe.io/account/companies" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">{c}</a> })}
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            {t("cityCode")}
          </label>
          <input
            name="city_service_code"
            type="text"
            defaultValue={config?.city_service_code ?? "1.05"}
            placeholder={t("cityCodePlaceholder")}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">{t("cityCodeHint")}</p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            {t("cnae")}
          </label>
          <input
            name="cnae_code"
            type="text"
            defaultValue={config?.cnae_code ?? ""}
            placeholder={t("cnaePlaceholder")}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">{t("cnaeHint")}</p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
          {t("serviceDesc")}
        </label>
        <input
          name="service_description"
          type="text"
          defaultValue={config?.service_description ?? "Prestação de serviços de saúde"}
          placeholder={t("serviceDescPlaceholder")}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-sm font-medium text-white hover:bg-black transition disabled:opacity-50"
      >
        {isPending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
