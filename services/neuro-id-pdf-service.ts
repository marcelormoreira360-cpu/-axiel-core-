/**
 * neuro-id-pdf-service.ts — PDF herói do Mapa Bio³ (≤4 páginas, timbrado).
 *
 * Conteúdo: pirâmide/eixos em DISFUNÇÃO (maior = pior) + índice geral + ponto de atenção;
 * por eixo (o que foi avaliado / o que revela, linguagem de cuidado);
 * plano amarrado aos eixos; próximos passos; disclaimer (bem-estar funcional).
 */

import PDFDocument from "pdfkit";
import type { NeuroMapaIntegrativo, NeuroPlanoRegulacao, NeuroProtocoloSuplementacao, NeuroRelatorioHipersensibilidade } from "@/lib/types";
import { hasPersuasiveDoc2, bio3ProseHasPercent } from "@/modules/ai-insights/patient-text-guardrails";
import type { NeuroPillar } from "@/modules/neuro-id/catalog";
import { bandForDysfunction, dysfunctionToBalance, labelFor } from "@/modules/neuro-id/bands";
import { pillarContributions } from "@/modules/neuro-id/scoring";
import { buildPatientReportCopy, copyBandForDysfunction, type CopyPillar } from "@/modules/neuro-id/report-copy";

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
  fisico: "Biomecânico", bioquimico: "Biofuncional", emocional: "Bioemocional",
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
  return "em grande disfunção e desequilíbrio (pede cuidado prioritário)";
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
  doc.save();
  // Faixa de rodapé com o MESMO gradiente do topo + o lema em branco centralizado
  // (espelha o papel timbrado do Neuro ID). Só desenha o lema se a clínica tiver
  // tagline configurada (report_tagline) — multi-tenant: outras clínicas põem o seu.
  const bandH = 22;
  const bandY = 792 - 30; // faixa no rodapé, com ~8pt de folga até a borda
  const grad = doc.linearGradient(MARGIN, 0, PAGE_W - MARGIN, 0);
  grad.stop(0, GRAD[0]).stop(0.5, GRAD[1]).stop(1, GRAD[2]);
  doc.roundedRect(MARGIN, bandY, CONTENT_W, bandH, 6).fill(grad);
  if (tagline) {
    // Escrever sobre a faixa (abaixo da margem inferior) sem disparar nova página:
    // zera margins.bottom durante o text() e restaura em seguida. Sem isto, texto
    // em y>margem força addPage → páginas em branco e o lema vaza para a próxima.
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      doc.font("Helvetica").fontSize(8).fillColor("#ffffff")
        .text(tagline.toUpperCase(), MARGIN, bandY + 7, { width: CONTENT_W, align: "center", characterSpacing: 1.6, lineBreak: false });
    } finally {
      doc.page.margins.bottom = prevBottom;
    }
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
  // Normaliza o espaço em branco antes de desenhar. O terapeuta às vezes digita
  // listas (ex.: "próximos passos" um por linha) e cola quebras de linha extras
  // no início; sem tratar, essas linhas vazias orfanavam o título da seção no
  // rodapé de uma página e empurravam o conteúdo real para a página seguinte
  // (o relatório parecia "sem próximo passo"). Remove linhas vazias no início/fim
  // e colapsa sequências de linhas em branco, preservando as quebras simples.
  const clean = (text ?? "").replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  if (!clean) return;
  // Multi-linha (lista) fica melhor alinhado à esquerda; justificar estica linhas
  // curtas ("Fazer Detox") de forma estranha. Prosa de linha única segue justificada.
  const align = clean.includes("\n") ? "left" : "justify";
  doc.font("Times-Roman").fontSize(10.5).fillColor(MUTED).text(clean, MARGIN, doc.y, { width: CONTENT_W, align, lineGap: 3 });
  doc.moveDown(0.4);
}
// Desenha um título de seção + parágrafo mantendo-os JUNTOS na mesma página.
// Mede a altura do corpo e reserva espaço para o título + o começo do texto antes
// de deixar o sectionTitle quebrar a página; senão o título ("PRÓXIMO PASSO") ficava
// órfão no rodapé de uma página com a lista sozinha na página seguinte (parecia que
// o título "sumia"). Lista longa ainda flui naturalmente depois das primeiras linhas.
function sectionWithBody(doc: Doc, title: string, text?: string | null) {
  const clean = (text ?? "").replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  if (!clean) return;
  doc.font("Times-Roman").fontSize(10.5);
  const bodyH = doc.heightOfString(clean, { width: CONTENT_W, align: clean.includes("\n") ? "left" : "justify", lineGap: 3 });
  // título (~30) + corpo, limitado a ~170 (mantém título + ~7 linhas juntos).
  ensureSpace(doc, Math.min(bodyH + 44, 170));
  sectionTitle(doc, title);
  paragraph(doc, clean);
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
  doc.font("Times-Italic").fillColor(MUTED).text(`  ${hint} · ${bandWord}${shareTxt}${isPriority ? "  ·  comece aqui (prioridade)" : ""}`);
  const pct = disf ?? 0;
  const balance = dysfunctionToBalance(dysfunction); // camada profissional vê os dois
  const barY = doc.y + 2;
  const barW = CONTENT_W - 60;
  doc.roundedRect(MARGIN, barY, barW, 8, 4).fill("#EFEDE7");
  if (disf !== null) doc.roundedRect(MARGIN, barY, (barW * pct) / 100, 8, 4).fill(color);
  // Preenchimento = DISFUNÇÃO (cor/estado). À direita: disfunção (destaque) + equilíbrio (apoio).
  doc.font("Times-Bold").fontSize(11).fillColor(textColor).text(disf === null ? "—" : `${disf}%`, MARGIN + barW + 8, barY - 5, { width: 48, align: "right" });
  doc.font("Times-Roman").fontSize(7).fillColor(MUTED).text(balance === null ? "" : `eq ${balance}%`, MARGIN + barW + 8, barY + 7, { width: 48, align: "right" });
  doc.y = barY + 18;
}

// Estrela vetorial de 5 pontas (marcador de prioridade). As fontes padrão
// (WinAnsi) NÃO têm o glifo ★ — desenhar como vetor evita o caractere quebrado.
function drawStar(doc: Doc, cx: number, cy: number, r: number, color: string) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    pts.push([cx + r * Math.cos(outer), cy + r * Math.sin(outer)]);
    pts.push([cx + r * 0.42 * Math.cos(inner), cy + r * 0.42 * Math.sin(inner)]);
  }
  doc.save();
  doc.polygon(...pts).fill(color);
  doc.restore();
}

// Pirâmide Bio³: 3 faixas coloridas pela banda de DISFUNÇÃO.
// Ordem fixa [ápice, meio, base] = [Biomecânico, Biofuncional, Bioemocional].
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
      drawStar(doc, cx, centersY[i] - 15, 5.5, txt);
    }
  });
  doc.lineWidth(1);
  doc.y = yBase + 12;
}

