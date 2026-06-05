import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getRepasseHistory } from "@/services/repasse-service";
import { getClinicCurrency } from "@/services/finance-service";
import { formatMoney } from "@/lib/finance-utils";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";

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
  const __cur = await getClinicCurrency(clinic.id);

  const url    = new URL(req.url);
  const month  = url.searchParams.get("month")  ?? undefined; // e.g. "2025-06"
  const format = url.searchParams.get("format") ?? "pdf";

  const allHistory = await getRepasseHistory(clinic.id);
  const history    = month ? allHistory.filter((r) => r.period_month === month) : allHistory;
  const slug       = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");
  const statusLabel = (s: string) => (s === "paid" ? t("repasse.statusPaid") : t("repasse.statusPending"));

  // ── CSV ──────────────────────────────────────────────────────────────────
  if (format === "csv") {
    const headers = [t("repasse.colPeriod"), t("repasse.colProfessional"), t("repasse.colSessions"), t("repasse.colGross"), t("repasse.colPct"), t("repasse.colRepasse"), t("repasse.colStatus")];
    const rows = history.map((r) => {
      const pct = r.gross_revenue_cents > 0
        ? Math.round((r.repasse_cents / r.gross_revenue_cents) * 100)
        : 0;
      return [
        r.period_month,
        r.professional_name ?? "",
        r.sessions_count,
        (r.gross_revenue_cents / 100).toFixed(2).replace(".", ","),
        `${pct}%`,
        (r.repasse_cents / 100).toFixed(2).replace(".", ","),
        statusLabel(r.status),
      ];
    });
    const csv = [
      "﻿",
      headers.map(escCsv).join(","),
      ...rows.map((r) => r.map(escCsv).join(",")),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="repasse-${slug}${month ? "-" + month : ""}.csv"`,
      },
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  if (format === "xlsx") {
    const xlsxRows = history.map((r) => {
      const pct = r.gross_revenue_cents > 0
        ? Math.round((r.repasse_cents / r.gross_revenue_cents) * 100)
        : 0;
      return {
        periodo:      r.period_month,
        profissional: r.professional_name ?? "",
        sessoes:      r.sessions_count,
        receita:      r.gross_revenue_cents / 100,
        pct:          `${pct}%`,
        repasse:      r.repasse_cents / 100,
        status:       statusLabel(r.status),
      };
    });
    const buf = await buildExcelBuffer([{
      name: t("repasse.title"),
      columns: [
        { header: t("repasse.colPeriod"),       key: "periodo",      width: 14 },
        { header: t("repasse.colProfessional"), key: "profissional", width: 30 },
        { header: t("repasse.colSessions"),     key: "sessoes",      width: 10 },
        { header: t("repasse.colGross"),        key: "receita",      width: 18 },
        { header: t("repasse.colPct"),          key: "pct",          width: 12 },
        { header: t("repasse.colRepasse"),      key: "repasse",      width: 16 },
        { header: t("repasse.colStatus"),       key: "status",       width: 12 },
      ],
      rows: xlsxRows,
    }]);
    return excelResponse(buf, `repasse-${slug}${month ? "-" + month : ""}.xlsx`);
  }

  // ── PDF (default) ─────────────────────────────────────────────────────────
  const doc = new PDFDocument({ margin: 56, size: "A4", info: { Title: t("repasse.title"), Author: clinic.name } });

  // Header
  doc.rect(0, 0, 595, 80).fill("#0F6E56");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(clinic.name, 56, 24);
  doc.fillColor("rgba(255,255,255,0.7)").font("Helvetica").fontSize(10).text(t("repasse.titleFull"), 56, 48);
  doc.fillColor("rgba(255,255,255,0.4)").fontSize(9).text(t("generatedAt", { date: new Date().toLocaleString(locale) }), 56, 62);
  doc.y = 100;

  if (month) {
    doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(t("period", { label: month }), { characterSpacing: 0.5 });
    doc.moveDown(1);
  }

  if (history.length === 0) {
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(11).text(t("repasse.empty"));
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
         .text(t("repasse.summary", { gross: formatMoney(totalGross, __cur, locale), total: formatMoney(totalRepasse, __cur, locale) }));
      doc.moveDown(0.5);

      // Table header
      const hY = doc.y;
      doc.rect(56, hY, 487, 18).fillColor("#f3f4f6").fill();
      [
        { x: 56,  w: 160, label: t("repasse.colProfessional") },
        { x: 220, w:  80, label: t("repasse.colSessions") },
        { x: 304, w: 110, label: t("repasse.colGrossShort") },
        { x: 418, w:  60, label: "%" },
        { x: 482, w:  80, label: t("repasse.colRepasseShort") },
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
        doc.text(formatMoney(r.gross_revenue_cents, __cur, locale), 308, rowY, { width: 106, align: "right" });
        const pct = totalGross > 0 ? Math.round((r.repasse_cents / r.gross_revenue_cents) * 100) : 0;
        doc.text(`${pct}%`, 422, rowY, { width: 56, align: "right" });
        doc.fillColor(r.status === "paid" ? "#0F6E56" : "#d97706")
           .font("Helvetica-Bold").fontSize(9)
           .text(formatMoney(r.repasse_cents, __cur, locale), 486, rowY, { width: 56, align: "right" });

        doc.y = rowY + 16;
      });

      doc.moveDown(1.5);
      if (doc.y > 700) doc.addPage();
    }
  }

  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
     .text(t("generatedBy", { clinic: clinic.name }), { align: "center" });

  const buffer = await pdfToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="repasse-${slug}${month ? "-" + month : ""}.pdf"`,
    },
  });
}
