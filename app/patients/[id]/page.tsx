import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { AiInsightReviewCard } from "@/components/ai-insight-review-card";
import { getPatientById } from "@/services/patient-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientIntakeResponses } from "@/services/intake-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";
import { getPatientAssessmentResponses } from "@/services/assessment-service";
import { getPatientExams, getPatientPrescriptions } from "@/services/exams-service";
import { getPatientPackages } from "@/services/package-service";
import { generateAiInsightAction } from "@/app/patients/[id]/insights/actions";
import { getTerm } from "@/modules/ui/terminology";
import { PatientExamsPanel } from "@/components/patient-exams-panel";
import { PatientPrescriptionsPanel } from "@/components/patient-prescriptions-panel";
import { PatientPackagePanel } from "@/components/patient-package-panel";
import { HealthAgentPanel } from "@/components/health-agent-panel";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  if (status === "active") return { label: "Active", classes: "bg-[#E1F5EE] text-[#085041]" };
  if (status === "archived") return { label: "Archived", classes: "bg-[#F4F3EF] text-[#A09E98]" };
  return { label: "Inactive", classes: "bg-[#FAEEDA] text-[#633806]" };
}

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const [appointments, responses, sessionRecords, aiInsights, assessmentResponses, exams, prescriptions, packages] = await Promise.all([
    getAppointmentsByPatient(id),
    getPatientIntakeResponses(id),
    getSessionRecordsByPatient(id),
    getAiInsightsByPatient(id, 4),
    getPatientAssessmentResponses(id),
    getPatientExams(id),
    getPatientPrescriptions(id),
    getPatientPackages(id),
  ]);

  const lastSession = appointments[0] ?? null;
  const latestInsight = aiInsights.find((i) => i.review_status === "final") ?? aiInsights[0] ?? null;
  const pendingReviews = aiInsights.filter((i) => i.review_status !== "final").length;
  const generateAction = generateAiInsightAction.bind(null, patient.id);
  const badge = statusBadge(patient.status);
  const since = new Date(patient.created_at).toLocaleDateString([], { month: "short", year: "numeric" });

  return (
    <Shell>
      {/* Back */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Patients
      </Link>

      {/* ── Patient header ── */}
      <div className="bg-white border-b border-black/[.07] rounded-t-[12px] px-[22px] py-5 flex items-center gap-4 mb-0">
        <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[15px] font-medium text-[#0F6E56] shrink-0">
          {initials(patient.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-medium tracking-[-0.025em] text-[#0F1A2E] truncate">{patient.full_name}</p>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            Patient since {since}
            {patient.date_of_birth ? ` · ${Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365))}y` : ""}
          </p>
          <div className="flex gap-[6px] mt-[6px]">
            <span className={`text-[10px] px-[9px] py-[2px] rounded-full ${badge.classes}`}>{badge.label}</span>
            <span className="text-[10px] px-[9px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">Integrative</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/patients/${patient.id}/edit`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title="Editar paciente"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </Link>
          <Link
            href={`/patients/${patient.id}/intake`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title="Intake"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </Link>
          <Link
            href={`/patients/${patient.id}/prontuario`}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title="Prontuário"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </Link>
          <Link
            href="/schedule/new"
            className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66] hover:bg-[#F4F3EF] transition"
            title="Schedule session"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
          </Link>
          {lastSession && (
            <Link
              href={`/teleconsulta/${lastSession.id}`}
              className="flex items-center gap-1.5 px-[10px] h-[30px] rounded-lg bg-[#0F6E56] text-white text-[11px] font-medium hover:bg-[#085041] transition"
              title="Iniciar teleconsulta"
            >
              <svg className="w-[12px] h-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
              Teleconsulta
            </Link>
          )}
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-white border border-t-0 border-black/[.07] rounded-b-[12px] overflow-hidden mb-5">

        {/* Col 1 — stats */}
        <div className="p-[20px] lg:border-r border-black/[.05]">
          {/* Sessions count */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[13px] mb-3">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">SESSIONS</p>
            <p className="text-[30px] font-medium tracking-[-0.04em] text-[#0F1A2E] leading-none">{appointments.length}</p>
            <p className="text-[11px] text-[#0F6E56] mt-[4px]">
              {lastSession ? `Last: ${formatDate(lastSession.starts_at)}` : "No sessions yet"}
            </p>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">INTAKE</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">
                {responses.length}<span className="text-[10px] text-[#A09E98] font-normal"> forms</span>
              </p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">INSIGHTS</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">{aiInsights.length}</p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">NOTES</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">{sessionRecords.length}</p>
            </div>
            <div className="bg-[#F4F3EF] rounded-lg p-[10px]">
              <p className="text-[9px] text-[#A09E98] mb-[3px]">REVIEWS</p>
              <p className="text-[14px] font-medium text-[#0F1A2E]">
                {pendingReviews}<span className="text-[10px] text-[#A09E98] font-normal"> pending</span>
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href={`/patients/${patient.id}/intake`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>Intake forms</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/forms/new`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>Preencher formulário</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/insights`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>AI {getTerm("insight", "lowerPlural")}</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/evolution`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>Evolução clínica</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href={`/patients/${patient.id}/portal-link`}
              className="flex items-center justify-between text-[12px] text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-lg px-3 py-2.5 transition"
            >
              <span>Patient portal</span>
              <svg className="w-3 h-3 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
        </div>

        {/* Col 2 — session timeline */}
        <div className="p-[20px] lg:border-r border-black/[.05]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-[#0F1A2E]">Session timeline</p>
            <Link href="/schedule" className="text-[11px] text-[#0F6E56] hover:underline">all</Link>
          </div>

          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-[12px] text-[#6B6A66]">No sessions yet.</p>
              <Link
                href="/schedule/new"
                className="mt-3 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-3 py-1.5 rounded-lg transition"
              >
                Book first session
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
                    <p className="text-[9px] text-[#A09E98]">{formatDate(appt.starts_at)}</p>
                    <div className="flex items-center gap-2">
                      <Link href={`/schedule/${appt.id}/session`} className="text-[11px] font-medium text-[#0F1A2E] group-hover:text-[#0F6E56] transition">
                        {getTerm("session")} {appointments.length - i}
                      </Link>
                      {i === 0 && (
                        <Link
                          href={`/teleconsulta/${appt.id}`}
                          className="text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] hover:bg-[#0F6E56] hover:text-white px-[6px] py-[2px] rounded-full transition"
                        >
                          Teleconsulta
                        </Link>
                      )}
                    </div>
                    <p className="text-[10px] text-[#A09E98]">
                      {appt.duration_minutes} min{appt.notes ? ` · ${appt.notes.slice(0, 30)}` : ""}
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
                <span className="text-[10px] font-medium text-[#0F6E56] tracking-[.06em] uppercase">Latest insight</span>
              </div>
              <span className={`text-[10px] px-2 py-[2px] rounded-full inline-block mb-[10px] ${latestInsight.review_status === "final" ? "bg-[#E1F5EE] text-[#085041]" : "bg-[#FAEEDA] text-[#633806]"}`}>
                {latestInsight.review_status === "final" ? "Final" : "In review"}
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
                <span className="text-[10px] text-[#0F6E56]">AI-generated insight · not medical advice</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#F4F3EF] rounded-[12px] p-[14px] h-full flex flex-col">
              <div className="flex items-center gap-[6px] mb-[10px]">
                <svg className="w-[14px] h-[14px] text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span className="text-[10px] font-medium text-[#A09E98] tracking-[.06em] uppercase">No insights yet</span>
              </div>
              <p className="text-[11px] text-[#6B6A66] leading-relaxed mb-4">
                Complete intake and at least one session to generate the first AI insight.
              </p>
              <form action={generateAction}>
                <button
                  type="submit"
                  className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-3 py-1.5 rounded-lg"
                >
                  Generate first insight
                </button>
              </form>
            </div>
          )}

          {/* Recent AI insights list */}
          {aiInsights.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-[#0F1A2E]">All insights</p>
                <Link href={`/patients/${patient.id}/insights`} className="text-[11px] text-[#0F6E56] hover:underline">
                  view all
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

      {/* Notes */}
      {patient.notes && (
        <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
          <p className="text-[11px] font-medium text-[#A09E98] uppercase tracking-[.06em] mb-2">Notes</p>
          <p className="text-[13px] text-[#6B6A66] leading-relaxed">{patient.notes}</p>
        </div>
      )}

      {/* Assessment responses */}
      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden mt-5">
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-black/[.06]">
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E]">Formulários aplicados</p>
            <p className="text-[11px] text-[#A09E98] mt-[1px]">
              {assessmentResponses.length} {assessmentResponses.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>
          <Link
            href={`/patients/${patient.id}/forms/new`}
            className="flex items-center gap-1 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[10px] py-[5px] rounded-[6px]"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Preencher
          </Link>
        </div>

        {assessmentResponses.length === 0 ? (
          <div className="px-[16px] py-[14px]">
            <p className="text-[12px] text-[#A09E98]">Nenhum formulário preenchido ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {assessmentResponses.slice(0, 5).map((resp) => {
              const pct = resp.score_percentage ?? 0;
              const filledDate = new Date(resp.filled_at).toLocaleDateString("pt-BR", {
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

      {/* Pacotes de sessão */}
      <div className="mt-[18px]">
        <PatientPackagePanel packages={packages} patientId={id} />
      </div>

      {/* Exames laboratoriais */}
      <div className="mt-[18px]">
        <PatientExamsPanel exams={exams} patientId={id} />
      </div>

      {/* Medicamentos e suplementos */}
      <div className="mt-[18px]">
        <PatientPrescriptionsPanel prescriptions={prescriptions} patientId={id} />
      </div>

      {/* Agente de saúde */}
      <div className="mt-[18px]">
        <HealthAgentPanel patientId={id} />
      </div>
    </Shell>
  );
}
