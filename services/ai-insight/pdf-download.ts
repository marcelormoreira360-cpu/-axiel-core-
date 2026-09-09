import type {
  AiInsight,
  AiInsightOutput,
  NeuroProtocoloSuplementacao,
  NeuroRelatorioHipersensibilidade,
} from "@/lib/types";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { needsEmotionalSafeguard } from "@/modules/ai-insights/neuro-enums";
import { hasPersuasiveDoc1 } from "@/modules/ai-insights/patient-text-guardrails";
import {
  buildNeuroIdDoc1Pdf,
  buildNeuroIdPatientReportPdf,
  buildNeuroIdSupplementPdf,
  buildNeuroIdHypersensitivityPdf,
} from "@/services/neuro-id-pdf-service";
import { getSupplementCatalog, resolveSupplementCountry } from "@/services/supplement-service";

/**
 * FONTE ÚNICA de geração dos PDFs Neuro ID por documento (Relatório = Doc 1+2,
 * Suplementação = Doc 3, Hipersensibilidade). Tanto o ENVIO ao paciente
 * (services/ai-insight/delivery.ts) quanto o DOWNLOAD manual pelo profissional
 * (app/api/patients/[id]/neuro-id/pdf) chamam estas funções, de modo que o PDF
 * baixado é BYTE A BYTE o mesmo que o paciente recebe — nunca divergem.
 *
 * Cada função recebe o `insight` JÁ CARREGADO (o chamador decide se é o final ou
 * o rascunho em revisão) e o paciente, e devolve { buffer, filename } ou null
 * quando aquele documento não tem conteúdo.
 */

type ClinicBrand = { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null };

export type RenderedPdf = { buffer: Buffer; filename: string };

/** Só os campos do paciente que os builders precisam (estruturalmente compatível com getPatientById). */
export type PatientForPdf = {
  id: string;
  clinic_id?: string | null;
  full_name?: string | null;
  country?: string | null;
  locale?: string | null;
  chief_complaint?: string | null;
};

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function outputOf(insight: AiInsight): AiInsightOutput | null {
  return (insight.final_output ?? insight.output) as AiInsightOutput | null;
}

async function fetchClinicBrand(clinicId?: string | null): Promise<ClinicBrand> {
  if (!clinicId) return {};
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("clinics")
      .select("name, logo_url, primary_color, report_tagline")
      .eq("id", clinicId)
      .single();
    if (data) return { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color, tagline: data.report_tagline };
  } catch {
    /* sem marca: usa defaults */
  }
  return {};
}

/** RELATÓRIO DO PACIENTE = Documento 1 + Documento 2 fundidos (mesma lógica do envio e da tela). */
export async function renderPatientReportPdf(insight: AiInsight, patient: PatientForPdf): Promise<RenderedPdf | null> {
  const out = outputOf(insight);
  if (!out) return null;

  const clinicBrand = await fetchClinicBrand(insight.clinic_id ?? patient.clinic_id);
  const map = await getLatestNeuroIdMap(patient.id);
  const mapa = out.mapa_integrativo ?? null;
  // Salvaguarda emocional DETERMINÍSTICA (gate Salvo): da disfunção CRUA, nunca do texto da IA.
  const showSafeguard = needsEmotionalSafeguard(map?.emocional_pct ?? null);
  const filename = `relatorio-neuro-id-${patient.id.slice(0, 8)}.pdf`;

  if (mapa && hasPersuasiveDoc1(mapa)) {
    const buffer = await buildNeuroIdDoc1Pdf({
      mapa,
      bio3: map ?? null,
      plano: out.plano_regulacao ?? null,
      patientName: patient.full_name ?? null,
      clinic: clinicBrand,
      showSafeguard,
    });
    return { buffer, filename };
  }
  if (map) {
    const buffer = await buildNeuroIdPatientReportPdf({
      map,
      patientName: patient.full_name ?? null,
      clinic: clinicBrand,
      showSafeguard,
      vars: { q1: patient.chief_complaint ?? null, q2: null, sintoma: patient.chief_complaint ?? null },
    });
    return { buffer, filename };
  }
  // Sem Doc 1 persuasivo E sem Mapa Bio³: não há relatório do paciente a gerar.
  return null;
}

/** DOCUMENTO 3 — Suplementação (BR fórmula / US lista com link do catálogo da clínica). */
export async function renderSupplementPdf(insight: AiInsight, patient: PatientForPdf): Promise<RenderedPdf | null> {
  const out = outputOf(insight);
  const protocolo = out?.protocolo_suplementacao;
  const hasItens = !!protocolo?.itens?.some((it) => it.nome?.trim());
  const hasFormulas = !!protocolo?.formulas?.some((f) => f.nome?.trim() || f.composicao?.length);
  if (!protocolo || (!hasItens && !hasFormulas)) return null;

  const country = resolveSupplementCountry(patient.country ?? null, patient.locale ?? null);

  // EUA: casa cada item sem link com o catálogo da clínica (por nome) para puxar o
  // buy_url do profissional; storeUrl = link ÚNICO da loja. Brasil: fórmula, sem link.
  let enriched: NeuroProtocoloSuplementacao = protocolo;
  let storeUrl: string | null = null;
  if (country === "US" && patient.clinic_id) {
    const catalog = await getSupplementCatalog(patient.clinic_id, { activeOnly: true }).catch(() => []);
    const withUrl = catalog.filter((c) => c.country === "US" && c.buy_url);
    const byName = new Map(withUrl.map((c) => [norm(c.name), c.buy_url as string]));
    const anyUrl = withUrl[0]?.buy_url ?? undefined;
    storeUrl = anyUrl ? anyUrl.split("/products/")[0] : null;
    enriched = {
      ...protocolo,
      itens: protocolo.itens.map((it) => ({ ...it, buy_url: it.buy_url?.trim() || byName.get(norm(it.nome)) || undefined })),
    };
  }

  const clinicBrand = await fetchClinicBrand(insight.clinic_id ?? patient.clinic_id);
  const buffer = await buildNeuroIdSupplementPdf({
    protocolo: enriched,
    country,
    patientName: patient.full_name ?? null,
    clinic: clinicBrand,
    storeUrl,
  });
  return { buffer, filename: `suplementacao-${patient.id.slice(0, 8)}.pdf` };
}

/** Relatório de Hipersensibilidade (só quando há dados do teste capilar no insight). */
export async function renderHypersensitivityPdf(insight: AiInsight, patient: PatientForPdf): Promise<RenderedPdf | null> {
  const out = outputOf(insight);
  const relatorio: NeuroRelatorioHipersensibilidade | undefined = out?.relatorio_hipersensibilidade;
  const hasContent = !!relatorio && (
    (relatorio.achados_prioritarios?.length ?? 0) > 0 ||
    (relatorio.retirada_alta?.length ?? 0) > 0 ||
    (relatorio.padroes?.length ?? 0) > 0 ||
    (relatorio.fases?.length ?? 0) > 0
  );
  if (!relatorio || !hasContent) return null;

  const country = resolveSupplementCountry(patient.country ?? null, patient.locale ?? null);
  const clinicBrand = await fetchClinicBrand(insight.clinic_id ?? patient.clinic_id);
  const buffer = await buildNeuroIdHypersensitivityPdf({
    relatorio,
    country,
    patientName: patient.full_name ?? null,
    clinic: clinicBrand,
  });
  return { buffer, filename: `hipersensibilidade-${patient.id.slice(0, 8)}.pdf` };
}
