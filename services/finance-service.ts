import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PatientPayment, PaymentMethod } from "@/lib/types";
import { formatBRL, paymentMethodLabel, currentMonthRange, prevMonthRange, monthKey } from "@/lib/finance-utils";

// ── Formatters & period helpers ───────────────────────────────────
// Re-exported from lib/finance-utils so client components can import from there
// without pulling in any server-side dependencies.

export { formatBRL, paymentMethodLabel, currentMonthRange, prevMonthRange, monthKey } from "@/lib/finance-utils";

// ── Moeda da clínica ──────────────────────────────────────────────
// Moeda padrão da clínica (BRL/USD/EUR), de clinic_settings. Cached por request.
export const getClinicCurrency = cache(async (clinicId: string): Promise<string> => {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("default_currency, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const fromCol = (data?.default_currency as string | null) ?? null;
  const fromJson = ((data?.settings as Record<string, unknown> | null)?.default_currency as string | undefined) ?? null;
  return (fromCol || fromJson || "BRL").toUpperCase();
});

// ── KPIs ─────────────────────────────────────────────────────────

export type FinanceKPIs = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueThisMonthByMethod: Record<PaymentMethod | "other", number>;
  pendingCount: number;
  pendingEstimatedCents: number;
  totalPaymentsThisMonth: number;
  averageTicketCents: number;
};

export async function getFinanceKPIs(clinicId: string): Promise<FinanceKPIs> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { from, to } = currentMonthRange();
  const { from: prevFrom, to: prevTo } = prevMonthRange();

  const [{ data: thisPeriod }, { data: lastPeriod }, { data: pending }] = await Promise.all([
    supabase
      .from("patient_payments")
      .select("amount_cents, payment_method")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")            // pendentes não entram na receita
      .gte("paid_at", from)
      .lte("paid_at", to),
    supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", prevFrom)
      .lte("paid_at", prevTo),
    supabase
      .from("appointments")
      .select("id, session_types(price_cents)")
      .eq("clinic_id", clinicId)
      .eq("status", "scheduled")
      .gte("starts_at", from)
      .lte("starts_at", to),
  ]);

  const thisMonthPayments = thisPeriod ?? [];
  const revenueThisMonth = thisMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const revenueLastMonth = (lastPeriod ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // Revenue by payment method
  const revenueByMethod: Record<string, number> = {};
  for (const p of thisMonthPayments) {
    const m = p.payment_method ?? "other";
    revenueByMethod[m] = (revenueByMethod[m] ?? 0) + (p.amount_cents ?? 0);
  }

  // Pending: future appointments without a payment this month
  const pendingAppts = pending ?? [];
  const pendingCount = pendingAppts.length;
  const pendingEstimatedCents = pendingAppts.reduce((s, a) => {
    const st = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
    return s + ((st as { price_cents?: number } | null)?.price_cents ?? 0);
  }, 0);

  const avgTicket = thisMonthPayments.length > 0
    ? Math.round(revenueThisMonth / thisMonthPayments.length)
    : 0;

  return {
    revenueThisMonth,
    revenueLastMonth,
    revenueThisMonthByMethod: revenueByMethod as Record<PaymentMethod | "other", number>,
    pendingCount,
    pendingEstimatedCents,
    totalPaymentsThisMonth: thisMonthPayments.length,
    averageTicketCents: avgTicket,
  };
}

// ── Payment list ──────────────────────────────────────────────────

export type PaymentWithPatient = PatientPayment & {
  patient_name: string | null;
  session_type_name: string | null;
};

export async function getPaymentsWithPatients(
  clinicId: string,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<PaymentWithPatient[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("patient_payments")
    .select("*, patients(full_name), appointments(id, session_types(name))")
    .eq("clinic_id", clinicId)
    .order("paid_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.from) q = q.gte("paid_at", opts.from);
  if (opts.to)   q = q.lte("paid_at", opts.to);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    const appt = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const st = appt && (Array.isArray((appt as { session_types?: unknown }).session_types)
      ? ((appt as { session_types: Array<{ name?: string }> }).session_types)[0]
      : (appt as { session_types?: { name?: string } }).session_types);
    return {
      ...row,
      patient_name: (patient as { full_name?: string } | null)?.full_name ?? null,
      session_type_name: (st as { name?: string } | null)?.name ?? null,
    } as PaymentWithPatient;
  });
}

// ── Unpaid sessions ───────────────────────────────────────────────

export type UnpaidSession = {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  starts_at: string;
  session_type_name: string | null;
  price_cents: number;
};