// Anel Bio³ Circular (equilíbrio) desenhado no pdfkit — espelha o componente da tela.
// Três fatias iguais (nome + % de EQUILÍBRIO), borda arredondada por estado, nós nas
// junções, boneco no centro. Cor pela banda da DISFUNÇÃO crua; número exibido = equilíbrio.
// items em [fisico, bioquimico, emocional]. Desenha centrado em (cx, cy); não move doc.y.
type RingItem = { dys: number | null; balance: number | null; label: string; isPriority: boolean };
function drawBio3Ring(doc: Doc, cx: number, cy: number, items: RingItem[]) {
  const OUTER = 60, INNER = 17, RIM = 57, CORE_R = 15, ANCHOR_R = 39, HALF = 55;
  const CENTERS = [30, 150, -90];
  const BOUNDARIES = [-30, 90, -150];
  const NEUTRAL_STROKE = "#C9C7BF";
  const pol = (r: number, a: number) => ({ x: cx + r * Math.cos((a * Math.PI) / 180), y: cy + r * Math.sin((a * Math.PI) / 180) });
  const wedge = (a0: number, a1: number) => {
    const oS = pol(OUTER, a0), oE = pol(OUTER, a1), iE = pol(INNER, a1), iS = pol(INNER, a0);
    const L = a1 - a0 > 180 ? 1 : 0;
    return `M${oS.x} ${oS.y} A${OUTER} ${OUTER} 0 ${L} 1 ${oE.x} ${oE.y} L${iE.x} ${iE.y} A${INNER} ${INNER} 0 ${L} 0 ${iS.x} ${iS.y} Z`;
  };
  const rim = (a0: number, a1: number) => {
    const s = pol(RIM, a0), e = pol(RIM, a1);
    const L = a1 - a0 > 180 ? 1 : 0;
    return `M${s.x} ${s.y} A${RIM} ${RIM} 0 ${L} 1 ${e.x} ${e.y}`;
  };

  items.forEach((d, i) => {
    const c = CENTERS[i];
    const bd = bandForDysfunction(d.dys);
    const fill = bd ? bd.colors.fill : "#E9E7E0";
    const stroke = bd ? bd.colors.stroke : "#D3D1C7";
    doc.save(); doc.path(wedge(c - HALF, c + HALF)).fill(fill); doc.restore();
    doc.save(); doc.lineWidth(d.isPriority ? 4 : 3).lineCap("round").path(rim(c - HALF, c + HALF)).stroke(stroke); doc.restore();
  });

  BOUNDARIES.forEach((b) => {
    const p = pol(RIM, b);
    doc.save(); doc.lineWidth(0.8).circle(p.x, p.y, 2.4).fillAndStroke("#FFFFFF", NEUTRAL_STROKE); doc.restore();
  });

  // núcleo: disco branco + anel pontilhado + rótulo "Você" (o paciente no centro dos 3 pilares)
  doc.save(); doc.circle(cx, cy, CORE_R).fill("#FFFFFF"); doc.restore();
  doc.save(); doc.lineWidth(0.7).dash(1.2, { space: 2 }).circle(cx, cy, CORE_R).stroke(NEUTRAL_STROKE); doc.undash(); doc.restore();
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#5B5952").text("Você", cx - CORE_R, cy - 3.5, { width: CORE_R * 2, align: "center" });

  // rótulos: nome + % de equilíbrio (pilha vertical na âncora da fatia)
  items.forEach((d, i) => {
    const c = CENTERS[i];
    const bd = bandForDysfunction(d.dys);
    const txt = bd ? bd.colors.text : "#9ca3af";
    const an = pol(ANCHOR_R, c);
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(txt).text(d.label, an.x - 34, an.y - 11, { width: 68, align: "center" });
    doc.font("Times-Bold").fontSize(13).fillColor(txt).text(d.balance === null ? "—" : `${d.balance}%`, an.x - 30, an.y - 1, { width: 60, align: "center" });
  });
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
  /** Demografia do cadastro (fonte única): idade/sexo/peso/altura/local. */
  demographics?: { idade?: string | null; sexo?: string | null; peso?: string | null; altura?: string | null; local?: string | null } | null;
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
    info: { Title: "Mapa Bio³ · Índice Neuro ID", Author: brand.name ?? "OXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  const contrib = pillarContributions(dysByPillar);

  // ── Página 1 — índice (herói) / pirâmide / ponto de atenção ──
  docTitle(doc, "Mapa Bio³", "Índice Bio · grau de disfunção por eixo (meta: baixar)");
  if (opts.patientName) { doc.font("Times-Roman").fontSize(11).fillColor(MUTED).text(`Paciente: ${opts.patientName}`, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.2); }
  {
    const d = opts.demographics;
    const demoLine = [d?.idade, d?.sexo, d?.peso, d?.altura, d?.local].map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");
    if (demoLine) { doc.font("Times-Italic").fontSize(9.5).fillColor("#9ca3af").text(demoLine, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.4); }
  }

  const generalDys = round(map.indice_geral);
  const generalBalance = dysfunctionToBalance(map.indice_geral); // camada profissional vê os dois
  const indexBand = bandForDysfunction(map.indice_geral);
  sectionTitle(doc, "Índice Bio · Grau de Disfunção");
  doc.font("Times-Bold").fontSize(34).fillColor(indexBand ? indexBand.colors.text : "#9ca3af")
    .text(generalDys === null ? "—" : `${generalDys}%`, MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  // Leitura dupla para o profissional: disfunção (clínica) + equilíbrio (o que o paciente vê).
  doc.font("Times-Roman").fontSize(9.5).fillColor(MUTED)
    .text(
      generalDys === null ? "" : `Disfunção ${generalDys}%  ·  Equilíbrio ${generalBalance}% (o número que o paciente vê)`,
      MARGIN, doc.y + 1, { width: CONTENT_W, align: "center" },
    );
  if (indexBand) {
    doc.font("Times-Italic").fontSize(11).fillColor(indexBand.colors.text)
      .text(`${labelFor(indexBand.key, "axis")}: ${band(map.indice_geral)}`, MARGIN, doc.y + 2, { width: CONTENT_W, align: "center" });
  }
  doc.moveDown(0.3);
  if (map.priority_pillar) {
    paragraph(doc, `Comece aqui: ${PILLAR_LABEL[map.priority_pillar]} (${PILLAR_HINT[map.priority_pillar]}). É o eixo de MAIOR disfunção e onde o cuidado tende a gerar mais resultado.`);
  }
  if (map.is_partial) {
    doc.font("Times-Italic").fontSize(9.5).fillColor("#9a7b2f").text("Leitura parcial: alguns dados (ex.: exames) ainda não foram incluídos. Recomenda-se complementar a avaliação.", MARGIN, doc.y, { width: CONTENT_W });
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
    sectionTitle(doc, `${PILLAR_LABEL[p]} · ${PILLAR_HINT[p]}`);
    paragraph(doc, `O que foi avaliado: ${PILLAR_ASSESSED[p]}`);
    paragraph(doc, `O que sugere: este eixo está ${band(dysByPillar[p])}${disf !== null ? ` (disfunção ${disf}%)` : ""}.`);
  }

  // ── Página 3 — plano amarrado aos eixos + próximos passos ──
  doc.addPage();
  docTitle(doc, "Plano de Cuidado", "Direção terapêutica amarrada aos eixos");
  if (map.priority_pillar) {
    paragraph(doc, `Foco inicial sugerido: eixo ${PILLAR_LABEL[map.priority_pillar]} (${PILLAR_HINT[map.priority_pillar]}), por apresentar a maior disfunção. O plano prioriza recuperar este eixo e, em paralelo, sustentar os demais.`);
  }
  sectionTitle(doc, "Próximos passos");
  paragraph(doc, "• Acompanhamento conforme o plano definido com o(a) profissional.");
  paragraph(doc, "• Reavaliação para medir a evolução da disfunção dos eixos ao longo do cuidado.");
  if (map.is_partial) paragraph(doc, "• Complementar a avaliação com os exames pendentes para uma leitura completa.");

  doc.moveDown(0.6);
  doc.font("Times-Italic").fontSize(9).fillColor("#9ca3af").text(
    "Este Mapa é uma ferramenta de comunicação de bem-estar funcional. Não é diagnóstico de doença nem promessa de cura. Sugere pontos que merecem acompanhamento profissional.",
    MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 },
  );

  return pdfToBuffer(doc);
}

const COPY_HINT: Record<NeuroPillar, string> = {
  fisico: "corpo & movimento",
  bioquimico: "energia & química interna",
  emocional: "mente & emoção",
};

/**
 * Versão PACIENTE (persuasiva-ética, 7 beats) — `_BRIEF_BIO3_RELATORIO_PERSUASIVO`.
 * Consome apenas os scores existentes; a copy vem de report-copy.ts (Aval/Termo).
 * A versão clínica interna é a buildNeuroIdMapPdf (acima), preservada.
 */
export async function buildNeuroIdPatientReportPdf(opts: {
  map: NeuroIdPdfMap;
  patientName?: string | null;
  clinic?: ClinicBrand;
  vars?: { q1?: string | null; q2?: string | null; sintoma?: string | null };
  showSafeguard?: boolean;
}): Promise<Buffer> {
  const { map } = opts;
  const brand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);
  const dysByPillar: Record<NeuroPillar, number | null> = {
    fisico: map.fisico_pct, bioquimico: map.bioquimico_pct, emocional: map.emocional_pct,
  };
  const pillar: CopyPillar = (map.priority_pillar ?? "emocional") as CopyPillar;
  const band = copyBandForDysfunction(map.indice_geral);
  const indice = map.indice_geral === null ? 0 : Math.round(map.indice_geral);
  const equilibrio = dysfunctionToBalance(map.indice_geral) ?? 0; // número exibido ao paciente
  const showSafeguard = opts.showSafeguard ?? ((map.emocional_pct ?? 0) >= 70);

  const copy = buildPatientReportCopy({
    band, pillar, showSafeguard,
    vars: {
      nome: (opts.patientName ?? "").split(" ")[0] || "Olá",
      indice,
      equilibrio,
      pilar: PILLAR_LABEL[pillar],
      hint: COPY_HINT[pillar],
      q1: opts.vars?.q1 ?? null,
      q2: opts.vars?.q2 ?? null,
      sintoma: opts.vars?.sintoma ?? null,
    },
  });

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: "Mapa Bio³ · Seu Relatório", Author: brand.name ?? "OXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  // Página 1 — abertura + retrato (índice herói + pirâmide)
  docTitle(doc, "Mapa Bio³", "Seu relatório de bem-estar funcional");
  sectionTitle(doc, copy.beats[0].title);
  paragraph(doc, copy.beats[0].body);

  sectionTitle(doc, copy.beats[1].title);
  const indexBand = bandForDysfunction(map.indice_geral); // cor/estado vêm da disfunção crua
  doc.font("Times-Bold").fontSize(34).fillColor(indexBand ? indexBand.colors.text : "#9ca3af")
    .text(map.indice_geral === null ? "—" : `${equilibrio}%`, MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  doc.font("Times-Italic").fontSize(9).fillColor(MUTED)
    .text("Índice Bio³ de equilíbrio · maior = melhor", MARGIN, doc.y + 1, { width: CONTENT_W, align: "center" });
  ensureSpace(doc, 170);
  const ringCy = doc.y + 64;
  drawBio3Ring(doc, PAGE_W / 2, ringCy, [
    { dys: dysByPillar.fisico, balance: dysfunctionToBalance(dysByPillar.fisico), label: PILLAR_LABEL.fisico, isPriority: map.priority_pillar === "fisico" },
    { dys: dysByPillar.bioquimico, balance: dysfunctionToBalance(dysByPillar.bioquimico), label: PILLAR_LABEL.bioquimico, isPriority: map.priority_pillar === "bioquimico" },
    { dys: dysByPillar.emocional, balance: dysfunctionToBalance(dysByPillar.emocional), label: PILLAR_LABEL.emocional, isPriority: map.priority_pillar === "emocional" },
  ]);
  doc.y = ringCy + 66;
  doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af")
    .text("Solto = em bom equilíbrio · Tenso = merece atenção · Bloqueado = prioridade de cuidado", MARGIN, doc.y, { width: CONTENT_W, align: "center" });
  doc.moveDown(0.3);
  paragraph(doc, copy.beats[1].body);

  // Página 2 — significado + por onde começar + autoridade
  doc.addPage();
  sectionTitle(doc, copy.beats[2].title);
  paragraph(doc, copy.beats[2].body);
  sectionTitle(doc, copy.beats[3].title);
  paragraph(doc, copy.beats[3].body);
  doc.moveDown(0.2);
  doc.font("Times-Italic").fontSize(9.5).fillColor(MUTED).text(copy.authority, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });

  // Página 3 — caminho + trajetória + próximo passo + prova/disclaimer/salvaguarda
  doc.addPage();
  sectionTitle(doc, copy.beats[4].title);
  paragraph(doc, copy.beats[4].body);
  sectionTitle(doc, copy.beats[5].title);
  paragraph(doc, copy.beats[5].body);
  sectionTitle(doc, copy.beats[6].title);
  paragraph(doc, copy.beats[6].body);
  doc.moveDown(0.2);
  doc.font("Times-Italic").fontSize(9.5).fillColor(MUTED).text(copy.socialProof, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });

  if (copy.safeguard) {
    doc.moveDown(0.5);
    doc.font("Times-Bold").fontSize(9.5).fillColor("#8A3216").text(copy.safeguard, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }
  doc.moveDown(0.5);
  doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af").text(copy.disclaimer, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });

  return pdfToBuffer(doc);
}

