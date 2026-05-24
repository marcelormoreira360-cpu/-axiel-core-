"use server";

import { redirect } from "next/navigation";
import { createPatientPortalLink, regeneratePatientPortalLink, revokePatientPortalLink } from "@/services/patient-portal-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";

async function assertPortalFeature(patientId: string) {
  const clinic = await getCurrentClinic();
  if (!clinic) return;
  const billingCtx = await getBillingContext(clinic.id);
  if (!canUseFeature(billingCtx, "patient_portal")) {
    redirect(
      `/patients/${patientId}/portal-link?error=${encodeURIComponent(
        "Portal do paciente disponível no plano Professional ou superior."
      )}`
    );
  }
}

export async function createPatientPortalLinkAction(patientId: string) {
  await assertPortalFeature(patientId);
  const { token } = await createPatientPortalLink(patientId);
  redirect(`/patients/${patientId}/portal-link?token=${encodeURIComponent(token)}`);
}

export async function regeneratePatientPortalLinkAction(patientId: string) {
  await assertPortalFeature(patientId);
  const { token } = await regeneratePatientPortalLink(patientId);
  redirect(`/patients/${patientId}/portal-link?token=${encodeURIComponent(token)}&regenerated=true`);
}

export async function revokePatientPortalLinkAction(patientId: string, linkId: string) {
  await revokePatientPortalLink(linkId);
  redirect(`/patients/${patientId}/portal-link`);
}
