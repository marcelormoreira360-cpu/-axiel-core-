import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getPatientById } from "@/services/patient-service";
import { ageFromDob } from "@/lib/patient-demographics";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getPatientAssessmentResponses } from "@/services/assessment-service";
import { getPatientExams, getPatientPrescriptions } from "@/services/exams-service";
import { getPatientFunctionalExams } from "@/services/functional-exams-service";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { getClinicAssessmentFields, assessmentReportPairs, LEGACY_ASSESSMENT_COLUMNS } from "@/services/clinic-assessment-service";
import { EXAM_METRIC_META } from "@/modules/neuro-id/exam-metrics";
import { normalizeInsightText } from "@/modules/ai-insights/guardrails";

export type AiInsightInputSnapshot = {
  patient: {
    id: string;
    clinic_id: string;
    full_name: string;
    /** Idioma preferido do paciente (patients.locale); null = herda o da clínica. */
    locale: string | null;
    status: string;
    notes: string | null;
    age: number | null;
    sex: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    city: string | null;
    /** País do paciente (patients.country). Determina a linha de crise por país (Doc 1/Doc 2). */
    country: string | null;
    anamnese: string | null;
    antecedents: string | null;
    pain_level: number | null;
    pain_location: string | null;
    treatment_note: string | null;
    /** Campos personalizados da Avaliação da clínica (label/valor) marcados para o relatório. */
    assessment_extra: Array<{ label: string; value: string }>;
  };
  intake: Array<{
    question: string;
    answer: string | null;
  }>;
  session_notes: Array<{
    date: string | null;
    notes: string | null;
    key_observations: string[];
  }>;
  patient_history: Array<{
    date: string;
    duration_minutes: number;
    notes: string | null;
  }>;
  assessments: Array<{
    name: string;
    total_score: number | null;
    max_possible_score: number | null;
    score_percentage: number | null;
    date: string | null;
  }>;
  lab_exams: Array<{
    date: string;
    lab_name: string | null;
    results: Array<{ biomarker: string; value: number; unit: string | null; status: string }>;
  }>;
  functional_exams: Array<{
    type: string;
    title: string | null;
    date: string;
    summary: string | null;
    /** Valores brutos por métrica, SÓ revisados pelo gate humano (metrics_reviewed_at != null). */
    metrics: Array<{ code: string; label: string; unit: string; value: number }>;
  }>;
  /** Síntese da biorressonância com ORIGEM própria (não se mistura no bloco genérico). */
  bioemocional_source: { summary: string } | null;
  prescriptions: Array<{
    type: string;
    name: string;
    dosage: string | null;
    active: boolean;
  }>;
  neuro_id: {
    indice_geral: number | null;
    fisico_pct: number | null;
    bioquimico_pct: number | null;
    emocional_pct: number | null;
    priority_pillar: string | null;
    is_partial: boolean;
  } | null;
};

