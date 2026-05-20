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

  try {
    await completeGuidedOnboarding({
      clinicName,
      clinicSlug:  normalizeClinicSlug("", clinicName),
      timezone:    "America/Sao_Paulo",
      hoursPreset,
      clinicProfile,
      staffEmail,
    });

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
