import { getCurrentClinic } from "@/services/clinic-service";
import { getPaymentsWithPatients, paymentMethodLabel } from "@/services/finance-service";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import type { PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";

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

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from")   ?? undefined;
  const to     = url.searchParams.get("to")     ?? undefined;
  const format = url.searchParams.get("format") ?? "csv";

  const payments = await getPaymentsWithPatients(clinic.id, { from, to, limit: 10000 });
  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const periodLabel = from && to
      ? t("range", { from: new Date(from).toLocaleDateString(locale), to: new Date(to).toLocaleDateString(locale) })
      : t("allPeriods");
    const headers = [t("col.date"), t("col.patient"), t("col.sessionType"), t("col.method"), t("col.value")];
    const pdfRows = payments.map((p) => [
      new Date(p.paid_at).toLocaleDateString(locale),
      p.patient_name ?? "",
      p.session_type_name ?? "",
      paymentMethodLabel(p.payment_method as PaymentMethod),
      (p.amount_cents / 100).toFixed(2).replace(".", ","),
    ]);
    const buf = await buildTablePdf({ title: t("payments.title"), periodLabel, headers, rows: pdfRows, clinicName: clinic.name, locale });
    return pdfResponse(buf, `pagamentos-${slug}.pdf`);
  }

  if (format === "xlsx") {
    const rows = payments.map((p) => ({
      data:    new Date(p.paid_at).toLocaleDateString(locale),
      paciente: p.patient_name ?? "",
      tipo:    p.session_type_name ?? "",
      metodo:  paymentMethodLabel(p.payment_method as PaymentMethod),
      valor:   (p.amount_cents / 100),
      notas:   p.notes ?? "",
    }));
    const buf = await buildExcelBuffer([{
      name: t("payments.title"),
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
    return excelResponse(buf, `pagamentos-${slug}.xlsx`);
  }

  // CSV (default)
  const headers = [t("col.date"), t("col.patient"), t("col.sessionType"), t("col.payment"), t("col.value"), t("col.notes")];
  const rows = payments.map((p) => [
    new Date(p.paid_at).toLocaleDateString(locale),
    p.patient_name ?? "",
    p.session_type_name ?? "",
    paymentMethodLabel(p.payment_method as PaymentMethod),
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
      "Content-Disposition": `attachment; filename="pagamentos-${slug}.csv"`,
    },
  });
}
