import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceApprove } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { listTeamFinanceRoles } from "@/services/fin-permissions-service";
import { PermissoesClient } from "./permissoes-client";

export default async function FinancePermissionsPage() {
  await requireFinanceApprove();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, members] = await Promise.all([
    getTranslations("finance.permissions"),
    listTeamFinanceRoles(clinic.id),
  ]);

  const legend = [
    { role: "cfo", caps: t("cap_cfo") },
    { role: "controller", caps: t("cap_controller") },
    { role: "billing", caps: t("cap_billing") },
    { role: "pricing", caps: t("cap_pricing") },
    { role: "cpa", caps: t("cap_cpa") },
  ];

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

      {/* Time + papel financeiro */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[16px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05] flex items-center gap-[8px]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#0F6E56]" />
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("listTitle")}</p>
        </div>
        {members.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("empty")}</p>
        ) : (
          <PermissoesClient members={members} />
        )}
      </div>

      {/* Legenda */}
      <div className="bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.06] rounded-[12px] p-[14px]">
        <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[8px]">{t("legendTitle")}</p>
        <ul className="space-y-[5px]">
          {legend.map((l) => (
            <li key={l.role} className="text-[11px] text-[#6B6A66] flex gap-[6px]">
              <span className="font-medium text-[#0F1A2E] min-w-[74px]">{t(`role_${l.role}`)}</span>
              <span>{l.caps}</span>
            </li>
          ))}
          <li className="text-[11px] text-[#A09E98] pt-[4px]">{t("managerNote")}</li>
        </ul>
      </div>
    </Shell>
  );
}
