import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PatientPackage = {
  id: string;
  patient_id: string;
  clinic_id: string;
  name: string;
  sessions_total: number;
  start_date: string;
  notes: string | null;
  is_active: boolean;
  auto_renew: boolean;
  created_at: string;
  // Kept in sync by trigger 012_fix_sessions_used (no longer calculated in memory)
  sessions_used: number;
};

export async function getPatientPackages(patientId: string): Promise<PatientPackage[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: packages, error } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error || !packages) return [];

  // sessions_used is now kept accurate by a DB trigger (migration 012).
  // No in-memory recalculation needed.
  return packages as PatientPackage[];
}

export async function createPatientPackage(data: {
  patient_id: string;
  clinic_id: string;
  name: string;
  sessions_total: number;
  start_date: string;
  notes?: string;
  auto_renew?: boolean;
}): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: inserted } = await supabase
    .from("patient_packages")
    .insert(data)
    .select("id")
    .single();

  // Jornada (Frente C): contratar pacote = início do plano (T1 da métrica).
  // Best-effort, não interfere na criação do pacote.
  if (inserted?.id) {
    const { emitJourneyEvent } = await import("@/services/journey-events-service");
    await emitJourneyEvent({
      clinicId: data.clinic_id,
      patientId: data.patient_id,
      eventType: "plan_started",
      occurredAt: data.start_date,
      actorType: "staff",
      refTable: "patient_packages",
      refId: inserted.id,
      dedupKey: `core:pkg:${inserted.id}:plan_started`,
      payload: {}, // sem PHI: nome livre do pacote fica fora do log; detalhe via ref_table/ref_id
    });
  }
}

export async function deactivatePatientPackage(id: string, clinicId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  // A-01: scope to clinicId to prevent IDOR across clinics
  const { data: pkg } = await supabase
    .from("patient_packages")
    .update({ is_active: false })
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("is_active", true) // só desativa (e emite interrupted) o que estava ATIVO
    .select("patient_id")
    .maybeSingle();

  // Jornada (Frente C): desativar manualmente um pacote ATIVO = interrupção do plano
  // (interrupted). A renovação automática NÃO passa por aqui (ver
  // checkAndAutoRenewPackages) e deixa o pacote consumido inativo direto; ao filtrar
  // is_active=true, um pacote já consumido/renovado nunca é remarcado como interrupted.
  // Best-effort.
  if (pkg?.patient_id) {
    const { emitJourneyEvent } = await import("@/services/journey-events-service");
    await emitJourneyEvent({
      clinicId,
      patientId: pkg.patient_id as string,
      eventType: "interrupted",
      actorType: "staff",
      refTable: "patient_packages",
      refId: id,
      dedupKey: `core:pkg:${id}:interrupted`,
      payload: { reason: "package_deactivated" }, // sem PHI: só o motivo (código fixo)
    });
  }
}

export async function deletePatientPackage(id: string, clinicId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  // A-01: scope to clinicId to prevent IDOR across clinics
  await supabase.from("patient_packages").delete().eq("id", id).eq("clinic_id", clinicId);
}

// Called after each appointment is created/updated. Checks active packages with
// auto_renew=true and renews any that are now complete (sessions_used >= sessions_total).
// sessions_used is already kept accurate by the DB trigger — no recalculation needed.
export async function checkAndAutoRenewPackages(
  patientId: string,
  clinicId: string,
  appointmentStartsAt: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: packages } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .eq("auto_renew", true);

  if (!packages || packages.length === 0) return;

  const apptDate = new Date(appointmentStartsAt);

  for (const pkg of packages) {
    // sessions_used is accurate thanks to the DB trigger
    if ((pkg.sessions_used ?? 0) >= pkg.sessions_total) {
      await supabase
        .from("patient_packages")
        .update({ is_active: false })
        .eq("id", pkg.id);

      const newStartDate = apptDate.toISOString().split("T")[0];

      const { data: renewedPkg } = await supabase.from("patient_packages").insert({
        patient_id:     pkg.patient_id,
        clinic_id:      pkg.clinic_id,
        name:           pkg.name,
        sessions_total: pkg.sessions_total,
        start_date:     newStartDate,
        notes:          pkg.notes,
        auto_renew:     true,
        is_active:      true,
      }).select("id").single();

      // Jornada (Frente C): renovação automática de pacote = renewed. NÃO emite
      // plan_started (não é um novo início de plano) nem interrupted (o pacote
      // anterior foi consumido até o fim, não interrompido). Best-effort.
      if (renewedPkg?.id) {
        const { emitJourneyEvent } = await import("@/services/journey-events-service");
        await emitJourneyEvent({
          clinicId: pkg.clinic_id,
          patientId: pkg.patient_id,
          eventType: "renewed",
          occurredAt: newStartDate,
          actorType: "system",
          refTable: "patient_packages",
          refId: renewedPkg.id as string,
          dedupKey: `core:pkg:${renewedPkg.id}:renewed`,
          payload: { previous_package_id: pkg.id }, // sem PHI: só a referência ao pacote anterior
        });
      }
    }
  }
}
