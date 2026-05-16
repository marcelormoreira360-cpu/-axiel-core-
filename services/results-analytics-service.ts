import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ResultsMetric } from "@/modules/results/analytics-types";
import { buildResultsSummary } from "@/modules/results/results-summary";

async function safeCount(table: string, clinicId: string, filters?: (query: any) => any) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("clinic_id", clinicId);
  if (filters) query = filters(query);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function safeOrderRevenue(clinicId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_orders")
    .select("total_cents")
    .eq("clinic_id", clinicId)
    .in("status", ["paid", "delivered"]);

  if (error || !data) return 0;

  return data.reduce((sum: number, order: { total_cents?: number | null }) => {
    return sum + (order.total_cents ?? 0);
  }, 0);
}

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function getResultsAnalyticsSummary(clinicId: string) {
  const [
    revenueCents,
    sessions,
    newPatients,
    newLeads,
    productsSold,
    activeMemberships,
    pendingFollowUps,
  ] = await Promise.all([
    safeOrderRevenue(clinicId),
    safeCount("appointments", clinicId),
    safeCount("patients", clinicId),
    safeCount("leads", clinicId),
    safeCount("product_order_items", clinicId),
    safeCount("patient_offers", clinicId, (query) => query.eq("status", "active")),
    safeCount("follow_ups", clinicId, (query) => query.eq("status", "pending")),
  ]);

  const conversionRate =
    newLeads === 0 ? 0 : Math.min(100, Math.round((newPatients / Math.max(newLeads, 1)) * 100));

  const metrics: ResultsMetric[] = [
    {
      key: "revenue",
      label: "Revenue",
      value: formatCurrencyFromCents(revenueCents),
      helper: "Recorded product and support revenue.",
    },
    {
      key: "sessions",
      label: "Sessions",
      value: String(sessions),
      helper: "Sessions recorded in your clinic.",
    },
    {
      key: "conversion_rate",
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      helper: "New patients compared with new leads.",
    },
    {
      key: "new_patients",
      label: "New Patients",
      value: String(newPatients),
      helper: "Patients added to the clinic.",
    },
    {
      key: "new_leads",
      label: "New Leads",
      value: String(newLeads),
      helper: "New people in the lead flow.",
    },
    {
      key: "products_sold",
      label: "Products Sold",
      value: String(productsSold),
      helper: "Product items recorded in sales.",
    },
    {
      key: "active_memberships",
      label: "Active Memberships",
      value: String(activeMemberships),
      helper: "Active patient memberships or offers.",
    },
    {
      key: "pending_follow_ups",
      label: "Pending Follow-ups",
      value: String(pendingFollowUps),
      helper: "Follow-ups still waiting for action.",
    },
  ];

  return buildResultsSummary(metrics);
}
