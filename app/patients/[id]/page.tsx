import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { AiInsightReviewCard } from "@/components/ai-insight-review-card";
import { getPatientById, getPatientReferralInfo } from "@/services/patient-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";
import { getPatientAssessmentResponses } from "@/services/assessment-service";
import { getPatientExams, getPatientPrescriptions } from "@/services/exams-service";
import { getPatientFunctionalExams } from "@/services/functional-exams-service";
import { getPatientPackages } from "@/services/package-service";
import { getPatientTreatmentPlans } from "@/services/treatment-plan-service";
import { generateAiInsightAction } from "@/app/patients/[id]/insights/actions";
import { PatientExamsPanel } from "@/components/patient-exams-panel";
import { PatientFunctionalExamsPanel } from "@/components/patient-functional-exams-panel";
import { PatientPrescriptionsPanel } from "@/components/patient-prescriptions-panel";
import { PatientSupplementsPanel } from "@/components/patient-supplements-panel";
import { getSupplementCatalog, getPatientSupplementRecommendations } from "@/services/supplement-service";
import { PatientTreatmentPlanPanel } from "@/components/patient-treatment-plan-panel";
import { PatientPackagePanel } from "@/components/patient-package-panel";
import { PatientChargePanel } from "@/components/patient-charge-panel";
import { getMonetizationOffers } from "@/services/monetization-service";
import { isAsaasConfigured } from "@/lib/asaas";
import { getPatientAssessmentProgress } from "@/services/assessment-progress-service";
import { PatientAssessmentProgressPanel } from "@/components/patient-assessment-progress-panel";
import { PatientDocumentsPanel } from "@/components/patient-documents-panel";
import { getPatientDocuments } from "@/services/patient-document-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import { getPatientFinancials, getClinicCurrency } from "@/services/finance-service";
import { PatientFinancialsPanel } from "@/components/patient-financials-panel";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { QuickVoiceNote } from "@/components/quick-voice-note";
import { SessionPackageBadge } from "@/components/session-package-badge";
import { PatientIntelligenceStrip } from "@/components/patient-intelligence-strip";
import { PatientCaseSummaryCard } from "@/components/patient-case-summary-card";
import { PatientTimeline } from "@/components/patient-timeline";
import { computePatientEngagement, buildPatientTimeline } from "@/services/patient-intelligence-service";
import { derivePatientJourneyStage } from "@/modules/patient-journey/stage";
import { WaitlistButton } from "@/components/waitlist-button";
import { getWaitlist } from "@/services/waitlist-service";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function statusClasses(status: string) {
  if (status === "active") return "bg-[#E1F5EE] text-[#085041]";
  if (status === "archived") return "bg-[#F4F3EF] text-[#A09E98]";
  return "bg-[#FAEEDA] text-[#633806]";
}

