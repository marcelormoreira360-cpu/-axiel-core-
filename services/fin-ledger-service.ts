import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getFinanceKPIs,
  getClinicCurrency,
  getUnpaidSessions,
  getMonthlyRevenue,
  type UnpaidSession,
} from "@/services/finance-service";

// Módulo Financeiro (ERP) — Fase 1. Razão único `fin_entries` + consolidação
// read-only das fontes que já existem (patient_payments via finance-service).
// Escrita sempre pelo servidor (admin client), gated por requireFinanceAccess.

export type FinKind = "revenue" | "expense";

export type FinEntry = {
  id: string;
  clinic_id: string;
  kind: FinKind;
  amount_cents: number;
  currency: string;
  entry_date: string;
  category: string | null;
  business_unit: string;
  method: string | null;
  description: string | null;
  source: string;
  created_at: string;
};

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

// ── Lançamentos manuais ─────────────────────────────────────────────────────

export type CreateFinEntryInput = {
  clinicId: string;
  kind: FinKind;
  amountCents: number;
  currency: string;
  entryDate: string;          // YYYY-MM-DD
  category?: string | null;
  businessUnit?: string;
  method?: string | null;
  description?: string | null;
  createdBy?: string | null;
};

export async function createFinEntry(input: CreateFinEntryInput): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const row = {
    clinic_id: input.clinicId,
    kind: input.kind,
    amount_cents: Math.max(0, Math.round(input.amountCents)),
    currency: input.currency,
    entry_date: input.entryDate,
    category: input.category?.trim() || null,
    business_unit: input.businessUnit?.trim() || "clinica",
    method: input.method?.trim() || null,
    description: input.description?.trim() || null,
    source: "manual",
    created_by: input.createdBy ?? null,
  };
  const { data, error } = await supabase.from("fin_entries").insert(row).select("id").single();
  if (error) throw error;
  await supabase.from("fin_audit").insert({
    clinic_id: input.clinicId,
    entity: "fin_entry",
    entity_id: data.id,
    action: "create",
    changed_by: input.createdBy ?? null,
    diff: row,
  });
  return data.id as string;
}