// Rótulos fixos das seções do Doc 1 no PDF. O PDF é PT (como buildNeuroIdMapPdf);
// o CONTEÚDO das seções segue o idioma gerado pela IA. i18n do PDF é follow-up.
const DOC1_LABELS = {
  s1: "1.  Antes de tudo, uma palavra para você",
  s2: "2.  Como está o seu equilíbrio hoje",
  s3: "3.  O que a avaliação encontrou",
  // Sub-números 3.x atribuídos DINAMICAMENTE no render (evita "3.2" órfão quando só há biorressonância).
  neurometric: "Como o seu sistema nervoso está funcionando (Exame de Neurometria)",
  emotional: "A sua leitura emocional (Exame de Biorressonância)",
  s4: "4.  A conexão, e um ponto de força",
  anchor: "Um ponto forte a seu favor",
  s5: "5.  Por que começar agora é a melhor opção",
  s6: "6.  Os próximos passos",
  nextStep: "Próximo passo",
};

const DOC2_LABELS = {
  goal: "Aonde vamos juntos",
  pillars: "As três frentes do cuidado",
  pillarNervous: "Sistema nervoso",
  pillarEmotional: "Emoções",
  pillarLifestyle: "Estilo de vida",
  howWeWalk: "Como caminhamos juntos",
  nextStep: "Próximo passo",
};

