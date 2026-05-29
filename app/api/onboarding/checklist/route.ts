import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";

export interface OnboardingChecklistResult {
  steps: {
    session_types: boolean;
    patients: boolean;
    appointments: boolean;
    forms: boolean;
    booking: boolean;
    team: boolean;
  };
  completed: number;
  total: number;
}

export async function GET() {
  try {
    const clinic = await getCurrentClinic();
    if (!clinic) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const cid = clinic.id;

    const [
      { count: sessionTypesCount },
      { count: patientsCount },
      { count: appointmentsCount },
      { count: formsCount },
      { count: hoursCount },
      { count: teamCount },
    ] = await Promise.all([
      supabase
        .from("session_types")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
      supabase
        .from("assessment_templates")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
      supabase
        .from("working_hours")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
      supabase
        .from("clinic_users")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", cid),
    ]);

    const steps = {
      session_types: (sessionTypesCount ?? 0) > 0,
      patients: (patientsCount ?? 0) > 0,
      appointments: (appointmentsCount ?? 0) > 0,
      forms: (formsCount ?? 0) > 0,
      booking: (hoursCount ?? 0) > 0,
      team: (teamCount ?? 0) > 1,
    };

    const completed = Object.values(steps).filter(Boolean).length;
    const total = Object.keys(steps).length;

    return NextResponse.json({ steps, completed, total } satisfies OnboardingChecklistResult);
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
