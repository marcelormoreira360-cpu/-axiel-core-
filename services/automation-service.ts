import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { AppointmentConfirmationEmail } from "@/components/email/appointment-confirmation-email";
import { AppointmentReminderEmail } from "@/components/email/appointment-reminder-email";
import { sendNpsRequest } from "@/services/email-service";

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

  // Read clinic reminder settings (default all to enabled)
  const { data: cs } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", appointment.clinic_id)
    .maybeSingle();

  const reminderSettings = (cs?.settings as Record<string, unknown> | null)?.reminders as Record<string, boolean> | undefined;
  const isEnabled = (key: string) => reminderSettings ? (reminderSettings[key] !== false) : true;

  const t = new Date(appointment.starts_at).getTime();
  const day = 24 * 60 * 60 * 1000;

  const allRows = [
    { tag: "d-1",  due_at: new Date(t - day).toISOString(),      title: "Lembrete D-1",        settingKey: "d_minus_1" },
    { tag: "nps",  due_at: new Date(t + day).toISOString(),      title: "NPS pós-sessão",      settingKey: "nps" },
    { tag: "d+3",  due_at: new Date(t + 3 * day).toISOString(),  title: "Acompanhamento D+3",  settingKey: "d_plus_3" },
    { tag: "d+30", due_at: new Date(t + 30 * day).toISOString(), title: "Fidelização D+30",    settingKey: "d_plus_30" },
  ];

  const rows = allRows
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