/**
 * Texto do retrato Bio³ (seção 2). Se a prosa da IA trouxer percentuais (relatório ANTIGO,
 * pré-equilíbrio), CONTRADIZ o anel → troca por uma frase qualitativa determinística, sem número.
 * Prosa nova (sem %) passa intacta.
 */
function bio3PortraitPtText(descricao: string | null | undefined, priorityPillar: NeuroPillar | null): string {
  if (descricao && descricao.trim() && !bio3ProseHasPercent(descricao)) return descricao;
  if (priorityPillar) {
    return `Hoje, o eixo que mais pede o seu cuidado é o ${PILLAR_LABEL[priorityPillar]}; os outros dois já estão em bom equilíbrio e trabalham a seu favor.`;
  }
  return "Veja ao lado como estão os três pilares que compõem o seu Mapa Bio³: quais estão mais equilibrados e qual pede mais cuidado.";
}

/** Rótulo de ESTADO patient-facing (equilíbrio) por faixa da disfunção crua. */
function balanceStatePt(dysfunction: number | null): string {
  const bd = bandForDysfunction(dysfunction);
  if (!bd) return "";
  if (bd.key === "solto") return "Bom equilíbrio";
  if (bd.key === "tenso") return "Requer atenção";
  return "Prioridade de cuidado";
}

/**
 * PDF do Documento 1 persuasivo (Rota A) alimentado pelas 8 seções do Doc 1
 * APROVADO (final_output.mapa_integrativo), não mais por scores. Reaproveita
 * header/footer/pirâmide/branding. Fonte única de verdade = Doc 1 aprovado;
 * a versão por scores (buildNeuroIdPatientReportPdf) fica como fallback enquanto
 * não houver Doc 1 aprovado no formato novo.
 */
// Salvaguarda de saúde mental — DETERMINÍSTICA (gate Salvo): renderizada pelo código, nunca
// dependente do texto da IA. Linha de crise BR+US (sempre um número válido, independe de país/idioma).
const DOC1_SAFEGUARD =
  "Acompanhamento de um profissional de saúde mental é fortemente recomendado, junto do seu médico. " +
  "Se você tiver pensamentos de se machucar, procure ajuda imediata: no Brasil, ligue 188 (CVV, 24 horas) " +
  "ou 192 (SAMU); nos EUA, ligue ou envie mensagem para 988 (Suicide & Crisis Lifeline) ou 911. " +
  "Você não está sozinho(a), e há pessoas prontas para te ouvir.";

