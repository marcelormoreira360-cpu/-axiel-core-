import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { AgendamentosReportClient } from "./agendamentos-report-client";

export const dynamic = "force-dynamic";

// Relatório mensal do ciclo de status do agendamento (Fase 3, tela visual).
// Consome /api/reports/agendamentos-status (camada de dados já pronta) e mostra
// no-show, cancelamento com aviso vs tardio, ocupação por profissional e receita
// perdida. Gateado ao módulo financeiro (dono/gestor/admin).
export default async function AgendamentosReportPage() {
  await requireFinanceAccess();
  const t = await getTranslations("finance.statusReport");

  return (
    <Shell>
      <BackLink
        fallbackHref="/financeiro"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        {t("back")}
      </BackLink>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 dark:text-white/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      <AgendamentosReportClient />
    </Shell>
  );
}