export async function listFinEntries(
  clinicId: string,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<FinEntry[]> {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("fin_entries")
    .select("id, clinic_id, kind, amount_cents, currency, entry_date, category, business_unit, method, description, source, created_at")
    .eq("clinic_id", clinicId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (opts.from) q = q.gte("entry_date", opts.from);
  if (opts.to) q = q.lte("entry_date", opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FinEntry[];
}

export async function deleteFinEntry(id: string, clinicId: string, byUser?: string | null): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Só apaga lançamento MANUAL (espelhos de fonte externa não se apaga aqui).
  const { error } = await supabase
    .from("fin_entries")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("source", "manual");
  if (error) throw error;
  await supabase.from("fin_audit").insert({
    clinic_id: clinicId,
    entity: "fin_entry",
    entity_id: id,
    action: "delete",
    changed_by: byUser ?? null,
  });
}

// ── Dashboard Executivo (consolidação read-only) ────────────────────────────

export type ExecutiveSummary = {
  currency: string;
  revenueCents: number;       // receita do mês (pagamentos pagos + receita manual)
  revenuePrevCents: number;   // mês anterior (só pagamentos, p/ variação)
  expenseCents: number;       // despesas do mês (lançamentos manuais)
  netCents: number;           // resultado (receita - despesa)
  receivableCents: number;    // a receber estimado (agenda futura sem pagamento)
  fromExistingRevenueCents: number; // parte da receita que veio de patient_payments
};

/**
 * Matemática pura do resumo executivo (testável sem banco): consolida a receita
 * que já vem de patient_payments (kpis) com os lançamentos manuais do razão.
 */
export function computeExecutiveTotals(
  kpis: { revenueThisMonth: number; revenueLastMonth: number; pendingEstimatedCents: number },
  entries: { kind: FinKind; amount_cents: number }[],
  currency: string,
  extraExpenseCents = 0, // despesas de outras fontes (ex.: repasse pago no mês)
): ExecutiveSummary {
  let extraRevenue = 0;
  let expense = extraExpenseCents;
  for (const e of entries) {
    if (e.kind === "revenue") extraRevenue += e.amount_cents ?? 0;
    else expense += e.amount_cents ?? 0;
  }
  const revenue = kpis.revenueThisMonth + extraRevenue;
  return {
    currency,
    revenueCents: revenue,
    revenuePrevCents: kpis.revenueLastMonth,
    expenseCents: expense,
    netCents: revenue - expense,
    receivableCents: kpis.pendingEstimatedCents,
    fromExistingRevenueCents: kpis.revenueThisMonth,
  };
}

export async function getExecutiveSummary(clinicId: string): Promise<ExecutiveSummary> {
  const [kpis, currency] = await Promise.all([
    getFinanceKPIs(clinicId),
    getClinicCurrency(clinicId),
  ]);

  const supabase = createSupabaseAdminClient();
  const { from, to } = currentMonthRange();
  const [{ data }, repasseCents] = await Promise.all([
    supabase
      .from("fin_entries")
      .select("kind, amount_cents")
      .eq("clinic_id", clinicId)
      .gte("entry_date", from)
      .lte("entry_date", to),
    getPaidRepasseCents(clinicId, `${from}T00:00:00`, `${to}T23:59:59`),
  ]);

  return computeExecutiveTotals(
    kpis,
    (data ?? []) as { kind: FinKind; amount_cents: number }[],
    currency,
    repasseCents,
  );
}

// Total de repasse PAGO no período (despesa real da clínica). paid_at é timestamptz.
async function getPaidRepasseCents(clinicId: string, fromTs: string, toTs: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("repasse_ledger")
    .select("repasse_cents")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")
    .gte("paid_at", fromTs)
    .lte("paid_at", toTs);
  return (data ?? []).reduce((s, r) => s + ((r.repasse_cents as number) ?? 0), 0);
}

// ── Fase 2: Contas a Receber (sessões entregues sem pagamento) ──────────────

export type ReceivablesResult = {
  currency: string;
  totalCents: number;
  buckets: { d0_30: number; d31_60: number; d61_90: number; d90p: number };
  sessions: (UnpaidSession & { daysOverdue: number })[];
};

export async function getReceivables(clinicId: string): Promise<ReceivablesResult> {
  const [sessions, currency] = await Promise.all([
    getUnpaidSessions(clinicId),
    getClinicCurrency(clinicId),
  ]);
  const now = Date.now();
  const buckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  let total = 0;
  const enriched = sessions.map((s) => {
    const days = Math.max(0, Math.floor((now - Date.parse(s.starts_at)) / 86_400_000));
    const cents = s.price_cents ?? 0;
    total += cents;
    if (days <= 30) buckets.d0_30 += cents;
    else if (days <= 60) buckets.d31_60 += cents;
    else if (days <= 90) buckets.d61_90 += cents;
    else buckets.d90p += cents;
    return { ...s, daysOverdue: days };
  });
  return { currency, totalCents: total, buckets, sessions: enriched };
}

// ── Fase 2: Fluxo de Caixa (6 meses realizados: entrada x saída) ────────────

export type CashFlowMonth = { month: string; inCents: number; outCents: number; netCents: number };
export type CashFlowResult = {
  currency: string;
  months: CashFlowMonth[];
  totalIn: number;
  totalOut: number;
  totalNet: number;
};

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getCashFlow(clinicId: string): Promise<CashFlowResult> {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const fromDate = windowStart.toISOString().slice(0, 10);
  const fromTs = windowStart.toISOString();

  const supabase = createSupabaseAdminClient();
  const [monthly, currency, finRows, repasseRows] = await Promise.all([
    getMonthlyRevenue(clinicId), // entrada de patient_payments por mês (6 meses)
    getClinicCurrency(clinicId),
    supabase
      .from("fin_entries")
      .select("kind, amount_cents, entry_date")
      .eq("clinic_id", clinicId)
      .gte("entry_date", fromDate),
    supabase
      .from("repasse_ledger")
      .select("repasse_cents, paid_at")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", fromTs),
  ]);

  // Base: os 6 buckets de mês (mesma janela do getMonthlyRevenue).
  const months = new Map<string, CashFlowMonth>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, { month: key, inCents: 0, outCents: 0, netCents: 0 });
  }

  for (const m of monthly) {
    const b = months.get(m.month);
    if (b) b.inCents += m.cents ?? 0;
  }
  for (const e of (finRows.data ?? []) as { kind: FinKind; amount_cents: number; entry_date: string }[]) {
    const b = months.get(monthKeyOf(e.entry_date));
    if (!b) continue;
    if (e.kind === "revenue") b.inCents += e.amount_cents ?? 0;
    else b.outCents += e.amount_cents ?? 0;
  }
  for (const r of (repasseRows.data ?? []) as { repasse_cents: number; paid_at: string }[]) {
    const b = months.get(monthKeyOf(r.paid_at));
    if (b) b.outCents += r.repasse_cents ?? 0;
  }

  const list = [...months.values()].map((m) => ({ ...m, netCents: m.inCents - m.outCents }));
  return {
    currency,
    months: list,
    totalIn: list.reduce((s, m) => s + m.inCents, 0),
    totalOut: list.reduce((s, m) => s + m.outCents, 0),
    totalNet: list.reduce((s, m) => s + m.netCents, 0),
  };
}
