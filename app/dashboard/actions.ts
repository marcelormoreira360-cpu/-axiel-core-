"use server";

import { getDashboardKPIs } from "@/modules/dashboard/dashboard-kpis";
import { getAppointments } from "@/services/appointment-service";
import type { DashboardKPIs } from "@/modules/dashboard/dashboard-kpis";

export interface DashboardRealtimeData {
  kpis: DashboardKPIs;
  todayCount: number;
}

/**
 * Server Action called by DashboardRealtimeKpis whenever a Realtime event
 * fires on the appointments or patient_payments tables.
 *
 * Uses the session-based Supabase client so RLS is enforced — the browser
 * never touches the service-role key.
 */
export async function refreshDashboardData(
  clinicId: string,
): Promise<DashboardRealtimeData> {
  const [kpis, appointments] = await Promise.all([
    getDashboardKPIs(clinicId),
    getAppointments().catch(() => [] as Awaited<ReturnType<typeof getAppointments>>),
  ]);

  const today = new Date().toDateString();
  const todayCount = appointments.filter(
    (a) => new Date(a.starts_at).toDateString() === today,
  ).length;

  return { kpis, todayCount };
}
