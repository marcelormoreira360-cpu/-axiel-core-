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
export async function processAutomations(): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: followUps, error } = await supabase
    .from("follow_ups")
    .select("*, patients(id, full_name, phone), appointments(id, starts_at)")
    .eq("status", "pending")
    .eq("channel", "whatsapp")
    .in("notes", ["d-1", "d+3", "d+30"])
    .lte("due_at", new Date().toISOString());

  if (error) throw error;

  let sent = 0, failed = 0, skipped = 0;

  for (const fu of followUps ?? []) {
    const patient = fu.patients as { id: string; full_name: string; phone: string | null } | null;
    const appt    = fu.appointments as { id: string; starts_at: string } | null;

    if (!patient?.phone) {
      await supabase.from("follow_ups").update({ status: "canceled" }).eq("id", fu.id);
      skipped++;
      continue;
    }

    const body = buildMessage(fu.notes as string, patient.full_name, appt?.starts_at ?? null);

    try {
      await sendWhatsAppText(patient.phone, body);
      await supabase.from("follow_ups").update({ status: "completed" }).eq("id", fu.id);
      await supabase.from("communication_logs").insert({
        clinic_id:      fu.clinic_id,
        patient_id:     patient.id,
        appointment_id: fu.appointment_id ?? null,
        follow_up_id:   fu.id,
        channel:        "whatsapp",
        use_case:       fu.notes === "d-1" ? "appointment_reminder" : "follow_up",
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
        use_case:       fu.notes === "d-1" ? "appointment_reminder" : "follow_up",
        recipient:      patient.phone,
        body,
        status:         "failed",
        provider:       "twilio",
        error_message:  e instanceof Error ? e.message : "Unknown error",
      });
      failed++;
    }
  }

  return { processed: (followUps ?? []).length, sent, failed, skipped };
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
