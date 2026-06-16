import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import PDFDocument from "pdfkit";
import { getClinicalInsight } from "@/services/insight-export-service";
import { getLatestFinalAiInsight, getLatestAiInsight } from "@/services/ai-insight-service";
import type { AiInsightOutput } from "@/lib/types";

export const runtime = "nodejs";

type PdfTextOptions = PDFKit.Mixins.TextOptions;

function writeWrappedList(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item) => {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`- ${item}`, { indent: 8, lineGap: 4 });
  });
}

function writeSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1.1);
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(title);
  doc.moveDown(0.4);
}

function writeParagraph(doc: PDFKit.PDFDocument, text: string, options?: PdfTextOptions) {
  doc.font("Helvetica").fontSize(10.5).fillColor("#4b5563").text(text, { lineGap: 4, ...options });
}

function writeListSection(doc: PDFKit.PDFDocument, title: string, items?: string[]) {
  if (!items || items.length === 0) return;
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title);
  doc.moveDown(0.2);
  writeWrappedList(doc, items);
}

function writeNeuroDocuments(doc: PDFKit.PDFDocument, output: AiInsightOutput) {
  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;
  if (!mapa && !plano && !sup) return;

  if (mapa) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 1 — Mapa Integrativo Neuro ID 360");
    writeListSection(doc, "Principais achados", mapa.principais_achados);
    writeListSection(doc, "Padrões observados", mapa.padroes_observados);
    if (mapa.leitura_integrativa?.trim()) { writeSectionTitle(doc, "Leitura integrativa"); writeParagraph(doc, mapa.leitura_integrativa); }
    writeListSection(doc, "Achados funcionais", mapa.achados_funcionais);
    writeListSection(doc, "Elementos biomecânicos", mapa.elementos_biomecanicos);
    writeListSection(doc, "Elementos bioemocionais", mapa.elementos_bioemocionais);
    writeListSection(doc, "Desregulação do sistema nervoso (SNA)", mapa.desregulacao_sna);
    writeListSection(doc, "Possíveis fatores bioquímicos", mapa.fatores_bioquimicos);
    writeListSection(doc, "Prioridades de atenção", mapa.prioridades_atencao);
  }

  if (plano) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 2 — Plano Inicial de Regulação");
    writeListSection(doc, "Próximos passos", plano.proximos_passos);
    writeListSection(doc, "Orientações iniciais", plano.orientacoes_iniciais);
    writeListSection(doc, "Recomendações de rotina", plano.recomendacoes_rotina);
    writeListSection(doc, "Sugestões de regulação", plano.sugestoes_regulacao);
    writeListSection(doc, "Exames complementares recomendados", plano.exames_complementares);
    writeListSection(doc, "Prioridades", plano.prioridades);
    if (plano.recomendacao_continuidade?.trim()) { writeSectionTitle(doc, "Recomendação de continuidade"); writeParagraph(doc, plano.recomendacao_continuidade); }
  }

  if (sup && (sup.itens.length > 0 || sup.observacoes_gerais.length > 0)) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 3 — Protocolo de Suplementação");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9).fillColor("#9a7b2f").text("Rascunho — exige aprovação do profissional.");
    sup.itens.forEach((it) => {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(it.nome);
      if (it.dose_sugerida) writeParagraph(doc, `Dose sugerida: ${it.dose_sugerida}`);
      if (it.objetivo) writeParagraph(doc, `Objetivo: ${it.objetivo}`);
      if (it.observacao) writeParagraph(doc, `Obs.: ${it.observacao}`);
    });
    writeListSection(doc, "Observações gerais", sup.observacoes_gerais);
  }
}

async function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insight = await getClinicalInsight(id);
  if (!insight) notFound();

  const t = await getTranslations("insights");
  const locale = await getLocale();

  const patientName = insight.patient_overview.find((item) => item.title === "Patient")?.body ?? "patient";
  const doc = new PDFDocument({ margin: 56, size: "LETTER", info: { Title: insight.title, Author: "AXIEL Core" } });

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text(insight.title);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#9a7b2f").text(insight.notice);
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(t("createdAt", { date: new Date(insight.generated_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) }));
  doc.moveDown(1);
  writeParagraph(doc, t("pdf.disclaimer"));

  writeSectionTitle(doc, t("pdf.patientOverview"));
  insight.patient_overview.forEach((item) => {
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#111827").text(`${item.title}: `, { continued: true });
    doc.font("Helvetica").fontSize(10.5).fillColor("#4b5563").text(item.body, { lineGap: 3 });
  });

  writeSectionTitle(doc, t("keyNotes"));
  writeWrappedList(doc, insight.key_observations);

  writeSectionTitle(doc, t("whatConnected"));
  insight.patterns.forEach((pattern) => {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(pattern.title);
    writeParagraph(doc, pattern.body);
    doc.moveDown(0.4);
  });

  writeSectionTitle(doc, t("nextSteps"));
  writeWrappedList(doc, insight.simple_next_steps);

  writeSectionTitle(doc, t("pdf.finalNote"));
  writeParagraph(doc, insight.closing_note);

  // Neuro ID 360 — anexa os 3 documentos do insight aprovado (quando presentes).
  const raw = (await getLatestFinalAiInsight(id)) ?? (await getLatestAiInsight(id));
  if (raw) writeNeuroDocuments(doc, (raw.final_output ?? raw.output) as AiInsightOutput);

  doc.moveDown(1.4);
  doc.font("Helvetica").fontSize(9).fillColor("#9ca3af").text(t("pdf.footer"), { align: "center" });

  const buffer = await pdfToBuffer(doc);
  const safeName = patientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="clinical-insight-${safeName}.pdf"`,
    },
  });
}
