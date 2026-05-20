import { getCurrentClinic } from "@/services/clinic-service";
import { getLeads } from "@/services/lead-service";
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

export async function GET() {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const leads = await getLeads(clinic.id);

  const headers = [
    "Nome",
    "E-mail",
    "Telefone",
    "Etapa",
    "Origem",
    "Queixa principal",
    "Notas",
    "Cadastrado em",
  ];

  const rows = leads.map((l) => [
    l.full_name ?? "",
    l.email ?? "",
    l.phone ?? "",
    STAGE_LABELS[l.stage as LeadStage]  ?? l.stage ?? "",
    SOURCE_LABELS[l.source as LeadSource] ?? l.source ?? "",
    l.main_complaint ?? "",
    l.notes ?? "",
    new Date(l.created_at).toLocaleDateString("pt-BR"),
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
      "Content-Disposition": `attachment; filename="leads-${slug}.csv"`,
    },
  });
}
