import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowLeft, CalendarPlus, Video } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { ChargeSessionButton } from "@/app/financeiro/charge-session-button";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SessionRecordingPanel } from "@/components/session-recording-panel";
import { ZoomRecordingsPanel } from "@/components/zoom-recordings-panel";
import { ZoomSessionBanner } from "@/components/zoom-session-banner";
import { getAppointmentById } from "@/services/appointment-service";
import { getPatientById } from "@/services/patient-service";
import { getClinicalTestCatalog, getClinicSessionConfig } from "@/services/clinic-service";
import { getSessionRecordByAppointment, getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getZoomRecordingsByAppointment } from "@/services/zoom-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getPatientAssessmentResponses } from "@/services/assessment-service";
import { gradeTotal } from "@/lib/assessment-grading";
import { formatIntakeAnswerSummary } from "@/lib/intake-answer";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function SessionRecordingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const t = await getTranslations("session.page");
  const locale = await getLocale();

  const [record, recordings, intakeResponses, assessmentResponses, prevRecords, patient, testCatalog, isPaid] = await Promise.all([
    getSessionRecordByAppointment(id),
    getZoomRecordingsByAppointment(id),
    getPatientIntakeResponses(appointment.patient_id),
    getPatientAssessmentResponses(appointment.patient_id),
    getSessionRecordsByPatient(appointment.patient_id),
    getPatientById(appointment.patient_id),
    getClinicalTestCatalog(appointment.clinic_id),
    // Checagem barata: a sessão já tem pagamento confirmado? (mesma guarda do endpoint de cobrança)
    (async () => {
      const supabase = await createSupabaseServerClient();
      const { count } = await supabase
        .from("patient_payments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_id", id)
        .eq("status", "paid");
      return (count ?? 0) > 0;
    })(),
  ]);

  // Sugestão de testes na sessão: catálogo da clínica + bateria da última sessão (dedup)
  const carryForwardTests = (prevRecords.find((r) => r.appointment_id !== id && (r.clinical_tests?.length ?? 0) > 0)
    ?.clinical_tests ?? [])
    .map((ct) => ct.name)
    .filter(Boolean);
  const suggestedTests = [...new Set([...testCatalog, ...carryForwardTests])];

  const patientName =
    (Array.isArray(appointment.patients)
      ? appointment.patients[0]
      : appointment.patients)?.full_name ?? "Paciente";

  // Determine teleconsulta action
  const hasZoom = !!appointment.zoom_join_url;
  const teleconsultaHref = hasZoom
    ? appointment.zoom_start_url ?? appointment.zoom_join_url!
    : `/schedule/${id}/telehealth`;
  const teleconsultaLabel = hasZoom ? t("enterZoom") : t("startTelehealth");

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center gap-[10px] mb-[20px] flex-wrap">
        <BackLink
          fallbackHref={`/patients/${appointment.patient_id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {patientName} · {t("subtitle")}
          </p>
        </div>
        {hasZoom ? (
          <a
            href={teleconsultaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#2D8CFF] hover:bg-[#1a7aee] rounded-[8px] px-[12px] py-[7px] transition"
          >
            <Video className="h-3.5 w-3.5" />
            {teleconsultaLabel}
          </a>
        ) : (
          <Link
            href={teleconsultaHref}
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] dark:bg-white/[.10] hover:bg-[#1a2d4a] dark:hover:bg-white/[.16] rounded-[8px] px-[12px] py-[7px] transition"
          >
            <Video className="h-3.5 w-3.5" />
            {teleconsultaLabel}
          </Link>
        )}
      </div>

      {/* Zoom session banner — shown when Zoom meeting was created */}
      {appointment.zoom_join_url && (
        <ZoomSessionBanner
          zoomJoinUrl={appointment.zoom_join_url}
          zoomStartUrl={appointment.zoom_start_url}
          startsAt={appointment.starts_at}
          patientName={patientName}
        />
      )}

      {/* Queixa principal + resumo do caso — fixos em toda sessão (Feature 2) */}
      {(patient?.chief_complaint || patient?.case_summary) && (
        <div className="mb-5 bg-[#E1F5EE] dark:bg-[#0F6E56]/[.10] border border-[#0F6E56]/20 rounded-[12px] p-[15px]">
          {patient?.chief_complaint && (
            <div className="mb-[8px]">
              <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#0F6E56] mb-[2px]">{t("chiefComplaint")}</p>
              <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{patient.chief_complaint}</p>
            </div>
          )}
          {patient?.case_summary && (
            <div>
              <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#0F6E56] mb-[2px]">{t("caseSummary")}</p>
              <p className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed whitespace-pre-wrap">{patient.case_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Contexto do paciente — anamnese, assessments, última sessão */}
      {(intakeResponses.length > 0 || assessmentResponses.length > 0 || prevRecords.length > 0) && (
        <div className="mb-5 bg-[#F8F7F4] dark:bg-white/[.04] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-[15px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[12px]">
            {t("context")}
          </p>

          <div className="space-y-[14px]">
            {/* Última sessão — key observations */}
            {prevRecords.length > 0 && ((prevRecords[0].key_observations as string[] | null) ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[5px]">{t("lastSessionObs")}</p>
                <div className="space-y-[3px]">
                  {((prevRecords[0].key_observations as string[] | null) ?? []).slice(0, 3).map((obs, i) => (
                    <div key={i} className="flex gap-[7px] items-start">
                      <span className="w-1 h-1 rounded-full bg-[#0F6E56] mt-[5px] shrink-0" />
                      <p className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97] leading-relaxed">{obs}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Testes clínicos da última sessão */}
            {prevRecords.length > 0 && ((prevRecords[0].clinical_tests as { name: string; result: string; notes?: string }[] | null) ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[5px]">{t("lastSessionTests")}</p>
                <div className="space-y-[3px]">
                  {((prevRecords[0].clinical_tests as { name: string; result: string; notes?: string }[] | null) ?? []).slice(0, 6).map((ct, i) => (
                    <div key={i} className="flex gap-[6px] flex-wrap">
                      <span className="text-[10px] text-[#A09E98]">{ct.name}:</span>
                      <span className="text-[10px] text-[#0F1A2E] dark:text-[#E8E6E2]">{ct.result || "—"}{ct.notes ? ` (${ct.notes})` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assessment mais recente */}
            {assessmentResponses.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[5px]">{t("lastForm")}</p>
                {(() => {
                  const resp = assessmentResponses[0];
                  const pct = resp.score_percentage ?? 0;
                  const name = resp.assessment_templates?.name ?? t("formFallback");
                  const filledDate = new Date(resp.filled_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
                  const grade = gradeTotal(Number(resp.total_score ?? 0), resp.assessment_templates?.scoring_config ?? null);
                  return (
                    <div className="flex items-center gap-[10px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#0F1A2E] dark:text-[#E8E6E2] truncate">{name}</p>
                        <p className="text-[10px] text-[#A09E98]">{filledDate}</p>
                      </div>
                      <div className="flex items-center gap-[6px] shrink-0">
                        {grade && (
                          <span
                            className="text-[10px] font-medium rounded-full px-[8px] py-[2px]"
                            style={{ color: grade.color, backgroundColor: `${grade.color}1A` }}
                          >
                            {grade.label}
                          </span>
                        )}
                        <div className="w-[60px] h-[4px] bg-[#E5E3DC] dark:bg-white/[.10] rounded-full overflow-hidden">
                          <div
                            className={["h-full rounded-full", pct >= 70 ? "bg-[#FF6B4A]" : pct >= 40 ? "bg-[#F5A623]" : "bg-[#0F6E56]"].join(" ")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Anamnese — top 3 respostas */}
            {intakeResponses.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[5px]">
                  {t("intake")} <span className="font-normal text-[#A09E98]">{t("intakeCount", { count: intakeResponses.length })}</span>
                </p>
                <div className="space-y-[4px]">
                  {intakeResponses.slice(0, 3).map((r) => {
                    const label = r.intake_questions?.label;
                    const answer = formatIntakeAnswerSummary(r.answer);
                    if (!label || !answer) return null;
                    return (
                      <div key={r.id} className="flex gap-[6px] flex-wrap">
                        <span className="text-[10px] text-[#A09E98]">{label}:</span>
                        <span className="text-[10px] text-[#0F1A2E] dark:text-[#E8E6E2]">{answer.slice(0, 80)}{answer.length > 80 ? "…" : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SessionRecordingPanel
        appointment={appointment}
        record={record}
        saved={saved === "1"}
        suggestedTests={suggestedTests}
        recordingConsentAt={patient?.recording_consent_at ?? null}
        sessionConfig={await getClinicSessionConfig(appointment.clinic_id)}
      />

      {/* Zoom cloud recordings */}
      {appointment.zoom_meeting_id && (
        <div className="mt-6">
          <ZoomRecordingsPanel
            appointmentId={id}
            zoomMeetingId={appointment.zoom_meeting_id}
            clinicId={appointment.clinic_id}
            patientId={appointment.patient_id}
            recordings={recordings}
          />
        </div>
      )}

      {/* Pós-atendimento: cobrança da sessão + agendar retorno em um lugar só */}
      <div className="mt-6 bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-[15px]">
        <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[10px]">
          {t("wrapUpTitle")}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-[14px]">
          <div className="flex-1 min-w-[220px]">
            {isPaid ? (
              <span className="inline-block text-[11px] font-medium text-[#0F6E56] bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-[10px] py-[3px]">
                {t("alreadyPaid")}
              </span>
            ) : (
              <>
                <p className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97] mb-[6px]">{t("chargeHint")}</p>
                <div className="w-full sm:max-w-[420px] [&>div]:text-left">
                  <ChargeSessionButton appointmentId={id} />
                </div>
              </>
            )}
          </div>
          <Link
            href={`/schedule/new?patient_id=${appointment.patient_id}`}
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] dark:bg-white/[.10] hover:bg-[#1a2d4a] dark:hover:bg-white/[.16] rounded-[8px] px-[12px] py-[7px] transition shrink-0"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            {t("scheduleFollowUp")}
          </Link>
        </div>
      </div>
    </Shell>
  );
}
