import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import PDFDocument from "pdfkit";
import { getClinicalInsight } from "@/services/insight-export-service";

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
