import Link from "next/link";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { ScheduleContainer } from "@/components/schedule-container";
import { buildPatientSnapshot } from "@/components/patient-snapshot";
import type { ScheduleSession } from "@/components/session-card";
import { getAppointments, getAppointmentsByPatients, createAppointment, createPendingAppointmentWithToken, updateAppointment, softDeleteAppointment, getSessionTypes } from "@/services/appointment-service";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { sendSimpleEmail } from "@/services/email-service";
import { scheduleAutomations } from "@/services/automation-service";
import { getLatestAiInsightsByPatients, getPendingAiInsightReviewCount } from "@/services/ai-insight-service";
import { getPatients, findOrCreatePatientForBooking } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { isPractitioner, getTeamMembers } from "@/services/team-service";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
import { formatTime } from "@/modules/schedule/date-utils";

export default async function SchedulePage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const practitionerId = profile && isPractitioner(profile.role) ? profile.id : undefined;

  const [appointments, patients, openReviews, sessionTypes, clinic, teamMembers] = await Promise.all([
    getAppointments(clinicId, practitionerId),
    getPatients(clinicId, practitionerId),
    getPendingAiInsightReviewCount(clinicId),
    getSessionTypes(clinicId),
    getCurrentClinic(),
    // Only fetch team for non-practitioners (owners/admins who need the filter)
    !practitionerId && clinicId ? getTeamMembers(clinicId) : Promise.resolve([]),
  ]);

  // Practitioners available for the filter dropdown (owners/admins only)
  const practitionerOptions = practitionerId
    ? undefined
    : teamMembers
        .filter((m) => m.id !== profile?.id) // exclude self if already filtered above
        .map((m) => ({ id: m.id, name: (m as { full_name?: string }).full_name ?? m.email ?? m.id }))
        .filter((m) => m.name);

  const todayAppointments = getAppointmentsForDay(appointments, new Date());
  const nextSession = todayAppointments.find(
    (a) => new Date(a.starts_at).getTime() >= Date.now()
  );

  // PERF-01: batch-fetch appointments + insights for all today's patients in
  // 2 queries total instead of 2 × N (one per appointment).
  const todayPatientIds = [...new Set(todayAppointments.map((a) => a.patient_id))];
  const [appointmentsByPatient, insightsByPatient] = await Promise.all([
    getAppointmentsByPatients(todayPatientIds),
    getLatestAiInsightsByPatients(todayPatientIds),
  ]);

  const sessions: ScheduleSession[] = todayAppointments.map((appointment) => {
    const patientAppointments = appointmentsByPatient.get(appointment.patient_id) ?? [];
    const latestInsight = insightsByPatient.get(appointment.patient_id) ?? null;

    const insightOutput =
      latestInsight?.review_status === "final"
        ? latestInsight.final_output ?? latestInsight.output
        : latestInsight?.output;

    return {
      ...appointment,
      latestInsightStatus:
        latestInsight?.review_status === "final" ? "final" : "review",
      previousSessions: patientAppointments.filter((a) => a.id !== appointment.id),
      snapshot: buildPatientSnapshot({
        appointment,
        previousSessions: patientAppointments,
        latestInsightText: insightOutput?.structured_summary?.overview ?? null,
      }),
    };
  });

  async function createSessionAction(formData: FormData) {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic.");

    const startsAt = String(formData.get("starts_at") ?? "");
    const duration = Number(formData.get("duration_minutes") ?? 60);
    const sessionTypeId = String(formData.get("session_type_id") ?? "") || null;
    const source = (String(formData.get("source") ?? "") || null) as import("@/lib/types").AppointmentSource | null;

    // ── Resolve patient: existing or create new inline ────────────────────────
    const newPatientName = String(formData.get("new_patient_name") ?? "").trim();
    let patientId = String(formData.get("patient_id") ?? "").trim();

    if (newPatientName) {
      const newPatient = await findOrCreatePatientForBooking({
        clinic_id: profile.clinic_id,
        full_name: newPatientName,
        email: String(formData.get("new_patient_email") ?? "").trim() || null,
        phone: String(formData.get("new_patient_phone") ?? "").trim() || null,
      });
      patientId = newPatient.id;
    }

    if (!patientId || !startsAt) throw new Error("Paciente e horário são obrigatórios.");

    const appointment = await createAppointment({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      starts_at: startsAt,
      duration_minutes: duration,
      session_type_id: sessionTypeId,
      source,
      notes: null,
    });

    // Schedule D-1, D+3, D+30 automations (fire-and-forget)
    scheduleAutomations({
      id: appointment.id,
      clinic_id: appointment.clinic_id,
      patient_id: appointment.patient_id,
      starts_at: appointment.starts_at,
    }).catch(() => {});

    const patient = appointment.patients;
    if (patient?.phone) {
      try {
        const { getClinicTimezone } = await import("@/services/clinic-service");
        const tz = await getClinicTimezone(appointment.clinic_id);
        const date = new Date(startsAt);
        const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
        const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        const firstName = patient.full_name.split(" ")[0];
        const body =
          `Olá, ${firstName}! ✅\n\n` +
          `Sua sessão foi confirmada:\n` +
          `📅 ${dateStr}\n` +
          `🕐 ${timeStr}\n` +
          `⏱ ${duration} minutos\n\n` +
          `Até lá!`;
        await sendWhatsAppText(patient.phone, body);
      } catch {
        // WhatsApp failure does not block appointment creation
      }
    }

    revalidatePath("/schedule");
  }

  // Gera um link de confirmação: cria o agendamento como PENDENTE (segura o horário)
  // e devolve a URL + contato do paciente para o terapeuta enviar (copiar/WhatsApp/e-mail).
  async function createConfirmationLinkAction(
    formData: FormData,
  ): Promise<{ url?: string; phone?: string | null; email?: string | null; patientName?: string; error?: string }> {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) return { error: "Usuário sem clínica." };

    const startsAt = String(formData.get("starts_at") ?? "");
    const duration = Number(formData.get("duration_minutes") ?? 60);
    const sessionTypeId = String(formData.get("session_type_id") ?? "") || null;

    const newPatientName = String(formData.get("new_patient_name") ?? "").trim();
    let patientId = String(formData.get("patient_id") ?? "").trim();
    let phone: string | null = null;
    let email: string | null = null;
    let patientName = "";

    if (newPatientName) {
      const np = await findOrCreatePatientForBooking({
        clinic_id: profile.clinic_id,
        full_name: newPatientName,
        email: String(formData.get("new_patient_email") ?? "").trim() || null,
        phone: String(formData.get("new_patient_phone") ?? "").trim() || null,
      });
      patientId = np.id; phone = np.phone; email = np.email; patientName = np.full_name;
    } else if (patientId) {
      const { getPatientById } = await import("@/services/patient-service");
      const p = await getPatientById(patientId, profile.clinic_id);
      if (!p) return { error: "Paciente não encontrado." };
      phone = p.phone; email = p.email; patientName = p.full_name;
    }

    if (!patientId || !startsAt) return { error: "Paciente e horário são obrigatórios." };

    const { token } = await createPendingAppointmentWithToken({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      starts_at: startsAt,
      duration_minutes: duration,
      session_type_id: sessionTypeId,
    });

    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const url = `${proto}://${host}/confirmar/${token}`;

    revalidatePath("/schedule");
    return { url, phone, email, patientName };
  }

  // Envia o link de confirmação por e-mail ao paciente.
  async function emailConfirmationLinkAction(
    formData: FormData,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) return { ok: false, error: "Usuário sem clínica." };
    const to = String(formData.get("email") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const dateLabel = String(formData.get("date_label") ?? "").trim();
    if (!to || !url) return { ok: false, error: "E-mail ou link ausente." };

    const clinic = await getCurrentClinic();
    const clinicName = clinic?.name ?? "Clínica";
    try {
      await sendSimpleEmail({
        to,
        subject: `Confirme seu agendamento — ${clinicName}`,
        html:
          `<p>Olá!</p>` +
          `<p>A ${clinicName} reservou um horário para você${dateLabel ? `: <b>${dateLabel}</b>` : ""}.</p>` +
          `<p>Confirme o horário e complete seu cadastro neste link:</p>` +
          `<p><a href="${url}">${url}</a></p>`,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "Erro ao enviar e-mail." };
    }
  }

  async function updateStatusAction(id: string, status: string) {
    "use server";
    await updateAppointment(id, { status });
    revalidatePath("/schedule");
  }

  async function deleteSessionAction(id: string) {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("Usuário sem clínica.");
    await softDeleteAppointment(id, profile.clinic_id);
    revalidatePath("/schedule");
  }

  async function rescheduleAction(id: string, newStartsAt: string) {
    "use server";
    await updateAppointment(id, { starts_at: newStartsAt });
    revalidatePath("/schedule");
  }

  async function resizeDurationAction(id: string, newDuration: number) {
    "use server";
    await updateAppointment(id, { duration_minutes: newDuration });
    revalidatePath("/schedule");
  }

  const t = await getTranslations("schedule.page");
  const locale = await getLocale();
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Shell fullWidth>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] capitalize">{today}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {t("todayCount", { count: todayAppointments.length })}
          </p>
        </div>
        {profile?.clinic_id && (
          <Link
            href="/schedule/new"
            className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
          >
            {t("newSession")}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-[10px] mb-[22px]">
        <div className="bg-[#0F1A2E] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-white/50 mb-[6px]">{t("statToday")}</p>
          <p className="text-[26px] font-semibold tracking-[-0.04em] leading-none text-white">
            {todayAppointments.length}
          </p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[6px]">{t("statNext")}</p>
          <p className="text-[18px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">
            {nextSession ? formatTime(nextSession.starts_at, locale) : "—"}
          </p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[6px]">{t("statReviews")}</p>
          <p className="text-[26px] font-semibold tracking-[-0.04em] leading-none text-[#0F1A2E]">
            {openReviews}
          </p>
        </div>
      </div>

      {!profile?.clinic_id ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[13px] text-[#A09E98]">{t("noClinic")}</p>
        </div>
      ) : (
        <>
          <ScheduleContainer
            sessions={sessions}
            allAppointments={appointments}
            patients={patients}
            sessionTypes={sessionTypes}
            createSessionAction={createSessionAction}
            createConfirmationLinkAction={createConfirmationLinkAction}
            emailConfirmationLinkAction={emailConfirmationLinkAction}
            updateStatusAction={updateStatusAction}
            deleteSessionAction={deleteSessionAction}
            rescheduleAction={rescheduleAction}
            resizeDurationAction={resizeDurationAction}
            practitioners={practitionerOptions}
          />
        </>
      )}
    </Shell>
  );
}
