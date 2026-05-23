import { getCurrentClinic } from "@/services/clinic-service";
import { getPaymentsWithPatients, paymentMethodLabel } from "@/services/finance-service";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
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

  if (format === "xlsx") {
    const rows = payments.map((p) => ({
      data:    new Date(p.paid_at).toLocaleDateString("pt-BR"),
      paciente: p.patient_name ?? "",
      tipo:    p.session_type_name ?? "",
      metodo:  paymentMethodLabel(p.payment_method as PaymentMethod),
      valor:   (p.amount_cents / 100),
      notas:   p.notes ?? "",
    }));
    const buf = await buildExcelBuffer([{
      name: "Pagamentos",
      columns: [
        { header: "Data",              key: "data",     width: 14 },
        { header: "Paciente",          key: "paciente", width: 30 },
        { header: "Tipo de sessão",    key: "tipo",     width: 24 },
        { header: "Forma de pagamento",key: "metodo",   width: 22 },
        { header: "Valor (R$)",        key: "valor",    width: 14 },
        { header: "Notas",             key: "notas",    width: 36 },
      ],
      rows,
    }]);
    return excelResponse(buf, `pagamentos-${slug}.xlsx`);
  }

  // CSV (default)
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
