import { DEFAULT_CLINICAL_PACK_ID, getPack } from "@/modules/clinical-packs/registry";
import type { ClinicalPack } from "@/modules/clinical-packs/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Resolve o clinical_pack_id de uma clínica.
 *
 * Lê clinics.clinical_pack_id (migration 156) via admin client, filtrando pelo id da clínica
 * explicitamente (padrão já usado no Core). Cada clínica em produção tem um binding EXPLÍCITO
 * (IFWC/Axiel = "bio3-neuroid"; demais = "generic"), então o caminho normal devolve sempre o
 * pack correto do banco. Se a leitura falhar por qualquer motivo (sem clínica identificada,
 * env ausente em testes, erro de rede, linha inexistente ou coluna vazia), cai no
 * DEFAULT_CLINICAL_PACK_ID, que é o pack NEUTRO "generic": degrada para o lado seguro e nunca
 * entrega o método proprietário a quem não tem binding para ele. A IFWC não é afetada no uso
 * normal (sua leitura retorna "bio3-neuroid"); só um erro transitório a levaria ao generic, e
 * nesse caso a própria geração já tende a falhar por falta dos dados do paciente no banco.
 *
 * Observação de segurança: o admin client (service_role) contorna RLS de propósito aqui,
 * por isso o filtro por id é obrigatório e explícito; a função nunca lança.
 */
export async function resolveClinicalPackId(clinicId?: string | null): Promise<string> {
  // Sem clínica identificada → fallback seguro imediato.
  if (!clinicId) return DEFAULT_CLINICAL_PACK_ID;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clinics")
      .select("clinical_pack_id")
      .eq("id", clinicId)
      .maybeSingle();

    if (error) return DEFAULT_CLINICAL_PACK_ID;

    const packId = (data?.clinical_pack_id ?? "").trim();
    return packId || DEFAULT_CLINICAL_PACK_ID;
  } catch {
    // Env de Supabase ausente (ex.: suíte de testes) ou falha de rede → fallback seguro.
    return DEFAULT_CLINICAL_PACK_ID;
  }
}

/** Conveniência: resolve e já devolve o objeto do pack da clínica. */
export async function resolveClinicalPack(clinicId?: string | null): Promise<ClinicalPack> {
  return getPack(await resolveClinicalPackId(clinicId));
}

/**
 * A clínica usa o método Neuro ID/Bio³? Fonte única para o ISOLAMENTO DE UI: gate dos
 * módulos Bio³ (mapa, pirâmide, anel, relatórios/suplementação Neuro ID, formulário Neuro ID)
 * na interface. Clínica sem binding (ou com pack generic) devolve false — não vê Bio³.
 */
export async function clinicUsesNeuroId(clinicId?: string | null): Promise<boolean> {
  const pack = await resolveClinicalPack(clinicId);
  return pack.capabilities?.neuroId === true;
}
