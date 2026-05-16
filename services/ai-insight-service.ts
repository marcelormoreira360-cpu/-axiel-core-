import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toAppError } from "@/lib/errors";
import type { AiInsight, AiInsightOutput } from "@/lib/types";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { writeAuditLog } from "@/services/audit-service";
import { AI_INSIGHT_SYSTEM_PROMPT, normalizeInsightText } from "@/modules/ai-insights/guardrails";
import { aiInsightJsonShape, coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";

export type AiInsightInputSnapshot = {
  patient: {
    id: string;
    clinic_id: string;
    full_name: string;
    status: string;
    notes: string | null;
  };
  intake: Array<{
    question: string;
    answer: string | null;
  }>;
  session_notes: Array<{
    date: string | null;
    notes: string | null;
    key_observations: string[];
  }>;
  patient_history: Array<{
    date: string;
    duration_minutes: number;
    notes: string | null;
  }>;
};

function buildAiFallbackOutput(reason: string): AiInsightOutput {
  return {
    label: "AI-generated insights (not medical advice)",
    structured_summary: {
      overview: "AI insight generation was not completed. The available patient information remains safely stored for practitioner review.",
      key_context: ["Fallback mode was used because the AI provider was unavailable or misconfigured."],
      current_status: "Please review the intake, notes, and patient history manually.",
    },
    patterns_and_correlations: [],
    practitioner_review_points: ["Review patient intake responses.", "Review recent session notes.", "Decide the next operational follow-up step."],
    data_limitations: [reason],
    safety_note:
      "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
  };
}

export async function buildAiInsightInput(patientId: string): Promise<AiInsightInputSnapshot | null> {
  const patient = await getPatientById(patientId);
  if (!patient) return null;

  const [intakeResponses, appointments, sessionRecords] = await Promise.all([
    getPatientIntakeResponses(patientId),
    getAppointmentsByPatient(patientId),
    getSessionRecordsByPatient(patientId),
  ]);

  return {
    patient: {
      id: patient.id,
      clinic_id: patient.clinic_id,
      full_name: patient.full_name,
      status: patient.status,
      notes: normalizeInsightText(patient.notes),
    },
    intake: intakeResponses.map((response) => ({
      question: normalizeInsightText(response.intake_questions?.label ?? "Question"),
      answer: normalizeInsightText(response.answer),
    })),
    session_notes: sessionRecords.map((record) => ({
      date: record.appointments?.starts_at ?? null,
      notes: normalizeInsightText(record.notes),
      key_observations: (record.key_observations ?? []).map(normalizeInsightText).filter(Boolean),
    })),
    patient_history: appointments.map((appointment) => ({
      date: appointment.starts_at,
      duration_minutes: appointment.duration_minutes,
      notes: normalizeInsightText(appointment.notes),
    })),
  };
}

export async function createAiRequest(input: {
  clinic_id: string;
  patient_id: string;
  model: string;
  input_summary: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("ai_requests")
    .insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      requested_by: user?.id ?? null,
      model: input.model,
      purpose: "structured_insight",
      input_summary: input.input_summary,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completeAiRequest(input: {
  id: string;
  status: "completed" | "error";
  output_summary?: Record<string, unknown>;
  error_message?: string | null;
  tokens_used?: number | null;
  fallback_used?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_requests")
    .update({
      status: input.status,
      output_summary: input.output_summary ?? {},
      error_message: input.error_message ?? null,
      tokens_used: input.tokens_used ?? null,
      fallback_used: input.fallback_used ?? false,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw error;
}

export async function generateAiInsightOutput(input: AiInsightInputSnapshot): Promise<{ output: AiInsightOutput; tokensUsed?: number | null }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local before generating insights.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: AI_INSIGHT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate structured insights only. No diagnosis. No session. No prescriptions.",
          required_output_shape: aiInsightJsonShape,
          input_data: input,
        }),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    output: coerceAiInsightOutput(parsed),
    tokensUsed: response.usage?.total_tokens ?? null,
  };
}

export async function saveAiInsight(input: {
  clinic_id: string;
  patient_id: string;
  ai_request_id?: string | null;
  input_snapshot: AiInsightInputSnapshot;
  output: AiInsightOutput;
}): Promise<AiInsight> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("ai_insights")
    .insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      ai_request_id: input.ai_request_id ?? null,
      input_snapshot: input.input_snapshot,
      output: input.output,
      status: "completed",
      review_status: "pending_review",
      final_output: null,
      safety_label: "AI-generated insights (not medical advice)",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await writeAuditLog({
    clinicId: input.clinic_id,
    action: "ai_insight.generated",
    entityType: "ai_insight",
    entityId: data.id,
    metadata: { patient_id: input.patient_id, ai_request_id: input.ai_request_id ?? null },
  });

  return data as AiInsight;
}


export async function getPendingAiInsightReviewCount(clinicId?: string | null): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("ai_insights")
    .select("id", { count: "exact", head: true })
    .in("review_status", ["pending_review", "needs_changes"]);

  if (clinicId) {
    query = query.eq("clinic_id", clinicId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}


export async function getAiInsightsByPatient(patientId: string, limit = 6): Promise<AiInsight[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("patient_id", patientId)
    .neq("review_status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AiInsight[];
}

export async function getLatestFinalAiInsight(patientId: string): Promise<AiInsight | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("patient_id", patientId)
    .eq("review_status", "final")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AiInsight | null;
}

export async function getLatestAiInsight(patientId: string): Promise<AiInsight | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("patient_id", patientId)
    .neq("review_status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AiInsight | null;
}

export async function generateAndSaveAiInsight(patientId: string): Promise<AiInsight> {
  const snapshot = await buildAiInsightInput(patientId);
  if (!snapshot) throw new Error("Patient not found.");

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const aiRequest = await createAiRequest({
    clinic_id: snapshot.patient.clinic_id,
    patient_id: patientId,
    model,
    input_summary: {
      intake_count: snapshot.intake.length,
      session_notes_count: snapshot.session_notes.length,
      patient_history_count: snapshot.patient_history.length,
    },
  });

  try {
    const { output, tokensUsed } = await generateAiInsightOutput(snapshot);
    await completeAiRequest({
      id: aiRequest.id,
      status: "completed",
      tokens_used: tokensUsed ?? null,
      output_summary: {
        label: output.label,
        patterns_count: output.patterns_and_correlations.length,
        review_points_count: output.practitioner_review_points.length,
      },
    });

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output,
    });
  } catch (error) {
    const safeError = toAppError(error, "AI insights are temporarily unavailable.");
    const fallbackOutput = buildAiFallbackOutput(safeError.safeMessage);

    await completeAiRequest({
      id: aiRequest.id,
      status: "error",
      error_message: safeError.safeMessage,
      fallback_used: true,
      output_summary: { fallback: true, reason: safeError.kind },
    });

    await writeAuditLog({
      clinicId: snapshot.patient.clinic_id,
      action: "ai_insight.fallback_used",
      entityType: "ai_request",
      entityId: aiRequest.id,
      metadata: { patient_id: patientId, error_kind: safeError.kind },
    });

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output: fallbackOutput,
    });
  }
}


