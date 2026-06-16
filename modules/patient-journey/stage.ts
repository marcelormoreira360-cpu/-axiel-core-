/**
 * stage.ts — Jornada do Paciente · Etapa 1 (derivação da etapa clínica).
 *
 * Função PURA: deriva a etapa clínica atual do paciente e a próxima melhor
 * ação a partir de dados que a ficha JÁ carrega (appointments, treatment
 * plans, churn risk, status). Zero query extra, zero tabela nova — a etapa é
 * sempre LIDA do que o terapeuta já registra no fluxo normal, nunca digitada.
 *
 * Reaproveita sinais existentes:
 *   - appointments (status/starts_at)            → sessões e avaliação
 *   - TreatmentPlan.status                        → plano de cuidado
 *   - PatientEngagement.churnRisk                 → risco/inatividade
 *   - patient.status + pacote/assinatura ativos   → tratamento em curso
 */

import type { Appointment } from "@/lib/types";
import type { ChurnRisk } from "@/services/patient-intelligence-service";
import type { TreatmentPlan } from "@/services/treatment-plan-service";

export type ClinicalJourneyStage =
  | "novo"
  | "avaliacao_agendada"
  | "avaliado"
  | "plano_sugerido"
  | "em_tratamento"
  | "reavaliacao"
  | "manutencao"
  | "inativo"
  | "reativacao";

export type JourneyStageTone = "neutral" | "active" | "attention" | "risk";

export interface PatientJourneyStage {
  /** Etapa clínica derivada. Também é o sufixo da chave i18n. */
  stage: ClinicalJourneyStage;
  /** Cor/ênfase do chip na UI (resolvida no componente). */
  tone: JourneyStageTone;
}

const TONE: Record<ClinicalJourneyStage, JourneyStageTone> = {
  novo:               "neutral",
  avaliacao_agendada: "neutral",
  avaliado:           "attention",
  plano_sugerido:     "attention",
  em_tratamento:      "active",
  reavaliacao:        "attention",
  manutencao:         "active",
  inativo:            "risk",
  reativacao:         "risk",
};

/**
 * Deriva a etapa da jornada. Prioridade (de cima para baixo):
 *   1. Inativo/alto risco → reativação (se já teve sessão) ou inativo.
 *   2. Sem sessão concluída → avaliação agendada (se há futura) ou novo.
 *   3. Com sessão, sem plano → avaliado (apresentar plano).
 *   4. Plano ativo (ou pacote/assinatura ativos) → em tratamento;
 *      reavaliação quando o risco é médio (hora de reforçar/revisar).
 *   5. Plano concluído → manutenção.
 *   6. Plano só pausado → plano sugerido (retomar/aceitar).
 */
export function derivePatientJourneyStage(input: {
  patientStatus: string;
  appointments: Pick<Appointment, "status" | "starts_at">[];
  treatmentPlans: Pick<TreatmentPlan, "status">[];
  churnRisk: ChurnRisk;
  hasActivePackageOrSub?: boolean;
}): PatientJourneyStage {
  const { patientStatus, appointments, treatmentPlans, churnRisk } = input;
  const nowIso = new Date().toISOString();

  const completedSessions = appointments.filter((a) => a.status === "completed").length;
  const hasFutureAppt = appointments.some(
    (a) => a.starts_at >= nowIso && a.status !== "cancelled" && a.status !== "no_show",
  );
  const activePlan = treatmentPlans.some((p) => p.status === "active");
  const completedPlan = treatmentPlans.some((p) => p.status === "completed");
  const anyPlan = treatmentPlans.length > 0;
  const isActivePatient = patientStatus === "active";

  let stage: ClinicalJourneyStage;

  if (!isActivePatient || churnRisk === "high") {
    stage = completedSessions > 0 ? "reativacao" : "inativo";
  } else if (completedSessions === 0) {
    stage = hasFutureAppt ? "avaliacao_agendada" : "novo";
  } else if (!anyPlan) {
    stage = "avaliado";
  } else if (activePlan || input.hasActivePackageOrSub) {
    stage = churnRisk === "medium" ? "reavaliacao" : "em_tratamento";
  } else if (completedPlan) {
    stage = "manutencao";
  } else {
    stage = "plano_sugerido";
  }

  return { stage, tone: TONE[stage] };
}
