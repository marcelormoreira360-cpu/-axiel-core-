import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { getNfseConfig } from "@/services/nfse-service";
import { NfseConfigForm } from "./nfse-config-form";

export default async function NfseSettingsPage() {
  const t = await getTranslations("settings.nfse");
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const config = await getNfseConfig(clinic.id);

  return (
    <Shell>
      <div className="mb-7">
        <BackLink
          fallbackHref="/settings/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px] max-w-xl">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-5">
        {/* Status */}
        <div className="flex items-center gap-3 rounded-xl border border-black/[.07] bg-white px-5 py-4">
          <div className={`h-2 w-2 rounded-full ${config ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`} />
          <p className="text-[13px] font-medium text-[#0F1A2E]">
            {config ? t("configured") : t("notConfigured")}
          </p>
          {config && (
            <Link
              href="/financeiro/nfse"
              className="ml-auto text-[12px] font-medium text-[#0F6E56] hover:underline"
            >
              {t("viewIssued")}
            </Link>
          )}
        </div>

        {/* Config form */}
        <div className="rounded-2xl border border-black/[.07] bg-white p-6">
          <p className="text-[13px] font-semibold text-[#0F1A2E] mb-1">{t("apiConfigTitle")}</p>
          <p className="text-[11px] text-[#A09E98] mb-5">
            {t("apiConfigDesc")}
          </p>
          <NfseConfigForm config={config} />
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-black/[.07] bg-[#FAFAF8] p-5">
          <p className="text-[12px] font-semibold text-[#0F1A2E] mb-3">{t("howItWorks")}</p>
          <ol className="space-y-2 text-[12px] text-[#6B6A66]">
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">1.</span>{t.rich("hiw1", { a: (c) => <a href="https://app.nfe.io" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">{c}</a> })}</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">2.</span>{t("hiw2")}</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">3.</span>{t.rich("hiw3", { b: (c) => <strong>{c}</strong> })}</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">4.</span>{t("hiw4")}</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}
