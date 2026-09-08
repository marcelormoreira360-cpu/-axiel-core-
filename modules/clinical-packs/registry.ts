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
 * Pack padrão de FALLBACK no código: NEUTRO ("generic"), nunca o método proprietário.
 *
 * Regra comercial: uma clínica só recebe um método específico (ex.: "bio3-neuroid") por BINDING
 * EXPLÍCITO no banco (clinics.clinical_pack_id, migration 156, default de coluna "generic";
 * IFWC recebe backfill para "bio3-neuroid"). Se o binding estiver ausente, vazio ou a leitura
 * falhar, o motor cai no pack horizontal "generic", que não diagnostica/prescreve/promete —
 * ou seja, degrada para o lado seguro, e o método da IFWC jamais "vaza" para outra clínica.
 *
 * A IFWC não é afetada no uso normal: sua leitura retorna "bio3-neuroid" do banco. O fallback
 * só entra em cenários sem clínica identificada ou de erro transitório de leitura.
 */
export const DEFAULT_CLINICAL_PACK_ID = "generic";

/** Ids de packs disponíveis (para validação/UI futura). */
export function listPackIds(): string[] {
  return Object.keys(PACKS);
}

/**
 * Resolve o objeto do pack pelo id. Se o id for desconhecido ou vazio, cai no pack padrão
 * NEUTRO ("generic"; nunca lança), para que o motor de IA jamais quebre por causa de um
 * binding inválido e um id desconhecido nunca resolva no método proprietário.
 */
export function getPack(packId?: string | null): ClinicalPack {
  const id = (packId ?? "").trim();
  return PACKS[id] ?? PACKS[DEFAULT_CLINICAL_PACK_ID];
}
