import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface DashboardKPIs {
  revenueThisMonth: number;
  revenueLastMonth: number;
  sessionsThisMonth: number;
  sessionsLastMonth: number;
  returnRate: number;
  returnRateBase: number;
}

export async function getDashboardKPIs(clinicId: string): Promise<DashboardKPIs> {
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [offersThis, offersLast, apptThis, apptBefore] = await Promise.all([
    supabase
      .from("patient_offers")
      .select("monetization_offers(price_cents)")
      .eq("clinic_id", clinicId)
      .gte("created_at", thisMonthStart),

    supabase
      .from("patient_offers")
      .select("monetization_offers(price_cents)")
      .eq("clinic_id", clinicId)
      .gte("created_at", lastMonthStart)
      .lt("created_at", thisMonthStart),

    supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", thisMonthStart),

    supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .lt("starts_at", thisMonthStart),
  ]);

  const sumCents = (rows: typeof offersThis.data) =>
    (rows ?? []).reduce((acc, r) => {
      const raw = r.monetization_offers;
      const offer = (Array.isArray(raw) ? raw[0] : raw) as { price_cents: number } | null;
      return acc + (offer?.price_cents ?? 0);
    }, 0);

  const revenueThisMonth = sumCents(offersThis.data);
  const revenueLastMonth = sumCents(offersLast.data);

  const thisMonthPatientIds = new Set((apptThis.data ?? []).map((a) => a.patient_id));
  const prevPatientIds = new Set((apptBefore.data ?? []).map((a) => a.patient_id));
  const returningCount = [...thisMonthPatientIds].filter((id) => prevPatientIds.has(id)).length;

  const returnRateBase = thisMonthPatientIds.size;
  const returnRate = returnRateBase > 0 ? Math.round((returningCount / returnRateBase) * 100) : 0;

  // sessions this month and last month from the same data we already have
  const sessionsThisMonth = (apptThis.data ?? []).length;

  const { data: apptLast } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .gte("starts_at", lastMonthStart)
    .lt("starts_at", thisMonthStart);

  const sessionsLastMonth = (apptLast ?? []).length;

  return {
    revenueThisMonth,
    revenueLastMonth,
    sessionsThisMonth,
    sessionsLastMonth,
    returnRate,
    returnRateBase,
  };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function sessionsDelta(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "nenhuma sessão";
  const diff = current - previous;
  if (diff === 0) return "igual ao mês passado";
  return `${diff > 0 ? "+" : ""}${diff} vs. mês passado`;
}

export function revenueDelta(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return "igual ao mês passado";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatBRL(diff)} vs. mês passado`;
}
