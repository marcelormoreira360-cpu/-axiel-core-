import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const url  = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to   = url.searchParams.get("to")   ?? undefined;

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

  const csv = [
    "﻿",
    headers.map(escCsv).join(","),
    ...rows.map((r) => r.map(escCsv).join(",")),
  ].join("\r\n");

  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sessoes-${slug}.csv"`,
    },
  });
}