// Interpolates template variables: {{nome}}, {{horario}}, {{data}}
function interpolateTemplate(template: string, firstName: string, startsAt: string | null): string {
  const time = startsAt
    ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "horário agendado";
  const date = startsAt
    ? new Date(startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "data agendada";
  return template
    .replace(/{{nome}}/g, firstName)
    .replace(/{{horario}}/g, time)
    .replace(/{{data}}/g, date);
}

// Called by the daily cron — sends all due pending WhatsApp automations.
// For D-1, also sends a reminder email when the patient has an email address.
export async function processAutomations(): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: followUps, error } = await supabase
    .from("follow_ups")
    .select("*, patients(id, full_name, phone, email), appointments(id, starts_at)")
    .eq("status", "pending")
    .eq("channel", "whatsapp")
    .in("notes", ["d-1", "nps", "d+3", "d+30"])
    .lte("due_at", new Date().toISOString());

  if (error) throw error;

  type FollowUpRow = (typeof followUps extends (infer T)[] | null | undefined ? T : never);

  // Batch-load custom templates for all unique clinic_ids in this batch
  const clinicIds = [...new Set((followUps ?? []).map((fu) => fu.clinic_id as string))];
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

  async function processFollowUp(fu: FollowUpRow): Promise<"sent" | "failed" | "skipped"> {
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
    const ruleKey = TAG_TO_RULE_KEY[tag];
    const first = patient.full_name.split(" ")[0];
    const customTpl = ruleKey ? customTemplates.get(`${fu.clinic_id as string}:${ruleKey}`) : undefined;
    const body = customTpl
      ? interpolateTemplate(customTpl, first, appt?.starts_at ?? null)
      : buildMessage(tag, patient.full_name, appt?.starts_at ?? null);
    const useCase = fu.notes === "d-1" ? "appointment_reminder" : fu.notes === "nps" ? "nps_feedback" : "follow_up";

    // L-08: mark as "processing" before attempting send to prevent double-delivery
    // on cron retry. If the process crashes mid-flight the row stays "processing"
    // and won't be re-queued by the next run (operator can manually reset if needed).
    await supabase.from("follow_ups").update({ status: "processing" }).eq("id", fu.id);

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

  // Process all follow-ups in parallel — one failure won't block others
  const results = await Promise.allSettled((followUps ?? []).map(processFollowUp));

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
  const first = patient.full_name.split(" ")[0];
  const dateStr = appt?.starts_at
    ? new Date(appt.starts_at).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "data agendada";
  const timeStr = appt?.starts_at
    ? new Date(appt.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "horário agendado";

  const subject = `Lembrete: sua sessão é amanhã — ${timeStr}`;
  const bodyText = `Lembrete: sessão amanhã, ${dateStr} às ${timeStr}`;
  const { data: clinicRow } = await supabase.from("clinics").select("name, whatsapp_number").eq("id", fu.clinic_id).maybeSingle();
  const clinicName = (clinicRow?.name as string | null) ?? "sua clínica";
  const whatsappUrl = clinicRow?.whatsapp_number
    ? `https://wa.me/${(clinicRow.whatsapp_number as string).replace(/\D/g, "")}`
    : null;
  const durationMinutes = appt
    ? (() => { try { return (appt as { duration_minutes?: number }).duration_minutes ?? 60; } catch { return 60; } })()
    : 60;

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";
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

  // Get the patient's active portal link to include in the email
  const { data: portalLink } = await supabase
    .from("patient_portal_links")
    .select("token_hash")
    .eq("patient_id", patient.id)
    .eq("clinic_id", fu.clinic_id)
    .is("revoked_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // We can only link to portal if we have a raw token; token_hash is unusable as URL.
  // So we skip the CTA URL — patient uses their existing link.
  await sendNpsRequest({
    to: patient.email,
    patientFirstName: patient.full_name.split(" ")[0],
    clinicName: (clinicRow?.name as string | null) ?? "sua clínica",
    sessionTypeName,
    portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/p`,
  }).catch(() => { /* non-blocking */ });
}

// Called by the daily cron — finds patients with ≤2 sessions left in active packages
// and sends a single email+SMS notification (deduped by communication_logs).
export async function checkLowPackageNotifications(): Promise<{ notified: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: packages, error } = await supabase
    .from("patient_packages")
    .select("id, clinic_id, patient_id, name, sessions_total, sessions_used, patients(id, full_name, email, phone)")
    .eq("is_active", true);

  if (error) throw error;

  // Filter to ≤2 sessions remaining in JS (avoids complex SQL expression)
  const lowPackages = (packages ?? []).filter((pkg) => {
    const remaining = (pkg.sessions_total ?? 0) - (pkg.sessions_used ?? 0);
    return remaining >= 0 && remaining <= 2;
  });

  let notified = 0, skipped = 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";

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

    const remaining = (pkg.sessions_total ?? 0) - (pkg.sessions_used ?? 0);
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
  const dateStr = new Date(startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";
    const subject = `Sessão confirmada — ${dateStr} às ${timeStr}`;
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
          dateStr,
          timeStr,
          durationMinutes,
          whatsappUrl,
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

function buildMessage(tag: string, fullName: string, startsAt: string | null): string {
  const first = fullName.split(" ")[0];

  if (tag === "d-1") {
    const time = startsAt
      ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "horário agendado";
    return `Olá, ${first}! 👋\n\nLembrete: sua sessão é *amanhã* às ${time}. 📅\n\nAté lá!`;
  }

  if (tag === "nps") {
    return (
      `Olá, ${first}! 🌿\n\n` +
      `Como foi sua sessão de ontem? Sua avaliação nos ajuda a melhorar cada vez mais.\n\n` +
      `Acesse seu portal pelo link que você recebeu e deixe sua nota — leva menos de 1 minuto! ⭐`
    );
  }

  if (tag === "d+3") {
    return (
      `Olá, ${first}! 😊\n\n` +
      `Já se passaram alguns dias desde a sua sessão. Como está se sentindo?\n\n` +
      `Se tiver dúvidas ou quiser agendar o próximo atendimento, estou aqui. 🌿`
    );
  }

  // d+30
  return (
    `Olá, ${first}! 🌟\n\n` +
    `Faz 30 dias desde a sua última sessão — sentiu evolução? 💪\n\n` +
    `Que tal agendar o próximo atendimento para continuar o seu progresso?`
  );
}
