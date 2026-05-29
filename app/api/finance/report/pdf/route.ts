import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";
import { buildTablePdf, pdfResponse } from "@/lib/pdf-report";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "this_month";

  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  let from: Date;
  let label: string;

  switch (period) {
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      label = "Mês anterior";
      break;
    case "last_3m":
      from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      label = "Últimos 3 meses";
      break;
    case "last_6m":
      from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      label = "Últimos 6 meses";
      break;
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      label = "Este ano";
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Este mês";
  }

  const { data: payments } = await supabase
    .from("patient_payments")
    .select("paid_at, amount_cents, method, notes, patients(full_name), session_types(name)")
    .eq("clinic_id", clinic.id)
    .gte("paid_at", from.toISOString())
    .order("paid_at", { ascending: false });

  const rows = (payments ?? []).map((p) => {
    const patient = Array.isArray(p.patients) ? p.patients[0] : p.patients;
    const st = Array.isArray(p.session_types) ? p.session_types[0] : p.session_types;
    return [
      new Date(p.paid_at).toLocaleDateString("pt-BR"),
      (patient as { full_name?: string } | null)?.full_name ?? "—",
      (st as { name?: string } | null)?.name ?? "—",
      p.method ?? "—",
      `R$ ${(p.amount_cents / 100).toFixed(2).replace(".", ",")}`,
    ];
  });

  const totalCents = (payments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  const buffer = await buildTablePdf({
    title: `Relatório Financeiro — ${label}`,
    clinicName: clinic.name ?? "Clínica",
    headers: ["Data", "Paciente", "Tipo de sessão", "Pagamento", "Valor"],
    rows,
    summary: `Total: R$ ${(totalCents / 100).toFixed(2).replace(".", ",")} · ${rows.length} pagamento${rows.length !== 1 ? "s" : ""}`,
  });

  const filename = `financeiro_${period}_${now.toISOString().slice(0, 10)}.pdf`;
  return pdfResponse(buffer, filename);
}
