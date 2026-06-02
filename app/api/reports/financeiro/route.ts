import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPaymentsWithPatients, formatBRL } from "@/services/finance-service";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import type { PaymentMethod } from "@/lib/types";

const PAYMENT_METHODS: PaymentMethod[] = ["pix", "credit_card", "debit_card", "cash", "transfer", "insurance", "other"];

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

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");
  const methodLabel = (m: string | null | undefined) =>
    m && (PAYMENT_METHODS as string[]).includes(m) ? t(`paymentMethod.${m}`) : (m ?? "—");

  // ── QA-05: feature gate advanced_reports ──────────────────────────────────
  const billingCtx = await getBillingContext(clinic.id);
  if (!canUseFeature(billingCtx, "advanced_reports")) {
    return new Response(
      JSON.stringify({ error: t("financeReport.featureGate") }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from") ?? undefined;
  const to     = url.searchParams.get("to")   ?? undefined;
  const format = url.searchParams.get("format") ?? "pdf";

  const payments = await getPaymentsWithPatients(clinic.id, { from, to, limit: 10000 });
  const slug     = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const periodLabel = from && to
    ? t("range", { from: new Date(from).toLocaleDateString(locale), to: new Date(to).toLocaleDateString(locale) })
    : t("allPeriods");

  // ── CSV ──────────────────────────────────────────────────────────────────
  if (format === "csv") {
    const headers = [t("col.date"), t("col.patient"), t("col.sessionType"), t("col.payment"), t("col.value"), t("col.notes")];
    const rows = payments.map((p) => [
      new Date(p.paid_at).toLocaleDateString(locale),
      p.patient_name ?? "",
      p.session_type_name ?? "",
      methodLabel(p.payment_method),
      (p.amount_cents / 100).toFixed(2).replace(".", ","),
      p.notes ?? "",
    ]);
    const csv = [
      "﻿",
      headers.map(escCsv).join(","),
      ...rows.map((r) => r.map(escCsv).join(",")),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="financeiro-${slug}.csv"`,
      },
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  if (format === "xlsx") {
    const rows = payments.map((p) => ({
      data:     new Date(p.paid_at).toLocaleDateString(locale),
      paciente: p.patient_name ?? "",
      tipo:     p.session_type_name ?? "",
      metodo:   methodLabel(p.payment_method),
      valor:    p.amount_cents / 100,
      notas:    p.notes ?? "",
    }));
    const buf = await buildExcelBuffer([{
      name: t("financeReport.title"),
      columns: [
        { header: t("col.date"),        key: "data",     width: 14 },
        { header: t("col.patient"),     key: "paciente", width: 30 },
        { header: t("col.sessionType"), key: "tipo",     width: 24 },
        { header: t("col.payment"),     key: "metodo",   width: 22 },
        { header: t("col.value"),       key: "valor",    width: 14 },
        { header: t("col.notes"),       key: "notas",    width: 36 },
      ],
      rows,
    }]);
    return excelResponse(buf, `financeiro-${slug}.xlsx`);
  }

  // ── PDF (default) ─────────────────────────────────────────────────────────
  // Aggregate
  const totalCents    = payments.reduce((s, p) => s + p.amount_cents, 0);
  const avgCents      = payments.length > 0 ? Math.round(totalCents / payments.length) : 0;
  const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
    const key = p.payment_method ?? "other";
    acc[key] = (acc[key] ?? 0) + p.amount_cents;
    return acc;
  }, {});

  const doc = new PDFDocument({ margin: 56, size: "A4", info: { Title: t("financeReport.title"), Author: clinic.name } });

  // ── Header ──
  doc.rect(0, 0, 595, 80).fill("#0B1F3A");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(clinic.name, 56, 24);
  doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(10).text(t("financeReport.title"), 56, 48);
  doc.fillColor("rgba(255,255,255,0.4)").fontSize(9).text(t("generatedAt", { date: new Date().toLocaleString(locale) }), 56, 62);
  doc.y = 100;

  // ── Period ──
  doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(t("period", { label: periodLabel }), { characterSpacing: 0.5 });
  doc.moveDown(1);

  // ── KPIs ──
  const kpiY = doc.y;
  const kpiW = (595 - 112 - 16) / 3;
  [
    { label: t("financeReport.kpiRevenue"), value: formatBRL(totalCents) },
    { label: t("financeReport.kpiPayments"), value: String(payments.length) },
    { label: t("financeReport.kpiAvg"), value: formatBRL(avgCents) },
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
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text(t("financeReport.byMethod"));
  doc.moveDown(0.5);
  const sortedMethods = Object.entries(byMethod).sort(([, a], [, b]) => b - a);
  sortedMethods.forEach(([method, cents]) => {
    const pct = totalCents > 0 ? Math.round((cents / totalCents) * 100) : 0;
    doc.font("Helvetica").fontSize(10).fillColor("#374151")
       .text(methodLabel(method), 56, doc.y, { continued: true, width: 200 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10)
       .text(formatBRL(cents), { continued: true, width: 120, align: "right" });
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(9)
       .text(`  ${pct}%`, { width: 60 });
    doc.moveDown(0.3);
  });

  // ── Payments table ──
  if (payments.length > 0) {
    divider(doc);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text(t("financeReport.list"));
    doc.moveDown(0.5);

    // Table header
    const cols = [{ x: 56, w: 90, label: t("col.date") }, { x: 150, w: 150, label: t("col.patient") }, { x: 304, w: 130, label: t("col.sessionType") }, { x: 438, w: 60, label: t("col.method") }, { x: 502, w: 70, label: t("col.value") }];
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
         .text(new Date(p.paid_at).toLocaleDateString(locale), 60, rowY, { width: 86 });
      doc.text(p.patient_name ?? "—", 154, rowY, { width: 146 });
      doc.text(p.session_type_name ?? "—", 308, rowY, { width: 126 });
      doc.text(methodLabel(p.payment_method), 442, rowY, { width: 56 });
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9)
         .text(formatBRL(p.amount_cents), 506, rowY, { width: 56, align: "right" });
      doc.y = rowY + 16;
    });

    if (payments.length > 200) {
      doc.moveDown(0.5);
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(9)
         .text(t("financeReport.moreItems", { count: payments.length - 200 }));
    }
  }

  // ── Footer ──
  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
     .text(t("generatedBy", { clinic: clinic.name }), { align: "center" });

  const buffer = await pdfToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="financeiro-${slug}.pdf"`,
    },
  });
}
