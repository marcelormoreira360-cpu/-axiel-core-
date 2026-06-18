/**
 * neuro-id-pdf-service.ts — PDF herói do Mapa Bio³ (≤4 páginas, timbrado).
 *
 * Conteúdo: pirâmide/eixos em EQUILÍBRIO + índice geral + ponto de atenção;
 * por eixo (o que foi avaliado / o que revela, linguagem de cuidado);
 * plano amarrado aos eixos; próximos passos; disclaimer (bem-estar funcional).
 */

import PDFDocument from "pdfkit";
import type { NeuroPillar } from "@/modules/neuro-id/catalog";
import { bandForDysfunction, labelFor } from "@/modules/neuro-id/bands";
import { pillarContributions } from "@/modules/neuro-id/scoring";

const GRAD = ["#9A86B8", "#5E8AA0", "#3E5C8A"];
const INK = "#1f2937";
const MUTED = "#4b5563";
const PAGE_W = 612;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 120;
const BOTTOM = 92;

type Doc = PDFKit.PDFDocument;
type ClinicBrand = { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null };

export type NeuroIdPdfMap = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
  computed_at?: string | null;
};

const PILLAR_LABEL: Record<NeuroPillar, string> = {
  fisico: "Biomecânico", bioquimico: "Bioquímico", emocional: "Bioemocional",
};
const PILLAR_HINT: Record<NeuroPillar, string> = {
  fisico: "corpo & movimento", bioquimico: "energia & química interna", emocional: "mente & equilíbrio",
};
const PILLAR_ASSESSED: Record<NeuroPillar, string> = {
  fisico: "Dor, mobilidade e funções musculoesqueléticas avaliadas na prática.",
  bioquimico: "Sinais de intestino, ciclo/hormonal, medicação e exames quando disponíveis.",
  emocional: "Respostas autonômicas (SNA), relato emocional, sono e questionários funcionais.",
};

const round = (d: number | null) => (d === null ? null : Math.round(d));
// Texto por faixa de DISFUNÇÃO (maior = pior).
function band(dysfunction: number | null): string {
  if (dysfunction === null) return "aguardando dados para leitura completa";
  if (dysfunction <= 30) return "em função e equilíbrio";
  if (dysfunction <= 69) return "em disfunção e desequilíbrio crônico";
  return "em grande disfunção e desequilíbrio (possíveis crises agudas)";
}

async function fetchLogo(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}
function drawHeader(doc: Doc, logo: Buffer | null) {
  const grad = doc.linearGradient(MARGIN, 0, PAGE_W - MARGIN, 0);
  grad.stop(0, GRAD[0]).stop(0.5, GRAD[1]).stop(1, GRAD[2]);
  doc.roundedRect(MARGIN, 34, CONTENT_W, 9, 4).fill(grad);
  if (logo) { try { doc.image(logo, (PAGE_W - 58) / 2, 54, { width: 58 }); } catch { /* ignora */ } }
}
function drawFooter(doc: Doc, brand: ClinicBrand) {
  const tagline = (brand.tagline ?? "").trim();
  const y = 760;
  doc.save();
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.6).strokeColor("#D9D6E4").stroke();
  if (tagline) {
    doc.font("Helvetica").fontSize(8.5).fillColor("#8C86A6")
      .text(tagline.toUpperCase(), MARGIN, y + 10, { width: CONTENT_W, align: "center", characterSpacing: 1.4, lineBreak: false });
  }
  doc.restore();
}
function resetBody(doc: Doc) { doc.x = MARGIN; doc.y = TOP; }
function ensureSpace(doc: Doc, needed = 80) { if (doc.y > 770 - needed) doc.addPage(); }
function docTitle(doc: Doc, title: string, subtitle?: string) {
  doc.font("Times-Bold").fontSize(18).fillColor(INK).text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  if (subtitle) { doc.moveDown(0.2); doc.font("Times-Italic").fontSize(11.5).fillColor(MUTED).text(subtitle, MARGIN, doc.y, { width: CONTENT_W, align: "center" }); }
  doc.moveDown(0.8);
}
function sectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 70); doc.moveDown(0.5);
  doc.font("Times-Bold").fontSize(12.5).fillColor(INK).text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.35);
}
function paragraph(doc: Doc, text?: string | null) {
  if (!text) return;
  doc.font("Times-Roman").fontSize(10.5).fillColor(MUTED).text(text, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 3 });
  doc.moveDown(0.4);
}
function dysfunctionBar(doc: Doc, label: string, hint: string, dysfunction: number | null, isPriority: boolean, share: number | null) {
  ensureSpace(doc, 50);
  const bd = bandForDysfunction(dysfunction);
  const disf = round(dysfunction);
  const color = bd ? bd.colors.stroke : "#D3D1C7";
  const textColor = bd ? bd.colors.text : MUTED;
  const bandWord = bd ? labelFor(bd.key, "axis") : "—";
  const shareTxt = share === null ? "" : `  ·  ${Math.round(share)}% do total`;
  const y = doc.y;
  doc.font("Times-Bold").fontSize(10.5).fillColor(INK).text(`${label}`, MARGIN, y, { continued: true });
  doc.font("Times-Italic").fillColor(MUTED).text(`  ${hint} · ${bandWord}${shareTxt}${isPriority ? "  ★ comece aqui" : ""}`);
  const pct = disf ?? 0;
  const barY = doc.y + 2;
  const barW = CONTENT_W - 60;
  doc.roundedRect(MARGIN, barY, barW, 8, 4).fill("#EFEDE7");
  if (disf !== null) doc.roundedRect(MARGIN, barY, (barW * pct) / 100, 8, 4).fill(color);
  doc.font("Times-Bold").fontSize(11).fillColor(textColor).text(disf === null ? "—" : `${disf}%`, MARGIN + barW + 8, barY - 2, { width: 48, align: "right" });
  doc.y = barY + 18;
}

