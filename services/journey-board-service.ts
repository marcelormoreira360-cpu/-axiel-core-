/**
 * journey-board-service.ts — Command Center (Fase 1 · Intelligent Patient Journey).
 *
 * Agrega os pacientes da clínica por ETAPA canônica da jornada de cuidado,
 * derivando a etapa em runtime (a partir de sinais que a clínica já registra).
 * NÃO persiste etapa, NÃO cria tabela: espelha exatamente o cálculo já usado em
 * `app/patients/page.tsx` (batch + derivação em memória), mas agregando por etapa.
 *
 * Segurança (padrão-ouro de dashboard-alerts-service.ts / SEC-05):
 *   - clinicId resolvido no SERVIDOR via getCurrentClinic (nunca do cliente).
 *   - createSupabaseServerClient (RLS ativa), NUNCA admin client.
 *   - toda query com .eq("clinic_id", clinicId) (defesa em profundidade).
 *   - buscas em LOTE (sem N+1), trabalho O(N) em memória.
 *
 * Design técnico: OXIEL_CORE_COMMAND_CENTER_DESIGN.md (Forja).
 */

import { getCurrentClinic } from "@/services/clinic-service";
import { getPatientsLite } from "@/services/patient-service";
import { getAppointments } from "@/services/appointment-service";
import { getActivePlanPatientIds } from "@/services/treatment-plan-service";
import { computePatientEngagement } from "@/services/patient-intelligence-service";
import { derivePatientJourneyStage } from "@/modules/patient-journey/stage";
import {
  CANONICAL_JOURNEY_STAGES,
  toCanonicalStage,
  type CanonicalJourneyStage,
} from "@/modules/patient-journey/journey";

/** Teto de itens na lista "precisa de atenção" por etapa (drill-down mostra o resto). */
const ATTENTION_CAP = 20;
/** v1: escala IFWC (centenas). Acima disso, migrar para contagem via SQL/paginação. */
const PATIENT_CAP = 1000;
/** Janela de sessões: 120 dias (calibragem de churn, ver design §3). */
const APPT_WINDOW = { past: 120, future: 90 } as const;

/** Motivo pelo qual um paciente precisa de atenção (chave i18n). */
export type BoardAttentionReason =
  | "churn.high"
  | "churn.medium"
  | "followUp.pending"
  | "insight.missing"
  | "action.awaiting";

export type BoardAttentionItem = {
  patientId: string;
  patientName: string;
  reason: BoardAttentionReason;
};

export type JourneyStageBucket = {
  stage: CanonicalJourneyStage;
  /** Total de registros de paciente ativos nesta etapa (conta patient_id, não pessoa única). */
  count: number;
  /** Subconjunto que precisa de atenção (teto ATTENTION_CAP aplicado). */
  needsAttention: BoardAttentionItem[];
  /** Total real de "precisa de atenção" (para renderizar "+N" quando passa do teto). */
  needsAttentionTotal: number;
};

export type JourneyBoard = {
  /** Sempre as 7 etapas canônicas, na ordem, mesmo com count 0. */
  buckets: JourneyStageBucket[];
  /** Denominador: pacientes ativos varridos. */
  patientsConsidered: number;
  generatedAt: string;
};

function emptyBuckets(): JourneyStageBucket[] {
  return CANONICAL_JOURNEY_STAGES.map((stage) => ({
    stage,
    count: 0,
    needsAttention: [],
    needsAttentionTotal: 0,
  }));
}

/**
 * Decide o motivo de atenção (todos os sinais já em memória). As etapas de
 * EVENTO (understand/follow_up) sobrepõem como SINAL dentro do bucket de
 * permanência — não somem o paciente da coluna onde ele realmente está.
 */
function attentionReason(input: {
  clinicalStage: string;
  churnRisk: string;
  pendingFollowUp: boolean;
  hasFinalInsight: boolean;
}): BoardAttentionReason | null {
  if (input.churnRisk === "high") return "churn.high";
  if (input.pendingFollowUp) return "followUp.pending";
  if (input.churnRisk === "medium") return "churn.medium";
  // Avaliado sem insight/entendimento final = "Doc 1" pendente (proxy ai_insights).
  if (input.clinicalStage === "avaliado" && !input.hasFinalInsight) return "insight.missing";
  // Etapas esperando ação da clínica (revelar; a clínica decide/age).
  if (input.clinicalStage === "avaliado" || input.clinicalStage === "plano_sugerido") return "action.awaiting";
  return null;
}

/**
 * Monta o board da clínica por etapa da jornada. Read-only, RLS-safe, em lote.
 */
export async function getJourneyBoard(): Promise<JourneyBoard> {
  const generatedAt = new Date().toISOString();

  const clinic = await getCurrentClinic();
  if (!clinic) {
    return { buckets: emptyBuckets(), patientsConsidered: 0, generatedAt };
  }
  const clinicId = clinic.id;

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const [patients, appointments, activePlanArr, packagesRes, followUpsRes, insightsRes] =
    await Promise.all([
      getPatientsLite(clinicId, undefined, PATIENT_CAP),
      getAppointments(clinicId, undefined, APPT_WINDOW),
      getActivePlanPatientIds(clinicId),
      supabase.from("patient_packages").select("patient_id").eq("clinic_id", clinicId).eq("is_active", true),
      supabase.from("follow_ups").select("patient_id").eq("clinic_id", clinicId).eq("status", "pending"),
      supabase.from("ai_insights").select("patient_id").eq("clinic_id", clinicId).eq("review_status", "final"),
    ]);

  const activePlanIds = new Set(activePlanArr);
  const idsOf = (rows: unknown): Set<string> =>
    new Set(((rows as { patient_id: string }[]) ?? []).map((r) => r.patient_id));
  const packageIds = idsOf(packagesRes.data);
  const pendingFollowUpIds = idsOf(followUpsRes.data);
  const finalInsightIds = idsOf(insightsRes.data);

  // Agrupa appointments por paciente (1 passada) — sem N+1.
  const apptsByPatient = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const arr = apptsByPatient.get(a.patient_id) ?? [];
    arr.push(a);
    apptsByPatient.set(a.patient_id, arr);
  }

  const byStage = new Map<CanonicalJourneyStage, JourneyStageBucket>();
  for (const b of emptyBuckets()) byStage.set(b.stage, b);

  for (const p of patients) {
    const appts = apptsByPatient.get(p.id) ?? [];
    const churnRisk = computePatientEngagement(appts, p).churnRisk;
    const clinical = derivePatientJourneyStage({
      patientStatus: p.status,
      appointments: appts,
      treatmentPlans: activePlanIds.has(p.id) ? [{ status: "active" }] : [],
      churnRisk,
      hasActivePackageOrSub: packageIds.has(p.id),
    });
    const bucket = byStage.get(toCanonicalStage(clinical.stage));
    if (!bucket) continue;
    bucket.count += 1;

    const reason = attentionReason({
      clinicalStage: clinical.stage,
      churnRisk,
      pendingFollowUp: pendingFollowUpIds.has(p.id),
      hasFinalInsight: finalInsightIds.has(p.id),
    });
    if (reason) {
      bucket.needsAttentionTotal += 1;
      if (bucket.needsAttention.length < ATTENTION_CAP) {
        bucket.needsAttention.push({
          patientId: p.id,
          patientName: p.full_name ?? "Paciente",
          reason,
        });
      }
    }
  }

  return {
    buckets: CANONICAL_JOURNEY_STAGES.map((s) => byStage.get(s)!),
    patientsConsidered: patients.length,
    generatedAt,
  };
}
