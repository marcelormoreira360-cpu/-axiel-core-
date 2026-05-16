"use server";

import { headers } from "next/headers";
import { createAssessmentInvitation } from "@/services/assessment-invitation-service";
import { getCurrentUserProfile } from "@/services/user-service";

export async function createInvitationAction(
  templateId: string,
  patientId: string
): Promise<{ url: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const { token } = await createAssessmentInvitation({
    template_id: templateId,
    patient_id: patientId,
    clinic_id: profile.clinic_id,
  });

  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3001";
  const url = `${protocol}://${host}/f/${token}`;

  return { url };
}