// Pirâmide Bio³: 3 faixas coloridas pela banda de DISFUNÇÃO.
// Ordem fixa [ápice, meio, base] = [Biomecânico, Bioquímico, Bioemocional].
function drawPyramid(doc: Doc, bands: { dysfunction: number | null; isPriority: boolean }[]) {
  ensureSpace(doc, 150);
  const cx = PAGE_W / 2;
  const y0 = doc.y + 6;
  const H = 120, half = 84;
  const yA = y0, yB = y0 + 40, yC = y0 + 80, yBase = y0 + 120;
  const xAt = (y: number) => (half * (y - y0)) / H;
  const polys: [number, number][][] = [
    [[cx, yA], [cx + xAt(yB), yB], [cx - xAt(yB), yB]],
    [[cx - xAt(yB), yB], [cx + xAt(yB), yB], [cx + xAt(yC), yC], [cx - xAt(yC), yC]],
    [[cx - xAt(yC), yC], [cx + xAt(yC), yC], [cx + xAt(yBase), yBase], [cx - xAt(yBase), yBase]],
  ];
  const centersY = [y0 + 30, y0 + 60, y0 + 100];
  doc.lineWidth(2);
  bands.forEach((b, i) => {
    const bd = bandForDysfunction(b.dysfunction);
    const disf = round(b.dysfunction);
    const fill = bd ? bd.colors.fill : "#E9E7E0";
    const txt = bd ? bd.colors.text : "#9ca3af";
    doc.polygon(...polys[i]).fillAndStroke(fill, "#ffffff");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(txt)
      .text(disf === null ? "—" : `${disf}%`, cx - 30, centersY[i] - 7, { width: 60, align: "center" });
    if (b.isPriority) {
      doc.font("Helvetica").fontSize(10).fillColor(txt).text("★", cx - 30, centersY[i] - 19, { width: 60, align: "center" });
    }
  });
  doc.lineWidth(1);
  doc.y = yBase + 12;
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

export async function buildNeuroIdMapPdf(opts: {
  map: NeuroIdPdfMap;
  patientName?: string | null;
  clinic?: ClinicBrand;
}): Promise<Buffer> {
  const { map } = opts;
  const brand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);
  const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];
  const dysByPillar: Record<NeuroPillar, number | null> = {
    fisico: map.fisico_pct, bioquimico: map.bioquimico_pct, emocional: map.emocional_pct,
  };

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: "Mapa Bio³ — Índice Neuro ID", Author: brand.name ?? "AXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  const contrib = pillarContributions(dysByPillar);

  // ── Página 1 — índice (herói) / pirâmide / ponto de atenção ──
  docTitle(doc, "Mapa Bio³", "Índice Bio — grau de disfunção por eixo (meta: baixar)");
  if (opts.patientName) { doc.font("Times-Roman").fontSize(11).fillColor(MUTED).text(`Paciente: ${opts.patientName}`, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.4); }

  const generalDys = round(map.indice_geral);
  const indexBand = bandForDysfunction(map.indice_geral);
  sectionTitle(doc, "Índice Bio — Grau de Disfunção");
  doc.font("Times-Bold").fontSize(34).fillColor(indexBand ? indexBand.colors.text : "#9ca3af")
    .text(generalDys === null ? "—" : `${generalDys}%`, MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  if (indexBand) {
    doc.font("Times-Italic").fontSize(11).fillColor(indexBand.colors.text)
      .text(`${labelFor(indexBand.key, "axis")} — ${band(map.indice_geral)}`, MARGIN, doc.y + 2, { width: CONTENT_W, align: "center" });
  }
  doc.moveDown(0.3);
  if (map.priority_pillar) {
    paragraph(doc, `Comece aqui: ${PILLAR_LABEL[map.priority_pillar]} (${PILLAR_HINT[map.priority_pillar]}). É o eixo de MAIOR disfunção e onde o cuidado tende a gerar mais resultado.`);
  }
  if (map.is_partial) {
    doc.font("Times-Italic").fontSize(9.5).fillColor("#9a7b2f").text("Leitura parcial — alguns dados (ex.: exames) ainda não foram incluídos. Recomenda-se complementar a avaliação.", MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);
  }

  sectionTitle(doc, "Os 3 Eixos (Bio³)");
  drawPyramid(doc, [
    { dysfunction: dysByPillar.fisico, isPriority: map.priority_pillar === "fisico" },
    { dysfunction: dysByPillar.bioquimico, isPriority: map.priority_pillar === "bioquimico" },
    { dysfunction: dysByPillar.emocional, isPriority: map.priority_pillar === "emocional" },
  ]);
  for (const p of PILLARS) dysfunctionBar(doc, PILLAR_LABEL[p], PILLAR_HINT[p], dysByPillar[p], map.priority_pillar === p, contrib[p]);
  doc.moveDown(0.2);
  doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af").text("Legenda: 0–30 em função (Solto) · 31–69 disfunção crônica (Tenso) · 70–100 grande disfunção (Bloqueado)", MARGIN, doc.y, { width: CONTENT_W });

  // ── Página 2 — por eixo: o que foi avaliado / o que revela ──
  doc.addPage();
  docTitle(doc, "Leitura por Eixo", "O que foi avaliado e o que sugere");
  for (const p of PILLARS) {
    const disf = round(dysByPillar[p]);
    sectionTitle(doc, `${PILLAR_LABEL[p]} — ${PILLAR_HINT[p]}`);
    paragraph(doc, `O que foi avaliado: ${PILLAR_ASSESSED[p]}`);
    paragraph(doc, `O que sugere: este eixo está ${band(dysByPillar[p])}${disf !== null ? ` (disfunção ${disf}%)` : ""}.`);
  }

  // ── Página 3 — plano amarrado aos eixos + próximos passos ──
  doc.addPage();
  docTitle(doc, "Plano de Cuidado", "Direção terapêutica amarrada aos eixos");
  if (map.priority_pillar) {
    paragraph(doc, `Foco inicial sugerido: eixo ${PILLAR_LABEL[map.priority_pillar]} (${PILLAR_HINT[map.priority_pillar]}), por apresentar o menor equilíbrio. O plano prioriza recuperar este eixo e, em paralelo, sustentar os demais.`);
  }
  sectionTitle(doc, "Próximos passos");
  paragraph(doc, "• Acompanhamento conforme o plano definido com o(a) profissional.");
  paragraph(doc, "• Reavaliação para medir a evolução do equilíbrio dos eixos ao longo do cuidado.");
  if (map.is_partial) paragraph(doc, "• Complementar a avaliação com os exames pendentes para uma leitura completa.");

  doc.moveDown(0.6);
  doc.font("Times-Italic").fontSize(9).fillColor("#9ca3af").text(
    "Este Mapa é uma ferramenta de comunicação de bem-estar funcional. Não é diagnóstico de doença nem promessa de cura. Sugere pontos que merecem acompanhamento profissional.",
    MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 },
  );

  return pdfToBuffer(doc);
}
