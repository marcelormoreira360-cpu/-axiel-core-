"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertSessionRecord } from "@/services/session-recording-service";
import { generateAndSaveAiInsight } from "@/services/ai-insight-service";
import { syncZoomRecordingsForMeeting } from "@/services/zoom-service";
import type { AiInsight } from "@/lib/types";

export type SaveSessionState = { error?: string } | null;

export async function saveSessionRecord(
  _prev: SaveSessionState,
  formData: FormData,
): Promise<SaveSessionState> {
  const appointmentId = String(formData.get("appointment_id") ?? "");
  const patientId     = String(formData.get("patient_id") ?? "");
  const clinicId      = String(formData.get("clinic_id") ?? "");
  const notes         = String(formData.get("notes") ?? "").trim();
  const observationsRaw = String(formData.get("key_observations") ?? "[]");
  const soapMode      = formData.get("soap_mode") === "1";
  const subjective    = String(formData.get("subjective") ?? "").trim() || null;
  const objective     = String(formData.get("objective") ?? "").trim() || null;
  const assessmentNote = String(formData.get("assessment_note") ?? "").trim() || null;
  const plan          = String(formData.get("plan") ?? "").trim() || null;

  // Vitals — integer 1–5 or null
  function parseVital(key: string): number | null {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }
  const vitals = {
    dor:    parseVital("vitals_dor"),
    energia: parseVital("vitals_energia"),
    humor:  parseVital("vitals_humor"),
    sono:   parseVital("vitals_sono"),
  };
  const hasVitals = Object.values(vitals).some((v) => v !== null);

  let keyObservations: string[] = [];
  try {
    const parsed = JSON.parse(observationsRaw);
    if (Array.isArray(parsed)) {
      keyObservations = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    keyObservations = [];
  }

  if (!appointmentId || !patientId || !clinicId) {
    return { error: "Informações da sessão estão incompletas. Recarregue a página." };
  }

  try {
    await upsertSessionRecord({
      appointment_id:  appointmentId,
      patient_id:      patientId,
      clinic_id:       clinicId,
      notes,
      key_observations: keyObservations,
      soap_mode:       soapMode,
      subjective,
      objective,
      assessment_note: assessmentNote,
      plan,
      vitals:          hasVitals ? vitals : null,
    });
  } catch (err: unknown) {
    console.error("[saveSessionRecord] upsert failed:", err);
    return { error: "Erro ao salvar a sessão. Tente novamente." };
  }

  revalidatePath(`/schedule/${appointmentId}/session`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/prontuario`);
  redirect(`/schedule/${appointmentId}/session?saved=1`);
}

export async function syncZoomRecordingsAction(
  appointmentId: string,
  zoomMeetingId: string,
  clinicId: string,
  patientId: string | null,
): Promise<{ synced: number; error: string | null }> {
  const result = await syncZoomRecordingsForMeeting(zoomMeetingId, appointmentId, clinicId, patientId);
  if (result.synced > 0) revalidatePath(`/schedule/${appointmentId}/session`);
  return result;
}

export async function generateSessionInsightAction(
  patientId: string,
): Promise<{ insight: AiInsight | null; error: string | null }> {
  try {
    const insight = await generateAndSaveAiInsight(patientId);
    revalidatePath(`/patients/${patientId}/insights`);
    return { insight, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar insight.";
    return { insight: null, error: msg };
  }
}
