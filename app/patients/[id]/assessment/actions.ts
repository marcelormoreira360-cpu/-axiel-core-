"use server";

import { revalidatePath } from "next/cache";
import { updatePatient } from "@/services/patient-service";

export type AssessmentState = { error?: string; ok?: boolean } | null;

// Seção "Avaliação" (espaços de escrita do terapeuta). Fonte única em patients;
// lida pelo Bio³ e pelos relatórios. Escopo de clínica garantido em updatePatient.
export async function saveAssessmentAction(
  patientId: string,
  _prev: AssessmentState,
  formData: FormData,
): Promise<AssessmentState> {
  try {
    const str = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      return v === "" ? null : v;
    };
    const painRaw = String(formData.get("pain_level") ?? "").trim();
    let pain_level: number | null = null;
    if (painRaw !== "") {
      const n = Number(painRaw);
      pain_level = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null;
    }

    await updatePatient(patientId, {
      anamnese: str("anamnese"),
      antecedents: str("antecedents"),
      pain_level,
      pain_location: str("pain_location"),
      treatment_note: str("treatment_note"),
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }
}
