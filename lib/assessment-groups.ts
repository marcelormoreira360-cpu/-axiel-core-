/**
 * assessment-groups.ts — espinha ATM da Avaliação (puro, client + server).
 *
 * Antecedentes → Gatilhos → Mediadores (método funcional). O agrupamento é por
 * CÓDIGO do campo (não precisa de coluna no banco). Campos custom da clínica caem
 * em "mediadores" por padrão. Usado para organizar o painel da Avaliação.
 */

export type AssessmentGroup = "objetivo" | "antecedentes" | "gatilhos" | "mediadores" | "integracao";

export const ASSESSMENT_GROUP_ORDER: AssessmentGroup[] = [
  "objetivo", "antecedentes", "gatilhos", "mediadores", "integracao",
];

const ATM_GROUP_BY_KEY: Record<string, AssessmentGroup> = {
  objetivo: "objetivo",
  antecedents: "antecedentes",
  linha_do_tempo: "gatilhos",
  anamnese: "mediadores",
  pain_level: "mediadores",
  pain_location: "mediadores",
  integracao_atm: "integracao",
  treatment_note: "integracao",
};

export function groupForFieldKey(fieldKey: string): AssessmentGroup {
  return ATM_GROUP_BY_KEY[fieldKey] ?? "mediadores";
}