export async function buildAiInsightInput(patientId: string): Promise<AiInsightInputSnapshot | null> {
  const patient = await getPatientById(patientId);
  if (!patient) return null;

  // Cada fonte é resiliente: se uma falhar (ex.: drift de schema), usa vazio
  // em vez de derrubar toda a geração do relatório.
  const safe = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
  const [intakeResponses, appointments, sessionRecords, assessments, labExams, functionalExams, prescriptions] = await Promise.all([
    safe(getPatientIntakeResponses(patientId)),
    safe(getAppointmentsByPatient(patientId)),
    safe(getSessionRecordsByPatient(patientId)),
    safe(getPatientAssessmentResponses(patientId)),
    safe(getPatientExams(patientId)),
    safe(getPatientFunctionalExams(patientId)),
    safe(getPatientPrescriptions(patientId)),
  ]);
  const neuroIdMap = await getLatestNeuroIdMap(patientId).catch(() => null);
  const clinicFields = await getClinicAssessmentFields(patient.clinic_id, { activeOnly: true }).catch(() => []);

  // Biorressonância com origem própria: a síntese mais recente do exame do tipo
  // "biorressonancia" (o slot bioemocional do Doc 1 nunca some no bloco genérico).
  const bioExam = functionalExams.find((f) => f.exam_type === "biorressonancia" && (f.summary ?? "").trim());
  const bioemocional_source = bioExam ? { summary: normalizeInsightText(bioExam.summary) } : null;

  // Avaliação: fonte viva = assessment_data (com fallback às colunas legadas).
  // Só entram no relatório os campos que a clínica mantém ATIVOS e marcados
  // "incluir no relatório" — campo deletado/desativado/excluído não injeta dado legado obsoleto.
  const ad = patient.assessment_data ?? {};
  const reportable = new Set(clinicFields.filter((f) => f.include_in_report).map((f) => f.field_key));
  const adText = (key: string, legacy: string | null) =>
    reportable.has(key) ? normalizeInsightText((ad[key] ?? legacy ?? null) as string | null) : null;
  const adNum = (key: string, legacy: number | null): number | null => {
    if (!reportable.has(key)) return null;
    const v = ad[key] ?? legacy;
    return typeof v === "number" ? v : v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  // Campos personalizados (não-legados) marcados para o relatório.
  const LEGACY = new Set<string>(LEGACY_ASSESSMENT_COLUMNS);
  const assessment_extra = assessmentReportPairs(patient, clinicFields)
    .filter((p) => !LEGACY.has(p.key))
    .map((p) => ({ label: p.label, value: p.value }));

  return {
    patient: {
      id: patient.id,
      clinic_id: patient.clinic_id,
      full_name: patient.full_name,
      locale: patient.locale ?? null,
      status: patient.status,
      notes: normalizeInsightText(patient.notes),
      age: ageFromDob(patient.date_of_birth),
      sex: patient.sex,
      weight_kg: patient.weight_kg,
      height_cm: patient.height_cm,
      city: patient.city,
      country: patient.country,
      // Seção "Avaliação" — escrita do terapeuta entra no relatório.
      anamnese: adText("anamnese", patient.anamnese),
      antecedents: adText("antecedents", patient.antecedents),
      pain_level: adNum("pain_level", patient.pain_level),
      pain_location: adText("pain_location", patient.pain_location),
      treatment_note: adText("treatment_note", patient.treatment_note),
      assessment_extra,
    },
    intake: intakeResponses.map((response) => ({
      question: normalizeInsightText(response.intake_questions?.label ?? "Question"),
      answer: normalizeInsightText(response.answer),
    })),
    session_notes: sessionRecords.map((record) => ({
      date: record.appointments?.starts_at ?? null,
      notes: normalizeInsightText(record.notes),
      key_observations: (record.key_observations ?? []).map(normalizeInsightText).filter(Boolean),
    })),
    patient_history: appointments.map((appointment) => ({
      date: appointment.starts_at,
      duration_minutes: appointment.duration_minutes,
      notes: normalizeInsightText(appointment.notes),
    })),
    assessments: assessments.map((a) => ({
      name: (a as { assessment_templates?: { name?: string } }).assessment_templates?.name ?? "Questionário",
      total_score: a.total_score ?? null,
      max_possible_score: a.max_possible_score ?? null,
      score_percentage: a.score_percentage ?? null,
      date: a.created_at ?? null,
    })),
    lab_exams: labExams.map((e) => ({
      date: e.exam_date,
      lab_name: e.lab_name,
      results: (e.exam_results ?? []).map((r) => ({
        biomarker: r.biomarker,
        value: r.value,
        unit: r.unit,
        status: r.status,
      })),
    })),
    functional_exams: functionalExams.map((f) => ({
      type: f.exam_type,
      title: f.title,
      date: f.exam_date,
      summary: normalizeInsightText(f.summary),
      // Só entram valores revisados pelo gate humano (bruto não confirmado nunca vai ao Doc 1),
      // SÓ do instrumento neurometria (a biorressonância é qualitativa: vai pelo slot
      // bioemocional_source, sem número nem a palavra "biorressonância" ao paciente),
      // e SÓ valores numéricos finitos (jsonb pode trazer null/NaN).
      metrics: f.metrics_reviewed_at && f.metrics_values
        ? Object.entries(f.metrics_values)
            .filter(([code, value]) => EXAM_METRIC_META[code]?.instrument === "neurometria" && Number.isFinite(value))
            .map(([code, value]) => ({
              code,
              label: EXAM_METRIC_META[code].label,
              unit: EXAM_METRIC_META[code].unit,
              value,
            }))
        : [],
    })),
    prescriptions: prescriptions.map((p) => ({
      type: p.type,
      name: p.name,
      dosage: p.dosage,
      active: p.is_active,
    })),
    neuro_id: neuroIdMap
      ? {
          indice_geral: neuroIdMap.indice_geral,
          fisico_pct: neuroIdMap.fisico_pct,
          bioquimico_pct: neuroIdMap.bioquimico_pct,
          emocional_pct: neuroIdMap.emocional_pct,
          priority_pillar: neuroIdMap.priority_pillar,
          is_partial: neuroIdMap.is_partial,
        }
      : null,
    bioemocional_source,
  };
}