export type AiValidationEvent = {
  id: string;
  clinic_id: string;
  ai_insight_id: string;
  patient_id: string | null;
  action: "generated_pending_review" | "approved_final" | "requested_changes" | "archived" | "reopened";
  previous_status: string | null;
  new_status: string;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  changes_made: string | null;
  output_before: Record<string, unknown> | null;
  output_after: Record<string, unknown> | null;
  created_at: string;
};

export async function getAiValidationEvents(aiInsightId: string): Promise<AiValidationEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_validation_events")
    .select("*")
    .eq("ai_insight_id", aiInsightId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AiValidationEvent[];
}

export async function approveAiInsightAsFinal(input: {
  aiInsightId: string;
  reviewerNotes?: string | null;
  changesMade?: string | null;
}): Promise<AiInsight> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to approve AI insights.");

  const { data: existing, error: readError } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("id", input.aiInsightId)
    .single();

  if (readError) throw readError;
  const previousStatus = existing.review_status ?? "pending_review";
  const finalOutput = existing.final_output ?? existing.output;
  const approvedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_insights")
    .update({
      review_status: "final",
      final_output: finalOutput,
      approved_by: user.id,
      approved_at: approvedAt,
      last_reviewed_by: user.id,
      last_reviewed_at: approvedAt,
      reviewer_notes: normalizeInsightText(input.reviewerNotes ?? null),
      changes_made: normalizeInsightText(input.changesMade ?? null),
      reviewed_at: approvedAt,
      updated_by: user.id,
    })
    .eq("id", input.aiInsightId)
    .select("*")
    .single();

  if (error) throw error;

  const { error: eventError } = await supabase.from("ai_validation_events").insert({
    clinic_id: existing.clinic_id,
    ai_insight_id: existing.id,
    patient_id: existing.patient_id,
    action: "approved_final",
    previous_status: previousStatus,
    new_status: "final",
    reviewed_by: user.id,
    reviewer_notes: normalizeInsightText(input.reviewerNotes ?? null),
    changes_made: normalizeInsightText(input.changesMade ?? null),
    output_before: existing.output,
    output_after: finalOutput,
  });
  if (eventError) throw eventError;

  await writeAuditLog({
    clinicId: existing.clinic_id,
    action: "ai_insight.approved_final",
    entityType: "ai_insight",
    entityId: existing.id,
    metadata: { patient_id: existing.patient_id, approved_by: user.id, changes_made: normalizeInsightText(input.changesMade ?? null) },
  });

  return data as AiInsight;
}

