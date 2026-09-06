import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  LayoutDashboard, Clock, Wallet, Waves, Percent, Repeat, Package,
  FileText, CalendarClock, Receipt, Landmark, HandCoins, FileClock, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { FinanceCaps } from "@/lib/finance-permissions";

type NavItem = { href: string; labelKey: string; icon: LucideIcon; badge?: number };
type NavGroup = { titleKey: string; items: NavItem[] };

// Índice de dashboards do Financeiro (ERP) — agrupa a navegação por tema em vez
// de uma régua de botões. Reusa os labels de finance.page.*Nav já existentes.
export async function FinanceNavIndex({
  caps,
  feeDecisionsCount,
}: {
  caps: FinanceCaps;
  feeDecisionsCount: number;
}) {
  const t = await getTranslations("finance.page");

  const groups: NavGroup[] = [
    {
      titleKey: "group_overview",
      items: [
        { href: "/financeiro/executivo", labelKey: "executiveNav", icon: LayoutDashboard },
        { href: "/financeiro/receber", labelKey: "receivablesNav", icon: Clock },
        { href: "/financeiro/pagar", labelKey: "payablesNav", icon: Wallet },
        { href: "/financeiro/fluxo-caixa", labelKey: "cashflowNav", icon: Waves },
      ],
    },
    {
      titleKey: "group_revenue",
      items: [
        { href: "/financeiro/margem", labelKey: "marginNav", icon: Percent },
        { href: "/financeiro/recorrencia", labelKey: "recurringNav", icon: Repeat },
        { href: "/financeiro/programas", labelKey: "programsNav", icon: Package },
      ],
    },
    {
      titleKey: "group_fiscal",
      items: [
        { href: "/financeiro/relatorio", labelKey: "reportNav", icon: FileText },
        { href: "/financeiro/relatorio-agendamentos", labelKey: "statusReportNav", icon: CalendarClock },
        { href: "/financeiro/nfse", labelKey: "nfseNav", icon: Receipt },
        { href: "/financeiro/taxas", labelKey: "fees", icon: Landmark, badge: feeDecisionsCount },
        { href: "/financeiro/repasse", labelKey: "repasseNav", icon: HandCoins },
      ],
    },
    {
      titleKey: "group_governance",
      items: [
        { href: "/financeiro/auditoria", labelKey: "auditNav", icon: FileClock },
        ...(caps.canApprove
          ? [{ href: "/financeiro/permissoes", labelKey: "permissionsNav", icon: ShieldCheck } as NavItem]
          : []),
      ],
    },
  ];

  return (
    <section className="mb-6">
      <div className="space-y-[14px]">
        {groups.map((g) => (
          <div key={g.titleKey}>
            <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-[#A09E98] mb-[7px]">{t(g.titleKey)}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[8px]">
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="group flex items-center gap-[9px] rounded-[10px] border border-black/[.07] dark:border-white/[.08] bg-white dark:bg-white/[.02] px-[11px] py-[9px] hover:border-[#0F6E56]/40 hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] transition"
                  >
                    <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-[#F4F3EF] dark:bg-white/[.06] text-[#0F6E56] group-hover:bg-[#0F6E56] group-hover:text-white transition">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate flex-1">{t(it.labelKey)}</span>
                    {it.badge != null && it.badge > 0 && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 rounded-full px-1.5 py-0.5 shrink-0">{it.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
