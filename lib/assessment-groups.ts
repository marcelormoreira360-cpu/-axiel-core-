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

/** True se `g` é um grupo ATM válido. */
export function isAssessmentGroup(g: string | null | undefined): g is AssessmentGroup {
  return !!g && (ASSESSMENT_GROUP_ORDER as string[]).includes(g);
}

/**
 * Grupo efetivo de um campo: usa group_key (config da clínica) quando válido,
 * com fallback no mapa ATM por field_key (compat com dados antigos sem group_key).
 */
export function groupForField(field: { field_key: string; group_key?: string | null }): AssessmentGroup {
  return isAssessmentGroup(field.group_key) ? field.group_key : groupForFieldKey(field.field_key);
}
