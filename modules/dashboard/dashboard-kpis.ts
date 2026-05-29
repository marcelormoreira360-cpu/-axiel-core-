export interface DashboardKPIs {
  revenueThisMonth: number;
  revenueLastMonth: number;
  sessionsThisMonth: number;
  sessionsLastMonth: number;
  returnRate: number;
  returnRateBase: number;
}

export async function getDashboardKPIs(clinicId: string): Promise<DashboardKPIs> {
  // Lazy import so this module is never accidentally bundled client-side
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [
    { data: paymentsThis },
    { data: paymentsLast },
    { data: apptThis },
    { data: apptLast },
    { data: apptBefore },
  ] = await Promise.all([
    // Revenue this month from patient_payments
    supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .gte("paid_at", thisMonthStart)
      .lte("paid_at", thisMonthEnd),

    // Revenue last month
    supabase
      .from("patient_payments")
      .select("amount_cents")
      .eq("clinic_id", clinicId)
      .gte("paid_at", lastMonthStart)
      .lte("paid_at", lastMonthEnd),

    // Sessions (appointments) this month
    supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", thisMonthStart)
      .lte("starts_at", thisMonthEnd),

    // Sessions last month
    supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", lastMonthStart)
      .lte("starts_at", lastMonthEnd),

    // All past sessions (to calculate return rate)
    supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .lt("starts_at", thisMonthStart),
  ]);

  const revenueThisMonth = (paymentsThis ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const revenueLastMonth = (paymentsLast ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const sessionsThisMonth = (apptThis ?? []).length;
  const sessionsLastMonth = (apptLast ?? []).length;

  // Return rate: % of this-month patients who had a previous appointment
  const thisMonthPatientIds = new Set((apptThis ?? []).map((a) => a.patient_id));
  const prevPatientIds      = new Set((apptBefore ?? []).map((a) => a.patient_id));
  const returningCount      = [...thisMonthPatientIds].filter((id) => prevPatientIds.has(id)).length;
  const returnRateBase      = thisMonthPatientIds.size;
  const returnRate          = returnRateBase > 0 ? Math.round((returningCount / returnRateBase) * 100) : 0;

  return {
    revenueThisMonth,
    revenueLastMonth,
    sessionsThisMonth,
    sessionsLastMonth,
    returnRate,
    returnRateBase,
  };
}

// Pure formatting utils live in dashboard-kpis-utils.ts (safe for Client Components)
export { formatBRL, sessionsDelta, revenueDelta } from "@/modules/dashboard/dashboard-kpis-utils";
