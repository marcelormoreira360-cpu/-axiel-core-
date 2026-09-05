import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getFinanceKPIs, getClinicCurrency } from "@/services/finance-service";

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
): ExecutiveSummary {
  let extraRevenue = 0;
  let expense = 0;
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
  const { data } = await supabase
    .from("fin_entries")
    .select("kind, amount_cents")
    .eq("clinic_id", clinicId)
    .gte("entry_date", from)
    .lte("entry_date", to);

  return computeExecutiveTotals(kpis, (data ?? []) as { kind: FinKind; amount_cents: number }[], currency);
}
