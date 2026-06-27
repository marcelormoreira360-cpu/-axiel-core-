"use server";

import { revalidatePath } from "next/cache";
import { getPatientById, updatePatient } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getClinicAssessmentFields, LEGACY_ASSESSMENT_COLUMNS } from "@/services/clinic-assessment-service";
import { extractQuestionnaireFindings } from "@/services/neuro-id-service";
import { suggestAtmIntegration } from "@/services/ai-insight-service";

export type AssessmentState = { error?: string; ok?: boolean } | null;

// Colunas legadas mantidas em sincronia quando a clínica conserva os field_keys padrão
// (compatibilidade com leitores antigos: guardrails, regras de ação, etc.).
const LEGACY_COLUMNS = new Set<string>(LEGACY_ASSESSMENT_COLUMNS);

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

    // Merge sobre o que já existe: campos inativos/fora do formulário NÃO são apagados.
    const current = await getPatientById(patientId, clinic.id);
    const data: Record<string, string | number | null> = { ...(current?.assessment_data ?? {}) };
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

// Puxa os achados (itens >= corte) dos questionários para o terapeuta revisar e
// validar na Avaliação. Roteia: História Familiar → Antecedentes; o resto →
// Anamnese. NÃO grava: só devolve os textos. A gravação é o saveAssessmentAction.
export async function importQuestionnaireFindingsAction(
  patientId: string,
): Promise<{ anamnese: string; antecedents: string; hasData: boolean; error?: string }> {
  const empty = { anamnese: "", antecedents: "", hasData: false };
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { ...empty, error: "Não autorizado." };
  const patient = await getPatientById(patientId, clinic.id);
  if (!patient) return { ...empty, error: "Paciente não encontrado nesta clínica." };
  try {
    return await extractQuestionnaireFindings(patientId, clinic.id, 3);
  } catch {
    return { ...empty, error: "Não foi possível buscar os achados agora." };
  }
}

// Gera um RASCUNHO de "Integração clínica (ATM)" com IA (junta avaliação + exames +
// Mapa Bio³). NÃO grava nem entra no relatório: o terapeuta revisa e salva via
// saveAssessmentAction. Escopo de clínica garantido por getPatientById(clinic.id).
export async function suggestAtmIntegrationAction(
  patientId: string,
): Promise<{ suggestion?: string; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { error: "Não autorizado." };
  const patient = await getPatientById(patientId, clinic.id);
  if (!patient) return { error: "Paciente não encontrado nesta clínica." };
  return await suggestAtmIntegration(patientId);
}
