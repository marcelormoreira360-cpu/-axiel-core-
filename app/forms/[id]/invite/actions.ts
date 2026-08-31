"use server";

import { headers } from "next/headers";
import {
  createAssessmentInvitation,
  createPublicCaptureInvitation,
} from "@/services/assessment-invitation-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isUnifiedTemplate } from "@/services/unified-form-link-service";

// O formulário unificado Neuro ID é renderizado numa rota RICA dedicada
// (freq×impacto, humor em faixas, ideação só encaminha, pirâmide oculta ao
// paciente). Os demais formulários usam o renderizador genérico em /f/[token].
async function linkPathForTemplate(templateId: string): Promise<"neuro-id" | "f"> {
  return (await isUnifiedTemplate(templateId)) ? "neuro-id" : "f";
}

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
  const path = await linkPathForTemplate(templateId);
  return { url: `${baseUrl}/${path}/${token}` };
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
  const path = await linkPathForTemplate(templateId);
  return { url: `${baseUrl}/${path}/${token}` };
}
