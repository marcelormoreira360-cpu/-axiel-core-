import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPaymentsWithPatients, formatBRL, paymentMethodLabel } from "@/services/finance-service";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import type { PaymentMethod } from "@/lib/types";

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

function divider(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.5);
  doc.strokeColor("#e5e7eb").lineWidth(0.5).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(0.5);
}

export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  // ── QA-05: feature gate advanced_reports ──────────────────────────────────
  const billingCtx = await getBillingContext(clinic.id);
  if (!canUseFeature(billingCtx, "advanced_reports")) {
    return new Response(
      JSON.stringify({ error: "Relatórios avançados disponíveis no plano Professional ou superior." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to   = url.searchParams.get("to")   ?? undefined;

  const payments = await getPaymentsWithPatients(clinic.id, { from, to, limit: 1000 });

  // Aggregate
  const totalCents    = payments.reduce((s, p) => s + p.amount_cents, 0);
  const avgCents      = payments.length > 0 ? Math.round(totalCents / payments.length) : 0;
  const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
    const key = p.payment_method ?? "other";
    acc[key] = (acc[key] ?? 0) + p.amount_cents;
    return acc;
  }, {});

  const periodLabel = from && to
    ? `${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")}`
    : "Todos os períodos";

  const doc = new PDFDocument({ margin: 56, size: "A4", info: { Title: "Relatório Financeiro", Author: clinic.name } });

  // ── Header ──
  doc.rect(0, 0, 595, 80).fill("#0B1F3A");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(clinic.name, 56, 24);
  doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(10).text("Relatório Financeiro", 56, 48);
  doc.fillColor("rgba(255,255,255,0.4)").fontSize(9).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 56, 62);
  doc.y = 100;

  // ── Period ──
  doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(`PERÍODO: ${periodLabel}`, { characterSpacing: 0.5 });
  doc.moveDown(1);

  // ── KPIs ──
  const kpiY = doc.y;
  const kpiW = (595 - 112 - 16) / 3;
  [
    { label: "RECEITA TOTAL", value: formatBRL(totalCents) },
    { label: "PAGAMENTOS",   value: String(payments.length) },
    { label: "TICKET MÉDIO", value: formatBRL(avgCents) },
  ].forEach((kpi, i) => {
    const x = 56 + i * (kpiW + 8);
    doc.rect(x, kpiY, kpiW, 56).fillColor("#f9fafb").fill();
    doc.rect(x, kpiY, 3, 56).fillColor("#0B1F3A").fill();
    doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(kpi.label, x + 10, kpiY + 10, { width: kpiW - 20 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(16).text(kpi.value, x + 10, kpiY + 26, { width: kpiW - 20 });
  });
  doc.y = kpiY + 72;

  // ── By method ──
  divider(doc);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text("Receita por forma de pagamento");
  doc.moveDown(0.5);
  const sortedMethods = Object.entries(byMethod).sort(([, a], [, b]) => b - a);
  sortedMethods.forEach(([method, cents]) => {
    const pct = totalCents > 0 ? Math.round((cents / totalCents) * 100) : 0;
    doc.font("Helvetica").fontSize(10).fillColor("#374151")
       .text(paymentMethodLabel(method as PaymentMethod), 56, doc.y, { continued: true, width: 200 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10)
       .text(formatBRL(cents), { continued: true, width: 120, align: "right" });
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(9)
       .text(`  ${pct}%`, { width: 60 });
    doc.moveDown(0.3);
  });

  // ── Payments table ──
  if (payments.length > 0) {
    divider(doc);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text("Lista de pagamentos");
    doc.moveDown(0.5);

    // Table header
    const cols = [{ x: 56, w: 90, label: "Data" }, { x: 150, w: 150, label: "Paciente" }, { x: 304, w: 130, label: "Tipo de sessão" }, { x: 438, w: 60, label: "Método" }, { x: 502, w: 70, label: "Valor" }];
    const hY = doc.y;
    doc.rect(56, hY, 487, 18).fillColor("#f3f4f6").fill();
    cols.forEach((c) => {
      doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(8)
         .text(c.label, c.x + 4, hY + 5, { width: c.w - 4 });
    });
    doc.y = hY + 22;

    payments.slice(0, 200).forEach((p, i) => {
      if (doc.y > 720) { doc.addPage(); }
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 16).fillColor("#fafafa").fill();

      doc.fillColor("#374151").font("Helvetica").fontSize(9)
         .text(new Date(p.paid_at).toLocaleDateString("pt-BR"), 60, rowY, { width: 86 });
      doc.text(p.patient_name ?? "—", 154, rowY, { width: 146 });
      doc.text(p.session_type_name ?? "—", 308, rowY, { width: 126 });
      doc.text(paymentMethodLabel(p.payment_method as PaymentMethod), 442, rowY, { width: 56 });
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9)
         .text(formatBRL(p.amount_cents), 506, rowY, { width: 56, align: "right" });
      doc.y = rowY + 16;
    });

    if (payments.length > 200) {
      doc.moveDown(0.5);
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(9)
         .text(`(${payments.length - 200} pagamentos adicionais não exibidos)`);
    }
  }

  // ── Footer ──
  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
     .text(`${clinic.name} · Relatório gerado pelo AXIEL Core`, { align: "center" });

  const buffer = await pdfToBuffer(doc);
  const slug   = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="financeiro-${slug}.pdf"`,
    },
  });
}
