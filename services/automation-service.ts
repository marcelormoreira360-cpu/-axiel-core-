import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";

type AppointmentRef = {
  id: string;
  clinic_id: string;
  patient_id: string;
  starts_at: string;
};

// Called right after appointment creation — schedules D-1, D+3 and D+30 follow-ups.
export async function scheduleAutomations(appointment: AppointmentRef): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const t = new Date(appointment.starts_at).getTime();
  const day = 24 * 60 * 60 * 1000;

  const rows = [
    { tag: "d-1",  due_at: new Date(t - day).toISOString(),      title: "Lembrete D-1" },
    { tag: "d+3",  due_at: new Date(t + 3 * day).toISOString(),  title: "Acompanhamento D+3" },
    { tag: "d+30", due_at: new Date(t + 30 * day).toISOString(), title: "Fidelização D+30" },
  ].map(({ tag, due_at, title }) => ({
    clinic_id:      appointment.clinic_id,
    patient_id:     appointment.patient_id,
    appointment_id: appointment.id,
    title,
    due_at,
    channel:        "whatsapp",
    notes:          tag,
    status:         "pending",
  }));

  const { error } = await supabase.from("follow_ups").insert(rows);
  if (error) console.error("[automation] schedule failed:", error.message);
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
    .in("notes", ["d-1", "d+3", "d+30"])
    .lte("due_at", new Date().toISOString());

  if (error) throw error;

  let sent = 0, failed = 0, skipped = 0;

  for (const fu of followUps ?? []) {
    const patient = fu.patients as { id: string; full_name: string; phone: string | null; email: string | null } | null;
    const appt    = fu.appointments as { id: string; starts_at: string } | null;

    if (!patient?.phone) {
      await supabase.from("follow_ups").update({ status: "canceled" }).eq("id", fu.id);
      skipped++;
      continue;
    }

    const body = buildMessage(fu.notes as string, patient.full_name, appt?.starts_at ?? null);
    const useCase = fu.notes === "d-1" ? "appointment_reminder" : "follow_up";

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
      sent++;
    } catch (e) {
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
      failed++;
    }

    // For D-1: also send email if patient has one
    if (fu.notes === "d-1" && patient.email) {
      await sendReminderEmail(supabase, fu, patient, appt);
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

  const subject = `Lembrete: sua sessão é amanhã`;
  const html = `
    <p>Olá, ${first}!</p>
    <p>Este é um lembrete de que sua sessão está agendada para <strong>${dateStr}</strong> às <strong>${timeStr}</strong>.</p>
    <p>Caso precise remarcar ou tenha alguma dúvida, entre em contato conosco.</p>
    <p>Até lá!</p>
  `.trim();

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";
    await resend.emails.send({ from: fromAddress, to: patient.email, subject, html });
    await supabase.from("communication_logs").insert({
      clinic_id:      fu.clinic_id,
      patient_id:     patient.id,
      appointment_id: fu.appointment_id ?? null,
      follow_up_id:   fu.id,
      channel:        "email",
      use_case:       "appointment_reminder",
      recipient:      patient.email,
      body:           html,
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
      body:           html,
      status:         "failed",
      provider:       "resend",
      error_message:  e instanceof Error ? e.message : "Unknown error",
    });
  }
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

  for (const pkg of lowPackages) {
    const patient = pkg.patients as { id: string; full_name: string; email: string | null; phone: string | null } | null;
    if (!patient) { skipped++; continue; }

    // Dedup: skip if already notified in the last 7 days for this patient+use_case
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("patient_id", patient.id)
      .eq("use_case", "package_low")
      .gte("created_at", since)
      .limit(1);

    if (recent && recent.length > 0) { skipped++; continue; }

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

function buildMessage(tag: string, fullName: string, startsAt: string | null): string {
  const first = fullName.split(" ")[0];

  if (tag === "d-1") {
    const time = startsAt
      ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "horário agendado";
    return `Olá, ${first}! 👋\n\nLembrete: sua sessão é *amanhã* às ${time}. 📅\n\nAté lá!`;
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
