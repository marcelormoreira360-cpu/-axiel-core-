import { Shell } from "@/components/shell";
import { getPatients } from "@/services/patient-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isPractitioner } from "@/services/team-service";
import { PatientsClient } from "./patients-client";

export default async function PatientsPage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const practitionerMode = !!(profile && isPractitioner(profile.role));
  const practitionerId = practitionerMode ? profile!.id : undefined;

  const [patients, appointments] = await Promise.all([
    getPatients(clinicId, practitionerId),
    getAppointments(clinicId, practitionerId),
  ]);

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
      />
    </Shell>
  );
}
