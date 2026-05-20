import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PatientPayment, PaymentMethod } from "@/lib/types";
import { formatBRL, paymentMethodLabel, currentMonthRange, prevMonthRange, monthKey } from "@/lib/finance-utils";

// ── Formatters & period helpers ───────────────────────────────────
// Re-exported from lib/finance-utils so client components can import from there
// without pulling in any server-side dependencies.

export { formatBRL, paymentMethodLabel, currentMonthRange, prevMonthRange, monthKey } from "@/lib/finance-utils";

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
      .gte("paid_at", from)
      .lte("paid_at", to),
    supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
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

  // Get past appointments
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, patient_id, starts_at, patients(full_name), session_types(name, price_cents)")
    .eq("clinic_id", clinicId)
    .lt("starts_at", new Date().toISOString())
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
  const results: MonthlyRevenue[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .gte("paid_at", from)
      .lte("paid_at", to);

    const cents = (data ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    results.push({
      month: monthKey(d),
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      cents,
    });
  }

  return results;
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
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patient_payments")
    .insert({ ...input, currency: "BRL" })
    .select("*")
    .single();
  if (error) throw error;
  return data as PatientPayment;
}