function statusKey(status: string): "active" | "inactive" | "archived" {
  if (status === "active") return "active";
  if (status === "archived") return "archived";
  return "inactive";
}

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Resolve clinic first so we can scope the patient read to the caller's clinic
  const clinic = await getCurrentClinic();
  const patient = await getPatientById(id, clinic?.id ?? undefined);
  if (!patient) notFound();

  const t = await getTranslations("patientProfile");
  const tStatus = await getTranslations("patients.list.status");
  const tc = await getTranslations("common.terms");
  const locale = await getLocale();

  const [appointments, responses, sessionRecords, aiInsights, assessmentResponses, exams, functionalExams, prescriptions, packages, documents, treatmentPlans, offers, activeSubscriptionResult] = await Promise.all([
    getAppointmentsByPatient(id),
    getPatientIntakeResponses(id),
    getSessionRecordsByPatient(id),
    getAiInsightsByPatient(id, 4),
    getPatientAssessmentResponses(id),
    getPatientExams(id),
    getPatientFunctionalExams(id),
    getPatientPrescriptions(id),
    getPatientPackages(id),
    getPatientDocuments(id),
    getPatientTreatmentPlans(id),
    getMonetizationOffers(clinic?.id),
    createSupabaseAdminClient()
      .from("patient_subscriptions")
      .select("id, plan_name, status, amount_cents, currency, billing_interval, current_period_end, cancel_at_period_end")
      .eq("patient_id", id)
      .eq("clinic_id", clinic?.id ?? "00000000-0000-0000-0000-000000000000") // SEC-01: scope to caller's clinic
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeSub = activeSubscriptionResult.data;
  const assessmentProgress = await getPatientAssessmentProgress(id);

  // Suplementos (catálogo ativo da clínica + recomendações do paciente)
  const [supplementCatalog, supplementRecommendations] = await Promise.all([
    clinic?.id ? getSupplementCatalog(clinic.id, { activeOnly: true }) : Promise.resolve([]),
    getPatientSupplementRecommendations(id),
  ]);

  // Indicação paciente→paciente (quem indicou + quantos este trouxe)
  const referralInfo = clinic?.id
    ? await getPatientReferralInfo(id, clinic.id, patient.referred_by_patient_id)
    : { referredByName: null, referred: [] as { id: string; full_name: string }[] };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const intakeUrl = clinic?.slug ? `${appUrl}/envio/${clinic.slug}` : undefined;

  const lastSession = appointments[0] ?? null;
  // Fix #7: next upcoming session (soonest future) for teleconsulta link
  const nowIso = new Date().toISOString();
  const futureAppts = appointments.filter(
    (a) => a.starts_at >= nowIso && a.status !== "cancelled" && a.status !== "no_show",
  );
  // appointments is sorted DESC, so last element is the soonest upcoming
  const nextSession = futureAppts[futureAppts.length - 1] ?? null;
  const latestInsight = aiInsights.find((i) => i.review_status === "final") ?? aiInsights[0] ?? null;
  const pendingReviews = aiInsights.filter((i) => i.review_status !== "final").length;
  const generateAction = generateAiInsightAction.bind(null, patient.id);
  const since = new Date(patient.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" });

  // Pacote ativo — usado para exibir o badge no card de sessões
  const activePackage = packages.find((p) => p.is_active) ?? null;

  // ── Waitlist status for this patient ────────────────────────────────────────
  const waitlistEntries = clinic?.id ? await getWaitlist(clinic.id).catch(() => []) : [];
  const waitlistEntry = waitlistEntries.find((e) => e.patient_id === id && e.status === "waiting") ?? null;

  // ── Intelligence — computed from already-loaded data (zero extra queries) ──
  const engagement = computePatientEngagement(appointments, patient);
  // Etapa da jornada — derivada dos mesmos dados já carregados (zero query extra)
  const journeyStage = derivePatientJourneyStage({
    patientStatus: patient.status,
    appointments,
    treatmentPlans,
    churnRisk: engagement.churnRisk,
    hasActivePackageOrSub: !!activePackage || !!activeSub,
  });

  // ── Financeiro do paciente — só para gestores (dado financeiro restrito) ──
  const profile = await getCurrentUserProfile();
  const canSeeFinance = !!profile && isManager(profile.role);
  const patientFinancials =
    canSeeFinance && clinic?.id ? await getPatientFinancials(id, clinic.id) : null;
  const clinicCurrency =
    canSeeFinance && clinic?.id ? await getClinicCurrency(clinic.id) : "BRL";
  const timelineEvents = buildPatientTimeline(patient.id, {
    appointments,
    sessionRecords,
    aiInsights,
    assessmentResponses,
    exams,
    prescriptions,
  });

  return (
    <Shell>
      {/* Back */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {t("back")}
      </Link>

      {/* ── Patient header ── */}
      <div className="bg-white border-b border-black/[.07] rounded-t-[12px] px-[22px] py-5 flex items-center gap-4 mb-0">
        <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[15px] font-medium text-[#0F6E56] shrink-0">
          {initials(patient.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-medium tracking-[-0.025em] text-[#0F1A2E] truncate">{patient.full_name}</p>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {t("patientSince", { since })}
            {patient.date_of_birth ? (() => {
              const dob = new Date(patient.date_of_birth);
              const today = new Date();
              let age = today.getFullYear() - dob.getFullYear();
              if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
              return t("age", { age });
            })() : ""}
          </p>
          <div className="flex gap-[6px] mt-[6px]">
            <span className={`text-[10px] px-[9px] py-[2px] rounded-full ${statusClasses(patient.status)}`}>{tStatus(statusKey(patient.status))}</span>
            <span className="text-[10px] px-[9px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t("profileTag")}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center flex-wrap justify-end">
          {/* Fila de espera */}
          <WaitlistButton
            patientId={patient.id}
            patientName={patient.full_name}
            isOnWaitlist={!!waitlistEntry}
            waitlistEntryId={waitlistEntry?.id ?? null}
          />
          {/* Exportar PDF */}
          <a
            href={`/api/reports/paciente/${patient.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title={t("actions.exportPdf")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
          <Link
            href={`/patients/${patient.id}/edit`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title={t("actions.edit")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </Link>
          <Link
            href={`/patients/${patient.id}/intake`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title={t("actions.intake")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </Link>
          <Link
            href={`/patients/${patient.id}/prontuario`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title={t("actions.chart")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </Link>
          <Link
            href={`/schedule/new?patient_id=${patient.id}`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title={t("actions.schedule")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
          </Link>
          {nextSession && (
            <Link
              href={`/teleconsulta/${nextSession.id}`}
              className="flex items-center gap-1.5 px-[10px] h-[30px] rounded-lg bg-[#0F6E56] text-white text-[11px] font-medium hover:bg-[#085041] transition"
              title={t("actions.startTelehealth")}
            >
              <svg className="w-[12px] h-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
              {t("actions.telehealth")}
            </Link>
          )}
        </div>
      </div>

      {/* ── Intelligence strip ── */}
      <PatientIntelligenceStrip engagement={engagement} journey={journeyStage} />

      {/* ── Resumo do caso + queixa principal (Feature 2) ── */}
      <PatientCaseSummaryCard
        patientId={patient.id}
        chiefComplaint={patient.chief_complaint}
        caseSummary={patient.case_summary}
      />

      {/* ── Indicação paciente→paciente ── */}
      {(referralInfo.referredByName || referralInfo.referred.length > 0) && (
        <div className="bg-white border border-t-0 border-black/[.07] px-[22px] py-[12px] flex flex-wrap items-center gap-x-[18px] gap-y-[4px] text-[12px]">
          {referralInfo.referredByName && (
            <span className="text-[#6B6A66]">
              {t("referral.referredBy", { name: referralInfo.referredByName })}
            </span>
          )}
          {referralInfo.referred.length > 0 && (
            <span className="text-[#0F6E56] font-medium">
              {t("referral.brought", { count: referralInfo.referred.length })}
              <span className="text-[#A09E98] font-normal"> — {referralInfo.referred.map((r) => r.full_name).join(", ")}</span>
            </span>
          )}
        </div>
      )}

      {/* ── 3-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-white border border-t-0 border-black/[.07] rounded-b-[12px] overflow-hidden mb-5">

        {/* Col 1 — stats */}
        <div className="p-[20px] lg:border-r border-black/[.05]">
          {/* Sessions count */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[13px] mb-3">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{t("stats.sessions")}</p>
            <p className="text-[30px] font-medium tracking-[-0.04em] text-[#0F1A2E] leading-none">{appointments.length}</p>
            <p className="text-[11px] text-[#0F6E56] mt-[4px]">
              {lastSession ? t("stats.lastSession", { date: formatDate(lastSession.starts_at, locale) }) : t("stats.noSessions")}
            </p>
            {(activePackage || activeSub) && (
              <div className="mt-[8px] pt-[8px] border-t border-black/[.06] space-y-2">
                {activePackage && (
                  <SessionPackageBadge packages={packages} />
                )}
                {activeSub && (
                  <div className="flex items-center gap-[5px] flex-wrap">
                    <span className={[
                      "text-[10px] font-medium px-[7px] py-[2px] rounded-full",
                      activeSub.status === "past_due"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600",
                    ].join(" ")}>
                      {activeSub.status === "past_due" ? "⚠️ " : "↻ "}
                      {activeSub.plan_name as string}
                      {" · "}
                      {(activeSub.billing_interval as string) === "yearly" ? t("stats.yearly") : t("stats.monthly")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">{t("stats.intake")}</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">
                {responses.length}<span className="text-[10px] text-[#A09E98] font-normal"> {t("stats.forms")}</span>
              </p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">{t("stats.aiInsights")}</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">{aiInsights.length}</p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">{t("stats.evolutions")}</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">{sessionRecords.length}</p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">{t("stats.reviews")}</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">
                {pendingReviews}<span className="text-[10px] text-[#A09E98] font-normal"> {t("stats.pending")}</span>
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href={`/patients/${patient.id}/forms/new`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>{t("quickActions.fillForm")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/insights`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>AI {tc("insightsLower")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/evolution`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>{t("quickActions.evolution")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/portal-link`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>{t("quickActions.portal")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/messages`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>{t("quickActions.portalMessages")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
        </div>

        {/* Col 2 — session timeline */}
        <div className="p-[20px] lg:border-r border-black/[.05]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-[#0F1A2E]">{t("history.title")}</p>
            <Link href="/schedule" className="text-[11px] text-[#0F6E56] hover:underline">{t("history.viewAll")}</Link>
          </div>

          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-[12px] text-[#6B6A66]">{t("history.empty")}</p>
              <Link
                href={`/schedule/new?patient_id=${patient.id}`}
                className="mt-3 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-3 py-1.5 rounded-lg transition"
              >
                {t("history.scheduleFirst")}
              </Link>
            </div>
          ) : (
            <div>
              {appointments.slice(0, 6).map((appt, i) => (
                <div key={appt.id} className="flex gap-[10px] mb-3 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-[3px] ${i === 0 ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`} />
                    {i < appointments.slice(0, 6).length - 1 && (
                      <div className="w-px flex-1 bg-black/[.08] mt-[2px]" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0 flex-1">
                    <p className="text-[9px] text-[#A09E98]">{formatDate(appt.starts_at, locale)}</p>
                    <div className="flex items-center gap-2">
                      <Link href={`/schedule/${appt.id}/session`} className="text-[11px] font-medium text-[#0F1A2E] group-hover:text-[#0F6E56] transition">
                        {tc("session")} {appointments.length - i}
                      </Link>
                      {i === 0 && (
                        <Link
                          href={`/teleconsulta/${appt.id}`}
                          className="text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] hover:bg-[#0F6E56] hover:text-white px-[6px] py-[2px] rounded-full transition"
                        >
                          {t("actions.telehealth")}
                        </Link>
                      )}
                    </div>
                    <p className="text-[10px] text-[#A09E98]">
                      {t("history.minutes", { count: appt.duration_minutes })}{appt.notes ? ` · ${appt.notes.slice(0, 30)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 3 — latest insight */}
        <div className="p-[20px]">
          {latestInsight ? (
            <div className="bg-[#F0FAF6] border border-[#9FE1CB] rounded-[12px] p-[14px]">
              <div className="flex items-center gap-[6px] mb-[10px]">
                <svg className="w-[14px] h-[14px] text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span className="text-[10px] font-medium text-[#0F6E56] tracking-[.06em] uppercase">{t("insight.latest")}</span>
              </div>
              <span className={`text-[10px] px-2 py-[2px] rounded-full inline-block mb-[10px] ${latestInsight.review_status === "final" ? "bg-[#E1F5EE] text-[#085041]" : "bg-[#FAEEDA] text-[#633806]"}`}>
                {latestInsight.review_status === "final" ? t("insight.final") : t("insight.inReview")}
              </span>
              {latestInsight.output?.structured_summary?.overview && (
                <div className="flex gap-[7px] items-start mb-[7px]">
                  <span className="w-1 h-1 rounded-full bg-[#0F6E56] mt-[5px] shrink-0" />
                  <p className="text-[11px] text-[#085041] leading-relaxed line-clamp-3">
                    {latestInsight.output.structured_summary.overview}
                  </p>
                </div>
              )}
              {latestInsight.output?.structured_summary?.current_status && (
                <div className="flex gap-[7px] items-start mb-[7px]">
                  <span className="w-1 h-1 rounded-full bg-[#0F6E56] mt-[5px] shrink-0" />
                  <p className="text-[11px] text-[#085041] leading-relaxed line-clamp-2">
                    {latestInsight.output.structured_summary.current_status}
                  </p>
                </div>
              )}
              <div className="mt-3 pt-[10px] border-t border-[#9FE1CB] flex items-center gap-[5px]">
                <svg className="w-[13px] h-[13px] text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="text-[10px] text-[#0F6E56]">{t("insight.aiDisclaimer")}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#F4F3EF] rounded-[12px] p-[14px] h-full flex flex-col">
              <div className="flex items-center gap-[6px] mb-[10px]">
                <svg className="w-[14px] h-[14px] text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span className="text-[10px] font-medium text-[#A09E98] tracking-[.06em] uppercase">{t("insight.none")}</span>
              </div>
              <p className="text-[11px] text-[#6B6A66] leading-relaxed mb-4">
                {t("insight.noneHelp")}
              </p>
              <form action={generateAction}>
                <button
                  type="submit"
                  className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-3 py-1.5 rounded-lg"
                >
                  {t("insight.generateFirst")}
                </button>
              </form>
            </div>
          )}

          {/* Recent AI insights list */}
          {aiInsights.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-[#0F1A2E]">{t("insight.all")}</p>
                <Link href={`/patients/${patient.id}/insights`} className="text-[11px] text-[#0F6E56] hover:underline">
                  {t("insight.viewAll")}
                </Link>
              </div>
              <div className="space-y-2">
                {aiInsights.slice(0, 3).map((insight) => (
                  <AiInsightReviewCard key={insight.id} patientId={patient.id} insight={insight} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next Step strip — ação prioritária baseada no estado atual */}
      {(pendingReviews > 0 || latestInsight?.output?.structured_summary?.current_status) && (
        <div className={[
          "mt-3 rounded-[10px] border px-[15px] py-[11px] flex items-center gap-[10px]",
          pendingReviews > 0
            ? "bg-[#FAEEDA] border-[#F5C47F]"
            : "bg-[#E1F5EE] border-[#9FE1CB]",
        ].join(" ")}>
          <div className="flex-1 min-w-0">
            <p className={["text-[11px] font-medium", pendingReviews > 0 ? "text-[#633806]" : "text-[#085041]"].join(" ")}>
              {pendingReviews > 0
                ? t("nextStep.pending", { count: pendingReviews })
                : t("nextStep.title")
              }
            </p>
            {pendingReviews === 0 && latestInsight?.output?.structured_summary?.current_status && (
              <p className="text-[11px] text-[#0F6E56] mt-[2px] line-clamp-1">
                {latestInsight.output.structured_summary.current_status}
              </p>
            )}
          </div>
          <Link
            href={`/patients/${patient.id}/insights`}
            className={[
              "shrink-0 text-[11px] font-medium px-[10px] py-[4px] rounded-[6px] transition",
              pendingReviews > 0
                ? "bg-[#F5A623] text-white hover:bg-[#e09510]"
                : "bg-[#0F6E56] text-white hover:bg-[#085041]",
            ].join(" ")}
          >
            {pendingReviews > 0 ? t("nextStep.review") : t("nextStep.viewInsight")}
          </Link>
        </div>
      )}

      {/* ── Patient timeline — unified event stream ── */}
      <div className="mt-5">
        <PatientTimeline events={timelineEvents} limit={15} />
      </div>

      {/* Notes — quick voice note widget */}
      <QuickVoiceNote patientId={patient.id} existingNotes={patient.notes ?? ""} />

      {/* Assessment responses */}
      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden mt-5">
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-black/[.06]">
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E]">{t("assessments.title")}</p>
            <p className="text-[11px] text-[#A09E98] mt-[1px]">
              {t("assessments.count", { count: assessmentResponses.length })}
            </p>
          </div>
          <Link
            href={`/patients/${patient.id}/forms/new`}
            className="flex items-center gap-1 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[10px] py-[5px] rounded-[6px]"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t("assessments.fill")}
          </Link>
        </div>

        {assessmentResponses.length === 0 ? (
          <div className="px-[16px] py-[14px]">
            <p className="text-[12px] text-[#A09E98]">{t("assessments.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {assessmentResponses.slice(0, 5).map((resp) => {
              const pct = resp.score_percentage ?? 0;
              const filledDate = new Date(resp.filled_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={resp.id}
                  href={`/patients/${patient.id}/forms/${resp.id}`}
                  className="flex items-center gap-[12px] px-[16px] py-[11px] hover:bg-[#FAFAF8] transition group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#0F1A2E] truncate">
                      {resp.assessment_templates?.name ?? "—"}
                    </p>
                    <p className="text-[11px] text-[#A09E98] mt-[1px]">{filledDate}</p>
                  </div>
                  <div className="flex items-center gap-[8px] shrink-0">
                    <div className="w-[80px] h-[4px] bg-[#F4F3EF] rounded-full overflow-hidden">
                      <div
                        className={[
                          "h-full rounded-full",
                          pct >= 70 ? "bg-[#FF6B4A]" : pct >= 40 ? "bg-[#F5A623]" : "bg-[#0F6E56]",
                        ].join(" ")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F1A2E] w-[36px] text-right">
                      {Math.round(pct)}%
                    </span>
                    <svg className="w-3 h-3 text-[#D3D1C7] group-hover:text-[#A09E98] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Evolução dos questionários */}
      {assessmentProgress.length > 0 && (
        <div className="mt-[18px]">
          <PatientAssessmentProgressPanel patientId={id} progress={assessmentProgress} />
        </div>
      )}

      {/* Plano de tratamento */}
      <div className="mt-[18px]">
        <PatientTreatmentPlanPanel plans={treatmentPlans} patientId={id} />
      </div>

      {/* Pacotes de sessão */}
      <div className="mt-[18px]">
        <PatientPackagePanel packages={packages} patientId={id} />
      </div>

      {/* Cobrança (pacote / mensalidade) */}
      <div className="mt-[18px]">
        <PatientChargePanel
          patientId={id}
          asaasEnabled={isAsaasConfigured()}
          offers={offers
            .filter((o) => o.is_active && o.price_cents > 0)
            .map((o) => ({
              id: o.id,
              name: o.name,
              price_cents: o.price_cents,
              currency: o.currency,
              offer_type: o.offer_type,
              number_of_sessions: o.number_of_sessions,
            }))}
        />
      </div>

      {/* Financeiro do paciente — restrito a gestores */}
      {canSeeFinance && patientFinancials && (
        <div className="mt-[18px]">
          <PatientFinancialsPanel
            financials={patientFinancials}
            currency={clinicCurrency}
            locale={locale}
          />
        </div>
      )}

      {/* Exames laboratoriais */}
      <div className="mt-[18px]">
        <PatientExamsPanel exams={exams} patientId={id} />

        <PatientFunctionalExamsPanel exams={functionalExams} patientId={id} />
      </div>

      {/* Medicamentos e suplementos */}
      <div className="mt-[18px]">
        <PatientPrescriptionsPanel prescriptions={prescriptions} patientId={id} />
      </div>

      {/* Recomendação de suplementos (catálogo + builder manual + saídas) */}
      <div className="mt-[18px]">
        <PatientSupplementsPanel
          recommendations={supplementRecommendations}
          catalog={supplementCatalog}
          patientId={id}
          clinicName={clinic?.name ?? ""}
        />
      </div>

      {/* Documentos do paciente */}
      <div className="mt-[18px]">
        <PatientDocumentsPanel documents={documents} patientId={id} intakeUrl={intakeUrl} />
      </div>
    </Shell>
  );
}
