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

  const [{ data: packages }, { data: appointments }, { data: recentExams }] = await Promise.all([
    supabase
      .from("patient_packages")
      .select("id, patient_id, name, sessions_total, start_date, patients(full_name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("appointments")
      .select("id, patient_id, starts_at")
      .eq("clinic_id", clinicId),
    supabase
      .from("patient_exams")
      .select("exam_date, patient_id, patients(full_name), exam_results(biomarker, value, unit, status)")
      .eq("clinic_id", clinicId)
      .order("exam_date", { ascending: false })
      .limit(20),
  ]);

  // Package alerts — remaining ≤ 2
  const packageAlerts: PackageAlert[] = [];
  for (const pkg of packages ?? []) {
    const used = (appointments ?? []).filter(
      (a) => a.patient_id === pkg.patient_id &&
        new Date(a.starts_at) >= new Date(pkg.start_date + "T00:00:00")
    ).length;
    const remaining = pkg.sessions_total - used;
    if (remaining <= 2) {
      packageAlerts.push({
        patientId: pkg.patient_id,
        patientName: (pkg.patients as any)?.full_name ?? "Paciente",
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
    for (const result of (exam.exam_results as any[]) ?? []) {
      if (result.status !== "high" && result.status !== "low") continue;
      const key = `${exam.patient_id}-${result.biomarker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      biomarkerAlerts.push({
        patientId: exam.patient_id,
        patientName: (exam.patients as any)?.full_name ?? "Paciente",
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
