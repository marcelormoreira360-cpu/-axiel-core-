import { getCurrentClinic } from "@/services/clinic-service";
import { getPaymentsWithPatients, paymentMethodLabel } from "@/services/finance-service";
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

  const url  = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to   = url.searchParams.get("to")   ?? undefined;

  const payments = await getPaymentsWithPatients(clinic.id, { from, to, limit: 10000 });

  const headers = ["Data", "Paciente", "Tipo de sessão", "Forma de pagamento", "Valor (R$)", "Notas"];
  const rows = payments.map((p) => [
    new Date(p.paid_at).toLocaleDateString("pt-BR"),
    p.patient_name ?? "",
    p.session_type_name ?? "",
    paymentMethodLabel(p.payment_method as PaymentMethod),
    (p.amount_cents / 100).toFixed(2).replace(".", ","),
    p.notes ?? "",
  ]);

  const csv = [
    "﻿", // UTF-8 BOM for Excel
    headers.map(escCsv).join(","),
    ...rows.map((r) => r.map(escCsv).join(",")),
  ].join("\r\n");

  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagamentos-${slug}.csv"`,
    },
  });
}
