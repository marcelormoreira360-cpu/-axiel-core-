import type { AiInsightOutput } from "@/lib/types";

/**
 * CLINICAL PACK — contrato do "pacote de método" que alimenta o motor horizontal de IA.
 *
 * Princípio da Frente B: a ENCANAÇÃO (chamar a IA, validar por humano, revisar, aprovar,
 * enviar) é horizontal e serve qualquer clínica; o CONTEÚDO do método (prompt do relatório,
 * schema de saída, prompts de apoio) é o que muda por clínica e vira um Clinical Pack.
 *
 * O motor (services/ai-insight/generation.ts) NÃO importa mais Bio³/Neuro ID de forma
 * estática: ele resolve o pack da clínica e usa esta interface. Trocar de método é trocar
 * de pack, sem tocar no fluxo.
 */

/** Builder de prompt de sistema; recebe o locale (idioma de saída) e devolve o texto. */
export type PackPromptBuilder = (locale?: string | null) => string;

export interface ClinicalPack {
  /** Identificador estável do pack (ex.: "bio3-neuroid", "generic"). Casa com clinics.clinical_pack_id (Passo 3). */
  id: string;

  /** Prompt de sistema do RELATÓRIO que vai ao paciente após aprovação humana. */
  buildReportSystemPrompt: PackPromptBuilder;

  /** Forma (shape) do JSON de saída do relatório, enviada ao modelo como required_output_shape. */
  reportJsonShape: Record<string, unknown>;

  /** Coerção/saneamento da saída bruta do modelo para o tipo AiInsightOutput. */
  coerceReportOutput: (parsed: unknown) => AiInsightOutput;

  /** Prompts de APOIO ao profissional (rascunhos internos, nunca vão direto ao paciente). */
  assistantPrompts: {
    /** Rascunho do campo "Integração clínica (ATM)" a partir dos dados do paciente. */
    atm: PackPromptBuilder;
    /** Escriba clínico: organiza a transcrição da consulta em rascunho. */
    scribe: PackPromptBuilder;
    /** Painel de direção: queixa principal + resumo do caso. */
    caseSummary: PackPromptBuilder;
  };

  // ── Pontos de extensão para passos futuros (ainda NÃO consumidos pelo motor) ──
  // Preenchidos incrementalmente e sem risco nos próximos passos do plano:
  //  • catalogSeed  → Passo 4 (seed do catálogo de avaliação por pack em ensureClinicCatalog).
  //  • bands        → Passo 6 (limiares/cores/eixos da pirâmide, hoje em modules/neuro-id/bands.ts).
  //  • supplementSeed → seed opcional do catálogo de suplementos por pack.
  catalogSeed?: unknown;
  bands?: unknown;
  supplementSeed?: unknown;
}
