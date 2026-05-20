import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getRepasseHistory } from "@/services/repasse-service";
import { formatBRL } from "@/services/finance-service";

export const runtime = "nodejs";

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const url   = new URL(req.url);
  const month = url.searchParams.get("month") ?? undefined; // e.g. "2025-06"

  const allHistory = await getRepasseHistory(clinic.id);
  const history    = month ? allHistory.filter((r) => r.period_month === month) : allHistory;

  const doc = new PDFDocument({ margin: 56, size: "A4", info: { Title: "Relatório de Repasse", Author: clinic.name } });

  // Header
  doc.rect(0, 0, 595, 80).fill("#0F6E56");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(clinic.name, 56, 24);
  doc.fillColor("rgba(255,255,255,0.7)").font("Helvetica").fontSize(10).text("Relatório de Repasse Médico", 56, 48);
  doc.fillColor("rgba(255,255,255,0.4)").fontSize(9).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 56, 62);
  doc.y = 100;

  if (month) {
    doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(`PERÍODO: ${month}`, { characterSpacing: 0.5 });
    doc.moveDown(1);
  }

  if (history.length === 0) {
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(11).text("Nenhum repasse encontrado para o período selecionado.");
  } else {
    // Group by period
    const byPeriod = history.reduce<Record<string, typeof history>>((acc, r) => {
      acc[r.period_month] = acc[r.period_month] ?? [];
      acc[r.period_month].push(r);
      return acc;
    }, {});

    for (const [period, rows] of Object.entries(byPeriod).sort(([a], [b]) => b.localeCompare(a))) {
      const totalRepasse = rows.reduce((s, r) => s + r.repasse_cents, 0);
      const totalGross   = rows.reduce((s, r) => s + r.gross_revenue_cents, 0);

      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text(period);
      doc.moveDown(0.4);

      // Summary
      doc.fillColor("#374151").font("Helvetica").fontSize(10)
         .text(`Receita bruta: ${formatBRL(totalGross)}  ·  Total repasse: ${formatBRL(totalRepasse)}`);
      doc.moveDown(0.5);

      // Table header
      const hY = doc.y;
      doc.rect(56, hY, 487, 18).fillColor("#f3f4f6").fill();
      [
        { x: 56,  w: 160, label: "Profissional" },
        { x: 220, w:  80, label: "Sessões" },
        { x: 304, w: 110, label: "Receita bruta" },
        { x: 418, w:  60, label: "%" },
        { x: 482, w:  80, label: "Repasse" },
      ].forEach((c) => {
        doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(8)
           .text(c.label, c.x + 4, hY + 5, { width: c.w - 4 });
      });
      doc.y = hY + 22;

      rows.forEach((r, i) => {
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 16).fillColor("#fafafa").fill();

        doc.fillColor("#374151").font("Helvetica").fontSize(9)
           .text(r.professional_name ?? "—", 60, rowY, { width: 156 });
        doc.text(String(r.sessions_count), 224, rowY, { width: 76, align: "right" });
        doc.text(formatBRL(r.gross_revenue_cents), 308, rowY, { width: 106, align: "right" });
        const pct = totalGross > 0 ? Math.round((r.repasse_cents / r.gross_revenue_cents) * 100) : 0;
        doc.text(`${pct}%`, 422, rowY, { width: 56, align: "right" });
        doc.fillColor(r.status === "paid" ? "#0F6E56" : "#d97706")
           .font("Helvetica-Bold").fontSize(9)
           .text(formatBRL(r.repasse_cents), 486, rowY, { width: 56, align: "right" });

        doc.y = rowY + 16;
      });

      doc.moveDown(1.5);
      if (doc.y > 700) doc.addPage();
    }
  }

  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
     .text(`${clinic.name} · Relatório gerado pelo AXIEL Core`, { align: "center" });

  const buffer = await pdfToBuffer(doc);
  const slug   = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="repasse-${slug}${month ? "-" + month : ""}.pdf"`,
    },
  });
}
