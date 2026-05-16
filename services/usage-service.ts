import { createSupabaseServerClient as createClient } from "@/lib/supabase-server";
import type { PlanLimitKey } from "@/modules/billing/plan-config";

export async function recordUsageEvent(
  clinicId: string,
  eventType: PlanLimitKey | string,
  quantity = 1
) {
  const supabase = await createClient();

  const { error } = await supabase.from("usage_events").insert({
    clinic_id: clinicId,
    event_type: eventType,
    quantity,
  });

  if (error) {
    console.error("recordUsageEvent error", error);
  }
}

export async function getUsageSummary(clinicId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usage_events")
    .select("event_type, quantity")
    .eq("clinic_id", clinicId);

  if (error) {
    console.error("getUsageSummary error", error);
    return {};
  }

  return (data ?? []).reduce<Record<string, number>>((summary, event) => {
    summary[event.event_type] = (summary[event.event_type] ?? 0) + Number(event.quantity ?? 0);
    return summary;
  }, {});
}
