import PDFDocument from "pdfkit";
import type { AiInsightOutput, NeuroIdentificacao, NeuroSecaoItem } from "@/lib/types";

// ── Identidade visual ────────────────────────────────────────────────────────
const GRAD = ["#9A86B8", "#5E8AA0", "#3E5C8A"]; // barra superior (roxo → teal → azul)
const INK = "#1f2937";
const MUTED = "#4b5563";

type ClinicBrand = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  tagline?: string | null;
};

type Doc = PDFKit.PDFDocument;

const PAGE_W = 612; // LETTER
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 120; // espaço para barra + logo
const BOTTOM = 92; // espaço para rodapé

async function fetchLogo(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

function drawHeader(doc: Doc, logo: Buffer | null) {
  // Barra em gradiente
  const grad = doc.linearGradient(MARGIN, 0, PAGE_W - MARGIN, 0);
  grad.stop(0, GRAD[0]).stop(0.5, GRAD[1]).stop(1, GRAD[2]);
  doc.roundedRect(MARGIN, 34, CONTENT_W, 9, 4).fill(grad);

  // Logo centralizado
  if (logo) {
    try {
      const w = 58;
      doc.image(logo, (PAGE_W - w) / 2, 54, { width: w });
    } catch { /* logo inválido: ignora */ }
  }
}

function drawFooter(doc: Doc, brand: ClinicBrand) {
  const tagline = (brand.tagline ?? "").trim();
  const y = 760;
  doc.save();
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.6).strokeColor("#D9D6E4").stroke();
  if (tagline) {
    doc.font("Helvetica").fontSize(8.5).fillColor("#8C86A6")
      .text(tagline.toUpperCase(), MARGIN, y + 10, { width: CONTENT_W, align: "center", characterSpacing: 1.4 });
  }
  doc.restore();
}

function resetBody(doc: Doc) {
  doc.x = MARGIN;
  doc.y = TOP;
}

function ensureSpace(doc: Doc, needed = 80) {
  if (doc.y > 770 - needed) doc.addPage();
}

// ── Blocos de conteúdo ───────────────────────────────────────────────────────
function docTitle(doc: Doc, title: string, subtitle?: string) {
  doc.font("Times-Bold").fontSize(17).fillColor(INK)
    .text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  if (subtitle) {
    doc.moveDown(0.2);
    doc.font("Times-Italic").fontSize(11.5).fillColor(MUTED)
      .text(subtitle, MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  }
  doc.moveDown(0.8);
}

function sectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 70);
  doc.moveDown(0.6);
  doc.font("Times-Bold").fontSize(12.5).fillColor(INK).text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.35);
}

function paragraph(doc: Doc, text?: string | null) {
  if (!text || !text.trim()) return;
  doc.font("Times-Roman").fontSize(10.5).fillColor(MUTED)
    .text(text.trim(), MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 3 });
  doc.moveDown(0.4);
}

/** Item com título em negrito seguido de " — descrição" no mesmo fluxo. */
function leadItem(doc: Doc, item: NeuroSecaoItem, numbered?: number) {
  if (!item.titulo && !item.descricao) return;
  ensureSpace(doc, 60);
  const prefix = numbered ? `${numbered}. ` : "";
  doc.font("Times-Bold").fontSize(10.5).fillColor(INK)
    .text(`${prefix}${item.titulo}`, MARGIN, doc.y, { width: CONTENT_W, continued: !!item.descricao });
  if (item.descricao) {
    doc.font("Times-Roman").fillColor(MUTED).text(` — ${item.descricao}`, { width: CONTENT_W, align: "justify", lineGap: 3 });
  }
  doc.moveDown(0.5);
}

function bullets(doc: Doc, title: string, items?: string[]) {
  const arr = (items ?? []).filter(Boolean);
  if (arr.length === 0) return;
  doc.moveDown(0.3);
  doc.font("Times-Bold").fontSize(11).fillColor(INK).text(title, MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.15);
  arr.forEach((it) => {
    ensureSpace(doc, 40);
    doc.font("Times-Roman").fontSize(10).fillColor(MUTED).text(`•  ${it}`, MARGIN + 6, doc.y, { width: CONTENT_W - 6, lineGap: 3 });
  });
}

function idRow(doc: Doc, label: string, value?: string | null) {
  if (!value || !value.trim()) return;
  ensureSpace(doc, 30);
  doc.font("Times-Bold").fontSize(10.5).fillColor(INK).text(`${label}: `, MARGIN, doc.y, { continued: true });
  doc.font("Times-Roman").fillColor(MUTED).text(value.trim(), { width: CONTENT_W, lineGap: 2 });
  doc.moveDown(0.1);
}

function identificacaoBlock(doc: Doc, id?: NeuroIdentificacao, fallbackName?: string | null) {
  sectionTitle(doc, "Identificação");
  idRow(doc, "Paciente", id?.paciente ?? fallbackName ?? undefined);
  idRow(doc, "Idade", id?.idade);
  idRow(doc, "Sexo", id?.sexo);
  idRow(doc, "Peso", id?.peso);
  idRow(doc, "Altura", id?.altura);
  idRow(doc, "Local de acompanhamento", id?.local);
  idRow(doc, "Data das avaliações", id?.data_avaliacoes);
  idRow(doc, "Microfisioterapia", id?.microfisioterapia);
  idRow(doc, "Exame de cabelo", id?.exame_cabelo);
  idRow(doc, "Base da orientação", id?.base_orientacao);
}

function pdfToBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Gera o PDF do relatório Neuro ID 360 no padrão visual da clínica.
 * Documento 1 = Relatório Funcional Integrado; Documento 2 = Plano Integrativo;
 * Documento 3 = Protocolo de Suplementação (quando houver).
 */
