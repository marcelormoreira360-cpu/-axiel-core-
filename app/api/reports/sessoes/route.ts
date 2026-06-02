import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from")   ?? undefined;
  const to     = url.searchParams.get("to")     ?? undefined;
  const format = url.searchParams.get("format") ?? "csv";

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("appointments")
    .select("starts_at, duration_minutes, status, notes, patients(full_name, email, phone), session_types(name, price_cents)")
    .eq("clinic_id", clinic.id)
    .order("starts_at", { ascending: false })
    .limit(10000);

  if (from) q = q.gte("starts_at", from);
  if (to)   q = q.lte("starts_at", to);

  const { data } = await q;
  const appts = data ?? [];

  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const locale = await resolveClinicLocale(clinic.id);
  const t = await getServerT(locale, "pdf");
  const statusLoc = (s: string) =>
    (["scheduled", "completed", "cancelled", "no_show"] as string[]).includes(s) ? t(`sessionStatus.${s}`) : s;

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const periodLabel = from && to
      ? t("range", { from: new Date(from).toLocaleDateString(locale), to: new Date(to).toLocaleDateString(locale) })
      : t("allPeriods");
    const headers = [t("col.date"), t("col.time"), t("col.patient"), t("col.sessionType"), t("col.status"), t("col.value")];
    const pdfRows = appts.map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const st      = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
      const d       = new Date(a.starts_at);
      return [
        d.toLocaleDateString(locale),
        d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
        (patient as { full_name?: string } | null)?.full_name ?? "",
        (st as { name?: string } | null)?.name ?? "",
        statusLoc(a.status ?? ""),
        (st as { price_cents?: number } | null)?.price_cents
          ? ((st as { price_cents: number }).price_cents / 100).toFixed(2).replace(".", ",")
          : "",
      ];
    });
    const buf = await buildTablePdf({ title: t("sessions.title"), periodLabel, headers, rows: pdfRows, clinicName: clinic.name, accentColor: "#0F6E56", locale });
    return pdfResponse(buf, `sessoes-${slug}.pdf`);
  }

  const headers = [t("col.date"), t("col.time"), t("col.patient"), t("col.email"), t("col.phone"), t("col.sessionType"), t("col.duration"), t("col.status"), t("col.value"), t("col.notes")];
  const rows = appts.map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const st      = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
    const d       = new Date(a.starts_at);
    return [
      d.toLocaleDateString(locale),
      d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      (patient as { full_name?: string } | null)?.full_name ?? "",
      (patient as { email?: string }    | null)?.email ?? "",
      (patient as { phone?: string }    | null)?.phone ?? "",
      (st as { name?: string }          | null)?.name ?? "",
      String(a.duration_minutes ?? ""),
      statusLoc(a.status ?? ""),
      (st as { price_cents?: number }   | null)?.price_cents
        ? ((st as { price_cents: number }).price_cents / 100).toFixed(2).replace(".", ",")
        : "",
      a.notes ?? "",
    ];
  });

  if (format === "xlsx") {
    const xlsxRows = appts.map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const st      = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
      const d       = new Date(a.starts_at);
      return {
        data:     d.toLocaleDateString(locale),
        hora:     d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
        paciente: (patient as { full_name?: string } | null)?.full_name ?? "",
        email:    (patient as { email?: string }    | null)?.email ?? "",
        telefone: (patient as { phone?: string }    | null)?.phone ?? "",
        tipo:     (st as { name?: string }          | null)?.name ?? "",
        duracao:  a.duration_minutes ?? "",
        status:   statusLoc(a.status ?? ""),
        valor:    (st as { price_cents?: number }   | null)?.price_cents
          ? (st as { price_cents: number }).price_cents / 100
          : "",
        notas:    a.notes ?? "",
      };
    });
    const buf = await buildExcelBuffer([{
      name: t("sessions.title"),
      columns: [
        { header: t("col.date"),        key: "data",     width: 14 },
        { header: t("col.time"),        key: "hora",     width: 10 },
        { header: t("col.patient"),     key: "paciente", width: 30 },
        { header: t("col.email"),       key: "email",    width: 28 },
        { header: t("col.phone"),       key: "telefone", width: 18 },
        { header: t("col.sessionType"), key: "tipo",     width: 24 },
        { header: t("col.duration"),    key: "duracao",  width: 14 },
        { header: t("col.status"),      key: "status",   width: 16 },
        { header: t("col.value"),       key: "valor",    width: 14 },
        { header: t("col.notes"),       key: "notas",    width: 36 },
      ],
      rows: xlsxRows,
    }]);
    return excelResponse(buf, `sessoes-${slug}.xlsx`);
  }

  const csv = [
    "﻿",
    headers.map(escCsv).join(","),
    ...rows.map((r) => r.map(escCsv).join(",")),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sessoes-${slug}.csv"`,
    },
  });
}
