"use server";

import { completeGuidedOnboarding, normalizeClinicSlug } from "@/services/onboarding-service";

export type OnboardingActionState =
  | { success: true }
  | { error: string }
  | null;

export async function completeOnboardingAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const clinicName    = String(formData.get("clinic_name")    ?? "").trim() || "Minha Clínica";
  const clinicProfile = String(formData.get("clinic_profile") ?? "integrativa");
  const hoursPreset   = String(formData.get("hours_preset")   ?? "weekdays");
  const staffEmail    = String(formData.get("staff_email")    ?? "").trim();
  const timezone      = String(formData.get("timezone")       ?? "").trim() || "America/Sao_Paulo";
  const logoDataUrl   = String(formData.get("logo_data_url")  ?? "").trim();

  try {
    const result = await completeGuidedOnboarding({
      clinicName,
      clinicSlug:  normalizeClinicSlug("", clinicName),
      timezone,
      hoursPreset,
      clinicProfile,
      staffEmail,
    });

    // Upload logo if provided
    if (logoDataUrl && result?.clinicId) {
      try {
        const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
        const supabase = createSupabaseAdminClient();
        const base64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const ext = logoDataUrl.startsWith("data:image/png") ? "png" : "jpg";
        const path = `${result.clinicId}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("clinic-logos")
          .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("clinic-logos").getPublicUrl(path);
          await supabase.from("clinics").update({ logo_url: publicUrl }).eq("id", result.clinicId);
        }
      } catch { /* logo upload failure is non-fatal */ }
    }

    return { success: true };
  } catch (err) {
    // Supabase throws PostgrestError (not a standard Error), extract message safely
    let msg = "Erro desconhecido";
    if (err instanceof Error) {
      msg = err.message;
    } else if (err && typeof err === "object" && "message" in err) {
      msg = String((err as { message: unknown }).message);
    } else if (typeof err === "string") {
      msg = err;
    }
    console.error("[onboarding] completeGuidedOnboarding error:", err);
    return {
      error: `Não foi possível criar a clínica: ${msg}`,
    };
  }
}
