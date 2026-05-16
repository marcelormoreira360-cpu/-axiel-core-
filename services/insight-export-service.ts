import { getLatestFinalAiInsight } from "@/services/ai-insight-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { buildPatientFriendlyClinicalInsight, type ClinicalInsight } from "@/modules/insights/clinical-insight";

export async function getClinicalInsight(patientId: string): Promise<ClinicalInsight | null> {
  const patient = await getPatientById(patientId);
  if (!patient) return null;

  const [intakeResponses, appointments, sessionRecords, latestAiInsight] = await Promise.all([
    getPatientIntakeResponses(patientId),
    getAppointmentsByPatient(patientId),
    getSessionRecordsByPatient(patientId),
    getLatestFinalAiInsight(patientId),
  ]);

  return buildPatientFriendlyClinicalInsight({
    patient,
    intakeResponses,
    appointments,
    sessionRecords,
    aiInsight: latestAiInsight?.final_output ?? latestAiInsight?.output ?? null,
  });
}
