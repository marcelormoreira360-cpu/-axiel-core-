"use server";

import { headers } from "next/headers";
import {
  createAssessmentInvitation,
  createPublicCaptureInvitation,
} from "@/services/assessment-invitation-service";
import { getCurrentUserProfile } from "@/services/user-service";

async function resolveBaseUrl(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return appUrl.replace(/\/$/, "");
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return `${protocol}://${host}`;
}

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

  const baseUrl = await resolveBaseUrl();
  return { url: `${baseUrl}/f/${token}` };
}

/**
 * Gera um link PÚBLICO de captação: reutilizável, sem paciente. Quem abrir
 * preenche os próprios dados (vira Lead) e responde o questionário.
 */
export async function createPublicCaptureLinkAction(
  templateId: string
): Promise<{ url: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const { token } = await createPublicCaptureInvitation({
    template_id: templateId,
    clinic_id: profile.clinic_id,
  });

  const baseUrl = await resolveBaseUrl();
  return { url: `${baseUrl}/f/${token}` };
}
