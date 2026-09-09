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
 * true se a prosa do Bio³ (leitura_bio3.descricao) traz PERCENTUAIS — típico dos relatórios
 * GERADOS ANTES da virada de equilíbrio (prompt antigo mandava citar disfunção "47%, índice 24%").
 * Como o Anel Bio³ agora mostra o número em EQUILÍBRIO, esse texto antigo CONTRADIZ a figura;
 * o render troca por uma frase qualitativa determinística. Relatórios novos não têm % → não disparam.
 */
export function bio3ProseHasPercent(text?: string | null): boolean {
  return !!text && /\d\s*%/.test(text);
}

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

/**
 * Termos INTERNOS que nunca podem aparecer no texto ao paciente (match por palavra inteira).
 * Trilíngue: o relatório é gerado no idioma do paciente (pt/en/es), então o léxico cobre os três.
 */
export const NAO_AO_PACIENTE_TERMS = [
  // pt
  "exame", "exames", "neurometria", "biorressonância", "biorressonancia", "protocolo", "protocolos",
  // en
  "exam", "exams", "neurometry", "bioresonance", "protocol", "protocols",
  // es
  "examen", "exámenes", "examenes", "neurometría", "biorresonancia",
];

const EM_DASH = "—";
// Número de sessões exposto ao paciente. Cobre dígito ou número por extenso (pt/en/es) +
// a palavra sessão nos três idiomas (sessão/ões · session(s) · sesión/sesiones).
const NUM_WORDS =
  "dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|" +
  "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|" +
  "dos|cuatro|siete|ocho|nueve|diez|once|doce";
const NUM_SESSOES_RE = new RegExp(
  `(\\d+|${NUM_WORDS})\\s*(sess(ão|ões|oes|ao)|sessions?|sesi(ó|o)n(es)?)`,
  "iu",
);

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

/**
 * Texto da SUPLEMENTAÇÃO (protocolo_suplementacao) que o paciente lê no PDF do
 * Documento 2/3. Varrido à parte de patientFacingFields para NÃO contar como
 * "conteúdo persuasivo" do Doc 1 (não deve exigir âncora positiva), mas ainda
 * assim pegar travessão que escape para o material do paciente.
 */
function supplementPatientText(output: AiInsightOutput): Array<{ field: string; text: string }> {
  const s = output.protocolo_suplementacao;
  const out: Array<{ field: string; text: string }> = [];
  if (!s) return out;
  const push = (field: string, text: string | undefined | null) => {
    if (text && text.trim()) out.push({ field, text });
  };
  push("suplementacao.intro", s.intro);
  push("suplementacao.proximos_passos", s.proximos_passos);
  (s.observacoes_gerais ?? []).forEach((t) => push("suplementacao.observacoes_gerais", t));
  (s.cuidados ?? []).forEach((c) => {
    push("suplementacao.cuidados.titulo", c.titulo);
    push("suplementacao.cuidados.texto", c.texto);
  });
  (s.formulas ?? []).forEach((f) => {
    push("suplementacao.formula.nome", f.nome);
    push("suplementacao.formula.posologia", f.posologia);
    push("suplementacao.formula.duracao", f.duracao);
    push("suplementacao.formula.excipiente", f.excipiente);
    (f.composicao ?? []).forEach((c) => {
      push("suplementacao.formula.composicao.ativo", c.ativo);
      push("suplementacao.formula.composicao.quantidade", c.quantidade);
    });
  });
  (s.itens ?? []).forEach((it) => {
    push("suplementacao.item.nome", it.nome);
    push("suplementacao.item.objetivo", it.objetivo);
    push("suplementacao.item.dose_sugerida", it.dose_sugerida);
    push("suplementacao.item.forma", it.forma);
    push("suplementacao.item.como_tomar", it.como_tomar);
    push("suplementacao.item.observacao", it.observacao);
  });
  return out;
}

/**
 * Texto do Documento 3 (relatorio_hipersensibilidade) que o paciente lê no PDF.
 * Varre APENAS travessão: este documento cita "biorressonância" de propósito no
 * aviso obrigatório (é complementar/qualitativa), então NÃO roda o léxico de
 * termos internos aqui (daria falso positivo no disclaimer do modelo).
 */
function hypersensitivityPatientText(output: AiInsightOutput): Array<{ field: string; text: string }> {
  const d = output.relatorio_hipersensibilidade;
  const out: Array<{ field: string; text: string }> = [];
  if (!d) return out;
  const push = (field: string, text: string | undefined | null) => {
    if (text && text.trim()) out.push({ field, text });
  };
  push("hipersens.introducao", d.introducao);
  push("hipersens.visao_geral.quadro", d.visao_geral?.quadro);
  push("hipersens.visao_geral.principais_achados", d.visao_geral?.principais_achados);
  push("hipersens.visao_geral.prioridade_funcional", d.visao_geral?.prioridade_funcional);
  (d.padroes ?? []).forEach((p) => push("hipersens.padroes.interpretacao", p.interpretacao));
  (d.achados_prioritarios ?? []).forEach((a) => push("hipersens.achados_prioritarios.prioridade", a.prioridade));
  push("hipersens.relacao_sistema_nervoso", d.relacao_sistema_nervoso);
  (d.eixos ?? []).forEach((e) => push("hipersens.eixos.descricao", e.descricao));
  (d.fases ?? []).forEach((f) => push("hipersens.fases.descricao", f.descricao));
  (d.plano_alimentar ?? []).forEach((t) => push("hipersens.plano_alimentar", t));
  push("hipersens.implicacoes.texto", d.implicacoes_suplementacao?.texto);
  (d.monitoramento ?? []).forEach((t) => push("hipersens.monitoramento", t));
  push("hipersens.resumo_executivo", d.resumo_executivo);
  (d.observacoes_gerais ?? []).forEach((t) => push("hipersens.observacoes_gerais", t));
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

  // Suplementação (Documento 2 ao paciente): checks COMPLETOS (termo interno,
  // número de sessões, travessão). Escapava por não passar pelo scan persuasivo.
  // Não conta como conteúdo persuasivo (não exige âncora).
  for (const { field, text } of supplementPatientText(output)) {
    for (const term of NAO_AO_PACIENTE_TERMS) {
      if (wordRegex(term).test(text)) violations.push({ kind: "termo_interno", term, field });
    }
    if (NUM_SESSOES_RE.test(text)) violations.push({ kind: "numero_sessoes", field });
    if (text.includes(EM_DASH)) violations.push({ kind: "travessao", field });
  }

  // Documento 3 (hipersensibilidade): só TRAVESSÃO (cita "biorressonância" de
  // propósito no aviso obrigatório, então não roda o léxico de termos internos).
  for (const { field, text } of hypersensitivityPatientText(output)) {
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
