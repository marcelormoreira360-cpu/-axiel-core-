import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicCurrency } from "@/services/finance-service";

// Módulo Financeiro (ERP) — Fase 3. Contas a Pagar + Fornecedores + Recorrentes.
// Ao PAGAR uma conta, geramos um lançamento de despesa no razão único
// (fin_entries, source='payable') — assim a despesa aparece automaticamente no
// Dashboard Executivo e no Fluxo de Caixa, sem duplicar número.
// Escrita sempre pelo servidor (admin client), gated por requireFinanceAccess.

// ── Tipos ───────────────────────────────────────────────────────────────────

export type PayableStatus = "open" | "paid" | "canceled";

export type FinSupplier = {
  id: string;
  clinic_id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export type FinRecurring = {
  id: string;
  clinic_id: string;
  supplier_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  day_of_month: number;
  category: string | null;
  business_unit: string;
  method: string | null;
  active: boolean;
  created_at: string;
};

export type FinPayable = {
  id: string;
  clinic_id: string;
  supplier_id: string | null;
  recurring_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  status: PayableStatus;
  category: string | null;
  business_unit: string;
  method: string | null;
  paid_at: string | null;
  supplier_name?: string | null;
  created_at: string;
};

const PAYABLE_COLS =
  "id, clinic_id, supplier_id, recurring_id, description, amount_cents, currency, due_date, status, category, business_unit, method, paid_at, created_at";

// ── Helpers puros (testáveis sem banco) ─────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Data de vencimento de uma recorrente numa competência (ano/mês, 1-based),
 * fixando o dia no mês e "grampeando" no último dia quando o mês é mais curto
 * (ex.: dia 31 em fevereiro vira 28/29). Retorna 'YYYY-MM-DD'.
 */
export function monthlyDueDate(year: number, month1: number, dayOfMonth: number): string {
  const lastDay = new Date(year, month1, 0).getDate(); // dia 0 do mês seguinte = último dia deste
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type PayablesSummary = {
  currency: string;
  openCents: number;        // tudo em aberto (a vencer + vencido)
  overdueCents: number;     // em aberto com vencimento < hoje
  dueThisMonthCents: number; // em aberto vencendo no mês corrente (a partir de hoje)
  paidThisMonthCents: number; // já pago no mês corrente
  openCount: number;
  overdueCount: number;
};

/**
 * Matemática pura do resumo de contas a pagar. `open` são as contas com status
 * 'open'; `paidThisMonthCents` vem de fora (soma das pagas no mês). `today` é
 * 'YYYY-MM-DD' — comparação lexicográfica de datas ISO é segura.
 */
export function computePayablesSummary(
  open: { amount_cents: number; due_date: string }[],
  paidThisMonthCents: number,
  today: string,
  currency: string,
): PayablesSummary {
  const monthPrefix = today.slice(0, 7); // 'YYYY-MM'
  let openCents = 0;
  let overdueCents = 0;
  let dueThisMonthCents = 0;
  let overdueCount = 0;
  for (const p of open) {
    const cents = p.amount_cents ?? 0;
    openCents += cents;
    if (p.due_date < today) {
      overdueCents += cents;
      overdueCount += 1;
    } else if (p.due_date.slice(0, 7) === monthPrefix) {
      dueThisMonthCents += cents;
    }
  }
  return {
    currency,
    openCents,
    overdueCents,
    dueThisMonthCents,
    paidThisMonthCents,
    openCount: open.length,
    overdueCount,
  };
}

// ── Fornecedores ────────────────────────────────────────────────────────────

export async function listSuppliers(clinicId: string): Promise<FinSupplier[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fin_suppliers")
    .select("id, clinic_id, name, notes, created_at")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinSupplier[];
}

/** Cria (ou reaproveita) um fornecedor pelo nome. Retorna o id. */
export async function upsertSupplier(input: {
  clinicId: string;
  name: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("supplier name required");
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("fin_suppliers")
    .select("id")
    .eq("clinic_id", input.clinicId)
    .ilike("name", name)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const { data, error } = await supabase
    .from("fin_suppliers")
    .insert({
      clinic_id: input.clinicId,
      name,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteSupplier(id: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("fin_suppliers").delete().eq("id", id).eq("clinic_id", clinicId);
  if (error) throw error;
}

// ── Recorrentes ─────────────────────────────────────────────────────────────

export async function listRecurring(clinicId: string): Promise<FinRecurring[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fin_recurring")
    .select(
      "id, clinic_id, supplier_id, description, amount_cents, currency, day_of_month, category, business_unit, method, active, created_at",
    )
    .eq("clinic_id", clinicId)
    .order("active", { ascending: false })
    .order("day_of_month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinRecurring[];
}

export async function createRecurring(input: {
  clinicId: string;
  description: string;
  amountCents: number;
  currency: string;
  dayOfMonth: number;
  supplierId?: string | null;
  category?: string | null;
  businessUnit?: string;
  method?: string | null;
  createdBy?: string | null;
}): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fin_recurring")
    .insert({
      clinic_id: input.clinicId,
      description: input.description.trim(),
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      currency: input.currency,
      day_of_month: Math.min(31, Math.max(1, Math.round(input.dayOfMonth))),
      supplier_id: input.supplierId ?? null,
      category: input.category?.trim() || null,
      business_unit: input.businessUnit?.trim() || "clinica",
      method: input.method?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function setRecurringActive(id: string, clinicId: string, active: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("fin_recurring")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

export async function deleteRecurring(id: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("fin_recurring").delete().eq("id", id).eq("clinic_id", clinicId);
  if (error) throw error;
}

/**
 * Materializa as recorrentes ATIVAS na competência do mês corrente, criando uma
 * conta a pagar por recorrente. O índice único (clinic_id, recurring_id, due_date)
 * garante idempotência — rodar duas vezes no mesmo mês não duplica. Retorna
 * quantas contas foram efetivamente criadas.
 */
export async function generateRecurringForCurrentMonth(
  clinicId: string,
  createdBy?: string | null,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const recs = await listRecurring(clinicId);
  const active = recs.filter((r) => r.active);
  if (active.length === 0) return 0;

  const now = new Date();
  const year = now.getFullYear();
  const month1 = now.getMonth() + 1;

  const rows = active.map((r) => ({
    clinic_id: clinicId,
    supplier_id: r.supplier_id,
    recurring_id: r.id,
    description: r.description,
    amount_cents: r.amount_cents,
    currency: r.currency,
    due_date: monthlyDueDate(year, month1, r.day_of_month),
    status: "open" as const,
    category: r.category,
    business_unit: r.business_unit,
    method: r.method,
    created_by: createdBy ?? null,
  }));

  // onConflict no índice único → ignora as que já existem neste mês.
  const { data, error } = await supabase
    .from("fin_payables")
    .upsert(rows, { onConflict: "clinic_id,recurring_id,due_date", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// ── Contas a pagar ──────────────────────────────────────────────────────────

export async function listPayables(
  clinicId: string,
  opts: { status?: PayableStatus; limit?: number } = {},
): Promise<FinPayable[]> {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("fin_payables")
    .select(`${PAYABLE_COLS}, fin_suppliers(name)`)
    .eq("clinic_id", clinicId)
    .limit(opts.limit ?? 100);
  if (opts.status) q = q.eq("status", opts.status);
  // Abertas: por vencimento (mais antigo primeiro). Demais: mais recente primeiro.
  q = opts.status === "open"
    ? q.order("due_date", { ascending: true })
    : q.order("paid_at", { ascending: false, nullsFirst: false }).order("due_date", { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { fin_suppliers, ...rest } = row as Record<string, unknown> & {
      fin_suppliers?: { name?: string } | { name?: string }[] | null;
    };
    const sup = Array.isArray(fin_suppliers) ? fin_suppliers[0] : fin_suppliers;
    return { ...(rest as unknown as FinPayable), supplier_name: sup?.name ?? null };
  });
}

export async function createPayable(input: {
  clinicId: string;
  description: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  supplierId?: string | null;
  category?: string | null;
  businessUnit?: string;
  method?: string | null;
  createdBy?: string | null;
}): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fin_payables")
    .insert({
      clinic_id: input.clinicId,
      description: input.description.trim(),
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      currency: input.currency,
      due_date: input.dueDate || todayIso(),
      supplier_id: input.supplierId ?? null,
      category: input.category?.trim() || null,
      business_unit: input.businessUnit?.trim() || "clinica",
      method: input.method?.trim() || null,
      status: "open",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await logAudit(input.clinicId, data.id as string, "create", input.createdBy, input);
  return data.id as string;
}

/**
 * Paga uma conta: cria o lançamento de despesa no razão (fin_entries,
 * source='payable') e marca a conta como paga, ligando-a ao lançamento.
 * Idempotente na prática — o índice único (clinic_id, source, source_id) do
 * razão impede lançamento duplicado, e só agimos se a conta ainda está 'open'.
 */
export async function payPayable(
  id: string,
  clinicId: string,
  opts: { method?: string | null; paidDate?: string; byUser?: string | null } = {},
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: p, error: loadErr } = await supabase
    .from("fin_payables")
    .select(PAYABLE_COLS)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();
  if (loadErr) throw loadErr;
  const payable = p as unknown as FinPayable;
  if (payable.status !== "open") return; // já paga/cancelada — no-op

  const entryDate = opts.paidDate || todayIso();
  const method = opts.method?.trim() || payable.method || null;

  const entryRow = {
    clinic_id: clinicId,
    kind: "expense" as const,
    amount_cents: payable.amount_cents,
    currency: payable.currency,
    entry_date: entryDate,
    category: payable.category,
    business_unit: payable.business_unit,
    method,
    description: payable.description,
    source: "payable" as const,
    source_id: id,
    created_by: opts.byUser ?? null,
  };
  const { data: entry, error: entryErr } = await supabase
    .from("fin_entries")
    .insert(entryRow)
    .select("id")
    .single();
  if (entryErr) throw entryErr;

  const { error: updErr } = await supabase
    .from("fin_payables")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      method,
      fin_entry_id: entry.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("status", "open");
  if (updErr) throw updErr;

  await supabase.from("fin_audit").insert([
    { clinic_id: clinicId, entity: "fin_entry", entity_id: entry.id, action: "create", changed_by: opts.byUser ?? null, diff: entryRow },
    { clinic_id: clinicId, entity: "fin_payable", entity_id: id, action: "pay", changed_by: opts.byUser ?? null, diff: { fin_entry_id: entry.id, entryDate } },
  ]);
}

export async function deletePayable(id: string, clinicId: string, byUser?: string | null): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Só apaga conta AINDA em aberto — paga vira histórico (ligada a um lançamento).
  const { error } = await supabase
    .from("fin_payables")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("status", "open");
  if (error) throw error;
  await logAudit(clinicId, id, "delete", byUser, null);
}

// ── Resumo ──────────────────────────────────────────────────────────────────

export async function getPayablesSummary(clinicId: string): Promise<PayablesSummary> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [currency, openRes, paidRes] = await Promise.all([
    getClinicCurrency(clinicId),
    supabase
      .from("fin_payables")
      .select("amount_cents, due_date")
      .eq("clinic_id", clinicId)
      .eq("status", "open"),
    supabase
      .from("fin_payables")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", `${monthStart}T00:00:00`),
  ]);
  const paidThisMonth = (paidRes.data ?? []).reduce((s, r) => s + ((r.amount_cents as number) ?? 0), 0);
  return computePayablesSummary(
    (openRes.data ?? []) as { amount_cents: number; due_date: string }[],
    paidThisMonth,
    todayIso(),
    currency,
  );
}

// ── util ──────────────────────────────────────────────────────────────────

async function logAudit(
  clinicId: string,
  entityId: string,
  action: string,
  byUser?: string | null,
  diff?: unknown,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("fin_audit").insert({
    clinic_id: clinicId,
    entity: "fin_payable",
    entity_id: entityId,
    action,
    changed_by: byUser ?? null,
    diff: diff ?? null,
  });
}
