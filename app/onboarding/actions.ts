"use server";

import { redirect } from "next/navigation";
import { completeGuidedOnboarding, normalizeClinicSlug } from "@/services/onboarding-service";

export type OnboardingActionState = { error: string } | null;

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
  } catch (err) {
    console.error("[onboarding] completeGuidedOnboarding error:", err);
    return {
      error:
        "Não foi possível concluir a configuração. Tente novamente ou entre em contato com o suporte.",
    };
  }

  redirect("/onboarding/ready");
}
