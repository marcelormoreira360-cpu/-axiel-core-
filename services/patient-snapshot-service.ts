import type { PatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";
import { buildPatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPendingFollowUps } from "@/services/follow-up-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";

export async function getPatientSnapshot(patientId: string): Promise<PatientJourneySnapshot | null> {
  const patient = await getPatientById(patientId);
  if (!patient) return null;

  const [appointments, intakeResponses, sessionRecords, aiInsights, followUps] = await Promise.all([
    getAppointmentsByPatient(patientId),
    getPatientIntakeResponses(patientId),
    getSessionRecordsByPatient(patientId),
    getAiInsightsByPatient(patientId, 5),
    getPendingFollowUps(),
  ]);

  return buildPatientJourneySnapshot({
    patient,
    appointments,
    intakeResponses,
    sessionRecords,
    aiInsights,
    followUps: followUps.filter((item) => item.patient_id === patientId),
  });
}
