import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
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
  if (status === "active")   return "Ativo";
  if (status === "inactive") return "Inativo";
  if (status === "archived") return "Arquivado";
  return status;
}

export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const format  = new URL(req.url).searchParams.get("format") ?? "csv";
  const patients = await getPatients();
  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (format === "xlsx") {
    const rows = patients.map((p) => ({
      nome:         p.full_name,
      email:        p.email ?? "",
      telefone:     p.phone ?? "",
      nascimento:   p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("pt-BR") : "",
      status:       statusLabel(p.status),
      cadastrado:   new Date(p.created_at).toLocaleDateString("pt-BR"),
      observacoes:  p.notes ?? "",
    }));
    const buf = buildExcelBuffer([{
      name: "Pacientes",
      columns: [
        { header: "Nome",              key: "nome",        width: 30 },
        { header: "E-mail",            key: "email",       width: 28 },
        { header: "Telefone",          key: "telefone",    width: 18 },
        { header: "Data de nascimento",key: "nascimento",  width: 20 },
        { header: "Status",            key: "status",      width: 12 },
        { header: "Cadastrado em",     key: "cadastrado",  width: 16 },
        { header: "Observações",       key: "observacoes", width: 40 },
      ],
      rows,
    }]);
    return excelResponse(buf, `pacientes-${slug}.xlsx`);
  }

  const headers = ["Nome", "E-mail", "Telefone", "Data de nascimento", "Status", "Cadastrado em", "Observações"];
  const rows = patients.map((p) => [
    p.full_name,
    p.email ?? "",
    p.phone ?? "",
    p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("pt-BR") : "",
    statusLabel(p.status),
    new Date(p.created_at).toLocaleDateString("pt-BR"),
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
