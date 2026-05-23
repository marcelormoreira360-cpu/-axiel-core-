import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";

export const runtime = "nodejs";

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "Agendada",
    completed: "Realizada",
    cancelled: "Cancelada",
    no_show:   "Não compareceu",
  };
  return map[status] ?? status;
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

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const periodLabel = from && to
      ? `${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")}`
      : "Todos os períodos";
    const headers = ["Data", "Hora", "Paciente", "Tipo de sessão", "Status", "Valor (R$)"];
    const pdfRows = appts.map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const st      = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
      const d       = new Date(a.starts_at);
      return [
        d.toLocaleDateString("pt-BR"),
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        (patient as { full_name?: string } | null)?.full_name ?? "",
        (st as { name?: string } | null)?.name ?? "",
        statusLabel(a.status ?? ""),
        (st as { price_cents?: number } | null)?.price_cents
          ? ((st as { price_cents: number }).price_cents / 100).toFixed(2).replace(".", ",")
          : "",
      ];
    });
    const buf = await buildTablePdf({ title: "Histórico de Sessões", periodLabel, headers, rows: pdfRows, clinicName: clinic.name, accentColor: "#0F6E56" });
    return pdfResponse(buf, `sessoes-${slug}.pdf`);
  }

  const headers = ["Data", "Hora", "Paciente", "E-mail", "Telefone", "Tipo de sessão", "Duração (min)", "Status", "Valor (R$)", "Notas"];
  const rows = appts.map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const st      = Array.isArray(a.session_types) ? a.session_types[0] : a.session_types;
    const d       = new Date(a.starts_at);
    return [
      d.toLocaleDateString("pt-BR"),
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      (patient as { full_name?: string } | null)?.full_name ?? "",
      (patient as { email?: string }    | null)?.email ?? "",
      (patient as { phone?: string }    | null)?.phone ?? "",
      (st as { name?: string }          | null)?.name ?? "",
      String(a.duration_minutes ?? ""),
      statusLabel(a.status ?? ""),
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
        data:     d.toLocaleDateString("pt-BR"),
        hora:     d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        paciente: (patient as { full_name?: string } | null)?.full_name ?? "",
        email:    (patient as { email?: string }    | null)?.email ?? "",
        telefone: (patient as { phone?: string }    | null)?.phone ?? "",
        tipo:     (st as { name?: string }          | null)?.name ?? "",
        duracao:  a.duration_minutes ?? "",
        status:   statusLabel(a.status ?? ""),
        valor:    (st as { price_cents?: number }   | null)?.price_cents
          ? (st as { price_cents: number }).price_cents / 100
          : "",
        notas:    a.notes ?? "",
      };
    });
    const buf = await buildExcelBuffer([{
      name: "Sessões",
      columns: [
        { header: "Data",          key: "data",     width: 14 },
        { header: "Hora",          key: "hora",     width: 10 },
        { header: "Paciente",      key: "paciente", width: 30 },
        { header: "E-mail",        key: "email",    width: 28 },
        { header: "Telefone",      key: "telefone", width: 18 },
        { header: "Tipo de sessão",key: "tipo",     width: 24 },
        { header: "Duração (min)", key: "duracao",  width: 14 },
        { header: "Status",        key: "status",   width: 16 },
        { header: "Valor (R$)",    key: "valor",    width: 14 },
        { header: "Notas",         key: "notas",    width: 36 },
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
