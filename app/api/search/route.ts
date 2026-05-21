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
  const like = `%${q}%`;

  const [patientsRes, appointmentsRes, leadsRes] = await Promise.all([
    // Patients — search by name, email or phone
    supabase
      .from("patients")
      .select("id, full_name, email, phone, status")
      .eq("clinic_id", clinic.id)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(5),

    // Appointments — search by patient name or session type name
    supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, patients(id, full_name), session_types(name)")
      .eq("clinic_id", clinic.id)
      .order("starts_at", { ascending: false })
      .limit(100), // will filter client-side by patient name

    // Leads — search by name, email or phone
    supabase
      .from("leads")
      .select("id, full_name, email, phone, stage, source")
      .eq("clinic_id", clinic.id)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(5),
  ]);

  // Filter appointments by patient name (Supabase doesn't support ilike on joined cols directly)
  const qLower = q.toLowerCase();
  const appointments = (appointmentsRes.data ?? [])
    .filter((a) => {
      const patientName = (a.patients as { full_name?: string } | null)?.full_name ?? "";
      const sessionName = (a.session_types as { name?: string } | null)?.name ?? "";
      return (
        patientName.toLowerCase().includes(qLower) ||
        sessionName.toLowerCase().includes(qLower)
      );
    })
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      duration_minutes: a.duration_minutes,
      patient_id: (a.patients as { id?: string } | null)?.id ?? null,
      patient_name: (a.patients as { full_name?: string } | null)?.full_name ?? "—",
      session_type_name: (a.session_types as { name?: string } | null)?.name ?? null,
    }));

  return Response.json({
    patients: patientsRes.data ?? [],
    appointments,
    leads: leadsRes.data ?? [],
  });
}
