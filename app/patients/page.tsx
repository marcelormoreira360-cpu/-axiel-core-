import { Shell } from "@/components/shell";
import { getPatients, getPatientCount } from "@/services/patient-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isPractitioner } from "@/services/team-service";
import { PatientsClient } from "./patients-client";

const PAGE_SIZE = 100;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const practitionerMode = !!(profile && isPractitioner(profile.role));
  const practitionerId = practitionerMode ? profile!.id : undefined;

  const [patients, appointments, totalCount] = await Promise.all([
    getPatients(clinicId, practitionerId, PAGE_SIZE, offset),
    getAppointments(clinicId, practitionerId),
    getPatientCount(clinicId, practitionerId),
  ]);

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
      />
    </Shell>
  );
}
