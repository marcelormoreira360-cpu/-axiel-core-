import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getCurrentClinic } from "@/services/clinic-service";
import { getHotmartToken, listRecentHotmartPurchases } from "@/services/hotmart-service";
import { HotmartForm } from "./hotmart-form";
import { redirect } from "next/navigation";
import { getClinicCurrency } from "@/services/finance-service";
import { formatMoney } from "@/lib/finance-utils";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-[#E1F5EE] text-[#0F6E56]",
  cancelled: "bg-red-50 text-red-500",
  refunded: "bg-amber-50 text-amber-600",
  chargeback: "bg-red-100 text-red-600",
};
const STATUS_KEYS: Record<string, string> = {
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  refunded: "statusRefunded",
  chargeback: "statusChargeback",
};


export default async function HotmartSettingsPage() {
  const t = await getTranslations("settings.hotmart");
  const locale = await getLocale();
  const clinic = await getCurrentClinic();
  const __cur = await getClinicCurrency(clinic?.id ?? "");
  if (!clinic) redirect("/dashboard");

  const [hottok, purchases] = await Promise.all([
    getHotmartToken(clinic.id),
    listRecentHotmartPurchases(clinic.id),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/hotmart?clinic_id=${clinic.id}`;

  return (
    <Shell>
      <div className="mb-8">
        <BackLink
          fallbackHref="/settings/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </BackLink>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">{t("eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          {t("subtitle")}
        </p>
      </div>

      <HotmartForm
        clinicId={clinic.id}
        webhookUrl={webhookUrl}
        hasToken={!!hottok}
      />

      {/* Compras recentes */}
      {purchases.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">{t("recentTitle")}</h2>
          <div className="overflow-hidden rounded-xl border border-black/[.07] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.06] bg-[#FAFAF8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">{t("colBuyer")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">{t("colProduct")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">{t("colAmount")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">{t("colStatus")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">{t("colDate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04]">
                {purchases.map((p) => {
                  const color = STATUS_COLORS[p.status] ?? "bg-[#F4F3EF] text-[#6B6A66]";
                  const label = STATUS_KEYS[p.status] ? t(STATUS_KEYS[p.status]) : p.status;
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF8] transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0F1A2E]">{p.buyer_name || "—"}</p>
                        <p className="text-xs text-black/40">{p.buyer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#0F1A2E]">{p.product_name}</td>
                      <td className="px-4 py-3 font-medium text-[#0F1A2E]">{p.price_cents == null ? "—" : formatMoney(p.price_cents, __cur, locale)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-black/40">
                        {new Date(p.created_at).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
