import { Shell } from "@/components/shell";
import { getPatients, getPatientCount } from "@/services/patient-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isPractitioner, getTeamMembers, isManager } from "@/services/team-service";
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
      />
    </Shell>
  );
}
