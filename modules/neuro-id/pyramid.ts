import type { NeuroPillar } from "@/modules/neuro-id/catalog";
import { sharesSummingTo100, priorityPillars } from "@/modules/neuro-id/bands";

// Dado de UM andar da pirâmide Bio³: severidade (cor) + peso do eixo (número) + se é prioritário.
export type PyramidDatum = { dys: number | null; share: number | null; isPriority: boolean };

// Só as colunas de % que a pirâmide usa (compatível com NeuroIdMapView).
type PyramidMap = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
} | null;

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];

/**
 * Deriva os 3 andares da pirâmide (topo→base: Biomecânico/Bioquímico/Bioemocional)
 * a partir do mapa Bio³. Extraído de patient-neuro-id-panel para reuso na mesa de
 * revisão do insight (mesma fonte de verdade, mesma matemática de peso/prioridade).
 */
export function pyramidDataFromMap(map: PyramidMap): PyramidDatum[] {
  const pillarDys: Record<NeuroPillar, number | null> = {
    fisico: map?.fisico_pct ?? null,
    bioquimico: map?.bioquimico_pct ?? null,
    emocional: map?.emocional_pct ?? null,
  };
  const [shareFisico, shareBioq, shareEmo] = sharesSummingTo100(PILLARS.map((p) => pillarDys[p]));
  const shareByPillar: Record<NeuroPillar, number | null> = {
    fisico: shareFisico, bioquimico: shareBioq, emocional: shareEmo,
  };
  const prioritySet = new Set<NeuroPillar>(priorityPillars(pillarDys));
  return PILLARS.map((p) => ({ dys: pillarDys[p], share: shareByPillar[p], isPriority: prioritySet.has(p) }));
}
