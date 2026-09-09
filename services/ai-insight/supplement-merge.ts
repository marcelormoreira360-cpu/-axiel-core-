import type { AiInsightOutput } from "@/lib/types";

/**
 * Merge PURO da regeneração de suplementação (Fase 1). Sem dependências de
 * servidor (só tipos), para ser unit-testável isolado.
 *
 * Regenera SÓ o Documento 2 (protocolo_suplementacao) com o cérebro clínico novo
 * (Protocolo dos 10 Filtros), preservando o Documento 1 (mapa_integrativo +
 * plano_regulacao) e o Documento 3 já APROVADOS do paciente. Assim a atualização
 * de suplementação não reescreve um relatório que o paciente já recebeu.
 *
 * - Sem relatório aprovado anterior: usa o output fresco inteiro (nada a preservar).
 * - Com relatório aprovado: mantém do aprovado tudo que descreve o RELATÓRIO já
 *   entregue (Doc 1 = mapa_integrativo + plano_regulacao, Doc 3, structured_summary,
 *   safety_note, data_limitations) e troca só o que é da SUPLEMENTAÇÃO nova:
 *   protocolo_suplementacao (Doc 2), o carimbo de versão e a ficha interna
 *   (practitioner_review_points), que passa a refletir as interações/cautelas dos
 *   novos ativos, que é o que o revisor precisa ver ao aprovar a suplementação.
 * - Defesa: se o fresco NÃO trouxer suplementação (ex.: JSON malformado da OpenAI),
 *   NÃO apaga o Doc 2 aprovado; devolve o aprovado intacto. O orquestrador trata
 *   "fresco sem Doc 2" como falha e não salva rascunho.
 */
export function mergeRegeneratedSupplement(
  previousApproved: AiInsightOutput | null,
  fresh: AiInsightOutput,
): AiInsightOutput {
  if (!previousApproved) return fresh;
  if (!fresh.protocolo_suplementacao) return previousApproved;
  return {
    ...previousApproved,
    protocolo_suplementacao: fresh.protocolo_suplementacao,
    supplement_reasoning_version: fresh.supplement_reasoning_version ?? null,
    practitioner_review_points: fresh.practitioner_review_points,
  };
}
