import { getCurrentClinic } from "@/services/clinic-service";
import { getLeads } from "@/services/lead-service";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";

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
  if (!(await (await import("@/lib/require-finance-access")).isFinanceApiAllowed())) {
    return new Response("Forbidden", { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const leads  = await getLeads(clinic.id);
  const slug   = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");
  const stageLoc = (s: string | null | undefined) =>
    s && (["new_lead", "contacted", "scheduled", "converted_to_patient"] as string[]).includes(s) ? t(`leadStage.${s}`) : (s ?? "");
  const sourceLoc = (s: string | null | undefined) =>
    s && (["website", "instagram", "facebook", "google", "referral", "other"] as string[]).includes(s) ? t(`leadSource.${s}`) : (s ?? "");

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const headers = [t("col.name"), t("col.email"), t("col.phone"), t("col.stage"), t("col.source"), t("col.complaint"), t("col.registered")];
    const pdfRows = leads.map((l) => [
      l.full_name ?? "",
      l.email ?? "",
      l.phone ?? "",
      stageLoc(l.stage),
      sourceLoc(l.source),
      l.main_complaint ?? "",
      new Date(l.created_at).toLocaleDateString(locale),
    ]);
    const buf = await buildTablePdf({ title: t("leads.title"), headers, rows: pdfRows, clinicName: clinic.name, accentColor: "#1E40AF", locale });
    return pdfResponse(buf, `leads-${slug}.pdf`);
  }

  if (format === "xlsx") {
    const rows = leads.map((l) => ({
      nome:      l.full_name ?? "",
      email:     l.email ?? "",
      telefone:  l.phone ?? "",
      etapa:     stageLoc(l.stage),
      origem:    sourceLoc(l.source),
      queixa:    l.main_complaint ?? "",
      notas:     l.notes ?? "",
      cadastro:  new Date(l.created_at).toLocaleDateString(locale),
    }));
    const buf = await buildExcelBuffer([{
      name: t("leads.title"),
      columns: [
        { header: t("col.name"),      key: "nome",     width: 30 },
        { header: t("col.email"),     key: "email",    width: 28 },
        { header: t("col.phone"),     key: "telefone", width: 18 },
        { header: t("col.stage"),     key: "etapa",    width: 18 },
        { header: t("col.source"),    key: "origem",   width: 16 },
        { header: t("col.complaint"), key: "queixa",   width: 34 },
        { header: t("col.notes"),     key: "notas",    width: 36 },
        { header: t("col.registered"),key: "cadastro", width: 16 },
      ],
      rows,
    }]);
    return excelResponse(buf, `leads-${slug}.xlsx`);
  }

  // CSV (default)
  const headers = [t("col.name"), t("col.email"), t("col.phone"), t("col.stage"), t("col.source"), t("col.complaint"), t("col.notes"), t("col.registered")];
  const rows = leads.map((l) => [
    l.full_name ?? "",
    l.email ?? "",
    l.phone ?? "",
    stageLoc(l.stage),
    sourceLoc(l.source),
    l.main_complaint ?? "",
    l.notes ?? "",
    new Date(l.created_at).toLocaleDateString(locale),
  ]);

  const csv = [
    "﻿",
    headers.map(escCsv).join(","),
    ...rows.map((r) => r.map(escCsv).join(",")),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${slug}.csv"`,
    },
  });
}
