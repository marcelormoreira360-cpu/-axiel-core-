import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Shell } from "@/components/shell";
import { ScheduleContainer } from "@/components/schedule-container";
import { buildPatientSnapshot } from "@/components/patient-snapshot";
import type { ScheduleSession } from "@/components/session-card";
import { getAppointments, getAppointmentsByPatient, createAppointment, getSessionTypes } from "@/services/appointment-service";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { scheduleAutomations } from "@/services/automation-service";
import { getLatestAiInsight, getPendingAiInsightReviewCount } from "@/services/ai-insight-service";
import { getPatients } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
import { formatTime } from "@/modules/schedule/date-utils";

export default async function SchedulePage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;

  const [appointments, patients, openReviews, sessionTypes] = await Promise.all([
    getAppointments(clinicId),
    getPatients(clinicId),
    getPendingAiInsightReviewCount(clinicId),
    getSessionTypes(clinicId),
  ]);

  const todayAppointments = getAppointmentsForDay(appointments, new Date());
  const nextSession = todayAppointments.find(
    (a) => new Date(a.starts_at).getTime() >= Date.now()
  );

  const sessions: ScheduleSession[] = await Promise.all(
    todayAppointments.map(async (appointment) => {
      const [patientAppointments, latestInsight] = await Promise.all([
        getAppointmentsByPatient(appointment.patient_id),
        getLatestAiInsight(appointment.patient_id),
      ]);

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
    })
  );

  async function createSessionAction(formData: FormData) {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic.");

    const patientId = String(formData.get("patient_id") ?? "");
    const startsAt = String(formData.get("starts_at") ?? "");
    const duration = Number(formData.get("duration_minutes") ?? 60);
    const sessionTypeId = String(formData.get("session_type_id") ?? "") || null;
    const source = (String(formData.get("source") ?? "") || null) as import("@/lib/types").AppointmentSource | null;

    if (!patientId || !startsAt) throw new Error("Patient and time are required.");

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
        const date = new Date(startsAt);
        const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] capitalize">{today}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {todayAppointments.length > 0
              ? `${todayAppointments.length} ${todayAppointments.length === 1 ? "sessão" : "sessões"} hoje`
              : "Nenhuma sessão agendada hoje"}
          </p>
        </div>
        {profile?.clinic_id && (
          <Link
            href="/schedule/new"
            className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
          >
            + Agendar sessão
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-[10px] mb-[22px]">
        <div className="bg-[#0F1A2E] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-white/50 mb-[6px]">Hoje</p>
          <p className="text-[26px] font-semibold tracking-[-0.04em] leading-none text-white">
            {todayAppointments.length}
          </p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[6px]">Próxima</p>
          <p className="text-[18px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">
            {nextSession ? formatTime(nextSession.starts_at) : "—"}
          </p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[6px]">Reviews</p>
          <p className="text-[26px] font-semibold tracking-[-0.04em] leading-none text-[#0F1A2E]">
            {openReviews}
          </p>
        </div>
      </div>

      {!profile?.clinic_id ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[13px] text-[#A09E98]">Usuário precisa estar vinculado a uma clínica.</p>
        </div>
      ) : (
        <ScheduleContainer
          sessions={sessions}
          allAppointments={appointments}
          patients={patients}
          sessionTypes={sessionTypes}
          createSessionAction={createSessionAction}
        />
      )}
    </Shell>
  );
}
