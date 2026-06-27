"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import {
  reorderClinicPatientSections,
  setClinicPatientSectionVisibility,
} from "@/services/clinic-patient-sections-service";

export async function reorderPatientSectionsAction(orderedIds: string[]) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManager(profile.role)) throw new Error("Sem permissão.");
  await reorderClinicPatientSections(profile.clinic_id, orderedIds);
  revalidatePath("/settings/secoes");
}

export async function togglePatientSectionVisibilityAction(id: string, isVisible: boolean) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManager(profile.role)) throw new Error("Sem permissão.");
  await setClinicPatientSectionVisibility(id, isVisible);
  revalidatePath("/settings/secoes");
}
