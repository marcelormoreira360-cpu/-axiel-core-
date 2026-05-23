import { getCurrentClinic } from "@/services/clinic-service";
import { getLeads } from "@/services/lead-service";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-report";
import type { LeadSource, LeadStage } from "@/lib/types";

export const runtime = "nodejs";

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  website:  "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  google:   "Google",
  referral: "Indicação",
  other:    "Outro",
};

const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead:             "Novo lead",
  contacted:            "Contatado",
  scheduled:            "Agendado",
  converted_to_patient: "Convertido",
};

export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const leads  = await getLeads(clinic.id);
  const slug   = clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (format === "pdf") {
    const { buildTablePdf, pdfResponse } = await import("@/lib/pdf-report");
    const headers = ["Nome", "E-mail", "Telefone", "Etapa", "Origem", "Queixa", "Cadastrado"];
    const pdfRows = leads.map((l) => [
      l.full_name ?? "",
      l.email ?? "",
      l.phone ?? "",
      STAGE_LABELS[l.stage as LeadStage] ?? l.stage ?? "",
      SOURCE_LABELS[l.source as LeadSource] ?? l.source ?? "",
      l.main_complaint ?? "",
      new Date(l.created_at).toLocaleDateString("pt-BR"),
    ]);
    const buf = await buildTablePdf({ title: "Pipeline de Leads", headers, rows: pdfRows, clinicName: clinic.name, accentColor: "#1E40AF" });
    return pdfResponse(buf, `leads-${slug}.pdf`);
  }

  if (format === "xlsx") {
    const rows = leads.map((l) => ({
      nome:      l.full_name ?? "",
      email:     l.email ?? "",
      telefone:  l.phone ?? "",
      etapa:     STAGE_LABELS[l.stage as LeadStage]    ?? l.stage ?? "",
      origem:    SOURCE_LABELS[l.source as LeadSource] ?? l.source ?? "",
      queixa:    l.main_complaint ?? "",
      notas:     l.notes ?? "",
      cadastro:  new Date(l.created_at).toLocaleDateString("pt-BR"),
    }));
    const buf = await buildExcelBuffer([{
      name: "Leads",
      columns: [
        { header: "Nome",            key: "nome",     width: 30 },
        { header: "E-mail",          key: "email",    width: 28 },
        { header: "Telefone",        key: "telefone", width: 18 },
        { header: "Etapa",           key: "etapa",    width: 18 },
        { header: "Origem",          key: "origem",   width: 16 },
        { header: "Queixa principal",key: "queixa",   width: 34 },
        { header: "Notas",           key: "notas",    width: 36 },
        { header: "Cadastrado em",   key: "cadastro", width: 16 },
      ],
      rows,
    }]);
    return excelResponse(buf, `leads-${slug}.xlsx`);
  }

  // CSV (default)
  const headers = ["Nome", "E-mail", "Telefone", "Etapa", "Origem", "Queixa principal", "Notas", "Cadastrado em"];
  const rows = leads.map((l) => [
    l.full_name ?? "",
    l.email ?? "",
    l.phone ?? "",
    STAGE_LABELS[l.stage as LeadStage]    ?? l.stage ?? "",
    SOURCE_LABELS[l.source as LeadSource] ?? l.source ?? "",
    l.main_complaint ?? "",
    l.notes ?? "",
    new Date(l.created_at).toLocaleDateString("pt-BR"),
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
