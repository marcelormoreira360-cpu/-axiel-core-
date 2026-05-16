import { buildPatientJourneyTimeline } from "@/modules/patient-journey/timeline-builder";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";

export async function getPatientJourneyTimeline(patientId: string) {
  const [appointments, intakeResponses, sessionRecords, aiInsights] = await Promise.all([
    getAppointmentsByPatient(patientId),
    getPatientIntakeResponses(patientId),
    getSessionRecordsByPatient(patientId),
    getAiInsightsByPatient(patientId, 5),
  ]);

  return buildPatientJourneyTimeline({
    appointments,
    intakeResponses,
    sessionRecords,
    aiInsights,
  });
}
