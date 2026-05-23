import PDFDocument from "pdfkit";

export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function buildTablePdf(opts: {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  clinicName: string;
  accentColor?: string;
}): Promise<Buffer> {
  const { title, subtitle, periodLabel, headers, rows, clinicName, accentColor = "#0B1F3A" } = opts;
  const doc = new PDFDocument({ margin: 40, size: "A4", info: { Title: title, Author: clinicName } });

  doc.rect(0, 0, 595, 72).fill(accentColor);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(16).text(clinicName, 40, 20);
  doc.fillColor("rgba(255,255,255,0.7)").font("Helvetica").fontSize(10).text(title, 40, 42);
  if (subtitle) {
    doc.fillColor("rgba(255,255,255,0.5)").fontSize(9).text(subtitle, 40, 56);
  }
  doc.y = 88;

  if (periodLabel) {
    doc.fillColor("#6b7280").font("Helvetica").fontSize(9)
       .text(`PERÍODO: ${periodLabel}`, { characterSpacing: 0.5 });
    doc.moveDown(0.8);
  }

  const contentWidth = 515;
  const colCount = headers.length;
  const colW = Math.floor(contentWidth / colCount);

  const hY = doc.y;
  doc.rect(40, hY, contentWidth, 18).fillColor("#f3f4f6").fill();
  headers.forEach((h, i) => {
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(7.5)
       .text(h, 40 + i * colW + 3, hY + 5, { width: colW - 6, ellipsis: true });
  });
  doc.y = hY + 22;

  rows.forEach((row, ri) => {
    if (doc.y > 750) doc.addPage();
    const rowY = doc.y;
    if (ri % 2 === 0) doc.rect(40, rowY - 1, contentWidth, 15).fillColor("#fafafa").fill();
    row.forEach((cell, ci) => {
      doc.fillColor("#374151").font("Helvetica").fontSize(8)
         .text(cell == null ? "—" : String(cell), 40 + ci * colW + 3, rowY, { width: colW - 6, ellipsis: true });
    });
    doc.y = rowY + 15;
  });

  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
     .text(`${clinicName} · Relatório gerado pelo AXIEL Core`, { align: "center" });

  return pdfToBuffer(doc);
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
