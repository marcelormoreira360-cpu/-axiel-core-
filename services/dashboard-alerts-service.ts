export type PackageAlert = {
  patientId: string;
  patientName: string;
  packageName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  remaining: number;
};

export type BiomarkerAlert = {
  patientId: string;
  patientName: string;
  biomarker: string;
  value: number;
  unit: string | null;
  status: "high" | "low";
  examDate: string;
};

export type DashboardAlerts = {
  packageAlerts: PackageAlert[];
  biomarkerAlerts: BiomarkerAlert[];
};

export async function getDashboardAlerts(clinicId: string): Promise<DashboardAlerts> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  const [{ data: packages }, { data: recentExams }] = await Promise.all([
    supabase
      .from("patient_packages")
      .select("id, patient_id, name, sessions_total, start_date, patients(full_name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("patient_exams")
      .select("exam_date, patient_id, patients(full_name), exam_results(biomarker, value, unit, status)")
      .eq("clinic_id", clinicId)
      .order("exam_date", { ascending: false })
      .limit(20),
  ]);

  // PERF-02: fetch appointments only for active-package patients, scoped to
  // the earliest package start_date so we don't load the full history.
  const activePackages = packages ?? [];
  const packagePatientIds = [...new Set(activePackages.map((p) => p.patient_id))];
  const earliestStartDate = activePackages.reduce<string | null>(
    (min, p) => (!min || p.start_date < min ? p.start_date : min),
    null,
  );

  let appointments: { id: string; patient_id: string; starts_at: string }[] = [];
  if (packagePatientIds.length > 0 && earliestStartDate) {
    const { data } = await supabase
      .from("appointments")
      .select("id, patient_id, starts_at")
      .eq("clinic_id", clinicId)
      .in("patient_id", packagePatientIds)
      .gte("starts_at", earliestStartDate + "T00:00:00");
    appointments = data ?? [];
  }

  // Package alerts — remaining ≤ 2
  const packageAlerts: PackageAlert[] = [];
  for (const pkg of activePackages) {
    const used = appointments.filter(
      (a) => a.patient_id === pkg.patient_id &&
        new Date(a.starts_at) >= new Date(pkg.start_date + "T00:00:00")
    ).length;
    const remaining = pkg.sessions_total - used;
    if (remaining <= 2) {
      packageAlerts.push({
        patientId: pkg.patient_id,
        patientName: (pkg.patients as { full_name?: string } | null)?.full_name ?? "Paciente",
        packageName: pkg.name,
        sessionsTotal: pkg.sessions_total,
        sessionsUsed: used,
        remaining,
      });
    }
  }

  // Biomarker alerts — high or low from recent exams
  const biomarkerAlerts: BiomarkerAlert[] = [];
  const seen = new Set<string>();

  for (const exam of recentExams ?? []) {
    type ExamResult = { biomarker: string; value: string | number; unit: string | null; status: string };
    for (const result of (exam.exam_results as ExamResult[]) ?? []) {
      if (result.status !== "high" && result.status !== "low") continue;
      const key = `${exam.patient_id}-${result.biomarker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      biomarkerAlerts.push({
        patientId: exam.patient_id,
        patientName: (exam.patients as { full_name?: string } | null)?.full_name ?? "Paciente",
        biomarker: result.biomarker,
        value: Number(result.value),
        unit: result.unit ?? null,
        status: result.status,
        examDate: exam.exam_date,
      });
      if (biomarkerAlerts.length >= 6) break;
    }
    if (biomarkerAlerts.length >= 6) break;
  }

  return { packageAlerts, biomarkerAlerts };
}
