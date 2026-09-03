import { notFound } from "next/navigation";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { buildNeuroIdMapPdf, buildNeuroIdDoc1Pdf, buildNeuroIdPatientReportPdf } from "@/services/neuro-id-pdf-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { patientIdentificacao } from "@/lib/patient-demographics";
import { getLatestFinalAiInsight } from "@/services/ai-insight/insight-repository";
import { hasPersuasiveDoc1 } from "@/modules/ai-insights/patient-text-guardrails";
import { needsEmotionalSafeguard } from "@/modules/ai-insights/neuro-enums";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // view=clinical → relatório técnico interno; padrão = relatório do paciente (persuasivo).
  const view = new URL(request.url).searchParams.get("view") === "clinical" ? "clinical" : "patient";

  const clinic = await getCurrentClinic();
  if (!clinic?.id) notFound();
  const map = await getLatestNeuroIdMap(id);

  // Defense-in-depth de tenant: se HÁ mapa, ele precisa ser da clínica atual. Quando NÃO há
  // mapa (paciente só com exames/anamnese, sem questionário Q-SNA), o tenant é garantido pelo
  // getPatientById escopado por clinic_id logo abaixo.
  if (map && map.clinic_id !== clinic.id) notFound();

  const patient = await getPatientById(id, clinic.id);
  if (!patient) notFound();

  // Marca da clínica (mesmo padrão do relatório 360).
  let brand: { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null } = {};
  try {
    if (clinic?.id) {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("clinics")
        .select("name, logo_url, primary_color, report_tagline")
        .eq("id", clinic.id)
        .single();
      if (data) brand = { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color, tagline: data.report_tagline };
    }
  } catch { /* usa defaults */ }

  const patientName = patient?.full_name ?? null;
  let buffer: Buffer;
  if (view === "clinical") {
    // O relatório técnico clínico É o Mapa Bio³ — sem questionário/mapa não há o que emitir.
    if (!map) notFound();
    buffer = await buildNeuroIdMapPdf({ map, patientName, clinic: brand, demographics: patient ? patientIdentificacao(patient) : null });
  } else {
    // Rota A: se existe um Doc 1 APROVADO (review_status="final") no formato persuasivo,
    // o PDF sai das 8 seções aprovadas. Senão, cai no PDF por scores (que exige o mapa).
    const finalInsight = await getLatestFinalAiInsight(id);
    const finalOutput = finalInsight?.final_output ?? finalInsight?.output ?? null;
    const mapa = finalOutput?.mapa_integrativo ?? null;
    // Salvaguarda emocional DETERMINÍSTICA (gate Salvo): da disfunção CRUA, nunca do texto da IA.
    const showSafeguard = needsEmotionalSafeguard(map?.emocional_pct ?? null);
    if (mapa && hasPersuasiveDoc1(mapa)) {
      // Doc 1 SAI mesmo sem Mapa Bio³ (paciente só com exames/anamnese): a seção 2 degrada
      // graciosamente (sem anel) e as seções de exames/plano carregam o relatório.
      buffer = await buildNeuroIdDoc1Pdf({ mapa, bio3: map ?? null, plano: finalOutput?.plano_regulacao ?? null, patientName, clinic: brand, showSafeguard });
    } else if (map) {
      buffer = await buildNeuroIdPatientReportPdf({
        map, patientName, clinic: brand, showSafeguard,
        vars: {
          q1: patient?.chief_complaint ?? null,
          q2: null,
          sintoma: patient?.chief_complaint ?? null,
        },
      });
    } else {
      // Sem mapa E sem Doc 1 aprovado: não há conteúdo para o relatório do paciente.
      notFound();
    }
  }
  const safeName = (patient?.full_name ?? "paciente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mapa-bio3-${safeName}.pdf"`,
    },
  });
}
