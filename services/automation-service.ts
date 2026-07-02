import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { AppointmentConfirmationEmail } from "@/components/email/appointment-confirmation-email";
import { AppointmentReminderEmail } from "@/components/email/appointment-reminder-email";
import { sendNpsRequest } from "@/services/email-service";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { canUseFeature } from "@/modules/billing/feature-access";
import { interpolateTemplate, buildMessage } from "@/lib/automation-helpers";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";

// Timezone por clínica com cache de instância (o fuso raramente muda e o cron
// processa muitos follow-ups da mesma clínica por execução).
const clinicTzCache = new Map<string, string>();
async function getClinicTz(clinicId: string): Promise<string> {
  const hit = clinicTzCache.get(clinicId);
  if (hit) return hit;
  const { getClinicTimezone } = await import("@/services/clinic-service");
  const tz = await getClinicTimezone(clinicId);
  clinicTzCache.set(clinicId, tz);
  return tz;
}

// Resolves plan slug for a clinic using the admin client (no session required).
// Falls back to "starter" when the clinic has no subscription row.
async function getClinicPlanSlug(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
): Promise<string> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plans(code, slug)")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const plans = (data?.plans as { code?: string | null; slug?: string | null } | null);
  return plans?.code ?? plans?.slug ?? "starter";
}

// A-05: sentinel email used for the demo patient created during onboarding.
// No real messages should ever be sent to this address or its associated phone.
const DEMO_PATIENT_EMAIL = "paciente-demo@exemplo.com";

type AppointmentRef = {
  id: string;
  clinic_id: string;
  patient_id: string;
  starts_at: string;
};

