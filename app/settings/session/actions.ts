"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic, saveClinicSessionConfig } from "@/services/clinic-service";
import { coerceSessionConfig, type SessionConfig } from "@/modules/session/session-config";

/** Salva a config de registro de sessão (vitais + escala) da clínica atual. */
export async function saveSessionConfigAction(config: SessionConfig): Promise<{ ok: boolean }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { ok: false };
  await saveClinicSessionConfig(clinic.id, coerceSessionConfig(config));
  revalidatePath("/settings/session");
  revalidatePath("/schedule", "layout");
  return { ok: true };
}
