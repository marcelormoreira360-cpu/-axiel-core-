import PDFDocument from "pdfkit";
import type { AiInsightOutput } from "@/lib/types";

// ── Helpers de escrita no PDF ────────────────────────────────────────────────
function writeList(doc: PDFKit.PDFDocument, title: string, items?: string[]) {
  if (!items || items.length === 0) return;
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title);
  doc.moveDown(0.2);
  items.forEach((item) => {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`• ${item}`, { indent: 8, lineGap: 4 });
  });
}

function writeParagraph(doc: PDFKit.PDFDocument, title: string, text?: string | null) {
  if (!text || !text.trim()) return;
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10.5).fillColor("#4b5563").text(text, { lineGap: 4 });
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Gera o PDF do relatório Neuro ID 360 (os 3 documentos) para envio ao paciente.
 * Retorna um Buffer pronto para upload/anexo.
 */
export async function buildNeuroId360Pdf(opts: {
  output: AiInsightOutput;
  patientName?: string | null;
  clinicName?: string | null;
}): Promise<Buffer> {
  const { output, patientName, clinicName } = opts;
  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;

  const doc = new PDFDocument({ margin: 56, size: "LETTER", info: { Title: "Relatório Neuro ID 360", Author: clinicName ?? "AXIEL Core" } });

  // Capa / cabeçalho
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#111827").text("Relatório de Acompanhamento");
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0F6E56").text("Neuro ID 360");
  doc.moveDown(0.4);
  if (patientName) doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(`Paciente: ${patientName}`);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`Emitido em ${new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })}`);
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(9.5).fillColor("#9a7b2f").text(
    "Este material foi revisado e aprovado pelo seu profissional. Não substitui avaliação clínica presencial.",
    { lineGap: 3 },
  );

  // Documento 1 — Mapa Integrativo
  if (mapa) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 1 — Mapa Integrativo Neuro ID 360");
    writeList(doc, "Principais achados", mapa.principais_achados);
    writeList(doc, "Padrões observados", mapa.padroes_observados);
    writeParagraph(doc, "Leitura integrativa", mapa.leitura_integrativa);
    writeList(doc, "Achados funcionais", mapa.achados_funcionais);
    writeList(doc, "Elementos biomecânicos", mapa.elementos_biomecanicos);
    writeList(doc, "Elementos bioemocionais", mapa.elementos_bioemocionais);
    writeList(doc, "Desregulação do sistema nervoso (SNA)", mapa.desregulacao_sna);
    writeList(doc, "Possíveis fatores bioquímicos", mapa.fatores_bioquimicos);
    writeList(doc, "Prioridades de atenção", mapa.prioridades_atencao);
  }

  // Documento 2 — Plano Inicial de Regulação
  if (plano) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 2 — Plano Inicial de Regulação");
    writeList(doc, "Próximos passos", plano.proximos_passos);
    writeList(doc, "Orientações iniciais", plano.orientacoes_iniciais);
    writeList(doc, "Recomendações de rotina", plano.recomendacoes_rotina);
    writeList(doc, "Sugestões de regulação", plano.sugestoes_regulacao);
    writeList(doc, "Exames complementares recomendados", plano.exames_complementares);
    writeList(doc, "Prioridades", plano.prioridades);
    writeParagraph(doc, "Recomendação de continuidade", plano.recomendacao_continuidade);
  }

  // Documento 3 — Protocolo de Suplementação
  if (sup && (sup.itens.length > 0 || sup.observacoes_gerais.length > 0)) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Documento 3 — Protocolo de Suplementação");
    sup.itens.forEach((it) => {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(it.nome);
      if (it.dose_sugerida) doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Dose sugerida: ${it.dose_sugerida}`, { lineGap: 3 });
      if (it.objetivo) doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Objetivo: ${it.objetivo}`, { lineGap: 3 });
      if (it.observacao) doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Obs.: ${it.observacao}`, { lineGap: 3 });
    });
    writeList(doc, "Observações gerais", sup.observacoes_gerais);
  }

  if (output.safety_note?.trim()) {
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(9).fillColor("#9ca3af").text(output.safety_note, { align: "center", lineGap: 3 });
  }

  return pdfToBuffer(doc);
}