// Called right after appointment creation — schedules D-1, D+3 and D+30 follow-ups.
export async function scheduleAutomations(appointment: AppointmentRef): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Feature gate: only schedule automations for clinics on Professional or above
  const planSlug = await getClinicPlanSlug(supabase, appointment.clinic_id);
  if (!canUseFeature({ planSlug }, "follow_up_automation")) return;

  // Read clinic settings (reminders + custom_rules)
  const { data: cs } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", appointment.clinic_id)
    .maybeSingle();

  const settings = (cs?.settings as Record<string, unknown> | null) ?? {};
  const reminderSettings = (settings.reminders as Record<string, boolean> | undefined);
  const isEnabled = (key: string) => reminderSettings ? (reminderSettings[key] !== false) : true;
  const customRules = (settings.custom_rules as Array<{
    id: string; title: string; offsetDays: number; isEnabled: boolean;
  }> | undefined) ?? [];

  const t = new Date(appointment.starts_at).getTime();
  const day = 24 * 60 * 60 * 1000;

  // Default rules
  const defaultRows = [
    { tag: "d-1",  due_at: new Date(t - day).toISOString(),      title: "Lembrete D-1",        settingKey: "d_minus_1" },
    { tag: "nps",  due_at: new Date(t + day).toISOString(),      title: "NPS pós-sessão",      settingKey: "nps" },
    { tag: "d+3",  due_at: new Date(t + 3 * day).toISOString(),  title: "Acompanhamento D+3",  settingKey: "d_plus_3" },
    { tag: "d+30", due_at: new Date(t + 30 * day).toISOString(), title: "Fidelização D+30",    settingKey: "d_plus_30" },
  ];

  const rows = defaultRows
    .filter(({ settingKey }) => isEnabled(settingKey))
    .map(({ tag, due_at, title }) => ({
      clinic_id:      appointment.clinic_id,
      patient_id:     appointment.patient_id,
      appointment_id: appointment.id,
      title,
      due_at,
      channel:        "whatsapp",
      notes:          tag,
      status:         "pending",
    }));

  // Custom rules
  for (const cr of customRules) {
    if (!cr.isEnabled) continue;
    const due_at = new Date(t + cr.offsetDays * day).toISOString();
    rows.push({
      clinic_id:      appointment.clinic_id,
      patient_id:     appointment.patient_id,
      appointment_id: appointment.id,
      title:          cr.title,
      due_at,
      channel:        "whatsapp",
      notes:          `custom:${cr.id}`,
      status:         "pending",
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("follow_ups").insert(rows);
  if (error) console.error("[automation] schedule failed:", error.message);
}

// Converts automation tag to rule_key for automation_templates lookup
const TAG_TO_RULE_KEY: Record<string, string> = {
  "d-1": "d_minus_1",
  "nps": "nps",
  "d+3": "d_plus_3",
  "d+30": "d_plus_30",
};

// interpolateTemplate and buildMessage imported from @/lib/automation-helpers

// Called by the daily cron — sends all due pending WhatsApp automations.
// For D-1, also sends a reminder email when the patient has an email address.
export async function processAutomations(): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: followUps, error } = await supabase
    .from("follow_ups")
    .select("*, patients(id, full_name, phone, email), appointments(id, starts_at)")
    .eq("status", "pending")
    .eq("channel", "whatsapp")
    .or(`notes.in.(d-1,nps,d+3,d+30),notes.like.custom:%`)
    .lte("due_at", new Date().toISOString());

  if (error) throw error;

  type FollowUpRow = (typeof followUps extends (infer T)[] | null | undefined ? T : never);

  // Feature gate safety net: batch-load plan slugs and cancel any follow_ups
  // belonging to clinics that no longer have follow_up_automation (e.g. downgraded).
  const clinicIds = [...new Set((followUps ?? []).map((fu) => fu.clinic_id as string))];
  const clinicPlanMap = new Map<string, string>(); // clinicId → planSlug
  if (clinicIds.length > 0) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("clinic_id, plans(code, slug)")
      .in("clinic_id", clinicIds);
    (subs ?? []).forEach((s) => {
      const plans = s.plans as { code?: string | null; slug?: string | null } | null;
      clinicPlanMap.set(s.clinic_id as string, plans?.code ?? plans?.slug ?? "starter");
    });
  }

  // Cancel and skip follow_ups for clinics without the feature
  const allowedFollowUps = [];
  for (const fu of followUps ?? []) {
    const planSlug = clinicPlanMap.get(fu.clinic_id as string) ?? "starter";
    if (!canUseFeature({ planSlug }, "follow_up_automation")) {
      await supabase.from("follow_ups").update({ status: "canceled" }).eq("id", fu.id);
      continue;
    }
    allowedFollowUps.push(fu);
  }

  // Batch-load custom templates for all unique clinic_ids in this batch
  const customTemplates = new Map<string, string>(); // key: "clinicId:rule_key"
  if (clinicIds.length > 0) {
    const { data: tpls } = await supabase
      .from("automation_templates")
      .select("clinic_id, rule_key, template")
      .in("clinic_id", clinicIds)
      .eq("channel", "whatsapp")
      .eq("is_active", true);
    (tpls ?? []).forEach((t) => {
      customTemplates.set(`${t.clinic_id as string}:${t.rule_key as string}`, t.template as string);
    });
  }

  // Batch-load clinic_settings for clinics that have custom follow_ups
  // to resolve custom:uuid → template
  const clinicCustomRules = new Map<string, Map<string, string>>(); // clinicId → (ruleId → template)
  const clinicsWithCustom = [
    ...new Set(
      (allowedFollowUps ?? [])
        .filter((fu) => (fu.notes as string).startsWith("custom:"))
        .map((fu) => fu.clinic_id as string)
    ),
  ];
  if (clinicsWithCustom.length > 0) {
    const { data: csRows } = await supabase
      .from("clinic_settings")
      .select("clinic_id, settings")
      .in("clinic_id", clinicsWithCustom);
    (csRows ?? []).forEach((row) => {
      const crList = ((row.settings as Record<string, unknown> | null)?.custom_rules as Array<{
        id: string; template: string;
      }> | undefined) ?? [];
      const ruleMap = new Map(crList.map((r) => [r.id, r.template]));
      clinicCustomRules.set(row.clinic_id as string, ruleMap);
    });
  }

  async function processFollowUp(fu: FollowUpRow): Promise<"sent" | "failed" | "skipped"> {
    const tz = await getClinicTz(fu.clinic_id as string);
    const patient = fu.patients as { id: string; full_name: string; phone: string | null; email: string | null } | null;
    const appt    = fu.appointments as { id: string; starts_at: string } | null;

    if (!patient?.phone) {
      await supabase.from("follow_ups").update({ status: "canceled" }).eq("id", fu.id);
      return "skipped";
    }

    // A-05: never send real messages to the onboarding demo patient
    if (patient.email === DEMO_PATIENT_EMAIL) {
      await supabase.from("follow_ups").update({ status: "canceled" }).eq("id", fu.id);
      return "skipped";
    }

    const tag = fu.notes as string;
    const first = patient.full_name.split(" ")[0];
    let body: string;
    if (tag.startsWith("custom:")) {
      const ruleId = tag.replace("custom:", "");
      const tpl = clinicCustomRules.get(fu.clinic_id as string)?.get(ruleId);
      body = tpl
        ? interpolateTemplate(tpl, first, appt?.starts_at ?? null, tz)
        : `Olá, ${first}! 🌿\n\nTemos uma mensagem para você. Entre em contato se precisar de algo.`;
    } else {
      const ruleKey = TAG_TO_RULE_KEY[tag];
      const customTpl = ruleKey ? customTemplates.get(`${fu.clinic_id as string}:${ruleKey}`) : undefined;
      body = customTpl
        ? interpolateTemplate(customTpl, first, appt?.starts_at ?? null, tz)
        : buildMessage(tag, patient.full_name, appt?.starts_at ?? null, tz);
    }
    const useCase = fu.notes === "d-1" ? "appointment_reminder" : fu.notes === "nps" ? "nps_feedback" : "follow_up";

    // BUG-06: atomic claim — only update to "processing" if still "pending".
    // If two cron instances race, only one UPDATE will match (status = pending).
    // The other gets data=[] (0 rows) and should skip this follow_up.
    const { data: claimResult } = await supabase
      .from("follow_ups")
      .update({ status: "processing" })
      .eq("id", fu.id)
      .eq("status", "pending")
      .select("id");
    if (!claimResult || claimResult.length === 0) {
      console.warn("[automations] follow_up", fu.id, "already claimed by another instance — skipping");
      return "skipped";
    }

    try {
      await sendWhatsAppText(patient.phone, body);
      await supabase.from("follow_ups").update({ status: "completed" }).eq("id", fu.id);
      await supabase.from("communication_logs").insert({
        clinic_id:      fu.clinic_id,
        patient_id:     patient.id,
        appointment_id: fu.appointment_id ?? null,
        follow_up_id:   fu.id,
        channel:        "whatsapp",
        use_case:       useCase,
        recipient:      patient.phone,
        body,
        status:         "sent",
        provider:       "twilio",
      });
      // For D-1: also send email reminder (non-blocking)
      if (fu.notes === "d-1" && patient.email) {
        await sendReminderEmail(supabase, fu, patient, appt);
      }
      // For NPS: also send email requesting feedback (non-blocking)
      if (fu.notes === "nps" && patient.email) {
        await sendNpsEmail(supabase, fu, patient, appt);
      }
      return "sent";
    } catch (e) {
      // Mark as "failed" (not "pending") so a cron retry doesn't resend (L-08)
      await supabase.from("follow_ups").update({ status: "failed" }).eq("id", fu.id);
      await supabase.from("communication_logs").insert({
        clinic_id:      fu.clinic_id,
        patient_id:     patient.id,
        appointment_id: fu.appointment_id ?? null,
        follow_up_id:   fu.id,
        channel:        "whatsapp",
        use_case:       useCase,
        recipient:      patient.phone,
        body,
        status:         "failed",
        provider:       "twilio",
        error_message:  e instanceof Error ? e.message : "Unknown error",
      });
      return "failed";
    }
  }

  // Process all allowed follow-ups in parallel — one failure won't block others
  const results = await Promise.allSettled(allowedFollowUps.map(processFollowUp));

  let sent = 0, failed = 0, skipped = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value === "sent") sent++;
      else if (r.value === "skipped") skipped++;
      else failed++;
    } else {
      failed++;
    }
  }

  // DB-04: purge rate_limit_buckets rows older than 1 hour to prevent unbounded growth.
  // Non-blocking — failure doesn't affect the automation result.
  supabase
    .from("rate_limit_buckets")
    .delete()
    .lt("window_start", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .then(({ error }) => { if (error) console.warn("[automations] rate_limit cleanup error:", error.message); });

  return { processed: (followUps ?? []).length, sent, failed, skipped };
}

