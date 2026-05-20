import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SendMessageBox } from "@/components/send-message-box";
import { getAppointmentById } from "@/services/appointment-service";
import { sendManualCommunicationAction } from "@/app/communications/actions";
import { buildPatientVariables, defaultCommunicationTemplates, renderCommunicationTemplate } from "@/modules/communications/templates";

export default async function AppointmentReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const variables = buildPatientVariables(appointment.patients, appointment);
  const emailTemplate = defaultCommunicationTemplates.find((template) => template.key === "appointment_reminder_email")!;
  const smsTemplate = defaultCommunicationTemplates.find((template) => template.key === "appointment_reminder_sms")!;
  const emailBody = renderCommunicationTemplate(emailTemplate.body, variables);
  const smsBody = renderCommunicationTemplate(smsTemplate.body, variables);

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <Link href="/schedule" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Agenda
        </Link>
        <div className="mt-6 flex items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">LEMBRETE</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Enviar lembrete de consulta</h1>
            <p className="mt-3 text-black/55">Escolha o canal e personalize a mensagem antes de enviar.</p>
          </div>
          <div className="hidden h-14 w-14 items-center justify-center rounded-3xl bg-axiel-soft md:flex">
            <Bell className="h-6 w-6 text-axiel-gold" />
          </div>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-black/35">Paciente</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{appointment.patients?.full_name ?? "Paciente"}</h2>
          <p className="mt-3 text-sm text-black/55">{new Date(appointment.starts_at).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</p>
          <p className="mt-1 text-sm text-black/45">{appointment.duration_minutes} minutes</p>
          {appointment.notes && <p className="mt-5 rounded-3xl bg-axiel-soft p-4 text-sm leading-6 text-black/55">{appointment.notes}</p>}
        </Card>

        <div className="space-y-4">
          <SendMessageBox
            title="Lembrete por e-mail"
            helper="Ideal para detalhes completos."
            channel="email"
            recipient={appointment.patients?.email}
            subject={emailTemplate.subject}
            body={emailBody}
            action={sendManualCommunicationAction}
            hiddenFields={{ patient_id: appointment.patient_id, appointment_id: appointment.id, use_case: "appointment_reminder", return_to: "/schedule" }}
          />
          <SendMessageBox
            title="Lembrete por SMS"
            helper="Rápido e direto."
            channel="sms"
            recipient={appointment.patients?.phone}
            body={smsBody}
            action={sendManualCommunicationAction}
            hiddenFields={{ patient_id: appointment.patient_id, appointment_id: appointment.id, use_case: "appointment_reminder", return_to: "/schedule" }}
          />
        </div>
      </section>
    </Shell>
  );
}
