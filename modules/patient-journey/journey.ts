/**
 * journey.ts — Modelo canônico da Jornada de Cuidado do Paciente (Fase 0).
 *
 * Fonte ÚNICA do vocabulário de jornada do Core, alinhada ao arco "Core" do
 * OXIEL Growth Cycle (Cuidar → Mostrar valor → Continuar). Consolida os
 * vocabulários que existiam soltos (o extinto `master-flow.ts` foi removido).
 *
 * Duas CAMADAS, de propósito:
 *   - As 7 ETAPAS canônicas = a narrativa macro (o que o profissional e o
 *     paciente veem: onde estamos no arco de cuidado).
 *   - Os 9 estados de `stage.ts` (ClinicalJourneyStage) = o derivador micro
 *     (sub-estado operacional calculado em runtime). Não são renomeados: aqui
 *     apenas os AGRUPAMOS nas 7 etapas.
 *
 * Duas NATUREZAS de etapa (sem esta distinção, um stepper mentiria sobre onde
 * o paciente está):
 *   - "permanence": o paciente permanece nela; derivada de `stage.ts`.
 *   - "event": marcada por um acontecimento/flag, não é um estado exclusivo.
 *       · understand = "Doc 1 (relatório) entregue?" (atravessa Assess→Care)
 *       · follow_up  = "follow-up pendente?" (derivado da agenda)
 *
 * Escopo da Fase 0: só o modelo + o mapeamento. Zero UI, zero query, zero
 * migração de dados — a etapa continua derivada em runtime por `stage.ts`.
 * Os rótulos i18n e o consumo (stepper, board) entram nas fases seguintes.
 */

import type { ClinicalJourneyStage } from "./stage";

/** As 7 etapas canônicas da jornada de cuidado (arco Core do Growth Cycle). */
export type CanonicalJourneyStage =
  | "prepare"
  | "assess"
  | "care"
  | "understand"
  | "follow_up"
  | "continue"
  | "return";

/** Ordem canônica das etapas (para stepper/board nas próximas fases). */
export const CANONICAL_JOURNEY_STAGES: readonly CanonicalJourneyStage[] = [
  "prepare",
  "assess",
  "care",
  "understand",
  "follow_up",
  "continue",
  "return",
] as const;

/**
 * Natureza da etapa:
 *   - "permanence": estado em que o paciente permanece (vem de `stage.ts`).
 *   - "event": marcada por um acontecimento/flag, não por estado exclusivo.
 */
export type JourneyStageKind = "permanence" | "event";

export const JOURNEY_STAGE_KIND: Record<CanonicalJourneyStage, JourneyStageKind> = {
  prepare: "permanence",
  assess: "permanence",
  care: "permanence",
  understand: "event",
  follow_up: "event",
  continue: "permanence",
  return: "permanence",
};

/**
 * Mapa dos 9 estados clínicos (`stage.ts`) → etapa canônica de PERMANÊNCIA.
 *
 * NÃO renomear os 9 ids: as chaves i18n (`journey.stage.<id>`) e os 4
 * consumidores de `stage.ts` dependem deles. Aqui só agrupamos.
 *
 * As etapas de EVENTO (`understand`, `follow_up`) não têm estado exclusivo e,
 * por isso, NUNCA são destino deste mapa — elas são derivadas de flags nas
 * próximas fases (Doc 1 entregue / follow-up pendente).
 */
export const CLINICAL_STAGE_TO_CANONICAL: Record<ClinicalJourneyStage, CanonicalJourneyStage> = {
  novo: "prepare",
  avaliacao_agendada: "prepare",
  avaliado: "assess",
  plano_sugerido: "care",
  em_tratamento: "care",
  reavaliacao: "continue",
  manutencao: "continue",
  inativo: "return",
  reativacao: "return",
};

/** Etapa canônica de permanência a partir do estado clínico derivado. */
export function toCanonicalStage(stage: ClinicalJourneyStage): CanonicalJourneyStage {
  return CLINICAL_STAGE_TO_CANONICAL[stage];
}
