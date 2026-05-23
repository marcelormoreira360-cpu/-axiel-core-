import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AiInsight, Appointment, Patient, SessionRecord } from "@/lib/types";

export type PatientPortalIntakeItem = {
  label: string;
  answer: string;
};

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

export type PatientPortalPackage = {
  name: string;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
};

export type PatientPortalOffer = {
  id: string;
  name: string;
  description: string | null;
  offer_type: string;
  price_cents: number;
  currency: string;
  number_of_sessions: number | null;
};

export type PatientPortalDocument = {
  id: string;
  file_name: string;
  file_type: string;
  source: string;
  created_at: string;
};

export type PatientPortalData = {
  link: PatientPortalLink;
  patient: Pick<Patient, "id" | "full_name" | "status"> & {
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    country: string | null;
  };
  clinic: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null };
  latestInsight: PatientPortalInsight | null;
  sessions: PatientPortalSessionItem[];
  upcomingAppointments: PatientPortalSessionItem[];
  activePackage: PatientPortalPackage | null;
  nextStep: string;
  whatsappUrl: string | null;
  availableOffers: PatientPortalOffer[];
  intakeResponses: PatientPortalIntakeItem[];
  documents: PatientPortalDocument[];
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
export const PATIENT_PORTAL_WHATSAPP_MESSAGE = "Olá, tenho uma dúvida sobre minha sessão.";


async function revokeExistingPatientPortalLinks(patientId: string, clinicId: string) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  const title = firstPattern?.title ?? "Análise recente";
  const summary = output?.structured_summary?.overview ?? firstPattern?.insight ?? "Sua análise mais recente está disponível.";
  const nextStep = output?.practitioner_review_points?.[0] ?? "Entre em contato com sua clínica para saber sobre o próximo passo.";

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
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_portal_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null);

  if (error) throw error;
}

export async function getRecentPatientPortalLinks(patientId: string): Promise<PatientPortalLink[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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

  const now = new Date().toISOString();
  const [{ data: patient }, { data: clinic }, { data: latestInsight }, { data: appointments }, { data: upcoming }, { data: sessionRecords }, { data: settings }, { data: activePackage }, { data: offersData }, { data: intakeData }, { data: docsData }] = await Promise.all([
    supabase.from("patients").select("id, full_name, status, email, phone, date_of_birth, address_line, city, state, zip_code, country").eq("id", link.patient_id).eq("clinic_id", link.clinic_id).maybeSingle(),
    supabase.from("clinics").select("id, name, slug, logo_url, primary_color").eq("id", link.clinic_id).maybeSingle(),
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
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(3),
    supabase
      .from("session_records")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("clinic_settings").select("settings").eq("clinic_id", link.clinic_id).maybeSingle(),
    supabase
      .from("patient_packages")
      .select("name, sessions_total, sessions_used")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("monetization_offers")
      .select("id, name, description, offer_type, price_cents, currency, number_of_sessions")
      .eq("clinic_id", link.clinic_id)
      .eq("is_active", true)
      .order("price_cents", { ascending: true }),
    supabase
      .from("intake_responses")
      .select("answer, intake_questions(label, display_order)")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .not("answer", "is", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("patient_documents")
      .select("id, file_name, file_type, source, created_at")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .order("created_at", { ascending: false })
      .limit(20),
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

  function mapAppointment(appointment: Appointment): PatientPortalSessionItem {
    const record = recordsByAppointment.get(appointment.id);
    return {
      id: appointment.id,
      starts_at: appointment.starts_at,
      duration_minutes: appointment.duration_minutes,
      notes: appointment.notes,
      observations: record?.key_observations?.slice(0, 3) ?? [],
    };
  }

  const upcomingMapped = ((upcoming ?? []) as Appointment[]).map(mapAppointment);

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

  const pkg = activePackage
    ? {
        name: activePackage.name,
        sessions_total: activePackage.sessions_total ?? 0,
        sessions_used: activePackage.sessions_used ?? 0,
        sessions_remaining: Math.max(0, (activePackage.sessions_total ?? 0) - (activePackage.sessions_used ?? 0)),
      }
    : null;

  const availableOffers: PatientPortalOffer[] = (offersData ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    description: (o.description as string | null) ?? null,
    offer_type: o.offer_type as string,
    price_cents: o.price_cents as number,
    currency: o.currency as string,
    number_of_sessions: (o.number_of_sessions as number | null) ?? null,
  }));

  const intakeResponses: PatientPortalIntakeItem[] = (intakeData ?? [])
    .filter((r) => r.answer && r.answer.trim() !== "")
    .sort((a, b) => {
      const aOrder = (a.intake_questions as { display_order?: number } | null)?.display_order ?? 999;
      const bOrder = (b.intake_questions as { display_order?: number } | null)?.display_order ?? 999;
      return aOrder - bOrder;
    })
    .map((r) => ({
      label: (r.intake_questions as { label?: string } | null)?.label ?? "",
      answer: r.answer as string,
    }))
    .filter((r) => r.label !== "");

  const documents: PatientPortalDocument[] = (docsData ?? []).map((d) => ({
    id: d.id as string,
    file_name: d.file_name as string,
    file_type: d.file_type as string,
    source: d.source as string,
    created_at: d.created_at as string,
  }));

  return {
    link: link as PatientPortalLink,
    patient: patient as PatientPortalData["patient"],
    clinic: clinic as PatientPortalData["clinic"],
    latestInsight: insight,
    sessions,
    upcomingAppointments: upcomingMapped,
    activePackage: pkg,
    nextStep: insight?.next_step ?? "Entre em contato com sua clínica para saber sobre o próximo passo.",
    whatsappUrl: createWhatsAppUrl(whatsappNumber),
    availableOffers,
    intakeResponses,
    documents,
  };
}
