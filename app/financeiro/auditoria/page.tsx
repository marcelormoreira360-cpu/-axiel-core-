import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { PlusCircle, Trash2, CheckCircle2, FileClock } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getClinicCurrency } from "@/services/finance-service";
import { listFinAudit } from "@/services/fin-audit-service";
import { formatMoney } from "@/lib/finance-utils";

function actionIcon(action: string) {
  if (action === "delete") return <Trash2 className="h-3.5 w-3.5 text-[#B42318]" />;
  if (action === "pay") return <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56]" />;
  return <PlusCircle className="h-3.5 w-3.5 text-[#0F1A2E]" />;
}

export default async function AuditPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, currency, rows] = await Promise.all([
    getTranslations("finance.audit"),
    getLocale(),
    getClinicCurrency(clinic.id),
    listFinAudit(clinic.id, { limit: 150 }),
  ]);
  const money = (c: number) => formatMoney(c, currency, locale);

  // action e entity vêm de um conjunto fechado; fallback pro próprio código.
  const actionLabel = (a: string) => (["create", "delete", "pay"].includes(a) ? t(`action_${a}`) : a);
  const entityLabel = (e: string) => (["fin_entry", "fin_payable"].includes(e) ? t(`entity_${e}`) : e);

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[6px]">
        <BackLink fallbackHref="/financeiro" className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition">‹</BackLink>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">{t("eyebrow")}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        </div>
      </div>
      <p className="text-[12px] text-[#A09E98] mb-[18px]">{t("subtitle")}</p>

      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
        <div className="px-[16px] py-[12px] border-b border-black/[.05] flex items-center gap-[8px]">
          <FileClock className="h-3.5 w-3.5 text-[#A09E98]" />
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("listTitle")}</p>
        </div>
        {rows.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("empty")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <span className="shrink-0">{actionIcon(r.action)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">
                    <span className="font-medium">{r.changedByName ?? t("system")}</span>{" "}
                    {actionLabel(r.action)} · {entityLabel(r.entity)}
                  </p>
                  <p className="text-[10px] text-[#A09E98]">
                    {new Date(r.createdAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {r.amountCents != null && (
                  <p className="text-[13px] font-medium text-[#0F1A2E] shrink-0">{money(r.amountCents)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