async function sendReminderEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  fu: { id: string; clinic_id: string; appointment_id: string | null },
  patient: { id: string; full_name: string; email: string | null },
  appt: { id: string; starts_at: string } | null,
) {
  if (!patient.email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const locale = await resolveClinicLocale(fu.clinic_id);
  const tz = await getClinicTz(fu.clinic_id);
  const t = await getServerT(locale, "emails");
  const first = patient.full_name.split(" ")[0];
  const dateStr = appt?.starts_at
    ? new Date(appt.starts_at).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz })
    : t("apptReminder.fallbackDate");
  const timeStr = appt?.starts_at
    ? new Date(appt.starts_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz })
    : t("apptReminder.fallbackTime");

  const subject = t("apptReminder.subject", { time: timeStr });
  const bodyText = `Lembrete: sessão amanhã, ${dateStr} às ${timeStr}`;
  const { data: clinicRow } = await supabase.from("clinics").select("name, whatsapp_number").eq("id", fu.clinic_id).maybeSingle();
  const clinicName = (clinicRow?.name as string | null) ?? "sua clínica";
  const whatsappUrl = clinicRow?.whatsapp_number
    ? `https://wa.me/${(clinicRow.whatsapp_number as string).replace(/\D/g, "")}`
    : null;
  const durationMinutes = appt
    ? ((appt as unknown as { duration_minutes?: number }).duration_minutes ?? 60)
    : 60;

  try {
    const fromAddress = DEFAULT_FROM_EMAIL;
    await resend.emails.send({
      from: fromAddress,
      to: patient.email,
      subject,
      react: AppointmentReminderEmail({
        clinicName,
        patientFirstName: first,
        dateStr,
        timeStr,
        durationMinutes,
        daysUntil: 1,
        whatsappUrl,
        t,
        locale,
      }),
    });
    await supabase.from("communication_logs").insert({
      clinic_id:      fu.clinic_id,
      patient_id:     patient.id,
      appointment_id: fu.appointment_id ?? null,
      follow_up_id:   fu.id,
      channel:        "email",
      use_case:       "appointment_reminder",
      recipient:      patient.email,
      body:           bodyText,
      status:         "sent",
      provider:       "resend",
    });
  } catch (e) {
    await supabase.from("communication_logs").insert({
      clinic_id:      fu.clinic_id,
      patient_id:     patient.id,
      appointment_id: fu.appointment_id ?? null,
      follow_up_id:   fu.id,
      channel:        "email",
      use_case:       "appointment_reminder",
      recipient:      patient.email,
      body:           bodyText,
      status:         "failed",
      provider:       "resend",
      error_message:  e instanceof Error ? e.message : "Unknown error",
    });
  }
}

