/**
 * unified-form-seed.ts — converte o FORMULÁRIO UNIFICADO (unified-form-template)
 * no formato SEMEÁVEL do Core (template → seções → perguntas), PURO e testável.
 *
 * Cada pergunta carrega um `code` = a chave de resposta que casa com a fiação de
 * import (unified-form-import). Sintoma comum vira DUAS perguntas de escala
 * (`<code>_freq` 0–3 e `<code>_imp` 0–3). Humor 0–6 e ansiedade/regulação 0–3
 * viram uma pergunta de escala com rótulos por opção. `info` não vira pergunta.
 *
 * NÃO grava no banco. A camada de seed (assessment-seed-service) consome isto.
 * Decisão de armazenamento do `code` (coluna nova nullable em assessment_questions
 * OU dentro de `options`) fica para o momento de semear, com OK de Marcelo.
 */

import { UNIFIED_FORM, type UnifiedQuestion } from "./unified-form-template";

export type SeedQuestionType = "scale" | "yes_no" | "text" | "choice" | "multi";

export type SeedQuestion = {
  text: string;
  /** chave da resposta (casa com unified-form-import). */
  code: string;
  question_type: SeedQuestionType;
  min_score: number;
  max_score: number;
  /** rótulos por valor de escala, OU opções de choice/multi. */
  options?: string[];
  is_required: boolean;
};

export type SeedSection = { title: string; questions: SeedQuestion[] };

export type SeedTemplateFull = {
  name: string;
  description: string;
  instructions: string;
  sections: SeedSection[];
};

const FREQ = ["Nunca", "Poucos dias", "Mais da metade dos dias", "Quase todos os dias"];
const IMP = ["Não atrapalha", "Atrapalha um pouco", "Atrapalha bastante", "Atrapalha muito"];

function anchorsToOptions(anchors: Record<number, string>, max: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= max; i++) out[i] = anchors[i] ?? "";
  return out;
}

/** Converte uma pergunta do formulário em 0..2 perguntas semeáveis. */
export function convertQuestion(q: UnifiedQuestion): SeedQuestion[] {
  const base = { is_required: false };
  switch (q.type) {
    case "freqimp":
      return [
        { text: `${q.label} — com que frequência?`, code: `${q.code}_freq`, question_type: "scale", min_score: 0, max_score: 3, options: FREQ, ...base },
        { text: `${q.label} — o quanto atrapalha?`, code: `${q.code}_imp`, question_type: "scale", min_score: 0, max_score: 3, options: IMP, ...base },
      ];
    case "scale": {
      const max = q.max ?? 3;
      const options = q.scaleLabels ?? (q.anchors ? anchorsToOptions(q.anchors, max) : undefined);
      return [{ text: q.label, code: q.code, question_type: "scale", min_score: 0, max_score: max, options, ...base }];
    }
    case "crisis": {
      const max = q.max ?? 6;
      return [{ text: q.label, code: q.code, question_type: "scale", min_score: 0, max_score: max, options: q.anchors ? anchorsToOptions(q.anchors, max) : undefined, ...base }];
    }
    case "yes_no":
      return [{ text: q.label, code: q.code, question_type: "yes_no", min_score: 0, max_score: 1, ...base }];
    case "choice":
      return [{ text: q.label, code: q.code, question_type: "choice", min_score: 0, max_score: 0, options: q.options, ...base }];
    case "multi":
      return [{ text: q.label, code: q.code, question_type: "multi", min_score: 0, max_score: 0, options: q.options, ...base }];
    case "text":
    case "date":
      return [{ text: q.label, code: q.code, question_type: "text", min_score: 0, max_score: 0, ...base }];
    case "info":
      return [];
    default:
      return [];
  }
}

/** Template unificado inteiro no formato semeável. */
export function buildUnifiedSeed(): SeedTemplateFull {
  return {
    name: UNIFIED_FORM.name,
    description: "Formulário unificado do método Neuro ID — Perfil Clínico Integrado de 30 Dias.",
    instructions: `${UNIFIED_FORM.recall}\n\n${UNIFIED_FORM.disclaimer}`,
    sections: UNIFIED_FORM.blocks.map((b) => ({
      title: `${b.key} — ${b.title}`,
      questions: b.questions.flatMap(convertQuestion),
    })),
  };
}

/** Todos os códigos de resposta gerados (para conferência/round-trip). */
export function unifiedSeedCodes(): string[] {
  return buildUnifiedSeed().sections.flatMap((s) => s.questions.map((q) => q.code));
}

/** Linha de `assessment_questions` pronta para insert (requer coluna `code`, migration 148). */
export type AssessmentQuestionRow = {
  template_id: string;
  section_id: string;
  text: string;
  code: string;
  question_type: SeedQuestionType;
  min_score: number;
  max_score: number;
  options: string[] | null;
  order_index: number;
  is_required: boolean;
};

/** Mapeia perguntas semeáveis nas linhas do banco (puro; a gravação é de quem chama). */
export function buildQuestionRows(
  templateId: string,
  sectionId: string,
  questions: SeedQuestion[],
  startOrder = 0,
): AssessmentQuestionRow[] {
  return questions.map((q, i) => ({
    template_id: templateId,
    section_id: sectionId,
    text: q.text,
    code: q.code,
    question_type: q.question_type,
    min_score: q.min_score,
    max_score: q.max_score,
    options: q.options ?? null,
    order_index: startOrder + i,
    is_required: q.is_required,
  }));
}
