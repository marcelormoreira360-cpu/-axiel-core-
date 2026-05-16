"use server";

import { redirect } from "next/navigation";
import { completeGuidedOnboarding, normalizeClinicSlug } from "@/services/onboarding-service";

export async function completeOnboardingAction(formData: FormData) {
  const clinicName = String(formData.get("clinic_name") ?? "").trim() || "Minha Clínica";
  const clinicProfile = String(formData.get("clinic_profile") ?? "integrativa");
  const hoursPreset = String(formData.get("hours_preset") ?? "weekdays");
  const staffEmail = String(formData.get("staff_email") ?? "").trim();

  await completeGuidedOnboarding({
    clinicName,
    clinicSlug: normalizeClinicSlug("", clinicName),
    timezone: "America/Sao_Paulo",
    hoursPreset,
    clinicProfile,
    staffEmail,
  });

  redirect("/onboarding/ready");
}
