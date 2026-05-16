"use server";

import { redirect } from "next/navigation";
import { createPatientPortalLink, regeneratePatientPortalLink, revokePatientPortalLink } from "@/services/patient-portal-service";

export async function createPatientPortalLinkAction(patientId: string) {
  const { token } = await createPatientPortalLink(patientId);
  redirect(`/patients/${patientId}/portal-link?token=${encodeURIComponent(token)}`);
}

export async function regeneratePatientPortalLinkAction(patientId: string) {
  const { token } = await regeneratePatientPortalLink(patientId);
  redirect(`/patients/${patientId}/portal-link?token=${encodeURIComponent(token)}&regenerated=true`);
}

export async function revokePatientPortalLinkAction(patientId: string, linkId: string) {
  await revokePatientPortalLink(linkId);
  redirect(`/patients/${patientId}/portal-link`);
}