export async function requestAiInsightChanges(input: {
  aiInsightId: string;
  reviewerNotes?: string | null;
  changesMade?: string | null;
}): Promise<AiInsight> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to review AI insights.");

  const { data: existing, error: readError } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("id", input.aiInsightId)
    .single();

  if (readError) throw readError;
  const previousStatus = existing.review_status ?? "pending_review";
  const reviewedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_insights")
    .update({
      review_status: "needs_changes",
      last_reviewed_by: user.id,
      last_reviewed_at: reviewedAt,
      reviewer_notes: normalizeInsightText(input.reviewerNotes ?? null),
      changes_made: normalizeInsightText(input.changesMade ?? null),
      reviewed_at: reviewedAt,
      updated_by: user.id,
    })
    .eq("id", input.aiInsightId)
    .select("*")
    .single();

  if (error) throw error;

  const { error: eventError } = await supabase.from("ai_validation_events").insert({
    clinic_id: existing.clinic_id,
    ai_insight_id: existing.id,
    patient_id: existing.patient_id,
    action: "requested_changes",
    previous_status: previousStatus,
    new_status: "needs_changes",
    reviewed_by: user.id,
    reviewer_notes: normalizeInsightText(input.reviewerNotes ?? null),
    changes_made: normalizeInsightText(input.changesMade ?? null),
    output_before: existing.output,
    output_after: existing.output,
  });
  if (eventError) throw eventError;

  await writeAuditLog({
    clinicId: existing.clinic_id,
    action: "ai_insight.requested_changes",
    entityType: "ai_insight",
    entityId: existing.id,
    metadata: { patient_id: existing.patient_id, reviewed_by: user.id, changes_made: normalizeInsightText(input.changesMade ?? null) },
  });

  return data as AiInsight;
}

export async function getPendingAiInsightReviewsForActions(clinicId?: string | null): Promise<Array<{
  id: string;
  patient_id: string;
  patient_name: string;
  review_status: "pending_review" | "needs_changes";
  created_at: string;
}>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("ai_insights")
    .select("id, patient_id, review_status, created_at, patients(full_name)")
    .in("review_status", ["pending_review", "needs_changes"])
    .order("created_at", { ascending: false })
    .limit(8);

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    patient_id: item.patient_id,
    patient_name: item.patients?.full_name ?? "this patient",
    review_status: item.review_status,
    created_at: item.created_at,
  }));
}