export async function buildNeuroId360Pdf(opts: {
  output: AiInsightOutput;
  patientName?: string | null;
  clinic?: ClinicBrand;
}): Promise<Buffer> {
  const { output, patientName } = opts;
  const brand: ClinicBrand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);

  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: "Relatório Neuro ID 360", Author: brand.name ?? "AXIEL Core" },
  });

  // Cabeçalho/rodapé em TODAS as páginas.
  drawHeader(doc, logo);
  drawFooter(doc, brand);
  doc.on("pageAdded", () => {
    drawHeader(doc, logo);
    drawFooter(doc, brand);
    resetBody(doc);
  });
  resetBody(doc);

  // ── DOCUMENTO 1 — Relatório Funcional Integrado ────────────────────────────
  if (mapa) {
    docTitle(doc, "Relatório Funcional Integrado — Neuro ID", "Resultado da Avaliação Funcional");
    identificacaoBlock(doc, mapa.identificacao, patientName);

    sectionTitle(doc, "Exames e Informações Avaliadas");
    paragraph(doc, mapa.exames_avaliados ?? mapa.leitura_integrativa);

    if (mapa.resultados_encontrados && mapa.resultados_encontrados.length > 0) {
      sectionTitle(doc, "Resultados Encontrados");
      mapa.resultados_encontrados.forEach((it) => leadItem(doc, it));
    } else {
      // fallback antigos
      bullets(doc, "Principais achados", mapa.principais_achados);
      bullets(doc, "Padrões observados", mapa.padroes_observados);
      bullets(doc, "Achados funcionais", mapa.achados_funcionais);
      bullets(doc, "Desregulação do sistema nervoso (SNA)", mapa.desregulacao_sna);
    }

    if (mapa.sintese_clinico_funcional) { sectionTitle(doc, "Síntese Clínico-Funcional"); paragraph(doc, mapa.sintese_clinico_funcional); }
    if (mapa.conclusao_funcional) { sectionTitle(doc, "Conclusão Funcional"); paragraph(doc, mapa.conclusao_funcional); }
    if (mapa.fase_jornada) { paragraph(doc, `Dentro da Jornada Neuro ID, o paciente se encontra na fase de ${mapa.fase_jornada}.`); }

    doc.moveDown(0.4);
    doc.font("Times-Italic").fontSize(9).fillColor("#9ca3af")
      .text(mapa.observacao ?? "Este documento não substitui avaliação médica, diagnóstico, exames laboratoriais ou condutas já prescritas.", MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }

  // ── DOCUMENTO 2 — Plano Integrativo Neuro ID ───────────────────────────────
  if (plano) {
    doc.addPage();
    docTitle(doc, "Plano Integrativo Neuro ID", "Próximos Passos e Direção Terapêutica");
    identificacaoBlock(doc, plano.identificacao, patientName);

    if (plano.fase_jornada_nome || plano.fase_jornada_justificativa) {
      sectionTitle(doc, "Fase na Jornada Neuro ID");
      if (plano.fase_jornada_nome) { doc.font("Times-Bold").fontSize(11).fillColor(INK).text(plano.fase_jornada_nome, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.2); }
      paragraph(doc, plano.fase_jornada_justificativa);
    }

    if (plano.direcao_terapeutica) { sectionTitle(doc, "Direção Terapêutica"); paragraph(doc, plano.direcao_terapeutica); }

    if (plano.plano_inicial && plano.plano_inicial.length > 0) {
      sectionTitle(doc, "Plano Integrativo Inicial");
      plano.plano_inicial.forEach((it, i) => leadItem(doc, it, i + 1));
    } else {
      bullets(doc, "Próximos passos", plano.proximos_passos);
      bullets(doc, "Orientações iniciais", plano.orientacoes_iniciais);
      bullets(doc, "Recomendações de rotina", plano.recomendacoes_rotina);
    }

    if (plano.acompanhamento_evolucao) { sectionTitle(doc, "Acompanhamento da Evolução"); paragraph(doc, plano.acompanhamento_evolucao); }
    if (plano.proximo_passo) { sectionTitle(doc, "Próximo Passo"); paragraph(doc, plano.proximo_passo); }

    doc.moveDown(0.4);
    doc.font("Times-Italic").fontSize(9).fillColor("#9ca3af")
      .text(plano.observacao ?? "Este plano não substitui avaliação médica, exames laboratoriais ou condutas já prescritas.", MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }

  // ── DOCUMENTO 3 — Protocolo de Suplementação ───────────────────────────────
  if (sup && (sup.itens.length > 0 || sup.observacoes_gerais.length > 0)) {
    doc.addPage();
    docTitle(doc, "Protocolo de Suplementação", "Sugestões para Validação Profissional");
    doc.font("Times-Italic").fontSize(9).fillColor("#9a7b2f")
      .text("Rascunho — exige aprovação do profissional antes de qualquer uso.", MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.5);
    sup.itens.forEach((it) => {
      ensureSpace(doc, 70);
      doc.font("Times-Bold").fontSize(11).fillColor(INK).text(it.nome, MARGIN, doc.y, { width: CONTENT_W });
      if (it.dose_sugerida) paragraph(doc, `Dose sugerida: ${it.dose_sugerida}`);
      if (it.objetivo) paragraph(doc, `Objetivo: ${it.objetivo}`);
      if (it.observacao) paragraph(doc, `Obs.: ${it.observacao}`);
      doc.moveDown(0.2);
    });
    bullets(doc, "Observações gerais", sup.observacoes_gerais);
  }

  return pdfToBuffer(doc);
}
