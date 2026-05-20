import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";

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

export async function GET() {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const patients = await getPatients();

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

  const slug = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pacientes-${slug}.csv"`,
    },
  });
}
