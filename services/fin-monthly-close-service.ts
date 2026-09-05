import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicCurrency } from "@/services/finance-service";
import { getPayablesSummary } from "@/services/fin-payables-service";
import { getRecurringDashboard } from "@/services/fin-saas-service";

// Módulo Financeiro (ERP) — Fase 6.4. Fechamento mensal (read-only).
// Consolida o mês ANTERIOR: receita, despesa e resultado (do razão + pagamentos
// + repasse), mais um retrato pontual de contas a pagar em aberto e MRR.
// Usado pelo card in-app e pela rota de export; o cron mensal reusa os números.

export type MonthlyClose = {
  year: number;
  month: number;              // 1-based
  currency: string;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
  openPayableCents: number;   // retrato atual (não do mês)
  mrrCents: number;           // retrato atual
};

/** Núcleo puro: receita − (despesas do razão + repasse pago) = resultado. */
export function computeMonthlyClose(
  paymentsRevenueCents: number,
  finRevenueCents: number,
  finExpenseCents: number,
  repassePaidCents: number,
): { revenueCents: number; expenseCents: number; netCents: number } {
  const revenueCents = paymentsRevenueCents + finRevenueCents;
  const expenseCents = finExpenseCents + repassePaidCents;
  return { revenueCents, expenseCents, netCents: revenueCents - expenseCents };
}

function lastMonthRange(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return {
    year: start.getFullYear(),
    month: start.getMonth() + 1,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startDay: day(start),
    endDay: day(end),
  };
}

/**
 * Fechamento do mês anterior para uma clínica. `nowIso` permite fixar a data nos
 * testes; em produção usa a data corrente.
 */
export async function getMonthlyClose(clinicId: string, nowIso?: string): Promise<MonthlyClose> {
  const now = nowIso ? new Date(nowIso) : new Date();
  const r = lastMonthRange(now);
  const supabase = createSupabaseAdminClient();

  const [currency, paymentsRes, finRes, repasseRes, payables, recurring] = await Promise.all([
    getClinicCurrency(clinicId),
    supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .gte("paid_at", r.startISO)
      .lt("paid_at", r.endISO),
    supabase
      .from("fin_entries")
      .select("kind, amount_cents")
      .eq("clinic_id", clinicId)
      .gte("entry_date", r.startDay)
      .lt("entry_date", r.endDay),
    supabase
      .from("repasse_ledger")
      .select("repasse_cents")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", r.startISO)
      .lt("paid_at", r.endISO),
    getPayablesSummary(clinicId),
    getRecurringDashboard(clinicId),
  ]);

  const paymentsRevenue = (paymentsRes.data ?? []).reduce((s, p) => s + ((p.amount_cents as number) ?? 0), 0);
  let finRevenue = 0;
  let finExpense = 0;
  for (const e of (finRes.data ?? []) as { kind: string; amount_cents: number }[]) {
    if (e.kind === "revenue") finRevenue += e.amount_cents ?? 0;
    else finExpense += e.amount_cents ?? 0;
  }
  const repassePaid = (repasseRes.data ?? []).reduce((s, r2) => s + ((r2.repasse_cents as number) ?? 0), 0);

  const { revenueCents, expenseCents, netCents } = computeMonthlyClose(
    paymentsRevenue,
    finRevenue,
    finExpense,
    repassePaid,
  );

  return {
    year: r.year,
    month: r.month,
    currency,
    revenueCents,
    expenseCents,
    netCents,
    openPayableCents: payables.openCents,
    mrrCents: recurring.saas.mrrCents,
  };
}
