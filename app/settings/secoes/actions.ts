"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import {
  moveClinicPatientSection,
  setClinicPatientSectionVisibility,
} from "@/services/clinic-patient-sections-service";

export async function movePatientSectionAction(id: string, direction: "up" | "down") {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManager(profile.role)) throw new Error("Sem permissão.");
  await moveClinicPatientSection(profile.clinic_id, id, direction);
  revalidatePath("/settings/secoes");
}

export async function togglePatientSectionVisibilityAction(id: string, isVisible: boolean) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManager(profile.role)) throw new Error("Sem permissão.");
  await setClinicPatientSectionVisibility(id, isVisible);
  revalidatePath("/settings/secoes");
}