export async function getUnpaidSessions(clinicId: string): Promise<UnpaidSession[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Get past appointments — exclude cancelled / no_show (M-04)
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, patient_id, starts_at, status, patients(full_name), session_types(name, price_cents)")
    .eq("clinic_id", clinicId)
    .lt("starts_at", new Date().toISOString())
    .not("status", "in", '("cancelled","no_show")')
    .order("starts_at", { ascending: false })
    .limit(100);

  if (!appts?.length) return [];

  // Get which appointment IDs already have payments
  const apptIds = appts.map((a) => a.id);
  const { data: paid } = await supabase
    .from("patient_payments")
    .select("appointment_id")
    .eq("clinic_id", clinicId)
    .in("appointment_id", apptIds);

  const paidSet = new Set((paid ?? []).map((p) => p.appointment_id));

  return appts
    .filter((a) => !paidSet.has(a.id))
    .map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const st = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
      return {
        appointment_id: a.id,
        patient_id: a.patient_id,
        patient_name: (patient as { full_name?: string } | null)?.full_name ?? "—",
        starts_at: a.starts_at,
        session_type_name: (st as { name?: string } | null)?.name ?? null,
        price_cents: (st as { price_cents?: number } | null)?.price_cents ?? 0,
      };
    });
}

// ── Revenue by month (last 6 months) ─────────────────────────────

export type MonthlyRevenue = { month: string; label: string; cents: number };

export async function getMonthlyRevenue(clinicId: string): Promise<MonthlyRevenue[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Single query for the whole 6-month window instead of 6 sequential queries (B-02)
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const { data } = await supabase
    .from("patient_payments")
    .select("amount_cents, paid_at")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")           // A-07: only count confirmed paid (excludes pending/refunded)
    .gte("paid_at", from)
    .limit(5000);

  // Build month buckets (always includes all 6 months even if empty)
  const buckets = new Map<string, MonthlyRevenue>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, {
      month: key,
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      cents: 0,
    });
  }

  for (const p of data ?? []) {
    const d = new Date(p.paid_at);
    const key = monthKey(d);
    const bucket = buckets.get(key);
    if (bucket) bucket.cents += p.amount_cents ?? 0;
  }

  return [...buckets.values()];
}

// ── Admin: create payment (used by server actions) ────────────────

export async function createPaymentAdmin(input: {
  clinic_id: string;
  patient_id: string;
  appointment_id?: string | null;
  amount_cents: number;
  payment_method: PaymentMethod;
  paid_at: string;
  notes?: string | null;
  created_by?: string | null;
  status?: PatientPayment["status"];
  proof_path?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const status = input.status ?? "paid";
  const currency = await getClinicCurrency(input.clinic_id);
  const { data, error } = await supabase
    .from("patient_payments")
    .insert({
      ...input,
      status,
      currency,
      // Pagamento já recebido entra confirmado; pendente aguarda conciliação.
      confirmed_at: status === "paid" ? input.paid_at : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PatientPayment;
}

// ── Pagamentos pendentes de conciliação (Zelle/transferência/dinheiro) ─────────

export type PendingPayment = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod | null;
  paid_at: string;
  notes: string | null;
  proof_path: string | null;
};

export async function getPendingPayments(clinicId: string): Promise<PendingPayment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("patient_payments")
    .select("id, patient_id, amount_cents, currency, payment_method, paid_at, notes, proof_path, patients(full_name)")
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .order("paid_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    return {
      id: row.id,
      patient_id: row.patient_id,
      patient_name: (patient as { full_name?: string } | null)?.full_name ?? null,
      amount_cents: row.amount_cents,
      currency: row.currency,
      payment_method: row.payment_method,
      paid_at: row.paid_at,
      notes: row.notes,
      proof_path: row.proof_path,
    } as PendingPayment;
  });
}

// ── Financeiro por paciente (view patient_financials) ─────────────
// Rollup por paciente: receita, ticket médio, LTV, nº de pagamentos, planos.
// Lê a VIEW patient_financials (security_invoker → RLS de clínica aplica).
// ⚠️ Exposição na UI deve ser restrita a gestores (requireFinanceAccess/isManager).
export type PatientFinancials = {
  patient_id: string;
  total_revenue_cents: number;
  payments_count: number;
  average_ticket_cents: number;
  lifetime_value_cents: number;
  first_payment_at: string | null;
  last_payment_at: string | null;
  pending_cents: number;
  refunded_cents: number;
  plans_offered: number;
  plans_accepted: number;
};

const EMPTY_PATIENT_FINANCIALS: Omit<PatientFinancials, "patient_id"> = {
  total_revenue_cents: 0,
  payments_count: 0,
  average_ticket_cents: 0,
  lifetime_value_cents: 0,
  first_payment_at: null,
  last_payment_at: null,
  pending_cents: 0,
  refunded_cents: 0,
  plans_offered: 0,
  plans_accepted: 0,
};

/**
 * Métricas financeiras de um paciente. Escopo de clínica explícito (além da
 * RLS). Retorna zeros quando o paciente ainda não tem movimento financeiro.
 */
export async function getPatientFinancials(
  patientId: string,
  clinicId: string,
): Promise<PatientFinancials> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("patient_financials")
    .select(
      "patient_id, total_revenue_cents, payments_count, average_ticket_cents, lifetime_value_cents, first_payment_at, last_payment_at, pending_cents, refunded_cents, plans_offered, plans_accepted",
    )
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { patient_id: patientId, ...EMPTY_PATIENT_FINANCIALS };

  return data as PatientFinancials;
}