export async function buildNeuroIdDoc1Pdf(opts: {
  mapa: NeuroMapaIntegrativo;
  bio3?: NeuroIdPdfMap | null;
  /** Doc 2 (Plano) aprovado; quando persuasivo, é anexado como 2ª parte do mesmo PDF. */
  plano?: NeuroPlanoRegulacao | null;
  patientName?: string | null;
  clinic?: ClinicBrand;
  /** Salvaguarda emocional determinística (encaminhamento + linha de crise). Calculada no server
   *  a partir da disfunção/flags CRUAS (needsEmotionalSafeguard), nunca do texto da IA. */
  showSafeguard?: boolean;
}): Promise<Buffer> {
  const { mapa } = opts;
  const brand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: "Relatório Funcional Integrado", Author: brand.name ?? "AXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  docTitle(doc, "Relatório Neuro ID", "Resultado da sua Avaliação Neuro ID");

  const id = mapa.identificacao;
  const idParts = [
    // Nome completo vem do CADASTRO (opts.patientName), não do eco da IA — a IA recebe só
    // o primeiro nome (minimização de PHI), então o cadastro é a fonte do nome exibido.
    opts.patientName ?? id?.paciente ?? null,
    id?.idade ? `Idade: ${id.idade}` : null,
    id?.data_avaliacoes ? `Data: ${id.data_avaliacoes}` : null,
  ].filter(Boolean) as string[];
  if (idParts.length > 0) {
    doc.font("Times-Italic").fontSize(10).fillColor(MUTED).text(idParts.join("   |   "), MARGIN, doc.y, { width: CONTENT_W, align: "center" });
    doc.moveDown(0.5);
  }

  // ── Documento 1 fundido, em seções numeradas (1..6) ──
  // 1
  sectionTitle(doc, DOC1_LABELS.s1);
  paragraph(doc, mapa.abertura_calorosa);

  // 2 — Como está o seu equilíbrio hoje. ESQUERDA: herói do índice de equilíbrio + prosa
  // qualitativa + breakdown dos 3 pilares (% + rótulo de estado). DIREITA: Anel Bio³.
  // Doutrina dupla linguagem: paciente vê EQUILÍBRIO (100 − disfunção, maior = melhor); TODOS os
  // números vêm do mapa (código), a prosa da IA fica qualitativa; cor/estado da DISFUNÇÃO crua.
  sectionTitle(doc, DOC1_LABELS.s2);
  const bio3 = opts.bio3;
  if (bio3) {
    ensureSpace(doc, 210);
    const topY = doc.y;
    const leftW = Math.round(CONTENT_W * 0.54);
    const gap = 20;
    const rightX = MARGIN + leftW + gap;
    const rightW = CONTENT_W - leftW - gap;
    const dysByP: Record<NeuroPillar, number | null> = { fisico: bio3.fisico_pct, bioquimico: bio3.bioquimico_pct, emocional: bio3.emocional_pct };

    // Herói do índice de equilíbrio
    const geralBal = dysfunctionToBalance(bio3.indice_geral);
    const idxBand = bandForDysfunction(bio3.indice_geral);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("SEU ÍNDICE DE EQUILÍBRIO", MARGIN, topY, { width: leftW, characterSpacing: 1 });
    doc.font("Times-Bold").fontSize(38).fillColor(idxBand ? idxBand.colors.text : "#9ca3af").text(geralBal === null ? "—" : `${geralBal}%`, MARGIN, doc.y - 2, { width: leftW });
    doc.font("Times-Italic").fontSize(9).fillColor(MUTED).text("no seu Mapa Bio³ · maior = melhor", MARGIN, doc.y, { width: leftW });
    doc.moveDown(0.5);

    // Prosa qualitativa (guardada, sem número)
    doc.font("Times-Roman").fontSize(10.5).fillColor(INK).text(bio3PortraitPtText(mapa.leitura_bio3?.descricao, bio3.priority_pillar), MARGIN, doc.y, { width: leftW, align: "justify", lineGap: 2 });
    doc.moveDown(0.5);

    // Breakdown dos 3 pilares, ordenado por disfunção desc (o que mais pede cuidado primeiro)
    const ordered = (["fisico", "bioquimico", "emocional"] as NeuroPillar[]).slice().sort((a, b) => (dysByP[b] ?? 0) - (dysByP[a] ?? 0));
    for (const p of ordered) {
      const dys = dysByP[p];
      const bal = dysfunctionToBalance(dys);
      const bd = bandForDysfunction(dys);
      const isPriority = bio3.priority_pillar === p;
      const ry = doc.y;
      doc.save(); doc.circle(MARGIN + 4, ry + 6, 4).fill(bd ? bd.colors.fill : "#E9E7E0"); doc.restore();
      doc.font(isPriority ? "Times-Bold" : "Times-Roman").fontSize(11).fillColor(INK).text(PILLAR_LABEL[p], MARGIN + 16, ry, { continued: true });
      doc.font("Times-Bold").fillColor(bd ? bd.colors.text : "#9ca3af").text(`   ${bal === null ? "—" : `${bal}%`}`, { continued: false });
      doc.font("Times-Italic").fontSize(9).fillColor(isPriority ? "#8A5A14" : MUTED).text(balanceStatePt(dys), MARGIN + 16, doc.y - 1, { width: leftW - 16 });
      doc.moveDown(0.45);
    }
    doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af").text("Quanto maior a porcentagem, maior o equilíbrio.", MARGIN, doc.y + 2, { width: leftW });
    const leftBottom = doc.y;

    // Anel Bio³ à direita (ordem canônica; "Você" no centro; cor da disfunção crua)
    const ringCy = topY + 88;
    drawBio3Ring(doc, rightX + rightW / 2, ringCy, [
      { dys: bio3.fisico_pct, balance: dysfunctionToBalance(bio3.fisico_pct), label: PILLAR_LABEL.fisico, isPriority: bio3.priority_pillar === "fisico" },
      { dys: bio3.bioquimico_pct, balance: dysfunctionToBalance(bio3.bioquimico_pct), label: PILLAR_LABEL.bioquimico, isPriority: bio3.priority_pillar === "bioquimico" },
      { dys: bio3.emocional_pct, balance: dysfunctionToBalance(bio3.emocional_pct), label: PILLAR_LABEL.emocional, isPriority: bio3.priority_pillar === "emocional" },
    ]);
    doc.y = Math.max(leftBottom, ringCy + 66) + 8;
  } else {
    paragraph(doc, bio3PortraitPtText(mapa.leitura_bio3?.descricao, null));
  }

  // 3 — neurometria e biorressonância, SEPARADAS e condicionais. Sub-número DINÂMICO:
  // só um exame presente vira "3.1" (nunca "3.2" órfão).
  sectionTitle(doc, DOC1_LABELS.s3);
  const readings = (mapa.leitura_neurometrica ?? []).filter((it) => it.titulo || it.descricao);
  let sub3 = 0;
  if (readings.length > 0) {
    sub3 += 1;
    sectionTitle(doc, `3.${sub3}  ${DOC1_LABELS.neurometric}`);
    for (const it of readings) {
      ensureSpace(doc, 50);
      if (it.titulo) { doc.font("Times-Bold").fontSize(10.5).fillColor(INK).text(it.titulo, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.15); }
      paragraph(doc, it.descricao);
    }
  }
  const bio = mapa.leitura_bioemocional;
  if (bio && ((bio.temas?.length ?? 0) > 0 || bio.sintese?.trim())) {
    sub3 += 1;
    sectionTitle(doc, `3.${sub3}  ${DOC1_LABELS.emotional}`);
    if (bio.temas?.length) {
      doc.font("Times-Italic").fontSize(10).fillColor(INK).text(bio.temas.join("  ·  "), MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.3);
    }
    paragraph(doc, bio.sintese);
  }

  // 4 — conexão + ponto de força
  sectionTitle(doc, DOC1_LABELS.s4);
  if (mapa.conexao_aha?.trim()) paragraph(doc, mapa.conexao_aha);
  if (mapa.ancora_positiva?.trim()) {
    ensureSpace(doc, 60);
    doc.font("Times-Bold").fontSize(10.5).fillColor("#0F6E56").text(DOC1_LABELS.anchor, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.15);
    paragraph(doc, mapa.ancora_positiva);
  }

  // 5
  sectionTitle(doc, DOC1_LABELS.s5);
  paragraph(doc, mapa.porque_agir_agora);

  // 6 — os próximos passos (fecho). Com plano persuasivo, ele é o conteúdo; senão, o próximo passo do mapa.
  const plano = opts.plano ?? null;
  const planoPersuasivo = hasPersuasiveDoc2(plano);
  sectionTitle(doc, DOC1_LABELS.s6);
  if (!planoPersuasivo) {
    if (mapa.proximo_passo?.trim()) paragraph(doc, mapa.proximo_passo);
    const disclaimer = mapa.observacao?.trim() || "Este documento não substitui avaliação médica, diagnóstico, exames laboratoriais ou condutas já prescritas.";
    doc.moveDown(0.5);
    doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af").text(disclaimer, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }

  // ── PRÓXIMOS PASSOS (conteúdo da seção 6, o plano) — em continuação, sem novo título de documento ──
  if (planoPersuasivo && plano) {
    if (plano.onde_queremos_chegar?.trim()) { paragraph(doc, plano.onde_queremos_chegar); }
    if (plano.tres_pilares) {
      sectionTitle(doc, DOC2_LABELS.pillars);
      const tp = plano.tres_pilares;
      const pilar = (label: string, text?: string | null) => {
        if (!text || !text.trim()) return;
        ensureSpace(doc, 46);
        doc.font("Times-Bold").fontSize(10.5).fillColor(INK).text(label, MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.1);
        paragraph(doc, text);
      };
      pilar(DOC2_LABELS.pillarNervous, tp.nervoso);
      pilar(DOC2_LABELS.pillarEmotional, tp.emocional);
      pilar(DOC2_LABELS.pillarLifestyle, tp.estilo_de_vida);
    }
    if (plano.como_caminhar_juntos?.trim()) { sectionWithBody(doc, DOC2_LABELS.howWeWalk, plano.como_caminhar_juntos); }
    if (plano.proximo_passo?.trim()) { sectionWithBody(doc, DOC2_LABELS.nextStep, plano.proximo_passo); }
    const disc2 = plano.observacao?.trim() || "Este plano não substitui avaliação médica, exames laboratoriais ou condutas já prescritas.";
    doc.moveDown(0.5);
    doc.font("Times-Italic").fontSize(8.5).fillColor("#9ca3af").text(disc2, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }

  // Salvaguarda de saúde mental — SEMPRE renderizada pelo código quando o sinal cru dispara,
  // independentemente do que a IA escreveu (o tom de equilíbrio não pode suprimir o encaminhamento).
  if (opts.showSafeguard) {
    ensureSpace(doc, 70);
    doc.moveDown(0.5);
    doc.font("Times-Bold").fontSize(9.5).fillColor("#8A3216").text(DOC1_SAFEGUARD, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
  }

  return pdfToBuffer(doc);
}

// ── DOCUMENTO 3 — Protocolo de Suplementação (documento próprio, envio separado) ──
// Bilíngue por país do paciente: BR = FÓRMULA MANIPULADA (ativos + dose + forma, sem
// marca, sem link, para farmácia de manipulação); US = suplementos (nome/forma/como
// tomar, sem marca) com o link de compra do profissional + aviso de que o link é
// apenas uma sugestão. O link nunca é gerado pela IA (vem do editor/catálogo).
const SUPP_STRINGS = {
  BR: {
    title: "Protocolo de Suplementação",
    subtitle: "Fórmula para manipulação",
    draft: "Rascunho — exige aprovação do profissional antes de qualquer uso.",
    intro: "Fórmula sugerida para manipulação. Leve esta orientação à sua farmácia de manipulação de confiança; o profissional pode ajustá-la.",
    lForm: "Forma", lDose: "Dose sugerida", lHow: "Como tomar", lGoal: "Objetivo", lNote: "Obs.",
    general: "Observações gerais",
  },
  US: {
    title: "Supplement Protocol",
    subtitle: "Suggestions for professional validation",
    draft: "Draft — requires professional approval before any use.",
    intro: "",
    lForm: "Form", lDose: "Suggested dose", lHow: "How to take", lGoal: "Goal", lNote: "Note",
    general: "General notes",
    storeLabel: "Where to buy",
    disclaimer:
      "The supplements above can be found in our online store (one link, same trusted brand). This is only a purchase suggestion: you are free to buy wherever you prefer, paying attention to the quality and dose of each supplement.",
  },
} as const;

export async function buildNeuroIdSupplementPdf(opts: {
  protocolo: NeuroProtocoloSuplementacao;
  country: "BR" | "US";
  patientName?: string | null;
  clinic?: ClinicBrand;
  /** EUA: link ÚNICO da loja/dispensário (o paciente clica um só link). */
  storeUrl?: string | null;
}): Promise<Buffer> {
  const s = SUPP_STRINGS[opts.country];
  const brand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);
  // Brasil com fórmulas manipuladas → "Plano de Suplementação" rico (cuidados + fórmulas).
  const brRich = opts.country === "BR" && !!opts.protocolo.formulas?.length;

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: s.title, Author: brand.name ?? "AXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  docTitle(doc, brRich ? "Seu Plano de Suplementação" : s.title, brRich ? "Cuidado integrativo, feito para você · Neuro ID" : s.subtitle);

  if (opts.patientName) {
    doc.font("Times-Italic").fontSize(10).fillColor(MUTED).text(opts.patientName, MARGIN, doc.y, { width: CONTENT_W, align: "center" });
    doc.moveDown(0.4);
  }

  doc.font("Times-Italic").fontSize(9.5).fillColor("#8A5A14").text(s.draft, MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.5);

  // ── BRASIL: Plano de Suplementação rico (fórmulas manipuladas) ──
  if (brRich) {
    const p = opts.protocolo;
    const tealTitle = (title: string) => {
      // Quebra pela margem inferior REAL (~692) para o título não colar no rodapé nem
      // se soltar do próximo parágrafo. moveDown antes; se estourar, vira a página.
      doc.moveDown(0.4);
      if (doc.y > 792 - BOTTOM - 40) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(13).fillColor(TEAL).text(title, MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.3);
    };
    if (p.intro) paragraph(doc, p.intro);
    if (p.cuidados?.length) {
      tealTitle("O que vamos cuidar, e por quê");
      for (const c of p.cuidados) {
        if (!c.titulo?.trim() && !c.texto?.trim()) continue;
        ensureSpace(doc, 40);
        if (c.titulo?.trim()) doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEAL).text(c.titulo.trim(), MARGIN, doc.y, { width: CONTENT_W });
        if (c.texto?.trim()) { doc.moveDown(0.1); doc.font("Times-Roman").fontSize(10.5).fillColor(MUTED).text(c.texto.trim(), MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 }); }
        doc.moveDown(0.3);
      }
    }
    tealTitle("Suas fórmulas, para levar à farmácia");
    doc.font("Times-Italic").fontSize(9.5).fillColor(MUTED).text("Esta é a sua receita de manipulação: pontos de partida a ajustar pelo profissional conforme os exames e a sua tolerância.", MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
    doc.moveDown(0.4);
    for (const f of p.formulas ?? []) {
      if (!f.nome?.trim() && !f.composicao?.length) continue;
      const estH = 48 + (f.composicao?.length ?? 0) * 14 + (f.posologia ? 24 : 0);
      ensureSpace(doc, Math.min(estH, 200));
      const top = doc.y;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEAL).text(f.nome?.trim() || "Fórmula", MARGIN + 10, top + 8, { width: CONTENT_W - 20 });
      doc.moveDown(0.2);
      if (f.composicao?.length) {
        doc.font("Times-Bold").fontSize(9.5).fillColor(INK).text("Composição:", MARGIN + 10, doc.y, { width: CONTENT_W - 20 });
        for (const c of f.composicao) {
          if (!c.ativo?.trim()) continue;
          ensureSpace(doc, 16);
          const q = c.quantidade?.trim() ? ` — ${c.quantidade.trim()}` : "";
          doc.font("Times-Roman").fontSize(9.5).fillColor(MUTED).text(`•  ${c.ativo.trim()}${q}`, MARGIN + 16, doc.y, { width: CONTENT_W - 32, lineGap: 1 });
        }
        if (f.excipiente?.trim()) doc.font("Times-Roman").fontSize(9.5).fillColor(MUTED).text(`•  ${f.excipiente.trim()}`, MARGIN + 16, doc.y, { width: CONTENT_W - 32, lineGap: 1 });
      }
      if (f.posologia?.trim()) {
        ensureSpace(doc, 20);
        doc.font("Times-Bold").fontSize(9.5).fillColor(INK).text("Posologia: ", MARGIN + 10, doc.y, { continued: true });
        doc.font("Times-Roman").fillColor(MUTED).text(f.posologia.trim() + (f.duracao?.trim() ? `  Duração: ${f.duracao.trim()}.` : ""), { width: CONTENT_W - 20 });
      } else if (f.duracao?.trim()) {
        doc.font("Times-Bold").fontSize(9.5).fillColor(INK).text("Duração: ", MARGIN + 10, doc.y, { continued: true });
        doc.font("Times-Roman").fillColor(MUTED).text(f.duracao.trim(), { width: CONTENT_W - 20 });
      }
      // moldura da fórmula
      doc.rect(MARGIN, top, CONTENT_W, doc.y - top + 8).strokeColor("#CFE3DC").lineWidth(0.8).stroke();
      doc.y = top + (doc.y - top) + 8;
      doc.moveDown(0.6);
    }
    if (opts.protocolo.observacoes_gerais?.length) {
      tealTitle("Cuidando de você com segurança");
      for (const o of opts.protocolo.observacoes_gerais) {
        if (!o?.trim()) continue;
        ensureSpace(doc, 24);
        doc.font("Times-Roman").fontSize(10).fillColor(MUTED).text(`•  ${o.trim()}`, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
        doc.moveDown(0.1);
      }
    }
    if (opts.protocolo.proximos_passos?.trim()) {
      tealTitle("Seus próximos passos");
      paragraph(doc, opts.protocolo.proximos_passos);
    }
    return pdfToBuffer(doc);
  }

  if (s.intro) paragraph(doc, s.intro);

  const line = (label: string, value?: string | null) => {
    if (!value?.trim()) return;
    ensureSpace(doc, 24);
    doc.font("Times-Bold").fontSize(10).fillColor(INK).text(`${label}: `, MARGIN, doc.y, { continued: true });
    doc.font("Times-Roman").fillColor(MUTED).text(value.trim());
  };

  for (const it of opts.protocolo.itens) {
    if (!it.nome?.trim()) continue;
    ensureSpace(doc, 60);
    doc.moveDown(0.3);
    doc.font("Times-Bold").fontSize(11.5).fillColor(INK).text(it.nome.trim(), MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.1);
    // Documento ao paciente: só nome + forma + dose + como tomar (sem "Objetivo"/"Obs.").
    line(s.lForm, it.forma);
    line(s.lDose, it.dose_sugerida);
    line(s.lHow, it.como_tomar);
  }

  // EUA: UM único link da loja no fim (todos os suplementos no mesmo dispensário),
  // com o aviso uma vez só. storeUrl vem do chamador; fallback: deriva do buy_url de
  // um item (tira o "/products/<slug>"). Sem link → não mostra a seção de compra.
  if (opts.country === "US") {
    const us = SUPP_STRINGS.US;
    const fromItem = opts.protocolo.itens.find((it) => it.buy_url?.trim())?.buy_url?.trim();
    const store = (opts.storeUrl?.trim() || (fromItem ? fromItem.split("/products/")[0] : "")).trim();
    if (store) {
      doc.moveDown(0.5);
      doc.font("Times-Italic").fontSize(8.5).fillColor("#6B6A66").text(us.disclaimer, MARGIN, doc.y, { width: CONTENT_W, align: "justify", lineGap: 2 });
      doc.moveDown(0.2);
      doc.font("Times-Bold").fontSize(10).fillColor(INK).text(`${us.storeLabel}: `, MARGIN, doc.y, { continued: true });
      doc.font("Times-Roman").fillColor("#2f5fae").text(store, { link: store, underline: true });
    }
  }

  if (opts.protocolo.observacoes_gerais?.length) {
    sectionTitle(doc, s.general);
    for (const o of opts.protocolo.observacoes_gerais) {
      if (!o?.trim()) continue;
      ensureSpace(doc, 24);
      doc.font("Times-Roman").fontSize(10).fillColor(MUTED).text(`• ${o.trim()}`, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.15);
    }
  }

  return pdfToBuffer(doc);
}

// ── DOCUMENTO 3 — Relatório de Hipersensibilidade (exame de cabelo; documento próprio) ──
// Só existe quando o paciente fez o teste capilar. NÃO carrega suplemento (aponta p/ Doc 2).
// Linguagem prudente: reatividade ≠ alergia/diagnóstico.
const TEAL = "#0F6E56";
const HYPER_STRINGS = {
  BR: {
    title: "Relatório Integrativo de Hipersensibilidade",
    subtitle: "Análise funcional baseada no exame de cabelo (biorressonância) e protocolo Neuro ID",
    draft: "Rascunho — exige aprovação do profissional antes de qualquer uso.",
    important: "Importante",
    s1: "1. Visão geral do caso",
    mainFindings: "Principais achados",
    priority: "Prioridade funcional",
    s2: "2. Padrões identificados",
    colPattern: "Padrão Neuro ID", colInterp: "Interpretação funcional",
    s3: "3. Resultados principais do exame",
    s31: "3.1 Achados prioritários",
    colArea: "Área", colFindings: "Achados", colPriority: "Prioridade",
    s32: "3.2 Lista operacional de retirada",
    removalHigh: "Retirar — alta prioridade",
    removalModerate: "Evitar/reduzir na fase inicial — reatividade moderada",
    s4: "4. Relação com o sistema nervoso e identidade corporal",
    s5: "5. Estratégia terapêutica em fases",
    colPhase: "Fase", colConduct: "Conduta",
    s6: "6. Plano alimentar prático",
    s7: "7. Implicações para a suplementação",
    support: "O que o exame sugere apoiar (detalhado no Documento 2)",
    attention: "Pontos de atenção",
    s8: "8. Monitoramento e reavaliação",
    s9: "9. Resumo executivo para o paciente",
    annex: "Anexo — Diário simplificado de reintrodução",
    colDate: "Data", colFood: "Alimento testado", colQty: "Quantidade", colSymptoms: "Sintomas 0–72h", colAction: "Conduta",
    pointer: "A suplementação, quando houver, está no Documento 2 (Protocolo de Suplementação).",
    footer: "Relatório educativo e integrativo — não substitui diagnóstico ou acompanhamento médico.",
  },
  US: {
    title: "Integrative Hypersensitivity Report",
    subtitle: "Functional analysis based on the hair test (bioresonance) and Neuro ID protocol",
    draft: "Draft — requires professional approval before any use.",
    important: "Important",
    s1: "1. Case overview",
    mainFindings: "Main findings",
    priority: "Functional priority",
    s2: "2. Identified patterns",
    colPattern: "Neuro ID pattern", colInterp: "Functional interpretation",
    s3: "3. Main test results",
    s31: "3.1 Priority findings",
    colArea: "Area", colFindings: "Findings", colPriority: "Priority",
    s32: "3.2 Operational removal list",
    removalHigh: "Remove — high priority",
    removalModerate: "Avoid/reduce in the initial phase — moderate reactivity",
    s4: "4. Relationship with the nervous system and body identity",
    s5: "5. Phased therapeutic strategy",
    colPhase: "Phase", colConduct: "Approach",
    s6: "6. Practical meal plan",
    s7: "7. Implications for supplementation",
    support: "What the test suggests supporting (detailed in Document 2)",
    attention: "Points of attention",
    s8: "8. Monitoring and reassessment",
    s9: "9. Executive summary for the patient",
    annex: "Appendix — Simplified reintroduction diary",
    colDate: "Date", colFood: "Food tested", colQty: "Amount", colSymptoms: "Symptoms 0–72h", colAction: "Action",
    pointer: "Supplementation, when applicable, is in Document 2 (Supplement Protocol).",
    footer: "Educational and integrative report — does not replace diagnosis or medical care.",
  },
} as const;

export async function buildNeuroIdHypersensitivityPdf(opts: {
  relatorio: NeuroRelatorioHipersensibilidade;
  country: "BR" | "US";
  patientName?: string | null;
  clinic?: ClinicBrand;
}): Promise<Buffer> {
  const s = HYPER_STRINGS[opts.country];
  const r = opts.relatorio;
  const brand = opts.clinic ?? {};
  const logo = await fetchLogo(brand.logoUrl);

  const doc = new PDFDocument({
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    size: "LETTER",
    info: { Title: s.title, Author: brand.name ?? "AXIEL Core" },
  });
  let decorating = false;
  const decorate = () => { if (decorating) return; decorating = true; try { drawHeader(doc, logo); drawFooter(doc, brand); } finally { decorating = false; } };
  decorate();
  doc.on("pageAdded", () => { decorate(); resetBody(doc); });
  resetBody(doc);

  // PDFKit quebra texto automaticamente na margem inferior (altura da página − BOTTOM).
  // A tabela é desenhada célula a célula, então precisa mover a linha inteira ANTES de
  // cruzar essa margem — senão o PDFKit pagina no meio da célula. Deixa uma folga.
  const PAGE_BOTTOM = 792 - BOTTOM - 8;
  const PAD = 6;

  // Tabela com cabeçalho teal, células com quebra de linha e quebra de página
  // (re-desenha o cabeçalho no topo de cada página). widths somam CONTENT_W.
  const drawTable = (headers: string[], rows: string[][], widths: number[]) => {
    const hasHeader = headers.some((h) => h.trim().length > 0);
    const drawHeaderRow = () => {
      if (!hasHeader) return;
      const h = 20;
      const top = doc.y;
      let x = MARGIN;
      doc.rect(MARGIN, top, CONTENT_W, h).fill(TEAL);
      headers.forEach((head, i) => {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff").text(head, x + PAD, top + PAD, { width: widths[i] - PAD * 2 });
        x += widths[i];
      });
      doc.y = top + h;
    };
    ensureSpace(doc, 60);
    drawHeaderRow();
    let zebra = false;
    for (const row of rows) {
      const heights = row.map((cell, i) => doc.font("Helvetica").fontSize(8.5).heightOfString(cell || "", { width: widths[i] - PAD * 2, lineGap: 1 }));
      const rowH = Math.max(16, ...heights) + PAD * 2;
      if (doc.y + rowH > PAGE_BOTTOM) { doc.addPage(); drawHeaderRow(); zebra = false; }
      const top = doc.y; // topo FIXO da linha — todas as células alinham por ele
      if (zebra) doc.rect(MARGIN, top, CONTENT_W, rowH).fill("#F4F2EE");
      doc.rect(MARGIN, top, CONTENT_W, rowH).strokeColor("#E2DFD8").lineWidth(0.5).stroke();
      let x = MARGIN;
      row.forEach((cell, i) => {
        doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(cell || "", x + PAD, top + PAD, { width: widths[i] - PAD * 2, lineGap: 1 });
        x += widths[i];
      });
      doc.y = top + rowH;
      zebra = !zebra;
    }
    doc.moveDown(0.5);
    doc.x = MARGIN;
  };

  const numberedTitle = (title: string) => {
    ensureSpace(doc, 60); doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(TEAL).text(title, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
  };
  const subTitle = (title: string) => {
    ensureSpace(doc, 40); doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEAL).text(title, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.2);
  };
  const boldLabel = (label: string, value?: string | null) => {
    if (!value?.trim()) return;
    ensureSpace(doc, 30);
    doc.font("Times-Bold").fontSize(10).fillColor(INK).text(`${label}: `, MARGIN, doc.y, { continued: true });
    doc.font("Times-Roman").fillColor(MUTED).text(value.trim(), { width: CONTENT_W, align: "justify", lineGap: 2 });
    doc.moveDown(0.2);
  };
  const bullets = (items: string[]) => {
    for (const it of items) {
      if (!it?.trim()) continue;
      ensureSpace(doc, 24);
      doc.font("Times-Roman").fontSize(10).fillColor(MUTED).text(`•  ${it.trim()}`, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.1);
    }
  };

  docTitle(doc, s.title, s.subtitle);

  // Tabela de identificação (Paciente / Exame / Plano...)
  const idRows: string[][] = [];
  if (opts.patientName) idRows.push(["Paciente", opts.patientName]);
  idRows.push(["Documento", "3 — Relatório de Hipersensibilidade (módulo do exame de cabelo)"]);
  if (idRows.length) drawTable(["", ""], idRows, [150, CONTENT_W - 150]);

  doc.font("Times-Italic").fontSize(9.5).fillColor("#5B3FA0").text(s.draft, MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.4);

  if (r.introducao) paragraph(doc, r.introducao);

  // 1. Visão geral
  if (r.visao_geral) {
    numberedTitle(s.s1);
    boldLabel(s.important, r.visao_geral.importante);
    paragraph(doc, r.visao_geral.quadro);
    boldLabel(s.mainFindings, r.visao_geral.principais_achados);
    boldLabel(s.priority, r.visao_geral.prioridade_funcional);
  }

  // 2. Padrões identificados (tabela)
  if (r.padroes.length) {
    numberedTitle(s.s2);
    drawTable([s.colPattern, s.colInterp], r.padroes.map((p) => [p.padrao, p.interpretacao]), [170, CONTENT_W - 170]);
  }

  // 3. Resultados principais
  if (r.achados_prioritarios.length || r.retirada_alta.length || r.retirada_moderada) {
    numberedTitle(s.s3);
    if (r.achados_prioritarios.length) {
      subTitle(s.s31);
      drawTable([s.colArea, s.colFindings, s.colPriority],
        r.achados_prioritarios.map((a) => [a.area, a.achados, a.prioridade]),
        [110, CONTENT_W - 110 - 120, 120]);
    }
    if (r.retirada_alta.length || r.retirada_moderada) {
      subTitle(s.s32);
      if (r.retirada_alta.length) {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(s.removalHigh, MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.2);
        for (const g of r.retirada_alta) {
          if (!g.grupo?.trim() && !g.itens?.trim()) continue;
          ensureSpace(doc, 28);
          doc.font("Times-Bold").fontSize(10).fillColor(INK).text(`${g.grupo}: `, MARGIN, doc.y, { continued: true });
          doc.font("Times-Roman").fillColor(MUTED).text(g.itens, { width: CONTENT_W, align: "justify", lineGap: 2 });
          doc.moveDown(0.15);
        }
      }
      boldLabel(s.removalModerate, r.retirada_moderada);
    }
  }

  // 4. Relação com o sistema nervoso
  if (r.relacao_sistema_nervoso || r.eixos.length) {
    numberedTitle(s.s4);
    paragraph(doc, r.relacao_sistema_nervoso);
    for (const e of r.eixos) {
      if (!e.titulo?.trim() && !e.descricao?.trim()) continue;
      ensureSpace(doc, 28);
      doc.font("Times-Bold").fontSize(10).fillColor(INK).text(`•  ${e.titulo}: `, MARGIN, doc.y, { continued: true });
      doc.font("Times-Roman").fillColor(MUTED).text(e.descricao, { width: CONTENT_W, align: "justify", lineGap: 2 });
      doc.moveDown(0.1);
    }
  }

  // 5. Estratégia em fases (tabela)
  if (r.fases.length) {
    numberedTitle(s.s5);
    drawTable([s.colPhase, s.colConduct], r.fases.map((f) => [f.titulo, f.descricao]), [150, CONTENT_W - 150]);
  }

  // 6. Plano alimentar prático
  if (r.plano_alimentar.length) {
    numberedTitle(s.s6);
    bullets(r.plano_alimentar);
  }

  // 7. Implicações para a suplementação
  if (r.implicacoes_suplementacao) {
    numberedTitle(s.s7);
    paragraph(doc, r.implicacoes_suplementacao.texto);
    if (r.implicacoes_suplementacao.apoiar.length) {
      subTitle(s.support);
      for (const a of r.implicacoes_suplementacao.apoiar) boldLabel(a.titulo, a.descricao);
    }
    if (r.implicacoes_suplementacao.pontos_atencao.length) {
      subTitle(s.attention);
      for (const a of r.implicacoes_suplementacao.pontos_atencao) boldLabel(a.titulo, a.descricao);
    }
  }

  // 8. Monitoramento
  if (r.monitoramento.length) {
    numberedTitle(s.s8);
    bullets(r.monitoramento);
  }

  // 9. Resumo executivo
  if (r.resumo_executivo) {
    numberedTitle(s.s9);
    paragraph(doc, r.resumo_executivo);
  }

  if (r.observacoes_gerais?.length) bullets(r.observacoes_gerais);

  doc.moveDown(0.2);
  doc.font("Times-Italic").fontSize(8.5).fillColor("#6B6A66").text(s.pointer, MARGIN, doc.y, { width: CONTENT_W });

  // Anexo — Diário de reintrodução (tabela em branco para preencher)
  doc.addPage();
  numberedTitle(s.annex);
  drawTable([s.colDate, s.colFood, s.colQty, s.colSymptoms, s.colAction],
    Array.from({ length: 10 }, () => ["", "", "", "", ""]),
    [70, 150, 80, 120, CONTENT_W - 70 - 150 - 80 - 120]);

  return pdfToBuffer(doc);
}