// ── NPS email ─────────────────────────────────────────────────────────────────
async function sendNpsEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  fu: { id: string; clinic_id: string; appointment_id: string | null },
  patient: { id: string; full_name: string; email: string | null },
  appt: { id: string; starts_at: string } | null,
) {
  if (!patient.email) return;

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", fu.clinic_id)
    .maybeSingle();

  // Get session type name for context
  const { data: apptRow } = appt?.id
    ? await supabase.from("appointments").select("session_types(name)").eq("id", appt.id).maybeSingle()
    : { data: null };

  const sessionTypeName = (apptRow as unknown as { session_types: { name: string } | null } | null)?.session_types?.name ?? "sessão";

  // UX-05: generate a fresh portal link so the NPS email contains a real direct URL.
  // We store the hash, so we must mint a new token here. The link expires in 30 days.
  let portalUrl = `${APP_URL}/p`;
  try {
    const { randomUUID } = await import("crypto");
    const rawToken = randomUUID();
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: linkError } = await supabase
      .from("patient_portal_links")
      .insert({
        patient_id: patient.id,
        clinic_id: fu.clinic_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_single_use: true,  // NPS link is consumed after first view
      });
    if (!linkError) {
      portalUrl = `${APP_URL}/p/${rawToken}`;
    }
  } catch {
    // Non-blocking — fall back to generic portal URL
  }

  await sendNpsRequest({
    to: patient.email,
    patientFirstName: patient.full_name.split(" ")[0],
    clinicName: (clinicRow?.name as string | null) ?? "sua clínica",
    sessionTypeName,
    portalUrl,
    locale: await resolveClinicLocale(fu.clinic_id),
  }).catch(() => { /* non-blocking */ });
}

