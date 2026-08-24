/**
 * Guardrails determinísticos sobre o TEXTO destinado ao PACIENTE (Doc 1/Doc 2, Rota A).
 * Ver docs/SPEC_doc1_persuasivo_pipeline.md (§5.2). NÃO é censura silenciosa: sinaliza
 * violações para o gate humano (review_status = needs_changes) em vez de reescrever escondido.
 *
 * Regra de escopo: varre SÓ os campos NOVOS do formato persuasivo (6 seções do Doc 1,
 * 4 blocos do Doc 2). Os campos antigos (exames_avaliados etc.) citam exames por design
 * do formato educativo e não são varridos aqui — senão todo insight legado falharia.
 */
import type { AiInsightOutput, NeuroMapaIntegrativo, NeuroPlanoRegulacao, NeuroSecaoItem } from "@/lib/types";

/**
 * true se o Doc 1 (mapa_integrativo) já veio no formato persuasivo (Rota A, 8 seções).
 * Fonte única usada pela tela (neuro-id-360-documents) e pelo PDF (neuro-id-pdf-service)
 * para decidir entre o render novo e o fallback do formato antigo.
 */
export function hasPersuasiveDoc1(mapa?: NeuroMapaIntegrativo | null): boolean {
  if (!mapa) return false;
  return Boolean(
    mapa.abertura_calorosa ||
      mapa.leitura_bio3 ||
      (mapa.leitura_neurometrica && mapa.leitura_neurometrica.length > 0) ||
      mapa.leitura_bioemocional ||
      mapa.ancora_positiva ||
      mapa.conexao_aha ||
      mapa.porque_agir_agora ||
      mapa.proximo_passo,
  );
}

/**
 * true se o Doc 2 (plano_regulacao) já veio no formato persuasivo (Rota A, 4 blocos).
 * Fonte única usada pela tela para decidir entre o render novo e o fallback antigo.
 */
export function hasPersuasiveDoc2(plano?: NeuroPlanoRegulacao | null): boolean {
  if (!plano) return false;
  return Boolean(plano.onde_queremos_chegar || plano.tres_pilares || plano.como_caminhar_juntos);
}

/** Termos INTERNOS que nunca podem aparecer no texto ao paciente (match por palavra inteira). */
export const NAO_AO_PACIENTE_TERMS = [
  "exame", "exames", "neurometria", "biorressonância", "biorressonancia", "protocolo",
];

const EM_DASH = "—";
/** Número (dígito ou "doze") + sessão/sessões: expõe a contagem de sessões do exame. */
const NUM_SESSOES_RE = /(\d+|doze)\s*sess(ão|ões|oes|ao)/iu;

export type PatientTextViolation =
  | { kind: "termo_interno"; term: string; field: string }
  | { kind: "numero_sessoes"; field: string }
  | { kind: "travessao"; field: string }
  | { kind: "sem_ancora_positiva" };

function wordRegex(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
}

function itemStrings(items: NeuroSecaoItem[] | undefined): string[] {
  return (items ?? []).flatMap((it) => [it.titulo, it.descricao]).filter(Boolean);
}

/** Coleta só os campos NOVOS (formato persuasivo Rota A) destinados ao paciente. */
function patientFacingFields(output: AiInsightOutput): Array<{ field: string; text: string }> {
  const m: NeuroMapaIntegrativo | undefined = output.mapa_integrativo;
  const p: NeuroPlanoRegulacao | undefined = output.plano_regulacao;
  const out: Array<{ field: string; text: string }> = [];
  const push = (field: string, text: string | undefined | null) => {
    if (text && text.trim()) out.push({ field, text });
  };
  // Doc 1 — 6 seções
  push("mapa.abertura_calorosa", m?.abertura_calorosa);
  push("mapa.leitura_bio3", m?.leitura_bio3 ? `${m.leitura_bio3.titulo} ${m.leitura_bio3.descricao}` : null);
  itemStrings(m?.leitura_neurometrica).forEach((t) => push("mapa.leitura_neurometrica", t));
  if (m?.leitura_bioemocional) {
    m.leitura_bioemocional.temas.forEach((t) => push("mapa.leitura_bioemocional.temas", t));
    push("mapa.leitura_bioemocional.sintese", m.leitura_bioemocional.sintese);
  }
  push("mapa.ancora_positiva", m?.ancora_positiva);
  push("mapa.conexao_aha", m?.conexao_aha);
  push("mapa.porque_agir_agora", m?.porque_agir_agora);
  push("mapa.proximo_passo", m?.proximo_passo);
  // Doc 2 — 4 blocos
  push("plano.onde_queremos_chegar", p?.onde_queremos_chegar);
  if (p?.tres_pilares) {
    push("plano.tres_pilares.nervoso", p.tres_pilares.nervoso);
    push("plano.tres_pilares.emocional", p.tres_pilares.emocional);
    push("plano.tres_pilares.estilo_de_vida", p.tres_pilares.estilo_de_vida);
  }
  push("plano.como_caminhar_juntos", p?.como_caminhar_juntos);
  // proximo_passo é compartilhado com o formato legado; só o varremos quando o Doc 2
  // está no formato persuasivo (senão um plano legado passaria a contar como persuasivo).
  if (hasPersuasiveDoc2(p)) push("plano.proximo_passo", p?.proximo_passo);
  return out;
}

export type PatientTextScan = {
  ok: boolean;
  violations: PatientTextViolation[];
  /** true se o Doc 1 tem alguma seção persuasiva preenchida (i.e., já é formato novo). */
  hasPersuasiveContent: boolean;
};

/**
 * Varre o texto persuasivo ao paciente. Se não houver conteúdo persuasivo ainda
 * (insight no formato antigo, campos novos vazios), retorna ok=true sem exigir âncora
 * (a exigência de âncora só vale quando o formato novo está em uso).
 */
export function scanPatientText(output: AiInsightOutput): PatientTextScan {
  const fields = patientFacingFields(output);
  const hasPersuasiveContent = fields.length > 0;
  const violations: PatientTextViolation[] = [];

  for (const { field, text } of fields) {
    for (const term of NAO_AO_PACIENTE_TERMS) {
      if (wordRegex(term).test(text)) violations.push({ kind: "termo_interno", term, field });
    }
    if (NUM_SESSOES_RE.test(text)) violations.push({ kind: "numero_sessoes", field });
    if (text.includes(EM_DASH)) violations.push({ kind: "travessao", field });
  }

  // Âncora positiva obrigatória, só quando o Doc 1 está no formato persuasivo
  // (a âncora é uma seção do Doc 1; um Doc 2 persuasivo sem Doc 1 não deve exigi-la).
  if (hasPersuasiveDoc1(output.mapa_integrativo) && !output.mapa_integrativo?.ancora_positiva?.trim()) {
    violations.push({ kind: "sem_ancora_positiva" });
  }

  return { ok: violations.length === 0, violations, hasPersuasiveContent };
}

/** Resumo curto das violações para nota do gate/audit. */
export function summarizeViolations(violations: PatientTextViolation[]): string {
  if (violations.length === 0) return "";
  return violations
    .map((v) => {
      if (v.kind === "termo_interno") return `termo interno "${v.term}" em ${v.field}`;
      if (v.kind === "numero_sessoes") return `número de sessões em ${v.field}`;
      if (v.kind === "travessao") return `travessão em ${v.field}`;
      return "âncora positiva ausente";
    })
    .join("; ");
}
