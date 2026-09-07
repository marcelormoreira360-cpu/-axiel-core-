import type { ClinicalPack } from "@/modules/clinical-packs/types";
import { bio3NeuroIdPack } from "@/modules/clinical-packs/packs/bio3-neuroid";
import { genericPack } from "@/modules/clinical-packs/packs/generic";

/**
 * Registro central de Clinical Packs (definição em CÓDIGO, versionada e testável).
 * O binding "qual clínica usa qual pack" fica em DADOS por tenant (clinics.clinical_pack_id,
 * Passo 3) — aqui só mora o mapa id → objeto do pack.
 */
const PACKS: Record<string, ClinicalPack> = {
  [bio3NeuroIdPack.id]: bio3NeuroIdPack,
  [genericPack.id]: genericPack,
};

/**
 * Pack padrão de FALLBACK no código.
 *
 * IMPORTANTE (Passo 2): enquanto a coluna clinics.clinical_pack_id não existir (ela chega no
 * Passo 3, migration em rascunho), o default é "bio3-neuroid" para garantir ZERO regressão da
 * IFWC, que é a única clínica em produção hoje. No Passo 3, o binding passa a vir do banco
 * (default de coluna "generic"; IFWC recebe backfill para "bio3-neuroid").
 */
export const DEFAULT_CLINICAL_PACK_ID = "bio3-neuroid";

/** Ids de packs disponíveis (para validação/UI futura). */
export function listPackIds(): string[] {
  return Object.keys(PACKS);
}

/**
 * Resolve o objeto do pack pelo id. Se o id for desconhecido ou vazio, cai no pack padrão
 * (nunca lança), para que o motor de IA jamais quebre por causa de um binding inválido.
 */
export function getPack(packId?: string | null): ClinicalPack {
  const id = (packId ?? "").trim();
  return PACKS[id] ?? PACKS[DEFAULT_CLINICAL_PACK_ID];
}