// Called by the daily cron — finds patients with ≤2 sessions left in active packages
// and sends a single email+SMS notification (deduped by communication_logs).
export async function checkLowPackageNotifications(): Promise<{ notified: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  // PERF-01: `sessions_remaining` is a generated column (migration 032) —
  // the filter is pushed down to Postgres, no full table scan.
  const { data: packages, error } = await supabase
    .from("patient_packages")
    .select("id, clinic_id, patient_id, name, sessions_total, sessions_used, sessions_remaining, patients(id, full_name, email, phone)")
    .eq("is_active", true)
    .gte("sessions_remaining", 0)
    .lte("sessions_remaining", 2);

  if (error) throw error;

  const lowPackages = packages ?? [];

  let notified = 0, skipped = 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = DEFAULT_FROM_EMAIL;

  // Batch dedup check: one query for all patient IDs instead of N queries
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const allPatientIds = lowPackages
    .map((pkg) => ((pkg.patients as unknown) as { id?: string } | null)?.id)
    .filter((id): id is string => Boolean(id));

  const alreadyNotified = new Set<string>();
  if (allPatientIds.length > 0) {
    const { data: recentLogs } = await supabase
      .from("communication_logs")
      .select("patient_id")
      .in("patient_id", allPatientIds)
      .eq("use_case", "package_low")
      .gte("created_at", since);
    (recentLogs ?? []).forEach((r) => alreadyNotified.add(r.patient_id as string));
  }

  for (const pkg of lowPackages) {
    const patient = (pkg.patients as unknown) as { id: string; full_name: string; email: string | null; phone: string | null } | null;
    if (!patient) { skipped++; continue; }

    // A-05: never send real messages to the onboarding demo patient
    if (patient.email === DEMO_PATIENT_EMAIL) { skipped++; continue; }

    // Dedup: skip if already notified in the last 7 days (checked in batch above)
    if (alreadyNotified.has(patient.id)) { skipped++; continue; }

    // BUG-06: use the generated column directly — avoids divergence if sessions_used is stale
    const remaining = (pkg as unknown as { sessions_remaining?: number }).sessions_remaining ?? 0;
    const first = patient.full_name.split(" ")[0];

    // Send email if patient has one
    if (patient.email) {
      const subject = `Seu pacote "${pkg.name}" está quase no fim`;
      const html = `
        <p>Olá, ${first}!</p>
        <p>Você tem apenas <strong>${remaining} sessão(ões)</strong> restante(s) no seu pacote <strong>${pkg.name}</strong>.</p>
        <p>Entre em contato para renovar e continuar seu tratamento sem interrupções.</p>
      `.trim();

      try {
        await resend.emails.send({ from: fromAddress, to: patient.email, subject, html });
        await supabase.from("communication_logs").insert({
          clinic_id:  pkg.clinic_id,
          patient_id: patient.id,
          channel:    "email",
          use_case:   "package_low",
          recipient:  patient.email,
          body:       html,
          status:     "sent",
          provider:   "resend",
        });
      } catch (e) {
        await supabase.from("communication_logs").insert({
          clinic_id:     pkg.clinic_id,
          patient_id:    patient.id,
          channel:       "email",
          use_case:      "package_low",
          recipient:     patient.email,
          body:          `Pacote ${pkg.name}: ${remaining} sessão(ões) restante(s).`,
          status:        "failed",
          provider:      "resend",
          error_message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    // Send WhatsApp if patient has phone
    if (patient.phone) {
      const smsBody = `Olá, ${first}! Você tem apenas *${remaining} sessão(ões)* restante(s) no pacote *${pkg.name}*. Entre em contato para renovar e continuar seu tratamento. 🌿`;

      try {
        await sendWhatsAppText(patient.phone, smsBody);
        await supabase.from("communication_logs").insert({
          clinic_id:  pkg.clinic_id,
          patient_id: patient.id,
          channel:    "whatsapp",
          use_case:   "package_low",
          recipient:  patient.phone,
          body:       smsBody,
          status:     "sent",
          provider:   "twilio",
        });
      } catch (e) {
        await supabase.from("communication_logs").insert({
          clinic_id:     pkg.clinic_id,
          patient_id:    patient.id,
          channel:       "whatsapp",
          use_case:      "package_low",
          recipient:     patient.phone,
          body:          smsBody,
          status:        "failed",
          provider:      "twilio",
          error_message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    if (patient.email || patient.phone) notified++;
    else skipped++;
  }

  return { notified, skipped };
}

// Called immediately after appointment creation — confirms the booking via WhatsApp + email.
export async function sendAppointmentConfirmation(params: {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  clinicName: string;
  startsAt: string;
  durationMinutes: number;
}): Promise<void> {
  const { clinicId, patientId, appointmentId, patientName, patientPhone, patientEmail, clinicName, startsAt, durationMinutes } = params;

  // A-05: never send real messages to the onboarding demo patient
  if (patientEmail === DEMO_PATIENT_EMAIL) return;

  const first = patientName.split(" ")[0];
  const tz = await getClinicTz(clinicId);
  const dateStr = new Date(startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const timeStr = new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const supabase = createSupabaseAdminClient();
  const useCase = "appointment_confirmation" as const;

  if (patientPhone) {
    const body =
      `Olá, ${first}! ✅\n\n` +
      `Sua sessão foi confirmada:\n` +
      `📅 *${dateStr}* às *${timeStr}*\n` +
      `⏱ ${durationMinutes} minutos\n\n` +
      `Em caso de imprevisto, entre em contato com a clínica. Até lá! 🌿`;

    try {
      await sendWhatsAppText(patientPhone, body);
      await supabase.from("communication_logs").insert({
        clinic_id: clinicId, patient_id: patientId, appointment_id: appointmentId,
        channel: "whatsapp", use_case: useCase, recipient: patientPhone,
        body, status: "sent", provider: "twilio",
      });
    } catch (e) {
      await supabase.from("communication_logs").insert({
        clinic_id: clinicId, patient_id: patientId, appointment_id: appointmentId,
        channel: "whatsapp", use_case: useCase, recipient: patientPhone,
        body, status: "failed", provider: "twilio",
        error_message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  if (patientEmail) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = DEFAULT_FROM_EMAIL;
    const locale = await resolveClinicLocale(clinicId);
    const t = await getServerT(locale, "emails");
    const dateStrEmail = new Date(startsAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    const timeStrEmail = new Date(startsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz });
    const subject = t("apptConfirm.subject", { date: dateStrEmail, time: timeStrEmail });
    const { data: clinicRow } = await supabase.from("clinics").select("whatsapp_number").eq("id", clinicId).maybeSingle();
    const whatsappUrl = clinicRow?.whatsapp_number
      ? `https://wa.me/${(clinicRow.whatsapp_number as string).replace(/\D/g, "")}`
      : null;
    const bodyText = `Sessão confirmada: ${dateStr} às ${timeStr} (${durationMinutes} min) em ${clinicName}`;

    try {
      await resend.emails.send({
        from: fromAddress,
        to: patientEmail,
        subject,
        react: AppointmentConfirmationEmail({
          clinicName,
          patientFirstName: first,
          dateStr: dateStrEmail,
          timeStr: timeStrEmail,
          durationMinutes,
          whatsappUrl,
          t,
          locale,
        }),
      });
      await supabase.from("communication_logs").insert({
        clinic_id: clinicId, patient_id: patientId, appointment_id: appointmentId,
        channel: "email", use_case: useCase, recipient: patientEmail,
        body: bodyText, status: "sent", provider: "resend",
      });
    } catch (e) {
      await supabase.from("communication_logs").insert({
        clinic_id: clinicId, patient_id: patientId, appointment_id: appointmentId,
        channel: "email", use_case: useCase, recipient: patientEmail,
        body: bodyText, status: "failed", provider: "resend",
        error_message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }
}

// buildMessage re-exported from @/lib/automation-helpers
