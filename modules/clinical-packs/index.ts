// Clinical Packs — barrel do módulo. Ponto de entrada único para o motor de IA horizontal.
export type { ClinicalPack, PackPromptBuilder } from "@/modules/clinical-packs/types";
export { getPack, listPackIds, DEFAULT_CLINICAL_PACK_ID } from "@/modules/clinical-packs/registry";
export { resolveClinicalPackId, resolveClinicalPack } from "@/modules/clinical-packs/resolve";
export { bio3NeuroIdPack } from "@/modules/clinical-packs/packs/bio3-neuroid";
export { genericPack } from "@/modules/clinical-packs/packs/generic";
