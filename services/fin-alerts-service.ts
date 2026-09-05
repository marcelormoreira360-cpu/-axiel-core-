import { listPayables } from "@/services/fin-payables-service";
import { getReceivables, getExecutiveSummary } from "@/services/fin-ledger-service";
import { getRecurringDashboard } from "@/services/fin-saas-service";

// Módulo Financeiro (ERP) — Fase 6.5. Alertas (read-only).
// Transforma os dados dos dashboards em ação: conta vencida/vencendo,
// inadimplência (a receber 90+ e assinaturas past_due) e resultado negativo.
// Não escreve nada — só agrega o que os serviços já expõem.

export type AlertLevel = "danger" | "warning";

export type FinAlert = {
  key: "overduePayables" | "dueSoonPayables" | "receivableAging" | "negativeNet" | "pastDueSubs";
  level: AlertLevel;
  count?: number;
  amountCents?: number;
  href: string;
};

export type AlertInputs = {
  overdueCount: number;
  overdueCents: number;
  dueSoonCount: number;
  dueSoonCents: number;
  receivable90pCents: number;
  netCents: number;
  pastDueSubs: number;
};

/**
 * Regras puras de alerta (testável sem banco). Ordena mais grave primeiro
 * (danger antes de warning). Só emite o que de fato exige atenção.
 */
export function buildAlerts(inp: AlertInputs): FinAlert[] {
  const alerts: FinAlert[] = [];

  if (inp.overdueCount > 0) {
    alerts.push({ key: "overduePayables", level: "danger", count: inp.overdueCount, amountCents: inp.overdueCents, href: "/financeiro/pagar" });
  }
  if (inp.pastDueSubs > 0) {
    alerts.push({ key: "pastDueSubs", level: "danger", count: inp.pastDueSubs, href: "/financeiro/recorrencia" });
  }
  if (inp.dueSoonCount > 0) {
    alerts.push({ key: "dueSoonPayables", level: "warning", count: inp.dueSoonCount, amountCents: inp.dueSoonCents, href: "/financeiro/pagar" });
  }
  if (inp.receivable90pCents > 0) {
    alerts.push({ key: "receivableAging", level: "warning", amountCents: inp.receivable90pCents, href: "/financeiro/receber" });
  }
  if (inp.netCents < 0) {
    alerts.push({ key: "negativeNet", level: "warning", amountCents: inp.netCents, href: "/financeiro/executivo" });
  }

  const rank = (a: FinAlert) => (a.level === "danger" ? 0 : 1);
  return alerts.sort((a, b) => rank(a) - rank(b));
}

function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function getFinanceAlerts(clinicId: string): Promise<FinAlert[]> {
  const [openPayables, receivables, executive, recurring] = await Promise.all([
    listPayables(clinicId, { status: "open", limit: 500 }),
    getReceivables(clinicId),
    getExecutiveSummary(clinicId),
    getRecurringDashboard(clinicId),
  ]);

  const today = isoDay(0);
  const soonCutoff = isoDay(7);
  let overdueCount = 0;
  let overdueCents = 0;
  let dueSoonCount = 0;
  let dueSoonCents = 0;
  for (const p of openPayables) {
    if (p.due_date < today) {
      overdueCount += 1;
      overdueCents += p.amount_cents;
    } else if (p.due_date <= soonCutoff) {
      dueSoonCount += 1;
      dueSoonCents += p.amount_cents;
    }
  }

  return buildAlerts({
    overdueCount,
    overdueCents,
    dueSoonCount,
    dueSoonCents,
    receivable90pCents: receivables.buckets.d90p,
    netCents: executive.netCents,
    pastDueSubs: recurring.saas.pastDueCount,
  });
}
