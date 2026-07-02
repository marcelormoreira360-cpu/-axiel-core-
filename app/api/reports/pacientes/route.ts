import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
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

  const format   = new URL(req.url).searchParams.get("format") ?? "csv";
  const patients = await getPatients();
  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");
  const statusLoc = (s: string) =>
    (["active", "inactive", "archived"] as string[]).includes(s) ? t(`patientStatus.${s}`) : s;

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const headers = [t("col.name"), t("col.email"), t("col.phone"), t("col.dob"), t("col.status"), t("col.registered")];
    const pdfRows = patients.map((p) => [
      p.full_name,
      p.email ?? "",
      p.phone ?? "",
      p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString(locale) : "",
      statusLoc(p.status),
      new Date(p.created_at).toLocaleDateString(locale),
    ]);
    const buf = await buildTablePdf({ title: t("patients.title"), headers, rows: pdfRows, clinicName: clinic.name, accentColor: "#0F6E56", locale });
    return pdfResponse(buf, `pacientes-${slug}.pdf`);
  }

  if (format === "xlsx") {
    const rows = patients.map((p) => ({
      nome:         p.full_name,
      email:        p.email ?? "",
      telefone:     p.phone ?? "",
      nascimento:   p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString(locale) : "",
      status:       statusLoc(p.status),
      cadastrado:   new Date(p.created_at).toLocaleDateString(locale),
      observacoes:  p.notes ?? "",
    }));
    const buf = await buildExcelBuffer([{
      name: t("patients.title"),
      columns: [
        { header: t("col.name"),       key: "nome",        width: 30 },
        { header: t("col.email"),      key: "email",       width: 28 },
        { header: t("col.phone"),      key: "telefone",    width: 18 },
        { header: t("col.dob"),        key: "nascimento",  width: 20 },
        { header: t("col.status"),     key: "status",      width: 12 },
        { header: t("col.registered"), key: "cadastrado",  width: 16 },
        { header: t("col.notes"),      key: "observacoes", width: 40 },
      ],
      rows,
    }]);
    return excelResponse(buf, `pacientes-${slug}.xlsx`);
  }

  // CSV (default)
  const headers = [t("col.name"), t("col.email"), t("col.phone"), t("col.dob"), t("col.status"), t("col.registered"), t("col.notes")];
  const rows = patients.map((p) => [
    p.full_name,
    p.email ?? "",
    p.phone ?? "",
    p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString(locale) : "",
    statusLoc(p.status),
    new Date(p.created_at).toLocaleDateString(locale),
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
      "Content-Disposition": `attachment; filename="pacientes-${slug}.csv"`,
    },
  });
}
