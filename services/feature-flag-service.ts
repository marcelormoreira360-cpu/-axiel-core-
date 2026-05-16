import { createSupabaseServerClient as createClient } from "@/lib/supabase-server";
import type { FeatureKey } from "@/modules/billing/plan-config";

export async function getClinicFeatureOverrides(clinicId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("feature_flags")
    .select("feature_key, is_enabled")
    .eq("clinic_id", clinicId);

  if (error) {
    console.error("getClinicFeatureOverrides error", error);
    return {};
  }

  return (data ?? []).reduce<Partial<Record<FeatureKey, boolean>>>((flags, row) => {
    flags[row.feature_key as FeatureKey] = row.is_enabled;
    return flags;
  }, {});
}

export async function setClinicFeatureFlag(
  clinicId: string,
  featureKey: FeatureKey,
  isEnabled: boolean,
  source = "manual"
) {
  const supabase = await createClient();

  const { error } = await supabase.from("feature_flags").upsert(
    {
      clinic_id: clinicId,
      feature_key: featureKey,
      is_enabled: isEnabled,
      source,
    },
    { onConflict: "clinic_id,feature_key" }
  );

  if (error) {
    console.error("setClinicFeatureFlag error", error);
  }
}
