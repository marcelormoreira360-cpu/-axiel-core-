import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { getNfseConfig, listNfseInvoices } from "@/services/nfse-service";
import { getPatients } from "@/services/patient-service";
import { NfseClient } from "./nfse-client";
import { getClinicCurrency } from "@/services/finance-service";

export default async function NfsePage() {
  await (await import("@/lib/require-finance-access")).requireFinanceAccess();
  const clinic = await getCurrentClinic();
  const __cur = await getClinicCurrency(clinic?.id ?? "");
  if (!clinic) redirect("/dashboard");
  const t = await getTranslations("finance.nfse");
  const locale = await getLocale();

  const [config, invoices, patients] = await Promise.all([
    getNfseConfig(clinic.id),
    listNfseInvoices(clinic.id),
    getPatients(),
  ]);

  if (!config) {
    return (
      <Shell>
        <div className="mb-7">
          <BackLink fallbackHref="/financeiro" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
          </BackLink>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        </div>
        <div className="rounded-2xl border border-black/[.07] bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F3EF]">
            <Settings className="h-6 w-6 text-[#A09E98]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F1A2E]">{t("notConfigured")}</p>
          <p className="text-[12px] text-[#A09E98] mt-1 mb-5">{t("notConfiguredDesc")}</p>
          <Link
            href="/settings/integrations/nfse"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-5 py-2 text-[12px] font-medium text-white hover:bg-black transition"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("configure")}
          </Link>
        </div>
      </Shell>
    );
  }

  const totalIssued    = invoices.filter((i) => i.status === "issued").length;
  const totalCents     = invoices.filter((i) => i.status === "issued").reduce((s, i) => s + i.amount_cents, 0);
  const totalProcessing = invoices.filter((i) => i.status === "processing").length;

  return (
    <Shell>
      <div className="mb-7">
        <BackLink fallbackHref="/financeiro" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Financeiro
        </BackLink>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
            <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
          </div>
          <Link
            href="/settings/integrations/nfse"
            className="flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("settings")}
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: t("kpiIssued"), value: totalIssued },
          { label: t("kpiTotal"), value: (totalCents / 100).toLocaleString(locale, { style: "currency", currency: __cur }) },
          { label: t("kpiProcessing"), value: totalProcessing },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-black/[.07] rounded-[10px] p-4">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-1">{m.label}</p>
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">{m.value}</p>
          </div>
        ))}
      </div>

      <NfseClient
        invoices={invoices}
        defaultServiceDescription={config.service_description}
        patients={patients.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }))}
      />
    </Shell>
  );
}
