import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AiInsight, Appointment, Patient, SessionRecord } from "@/lib/types";

export type PatientPortalLink = {
  id: string;
  clinic_id: string;
  patient_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientPortalSessionItem = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  notes: string | null;
  observations: string[];
};

export type PatientPortalInsight = {
  id: string;
  title: string;
  summary: string;
  status: "review" | "final";
  created_at: string;
  approved_at: string | null;
  next_step: string;
};

export type PatientPortalData = {
  link: PatientPortalLink;
  patient: Pick<Patient, "id" | "full_name" | "status">;
  clinic: { id: string; name: string };
  latestInsight: PatientPortalInsight | null;
  sessions: PatientPortalSessionItem[];
  nextStep: string;
  whatsappUrl: string | null;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function cleanPhoneForWhatsApp(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export const PATIENT_PORTAL_LINK_EXPIRATION_DAYS = 7;
export const PATIENT_PORTAL_WHATSAPP_MESSAGE = "Hi, I have a question about my session.";


async function revokeExistingPatientPortalLinks(patientId: string, clinicId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_portal_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .is("revoked_at", null);

  if (error) throw error;
}


async function logPatientPortalSecurityEvent(tokenHash: string, event: "invalid_token" | "expired_token" | "access_denied") {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("patient_portal_security_events").insert({
      token_hash: tokenHash,
      event,
      metadata: { source: "patient_portal" },
    });
  } catch {
    // Do not expose security logging failures to patients.
  }
}

function createWhatsAppUrl(phone?: string | null) {
  const cleanPhone = cleanPhoneForWhatsApp(phone ?? process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP_NUMBER);
  if (!cleanPhone) return null;
  const text = encodeURIComponent(PATIENT_PORTAL_WHATSAPP_MESSAGE);
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

function asInsightSummary(insight: AiInsight): PatientPortalInsight {
  const output = insight.final_output ?? insight.output;
  const firstPattern = output?.patterns_and_correlations?.[0];
  const title = firstPattern?.title ?? "Latest Insight";
  const summary = output?.structured_summary?.overview ?? firstPattern?.insight ?? "Your latest insight is ready.";
  const nextStep = output?.practitioner_review_points?.[0] ?? "Please contact your clinic to ask about your next step.";

  return {
    id: insight.id,
    title,
    summary,
    status: "final",
    created_at: insight.created_at,
    approved_at: insight.approved_at,
    next_step: nextStep,
  };
}

export async function createPatientPortalLink(patientId: string, expiresInDays = PATIENT_PORTAL_LINK_EXPIRATION_DAYS): Promise<{ token: string; link: PatientPortalLink }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in to create a patient portal link.");

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError) throw patientError;
  if (!patient) throw new Error("Patient not found.");

  await revokeExistingPatientPortalLinks(patient.id, patient.clinic_id);

  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("patient_portal_links")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { token, link: data as PatientPortalLink };
}

export async function regeneratePatientPortalLink(patientId: string): Promise<{ token: string; link: PatientPortalLink }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in to regenerate a patient portal link.");

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError) throw patientError;
  if (!patient) throw new Error("Patient not found.");

  await revokeExistingPatientPortalLinks(patient.id, patient.clinic_id);

  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PATIENT_PORTAL_LINK_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("patient_portal_links")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { token, link: data as PatientPortalLink };
}

export async function revokePatientPortalLink(linkId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_portal_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null);

  if (error) throw error;
}

export async function getRecentPatientPortalLinks(patientId: string): Promise<PatientPortalLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_portal_links")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data ?? []) as PatientPortalLink[];
}

export async function getPatientPortalDataByToken(token: string): Promise<PatientPortalData | null> {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(token);

  const { data: link, error: linkError } = await supabase
    .from("patient_portal_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) {
    await logPatientPortalSecurityEvent(tokenHash, "invalid_token");
    return null;
  }

  if (link.revoked_at) {
    await logPatientPortalSecurityEvent(tokenHash, "access_denied");
    return null;
  }

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    await logPatientPortalSecurityEvent(tokenHash, "expired_token");
    return null;
  }

  const [{ data: patient }, { data: clinic }, { data: latestInsight }, { data: appointments }, { data: sessionRecords }, { data: settings }] = await Promise.all([
    supabase.from("patients").select("id, full_name, status").eq("id", link.patient_id).eq("clinic_id", link.clinic_id).maybeSingle(),
    supabase.from("clinics").select("id, name").eq("id", link.clinic_id).maybeSingle(),
    supabase
      .from("ai_insights")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("review_status", "final")
      .order("approved_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .order("starts_at", { ascending: false })
      .limit(5),
    supabase
      .from("session_records")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("clinic_settings").select("settings").eq("clinic_id", link.clinic_id).maybeSingle(),
  ]);

  if (!patient || !clinic) return null;

  await supabase
    .from("patient_portal_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

  await supabase.from("patient_portal_access_logs").insert({
    clinic_id: link.clinic_id,
    patient_id: link.patient_id,
    portal_link_id: link.id,
    event: "viewed",
    metadata: { source: "patient_portal" },
  });

  const recordsByAppointment = new Map<string, SessionRecord>();
  ((sessionRecords ?? []) as SessionRecord[]).forEach((record) => recordsByAppointment.set(record.appointment_id, record));

  const sessions = ((appointments ?? []) as Appointment[]).map((appointment) => {
    const record = recordsByAppointment.get(appointment.id);
    return {
      id: appointment.id,
      starts_at: appointment.starts_at,
      duration_minutes: appointment.duration_minutes,
      notes: appointment.notes,
      observations: record?.key_observations?.slice(0, 3) ?? [],
    };
  });

  const insight = latestInsight ? asInsightSummary(latestInsight as AiInsight) : null;
  const settingsObject = (settings?.settings ?? {}) as Record<string, unknown>;
  const whatsappNumber = typeof settingsObject.whatsapp_number === "string" ? settingsObject.whatsapp_number : null;

  return {
    link: link as PatientPortalLink,
    patient,
    clinic,
    latestInsight: insight,
    sessions,
    nextStep: insight?.next_step ?? "Please contact your clinic to ask about your next step.",
    whatsappUrl: createWhatsAppUrl(whatsappNumber),
  };
}
