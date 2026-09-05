import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Wallet, AlertTriangle, CalendarClock, CheckCircle2, Trash2, CheckCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  getPayablesSummary,
  listPayables,
  listRecurring,
  listSuppliers,
} from "@/services/fin-payables-service";
import { formatMoney } from "@/lib/finance-utils";
import { AddPayableForm, RecurringManager } from "./pagar-forms";
import { payPayableAction, deletePayableAction, generateRecurringAction } from "./actions";

export default async function PayablesPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, summary, open, paid, recurring, suppliers] = await Promise.all([
    getTranslations("finance.payables"),
    getLocale(),
    getPayablesSummary(clinic.id),
    listPayables(clinic.id, { status: "open", limit: 100 }),
    listPayables(clinic.id, { status: "paid", limit: 20 }),
    listRecurring(clinic.id),
    listSuppliers(clinic.id),
  ]);

  const money = (c: number) => formatMoney(c, summary.currency, locale);
  const today = new Date().toISOString().slice(0, 10);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const recurringView = recurring.map((r) => ({
    id: r.id,
    description: r.description,
    amount_cents: r.amount_cents,
    day_of_month: r.day_of_month,
    active: r.active,
    supplier_name: r.supplier_id ? supplierName.get(r.supplier_id) ?? null : null,
  }));

  const cards = [
    { label: t("open"), value: money(summary.openCents), sub: t("openCount", { count: summary.openCount }), icon: <Wallet className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("overdue"), value: money(summary.overdueCents), sub: t("overdueCount", { count: summary.overdueCount }), icon: <AlertTriangle className="h-4 w-4 text-[#B42318]" />, tone: summary.overdueCents > 0 ? "text-[#B42318]" : "text-[#0F1A2E]" },
    { label: t("dueThisMonth"), value: money(summary.dueThisMonthCents), sub: t("dueThisMonthSub"), icon: <CalendarClock className="h-4 w-4 text-[#B7791F]" />, tone: "text-[#0F1A2E]" },
    { label: t("paidThisMonth"), value: money(summary.paidThisMonthCents), sub: t("paidThisMonthSub"), icon: <CheckCircle2 className="h-4 w-4 text-[#0F6E56]" />, tone: "text-[#0F6E56]" },
  ];

  const fmtDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
            <div className="flex items-center justify-between mb-[8px]">
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{c.label}</p>
              {c.icon}
            </div>
            <p className={`text-[20px] font-semibold tracking-[-0.03em] leading-none ${c.tone}`}>{c.value}</p>
            <p className="text-[10px] text-[#A09E98] mt-[5px]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-[8px] mb-[16px]">
        <AddPayableForm suppliers={suppliers} />
        <form action={generateRecurringAction}>
          <SubmitButton className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-70 rounded-[8px] px-[12px] py-[8px] transition">
            <CheckCheck className="h-3.5 w-3.5" /> {t("generateRecurring")}
          </SubmitButton>
        </form>
      </div>

      {/* Recorrentes */}
      <div className="mb-[16px]">
        <RecurringManager recurring={recurringView} suppliers={suppliers} money={money} />
      </div>

      {/* Contas em aberto */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[16px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("openListTitle")}</p>
        </div>
        {open.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("openEmpty")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {open.map((p) => {
              const overdue = p.due_date < today;
              return (
                <div key={p.id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overdue ? "bg-[#B42318]" : "bg-[#B7791F]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#0F1A2E] truncate">{p.description}</p>
                    <p className="text-[10px] text-[#A09E98]">
                      {t("due")} {fmtDate(p.due_date)}
                      {p.supplier_name ? ` · ${p.supplier_name}` : ""}
                      {p.category ? ` · ${p.category}` : ""}
                      {p.recurring_id ? ` · ${t("recurringTag")}` : ""}
                    </p>
                  </div>
                  {overdue && (
                    <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-red-50 text-red-500 shrink-0">{t("overdueTag")}</span>
                  )}
                  <p className="text-[13px] font-medium text-[#B42318] shrink-0">{money(p.amount_cents)}</p>
                  <form action={payPayableAction.bind(null, p.id)}>
                    <SubmitButton className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-70 rounded-[7px] px-[10px] py-[5px] transition shrink-0">
                      {t("pay")}
                    </SubmitButton>
                  </form>
                  <form action={deletePayableAction.bind(null, p.id)}>
                    <SubmitButton className="w-6 h-6 flex items-center justify-center rounded-md text-[#A09E98] hover:text-[#B42318] hover:bg-[#B42318]/[.06] disabled:opacity-70 transition shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagas recentes */}
      {paid.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
          <div className="px-[16px] py-[12px] border-b border-black/[.05]">
            <p className="text-[12px] font-medium text-[#0F1A2E]">{t("paidListTitle")}</p>
          </div>
          <div className="divide-y divide-black/[.04]">
            {paid.map((p) => (
              <div key={p.id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{p.description}</p>
                  <p className="text-[10px] text-[#A09E98]">
                    {p.paid_at ? `${t("paidOn")} ${fmtDate(p.paid_at.slice(0, 10))}` : ""}
                    {p.supplier_name ? ` · ${p.supplier_name}` : ""}
                  </p>
                </div>
                <p className="text-[13px] font-medium text-[#A09E98] shrink-0">{money(p.amount_cents)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
