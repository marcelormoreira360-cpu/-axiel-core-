import { notFound } from "next/navigation";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { buildNeuroIdMapPdf, buildNeuroIdPatientReportPdf } from "@/services/neuro-id-pdf-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // view=clinical → relatório técnico interno; padrão = relatório do paciente (persuasivo).
  const view = new URL(request.url).searchParams.get("view") === "clinical" ? "clinical" : "patient";

  const clinic = await getCurrentClinic();
  const map = await getLatestNeuroIdMap(id);
  if (!map) notFound();

  const patient = await getPatientById(id, clinic?.id);

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
  const buffer = view === "clinical"
    ? await buildNeuroIdMapPdf({ map, patientName, clinic: brand })
    : await buildNeuroIdPatientReportPdf({
        map, patientName, clinic: brand,
        vars: {
          q1: patient?.chief_complaint ?? null,
          q2: null,
          sintoma: patient?.chief_complaint ?? null,
        },
      });
  const safeName = (patient?.full_name ?? "paciente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mapa-bio3-${safeName}.pdf"`,
    },
  });
}
