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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  let baseUrl: string;
  if (appUrl) {
    baseUrl = appUrl.replace(/\/$/, "");
  } else {
    const headerStore = await headers();
    const protocol = headerStore.get("x-forwarded-proto") ?? "http";
    const host = headerStore.get("host") ?? "localhost:3000";
    baseUrl = `${protocol}://${host}`;
  }
  const url = `${baseUrl}/f/${token}`;

  return { url };
}
