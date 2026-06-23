"use server";

import { revalidatePath } from "next/cache";
import { updatePatient } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getClinicAssessmentFields } from "@/services/clinic-assessment-service";

export type AssessmentState = { error?: string; ok?: boolean } | null;

// Colunas legadas mantidas em sincronia quando a clínica conserva os field_keys padrão
// (compatibilidade com leitores antigos: guardrails, regras de ação, etc.).
const LEGACY_COLUMNS = new Set(["anamnese", "antecedents", "pain_level", "pain_location", "treatment_note"]);

// Seção "Avaliação" (espaços de escrita do terapeuta). Fonte viva = patients.assessment_data,
// estruturada pelos clinic_assessment_fields da clínica. Escopo de clínica garantido em updatePatient.
export async function saveAssessmentAction(
  patientId: string,
  _prev: AssessmentState,
  formData: FormData,
): Promise<AssessmentState> {
  try {
    const clinic = await getCurrentClinic();
    if (!clinic?.id) return { error: "Não autorizado." };

    const fields = await getClinicAssessmentFields(clinic.id, { activeOnly: true });

    const data: Record<string, string | number | null> = {};
    const legacy: Record<string, string | number | null> = {};

    for (const f of fields) {
      const raw = String(formData.get(f.field_key) ?? "").trim();
      let value: string | number | null = raw === "" ? null : raw;

      if (f.field_type === "number" && value !== null) {
        const n = Number(value);
        if (Number.isFinite(n)) {
          const min = f.options?.min ?? Number.NEGATIVE_INFINITY;
          const max = f.options?.max ?? Number.POSITIVE_INFINITY;
          value = Math.max(min, Math.min(max, n));
        } else {
          value = null;
        }
      }

      data[f.field_key] = value;
      if (LEGACY_COLUMNS.has(f.field_key)) legacy[f.field_key] = value;
    }

    await updatePatient(patientId, { assessment_data: data, ...legacy });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }
}
