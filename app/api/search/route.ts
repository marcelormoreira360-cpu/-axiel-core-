import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return Response.json({ patients: [], appointments: [], leads: [] });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const supabase = await createSupabaseServerClient();
  // SEC-07: escape LIKE wildcards so a query like "%%%" can't force a full table scan
  const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const like = `%${escaped}%`;

  const [patientsRes, leadsRes] = await Promise.all([
    // Patients — search by name, email or phone
    supabase
      .from("patients")
      .select("id, full_name, email, phone, status")
      .eq("clinic_id", clinic.id)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(5),

    // Leads — search by name, email or phone
    supabase
      .from("leads")
      .select("id, full_name, email, phone, stage, source")
      .eq("clinic_id", clinic.id)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(5),
  ]);

  // Search appointments server-side using matched patient IDs (avoids large client-side filter)
  const matchedPatientIds = (patientsRes.data ?? []).map((p) => p.id);
  let appointments: {
    id: string;
    starts_at: string;
    duration_minutes: number;
    patient_id: string | null;
    patient_name: string;
    session_type_name: string | null;
  }[] = [];

  if (matchedPatientIds.length > 0) {
    const appointmentsRes = await supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, patients(id, full_name), session_types(name)")
      .eq("clinic_id", clinic.id)
      .in("patient_id", matchedPatientIds)
      .order("starts_at", { ascending: false })
      .limit(30);

    appointments = (appointmentsRes.data ?? []).slice(0, 5).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      duration_minutes: a.duration_minutes,
      patient_id: (a.patients as { id?: string } | null)?.id ?? null,
      patient_name: (a.patients as { full_name?: string } | null)?.full_name ?? "—",
      session_type_name: (a.session_types as { name?: string } | null)?.name ?? null,
    }));
  }

  return Response.json({
    patients: patientsRes.data ?? [],
    appointments,
    leads: leadsRes.data ?? [],
  });
}
