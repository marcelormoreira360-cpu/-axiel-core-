import { notFound } from "next/navigation";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { buildNeuroIdMapPdf, buildNeuroIdPatientReportPdf } from "@/services/neuro-id-pdf-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { patientIdentificacao } from "@/lib/patient-demographics";
import { needsEmotionalSafeguard } from "@/modules/ai-insights/neuro-enums";
import { getAiInsightById, getLatestAiInsight } from "@/services/ai-insight/insight-repository";
import { renderPatientReportPdf, renderSupplementPdf, renderHypersensitivityPdf } from "@/services/ai-insight/pdf-download";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Documentos Neuro ID baixáveis pelo PROFISSIONAL (para imprimir/entregar em mão a
// pacientes sem WhatsApp/e-mail). O gerador é o MESMO do envio ao paciente
// (services/ai-insight/pdf-download.ts), então o PDF é idêntico ao que o paciente
// receberia — e idêntico ao que aparece no card de revisão.
const DOC_TYPES = ["report", "supplement", "hypersensitivity"] as const;
type DocType = (typeof DOC_TYPES)[number];

type ClinicBrand = { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  // view=clinical → Mapa Bio³ técnico interno (pirâmide/índice). Padrão = documento do paciente.
  const view = url.searchParams.get("view") === "clinical" ? "clinical" : "patient";
  const docParam = url.searchParams.get("doc") ?? "report";
  const doc: DocType = (DOC_TYPES as readonly string[]).includes(docParam) ? (docParam as DocType) : "report";
  // insight=<id> renderiza EXATAMENTE aquele card. SEM insight (ex.: "Ver PDF" do painel Bio³)
  // usa o insight MAIS RECENTE (mesmo que a tela mostra no topo), para que TODOS os botões de
  // "abrir relatório em PDF" gerem o MESMO documento — casando com o que se vê. Enquanto não
  // aprovado, é o rascunho; depois de aprovar, o próprio final vira o mais recente. Se não houver
  // nenhum insight mas houver Mapa Bio³, cai no relatório por scores (comportamento anterior).
  const insightIdParam = url.searchParams.get("insight");

  const clinic = await getCurrentClinic();
  if (!clinic?.id) notFound();
  const map = await getLatestNeuroIdMap(id);

  // Defense-in-depth de tenant: se HÁ mapa, ele precisa ser da clínica atual. Quando NÃO há
  // mapa, o tenant é garantido pelo getPatientById escopado por clinic_id logo abaixo.
  if (map && map.clinic_id !== clinic.id) notFound();

  const patient = await getPatientById(id, clinic.id);
  if (!patient) notFound();

  const safeName = (patient.full_name ?? "paciente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente";
  const brand = await fetchClinicBrand(clinic.id);

  // ── Mapa Bio³ técnico interno ──────────────────────────────────────────────
  if (view === "clinical") {
    if (!map) notFound();
    const buffer = await buildNeuroIdMapPdf({ map, patientName: patient.full_name ?? null, clinic: brand, demographics: patientIdentificacao(patient) });
    return pdfResponse(buffer, `mapa-bio3-${safeName}.pdf`);
  }

  // ── Documentos do paciente (Doc 1+2 / Suplementação / Hipersensibilidade) ───
  let insight = insightIdParam ? await getAiInsightById(insightIdParam) : await getLatestAiInsight(id);
  // Escopo de tenant/paciente quando veio um insight explícito por id.
  if (insightIdParam && insight && (insight.patient_id !== id || insight.clinic_id !== clinic.id)) insight = null;

  if (doc === "supplement" || doc === "hypersensitivity") {
    if (!insight) notFound();
    const rendered = doc === "supplement"
      ? await renderSupplementPdf(insight, patient)
      : await renderHypersensitivityPdf(insight, patient);
    if (!rendered) notFound();
    return pdfResponse(rendered.buffer, rendered.filename);
  }

  // doc === "report" (Doc 1 + Doc 2 fundidos)
  const rendered = insight ? await renderPatientReportPdf(insight, patient) : null;
  if (rendered) return pdfResponse(rendered.buffer, rendered.filename);

  // Sem relatório persuasivo aprovado, mas com Mapa Bio³ (Q-SNA): mantém o relatório por scores.
  if (map) {
    const showSafeguard = needsEmotionalSafeguard(map.emocional_pct ?? null);
    const buffer = await buildNeuroIdPatientReportPdf({
      map,
      patientName: patient.full_name ?? null,
      clinic: brand,
      showSafeguard,
      vars: { q1: patient.chief_complaint ?? null, q2: null, sintoma: patient.chief_complaint ?? null },
    });
    return pdfResponse(buffer, `relatorio-neuro-id-${safeName}.pdf`);
  }
  notFound();
}

async function fetchClinicBrand(clinicId: string): Promise<ClinicBrand> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("clinics")
      .select("name, logo_url, primary_color, report_tagline")
      .eq("id", clinicId)
      .single();
    if (data) return { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color, tagline: data.report_tagline };
  } catch { /* usa defaults */ }
  return {};
}

function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: abre no visualizador do navegador (ver/imprimir/salvar) em vez de baixar direto.
      "Content-Disposition": `inline; filename="${filename}"`,
      // no-store: o relatório é gerado por request a partir do insight editável. Sem isso
      // o Safari cacheia o PDF inline na MESMA URL e, depois de o terapeuta editar
      // (ex.: "próximos passos"), reabrir mostrava a versão ANTIGA. Força PDF fresco.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
