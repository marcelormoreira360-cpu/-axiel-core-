"use server";

import { revalidatePath } from "next/cache";
import { updatePatient } from "@/services/patient-service";

export type DemographicsState = { error?: string; ok?: boolean } | null;

// Fonte única da demografia: grava no cadastro do paciente (patients).
// Lido depois por Bio³, AI Insight, PDF e qualquer relatório (ageFromDob deriva a idade).
// Escopo de clínica é garantido dentro de updatePatient.
export async function saveDemographicsAction(
  patientId: string,
  _prev: DemographicsState,
  formData: FormData,
): Promise<DemographicsState> {
  try {
    const str = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      return v === "" ? null : v;
    };
    const num = (k: string) => {
      const v = String(formData.get(k) ?? "").trim().replace(",", ".");
      if (v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const full_name = str("full_name");
    if (!full_name) return { error: "O nome é obrigatório." };

    await updatePatient(patientId, {
      full_name,
      date_of_birth: str("date_of_birth"),
      sex: str("sex"),
      weight_kg: num("weight_kg"),
      height_cm: num("height_cm"),
      city: str("city"),
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }
}
