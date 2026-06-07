"use server";

import { revalidatePath } from "next/cache";
import { updatePatient } from "@/services/patient-service";

export type CaseSummaryState = { error?: string; ok?: boolean } | null;

// Salva queixa principal + resumo do caso (Feature 2). Escopo de clínica é
// garantido dentro de updatePatient (resolve a clínica do usuário autenticado).
export async function saveCaseSummaryAction(
  patientId: string,
  _prev: CaseSummaryState,
  formData: FormData,
): Promise<CaseSummaryState> {
  try {
    const chief = String(formData.get("chief_complaint") ?? "").trim();
    const summary = String(formData.get("case_summary") ?? "").trim();
    await updatePatient(patientId, {
      chief_complaint: chief || null,
      case_summary: summary || null,
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }
}
