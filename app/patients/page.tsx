import { Shell } from "@/components/shell";
import { getPatients, getPatientCount } from "@/services/patient-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isPractitioner, getTeamMembers, isManager } from "@/services/team-service";
import { getActivePlanPatientIds } from "@/services/treatment-plan-service";
import { computePatientEngagement } from "@/services/patient-intelligence-service";
import { derivePatientJourneyStage, type PatientJourneyStage } from "@/modules/patient-journey/stage";
import { PatientsClient } from "./patients-client";

const PAGE_SIZE = 100;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const offset = (page - 1) * PAGE_SIZE;

  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const practitionerMode = !!(profile && isPractitioner(profile.role));
  const practitionerId = practitionerMode ? profile!.id : undefined;
  const isManagerMode = !!(profile && isManager(profile.role));

  const [patients, appointments, totalCount, teamMembers] = await Promise.all([
    getPatients(clinicId, practitionerId, PAGE_SIZE, offset, search),
    getAppointments(clinicId, practitionerId),
    getPatientCount(clinicId, practitionerId, search),
    isManagerMode && clinicId ? getTeamMembers(clinicId) : Promise.resolve([]),
  ]);

  const practitioners =
    isManagerMode && teamMembers.length > 0
      ? teamMembers
          .filter((m) => isPractitioner(m.role))
          .map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? m.id }))
      : undefined;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Etapa da jornada por paciente (derivada, sem N+1) ──────────────────────
  // Agrupa os agendamentos já carregados por paciente + 1 query de planos ativos.
  const activePlanIds = clinicId ? new Set(await getActivePlanPatientIds(clinicId)) : new Set<string>();
  const apptsByPatient = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const arr = apptsByPatient.get(a.patient_id) ?? [];
    arr.push(a);
    apptsByPatient.set(a.patient_id, arr);
  }
  const journeyByPatientId: Record<string, PatientJourneyStage> = {};
  for (const p of patients) {
    const appts = apptsByPatient.get(p.id) ?? [];
    const churnRisk = computePatientEngagement(appts, p).churnRisk;
    journeyByPatientId[p.id] = derivePatientJourneyStage({
      patientStatus: p.status,
      appointments: appts,
      treatmentPlans: activePlanIds.has(p.id) ? [{ status: "active" }] : [],
      churnRisk,
    });
  }

  // Deduplicated list of patient_ids sorted by their most recent appointment date
  const seen = new Set<string>();
  const recentPatientIds: string[] = [];
  const sorted = [...appointments].sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );
  for (const appt of sorted) {
    if (!seen.has(appt.patient_id)) {
      seen.add(appt.patient_id);
      recentPatientIds.push(appt.patient_id);
    }
  }

  return (
    <Shell>
      <PatientsClient
        patients={patients}
        practitionerMode={practitionerMode}
        recentPatientIds={recentPatientIds}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        initialSearch={search}
        practitioners={practitioners}
        journeyByPatientId={journeyByPatientId}
      />
    </Shell>
  );
}
