import { notFound } from "next/navigation";
import { getLatestFinalAiInsight, getLatestAiInsight } from "@/services/ai-insight-service";
import { buildNeuroId360Pdf } from "@/services/insight-pdf-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getApprovedSupplementRecommendation } from "@/services/supplement-service";
import { patientIdentificacao } from "@/lib/patient-demographics";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AiInsightOutput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const raw = (await getLatestFinalAiInsight(id)) ?? (await getLatestAiInsight(id));
  if (!raw) notFound();

  const output = (raw.final_output ?? raw.output) as AiInsightOutput;
  const patient = await getPatientById(id);

  // Marca da clínica (mesmo padrão visual do envio ao paciente).
  let clinic: { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null } = {};
  try {
    const current = await getCurrentClinic();
    if (current?.id) {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("clinics")
        .select("name, logo_url, primary_color, report_tagline")
        .eq("id", current.id)
        .single();
      if (data) clinic = { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color, tagline: data.report_tagline };
    }
  } catch { /* usa defaults */ }

  // Doc 3: recomendação de suplementos aprovada (manual) substitui a da IA.
  const approvedSupplement = await getApprovedSupplementRecommendation(id).catch(() => null);

  const buffer = await buildNeuroId360Pdf({
    output,
    patientName: patient?.full_name ?? null,
    clinic,
    approvedSupplement,
    demographics: patient ? patientIdentificacao(patient) : null,
  });
  const safeName = (patient?.full_name ?? "paciente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-neuro-id-360-${safeName}.pdf"`,
    },
  });
}
