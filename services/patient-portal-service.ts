import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AiInsight, Appointment, Patient, SessionRecord } from "@/lib/types";
import type { AssessmentProgress } from "@/services/assessment-progress-service";
import { canUseFeature } from "@/modules/billing/feature-access";

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
  /** When true, the token is consumed after the first successful view */
  is_single_use: boolean;
  /** Set on first successful view when is_single_use = true */
  used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientPortalSessionItem = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  // M-05: `notes` is internal (clinician-only) — NOT included in portal data
  observations: string[];
  // Feature 2: per-session payment tracking
  price_cents: number;
  session_type_name: string | null;
  payment_status: "free" | "paid" | "covered" | "pending";
  // Feature 4: NPS feedback
  has_feedback: boolean;
  // Zoom teleconsultação
  zoom_join_url: string | null;
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
  billing_interval: string | null;
};

export type PatientPortalDocument = {
  id: string;
  file_name: string;
  file_type: string;
  source: string;
  created_at: string;
};

export type PatientPortalExam = {
  id: string;
  exam_date: string;
  lab_name: string | null;
  results: { biomarker: string; value: number; unit: string | null; status: string }[];
};

export type PatientPortalPrescription = {
  id: string;
  type: "medication" | "supplement";
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type PatientPortalPayment = {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  description: string | null;
  appointment_id: string | null;
};

export type PatientPortalSessionType = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
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
  clinic: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    /** PLG: false quando a clínica tem white_label (Enterprise) — oculta o rodapé "Powered by AXIEL" */
    show_powered_by?: boolean;
  };
  latestInsight: PatientPortalInsight | null;
  sessions: PatientPortalSessionItem[];
  upcomingAppointments: PatientPortalSessionItem[];
  activePackage: PatientPortalPackage | null;
  nextStep: string;
  whatsappUrl: string | null;
  availableOffers: PatientPortalOffer[];
  intakeResponses: PatientPortalIntakeItem[];
  pendingAssessments: { name: string }[];
  assessmentProgress: AssessmentProgress[];
  documents: PatientPortalDocument[];
  sessionTypes: PatientPortalSessionType[];
  unreadClinicMessages: number;
  paymentHistory: PatientPortalPayment[];
  allInsights: PatientPortalInsight[];
  exams: PatientPortalExam[];
  activePrescriptions: PatientPortalPrescription[];
  activeSubscription: {
    id: string;
    planName: string;
    status: string;
    amountCents: number;
    currency: string;
    billingInterval: string;
    sessionsPerCycle: number;
    sessionsUsedThisCycle: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
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

  // Single-use tokens (e.g. NPS emails) are rejected after first successful view
  if (link.is_single_use && link.used_at) {
    await logPatientPortalSecurityEvent(tokenHash, "access_denied");
    return null;
  }

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    await logPatientPortalSecurityEvent(tokenHash, "expired_token");
    return null;
  }

  const now = new Date().toISOString();
  const [{ data: patient }, { data: clinic }, { data: latestInsight }, { data: appointments }, { data: upcoming }, { data: sessionRecords }, { data: settings }, { data: activePackage }, { data: offersData }, { data: intakeData }, { data: docsData }, { data: sessionTypesData }, { data: paymentsData }, { data: feedbackData }, { count: unreadCount }, { data: activeSubscriptionData }, { data: clinicSubscription }] = await Promise.all([
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
      .select("*, session_types(name, price_cents)")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("*, session_types(name, price_cents)")
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
      .select("id, name, description, offer_type, price_cents, currency, number_of_sessions, billing_interval")
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
    supabase
      .from("session_types")
      .select("id, name, duration_minutes, price_cents")
      .eq("clinic_id", link.clinic_id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("patient_payments")
      .select("id, amount_cents, currency, paid_at, notes, appointment_id, status")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("session_feedback")
      .select("appointment_id")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id),
    supabase
      .from("portal_messages")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("direction", "clinic_to_patient")
      .is("read_at", null),
    supabase
      .from("patient_subscriptions")
      .select("id, plan_name, status, amount_cents, currency, billing_interval, sessions_per_cycle, sessions_used_this_cycle, current_period_end, cancel_at_period_end")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // PLG: plano da clínica para decidir se o rodapé "Powered by AXIEL" aparece
    supabase
      .from("subscriptions")
      .select("plans(code, slug)")
      .eq("clinic_id", link.clinic_id)
      .maybeSingle(),
  ]);

  if (!patient || !clinic) return null;

  // PLG: oculta o "Powered by AXIEL" para clínicas com white_label (Enterprise)
  const clinicPlans = clinicSubscription?.plans as { code?: string | null; slug?: string | null } | null;
  const clinicPlanSlug = clinicPlans?.code ?? clinicPlans?.slug ?? "starter";
  const showPoweredBy = !canUseFeature({ planSlug: clinicPlanSlug }, "white_label");

  // Additional data: all approved insights + exams + active prescriptions
  const [{ data: allInsightsRaw }, { data: examsRaw }, { data: prescriptionsRaw }] = await Promise.all([
    supabase
      .from("ai_insights")
      .select("*")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("review_status", "final")
      .order("approved_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("patient_exams")
      .select("id, exam_date, lab_name, exam_results(biomarker, value, unit, status)")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .order("exam_date", { ascending: false })
      .limit(10),
    supabase
      .from("patient_prescriptions")
      .select("id, type, name, dosage, frequency, start_date, end_date")
      .eq("patient_id", link.patient_id)
      .eq("clinic_id", link.clinic_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  await supabase
    .from("patient_portal_links")
    .update({
      last_viewed_at: now,
      // Stamp used_at on first access for single-use tokens (e.g. NPS emails)
      ...(link.is_single_use && !link.used_at ? { used_at: now } : {}),
    })
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

  // pkg must be computed BEFORE mapAppointment so payment_status can check sessions_remaining
  const pkg = activePackage
    ? {
        name: activePackage.name,
        sessions_total: activePackage.sessions_total ?? 0,
        sessions_used: activePackage.sessions_used ?? 0,
        sessions_remaining: Math.max(0, (activePackage.sessions_total ?? 0) - (activePackage.sessions_used ?? 0)),
      }
    : null;

  // Set of appointment IDs that already have a direct payment record
  const paidAppointmentIds = new Set<string>(
    (paymentsData ?? [])
      .filter((p) => p.appointment_id)
      .map((p) => p.appointment_id as string),
  );

  // Payment history for portal display
  const paymentHistory: PatientPortalPayment[] = (paymentsData ?? []).map((p) => ({
    id: p.id as string,
    amount_cents: p.amount_cents as number,
    currency: (p.currency as string | null) ?? "BRL",
    paid_at: (p.paid_at as string | null) ?? "",
    description: (p.notes as string | null) ?? null,
    appointment_id: (p.appointment_id as string | null) ?? null,
  }));

  // Set of appointment IDs that already have NPS feedback
  const feedbackedAppointmentIds = new Set<string>(
    (feedbackData ?? []).map((f) => f.appointment_id as string).filter(Boolean),
  );

  type AppointmentWithSessionType = Appointment & {
    session_types?: { name: string; price_cents: number } | null;
  };

  function mapAppointment(appointment: AppointmentWithSessionType): PatientPortalSessionItem {
    const record = recordsByAppointment.get(appointment.id);
    const priceCents = (appointment.session_types as { price_cents?: number } | null)?.price_cents ?? 0;
    const sessionTypeName = (appointment.session_types as { name?: string } | null)?.name ?? null;

    let payment_status: PatientPortalSessionItem["payment_status"] = "free";
    if (priceCents > 0) {
      if (paidAppointmentIds.has(appointment.id)) {
        payment_status = "paid";
      } else if (pkg && pkg.sessions_remaining > 0) {
        payment_status = "covered";
      } else {
        payment_status = "pending";
      }
    }

    return {
      id: appointment.id,
      starts_at: appointment.starts_at,
      duration_minutes: appointment.duration_minutes,
      // M-05: omit `notes` — clinician-only field, must not reach the patient portal
      observations: record?.key_observations?.slice(0, 3) ?? [],
      price_cents: priceCents,
      session_type_name: sessionTypeName,
      payment_status,
      has_feedback: feedbackedAppointmentIds.has(appointment.id),
      zoom_join_url: (appointment as { zoom_join_url?: string | null }).zoom_join_url ?? null,
    };
  }

  const upcomingMapped = ((upcoming ?? []) as AppointmentWithSessionType[]).map(mapAppointment);

  const sessions = ((appointments ?? []) as AppointmentWithSessionType[]).map(mapAppointment);

  const insight = latestInsight ? asInsightSummary(latestInsight as AiInsight) : null;
  const settingsObject = (settings?.settings ?? {}) as Record<string, unknown>;
  const whatsappNumber = typeof settingsObject.whatsapp_number === "string" ? settingsObject.whatsapp_number : null;

  const availableOffers: PatientPortalOffer[] = (offersData ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    description: (o.description as string | null) ?? null,
    offer_type: o.offer_type as string,
    price_cents: o.price_cents as number,
    currency: o.currency as string,
    number_of_sessions: (o.number_of_sessions as number | null) ?? null,
    billing_interval: (o.billing_interval as string | null) ?? null,
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

  const sessionTypes: PatientPortalSessionType[] = (sessionTypesData ?? []).map((st) => ({
    id: st.id as string,
    name: st.name as string,
    duration_minutes: st.duration_minutes as number,
    price_cents: st.price_cents as number,
  }));

  const allInsights: PatientPortalInsight[] = ((allInsightsRaw ?? []) as AiInsight[]).map(asInsightSummary);

  const exams: PatientPortalExam[] = (examsRaw ?? []).map((e) => {
    const raw = e as { id: string; exam_date: string; lab_name: string | null; exam_results?: unknown[] };
    return {
      id: raw.id,
      exam_date: raw.exam_date,
      lab_name: raw.lab_name,
      results: ((raw.exam_results ?? []) as Array<{ biomarker: string; value: number; unit: string | null; status: string }>).map((r) => ({
        biomarker: r.biomarker,
        value: r.value,
        unit: r.unit,
        status: r.status,
      })),
    };
  });

  const activePrescriptions: PatientPortalPrescription[] = (prescriptionsRaw ?? []).map((p) => {
    const raw = p as { id: string; type: string; name: string; dosage: string | null; frequency: string | null; start_date: string | null; end_date: string | null };
    return {
      id: raw.id,
      type: raw.type as "medication" | "supplement",
      name: raw.name,
      dosage: raw.dosage,
      frequency: raw.frequency,
      start_date: raw.start_date,
      end_date: raw.end_date,
    };
  });

  // Questionários pendentes (convites de avaliação não respondidos e não expirados)
  const { data: pendingInvites } = await supabase
    .from("assessment_invitations")
    .select("id, assessment_templates(name)")
    .eq("patient_id", link.patient_id)
    .eq("clinic_id", link.clinic_id)
    .is("completed_at", null)
    .gt("expires_at", now);
  const pendingAssessments = (pendingInvites ?? []).map((i) => {
    const tpl = Array.isArray(i.assessment_templates) ? i.assessment_templates[0] : i.assessment_templates;
    return { name: (tpl as { name?: string } | null)?.name ?? "Questionário" };
  });

  // Evolução dos questionários (série de pontuações por template, cronológica)
  const { data: progressRows } = await supabase
    .from("assessment_responses")
    .select("template_id, total_score, score_percentage, created_at, assessment_templates(name)")
    .eq("patient_id", link.patient_id)
    .eq("clinic_id", link.clinic_id)
    .order("created_at", { ascending: true });
  const progressMap = new Map<string, AssessmentProgress>();
  for (const r of progressRows ?? []) {
    const tid = r.template_id as string;
    if (!tid) continue;
    const tpl = Array.isArray(r.assessment_templates) ? r.assessment_templates[0] : r.assessment_templates;
    let entry = progressMap.get(tid);
    if (!entry) {
      entry = { template_id: tid, template_name: (tpl as { name?: string } | null)?.name ?? "Questionário", points: [], baseline: null, latest: null, deltaPct: null, count: 0, latestTotal: null, grade: null, sectionGrades: [], flaggedCount: 0 };
      progressMap.set(tid, entry);
    }
    entry.points.push({ date: r.created_at as string, score_percentage: Number(r.score_percentage ?? 0), total_score: Number(r.total_score ?? 0) });
  }
  const assessmentProgress: AssessmentProgress[] = [...progressMap.values()].map((e) => {
    const baseline = e.points.length ? e.points[0].score_percentage : null;
    const latest = e.points.length ? e.points[e.points.length - 1].score_percentage : null;
    const latestTotal = e.points.length ? e.points[e.points.length - 1].total_score : null;
    return { ...e, baseline, latest, deltaPct: baseline != null && latest != null ? Math.round((latest - baseline) * 10) / 10 : null, count: e.points.length, latestTotal };
  });

  return {
    link: link as PatientPortalLink,
    patient: patient as PatientPortalData["patient"],
    clinic: { ...(clinic as PatientPortalData["clinic"]), show_powered_by: showPoweredBy },
    latestInsight: insight,
    sessions,
    upcomingAppointments: upcomingMapped,
    activePackage: pkg,
    nextStep: insight?.next_step ?? "Entre em contato com sua clínica para saber sobre o próximo passo.",
    whatsappUrl: createWhatsAppUrl(whatsappNumber),
    availableOffers,
    intakeResponses,
    pendingAssessments,
    assessmentProgress,
    documents,
    sessionTypes,
    unreadClinicMessages: unreadCount ?? 0,
    paymentHistory,
    allInsights,
    exams,
    activePrescriptions,
    activeSubscription: activeSubscriptionData
      ? {
          id: activeSubscriptionData.id as string,
          planName: activeSubscriptionData.plan_name as string,
          status: activeSubscriptionData.status as string,
          amountCents: activeSubscriptionData.amount_cents as number,
          currency: activeSubscriptionData.currency as string,
          billingInterval: activeSubscriptionData.billing_interval as string,
          sessionsPerCycle: activeSubscriptionData.sessions_per_cycle as number,
          sessionsUsedThisCycle: activeSubscriptionData.sessions_used_this_cycle as number,
          currentPeriodEnd: activeSubscriptionData.current_period_end as string | null,
          cancelAtPeriodEnd: activeSubscriptionData.cancel_at_period_end as boolean,
        }
      : null,
  };
}
