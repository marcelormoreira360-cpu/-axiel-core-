import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicCurrency } from "@/services/finance-service";

// Módulo Financeiro (ERP) — Fase 5 (read-only).
//   • Recorrência/SaaS (#5): MRR/ARR/ativos/trial/churn de patient_subscriptions
//     (a recorrência que a CLÍNICA fatura dos pacientes — não a assinatura da
//     clínica ao Core, que é a tabela `subscriptions`, 1 por clínica).
//   • Exames & Suplementos (#4): NÃO têm receita/custo próprios no schema
//     (são clínicos — catálogo sem preço, recomendação é fluxo do Doc 2). O
//     honesto aqui é VOLUME + ATTACH RATE (funil exame→recomendação). Receita de
//     suplemento vendido como produto já aparece na Margem (Fase 4).

// ── Recorrência / SaaS ──────────────────────────────────────────────────────

type SubRow = {
  amount_cents: number;
  billing_interval: string; // 'monthly' | 'yearly'
  status: string;
  plan_name: string;
};

export type PlanMrr = { plan: string; subscribers: number; mrrCents: number };

export type SaasSummary = {
  mrrCents: number;
  arrCents: number;
  activeCount: number;    // active + past_due (assinaturas que geram receita recorrente)
  trialingCount: number;
  pastDueCount: number;
  byPlan: PlanMrr[];
};

/** Valor mensal normalizado de uma assinatura (anual ÷ 12). */
export function monthlyAmountCents(amountCents: number, billingInterval: string): number {
  if (billingInterval === "yearly") return Math.round((amountCents ?? 0) / 12);
  return amountCents ?? 0;
}

/**
 * Matemática pura do resumo de recorrência (testável sem banco). MRR conta as
 * assinaturas 'active' e 'past_due' (ainda vigentes, devendo receita); 'trialing'
 * entra só na contagem de trial, não no MRR.
 */
export function computeSaasSummary(subs: SubRow[]): SaasSummary {
  let mrr = 0;
  let activeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  const planMap = new Map<string, PlanMrr>();

  for (const s of subs) {
    if (s.status === "trialing") {
      trialingCount += 1;
      continue;
    }
    if (s.status !== "active" && s.status !== "past_due") continue; // canceled/unpaid/incomplete/paused fora do MRR
    const m = monthlyAmountCents(s.amount_cents, s.billing_interval);
    mrr += m;
    activeCount += 1;
    if (s.status === "past_due") pastDueCount += 1;
    const plan = s.plan_name || "—";
    const cur = planMap.get(plan) ?? { plan, subscribers: 0, mrrCents: 0 };
    cur.subscribers += 1;
    cur.mrrCents += m;
    planMap.set(plan, cur);
  }

  return {
    mrrCents: mrr,
    arrCents: mrr * 12,
    activeCount,
    trialingCount,
    pastDueCount,
    byPlan: [...planMap.values()].sort((a, b) => b.mrrCents - a.mrrCents),
  };
}

// ── Exames & Suplementos (attach / volume) ──────────────────────────────────

export type AttachStats = {
  examsThisMonth: number;
  examsByType: { type: string; count: number }[];
  recsThisMonth: number;         // recomendações de suplemento criadas no mês
  recsSentThisMonth: number;     // aprovadas/enviadas no mês
  patientsWithExam: number;      // distintos (all-time) com exame funcional
  patientsWithRec: number;       // distintos (all-time) com recomendação aprovada/enviada
  attachRatePct: number;         // patientsWithRec ÷ patientsWithExam (funil), 0–100
};

/** Attach rate puro: pacientes com recomendação ÷ pacientes com exame. */
export function computeAttachRate(patientsWithRec: number, patientsWithExam: number): number {
  if (patientsWithExam <= 0) return 0;
  return Math.round((patientsWithRec / patientsWithExam) * 1000) / 10;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export type RecurringDashboard = {
  currency: string;
  periodMonth: string;
  saas: SaasSummary;
  attach: AttachStats;
};

export async function getRecurringDashboard(clinicId: string): Promise<RecurringDashboard> {
  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${periodMonth}-01T00:00:00`;

  const [currency, saas, attach] = await Promise.all([
    getClinicCurrency(clinicId),
    getSaasSummary(clinicId),
    getAttachStats(clinicId, monthStart),
  ]);

  return { currency, periodMonth, saas, attach };
}

async function getSaasSummary(clinicId: string): Promise<SaasSummary> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patient_subscriptions")
    .select("amount_cents, billing_interval, status, plan_name")
    .eq("clinic_id", clinicId)
    .in("status", ["active", "past_due", "trialing"]);
  if (error) throw error;
  return computeSaasSummary((data ?? []) as SubRow[]);
}

async function getAttachStats(clinicId: string, monthStart: string): Promise<AttachStats> {
  const supabase = createSupabaseAdminClient();
  const [examsRes, recsRes] = await Promise.all([
    supabase
      .from("patient_functional_exams")
      .select("patient_id, exam_type, created_at")
      .eq("clinic_id", clinicId),
    supabase
      .from("patient_supplement_recommendations")
      .select("patient_id, status, created_at")
      .eq("clinic_id", clinicId),
  ]);
  const exams = (examsRes.data ?? []) as { patient_id: string; exam_type: string; created_at: string }[];
  const recs = (recsRes.data ?? []) as { patient_id: string; status: string; created_at: string }[];

  const examsThisMonth = exams.filter((e) => e.created_at >= monthStart).length;
  const byType = new Map<string, number>();
  for (const e of exams.filter((e) => e.created_at >= monthStart)) {
    byType.set(e.exam_type, (byType.get(e.exam_type) ?? 0) + 1);
  }

  const sent = (s: string) => s === "approved" || s === "sent";
  const recsThisMonth = recs.filter((r) => r.created_at >= monthStart).length;
  const recsSentThisMonth = recs.filter((r) => r.created_at >= monthStart && sent(r.status)).length;

  const patientsWithExam = new Set(exams.map((e) => e.patient_id)).size;
  const patientsWithRec = new Set(recs.filter((r) => sent(r.status)).map((r) => r.patient_id)).size;

  return {
    examsThisMonth,
    examsByType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    recsThisMonth,
    recsSentThisMonth,
    patientsWithExam,
    patientsWithRec,
    attachRatePct: computeAttachRate(patientsWithRec, patientsWithExam),
  };
}
