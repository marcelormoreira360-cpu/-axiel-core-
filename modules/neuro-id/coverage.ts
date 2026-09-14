/**
 * coverage.ts — COBERTURA por pilar do Mapa Bio³ (puro, sem I/O).
 *
 * Responde: "este pilar tem dados suficientes pra ser exibido como leitura real,
 * ou é parcial / sem dados?". Existe para NUNCA mostrar "100% Solto" quando o
 * pilar está vazio ou depende de etapa que ainda não aconteceu.
 *
 * Regras (decididas com Marcelo + 2 revisões externas, 14/09/2026):
 *  - Biomecânico (físico) tem DUAS camadas: autorrelato do paciente (bm_*) e o
 *    EXAME PRESENCIAL do terapeuta (dor, restr_*, qrm_musculo_articular). Enquanto
 *    o exame não é lançado, o pilar é "aguardando avaliação profissional", nunca
 *    100%.
 *  - Biofuncional e Bioemocional são completáveis pelo próprio paciente: com
 *    qualquer sinal, exibem a leitura; vazios, "sem dados".
 *
 * `answeredCodes` = item_codes com valor real gravado na avaliação (o
 * getAssessmentRawValues já exclui exames fundidos `exam:`).
 */

import { DEFAULT_CATALOG, type NeuroPillar } from "./catalog";

export type PillarCoverageState = "sem_dados" | "aguardando_exame" | "parcial" | "completo";
export type Coverage = Record<NeuroPillar, PillarCoverageState>;

// Itens de EXAME PRESENCIAL do Biomecânico: físico, não-autorrelato (não `bm_`),
// não derivado de questionário (`auto`) e não laboratorial (`lab`). São os testes
// manuais/mobilidade que só o terapeuta gradua.
const FISICO_PRO_EXAM = DEFAULT_CATALOG
  .filter((i) => i.pillar === "fisico" && !i.code.startsWith("bm_") && !i.auto && i.input_type !== "lab")
  .map((i) => i.code);

// Todos os itens "respondíveis" (exclui labs, que entram por fusão e são sempre
// parciais) por pilar.
function answerableCodes(pillar: NeuroPillar): string[] {
  return DEFAULT_CATALOG.filter((i) => i.pillar === pillar && i.input_type !== "lab").map((i) => i.code);
}

export function pillarCoverageState(pillar: NeuroPillar, answeredCodes: Set<string>): PillarCoverageState {
  if (pillar === "fisico") {
    const anyFisico = answerableCodes("fisico").some((c) => answeredCodes.has(c));
    if (!anyFisico) return "sem_dados";
    const answeredPro = FISICO_PRO_EXAM.filter((c) => answeredCodes.has(c)).length;
    if (answeredPro === 0) return "aguardando_exame";        // só autorrelato; exame pendente
    if (answeredPro < FISICO_PRO_EXAM.length) return "parcial"; // exame começado, incompleto
    return "completo";
  }
  return answerableCodes(pillar).some((c) => answeredCodes.has(c)) ? "completo" : "sem_dados";
}

export function coverageFromAnswers(answeredCodes: Set<string>): Coverage {
  return {
    fisico: pillarCoverageState("fisico", answeredCodes),
    bioquimico: pillarCoverageState("bioquimico", answeredCodes),
    emocional: pillarCoverageState("emocional", answeredCodes),
  };
}

/** true quando o estado não é uma leitura confiável (não deve exibir banda "Solto"). */
export function isPartialCoverage(state: PillarCoverageState): boolean {
  return state !== "completo";
}
