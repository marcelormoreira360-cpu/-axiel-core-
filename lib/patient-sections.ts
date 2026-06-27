/**
 * patient-sections.ts — registro canônico das SEÇÕES da ficha do paciente (puro).
 *
 * Cada clínica define ordem e visibilidade (clinic_patient_sections, migration 106).
 * A ordem padrão aqui espelha o seed da migration e a ordem original do JSX.
 * Rótulos via i18n (patientSections.<key>). Seções condicionais (financeiro,
 * indicacao, relatorios, proximo_passo) só renderizam quando há dado.
 */

export type PatientSectionKey =
  | "avaliacao"
  | "resumo"
  | "acompanhamento"
  | "indicacao"
  | "mapa_bio3"
  | "resumo_rapido"
  | "relatorios"
  | "proximo_passo"
  | "jornada"
  | "nota_voz"
  | "plano_suplementos"
  | "pacotes"
  | "cobranca"
  | "financeiro"
  | "exames"
  | "medicamentos"
  | "documentos";

/** Ordem padrão (= seed da migration 106 e ordem original do JSX). */
export const PATIENT_SECTION_ORDER: PatientSectionKey[] = [
  "avaliacao",
  "resumo",
  "acompanhamento",
  "indicacao",
  "mapa_bio3",
  "resumo_rapido",
  "relatorios",
  "proximo_passo",
  "jornada",
  "nota_voz",
  "plano_suplementos",
  "pacotes",
  "cobranca",
  "financeiro",
  "exames",
  "medicamentos",
  "documentos",
];

export function isPatientSectionKey(k: string): k is PatientSectionKey {
  return (PATIENT_SECTION_ORDER as string[]).includes(k);
}
