import Link from "next/link";
import { notFound } from "next/navigation";
import { TeleconsultaVideo } from "@/components/teleconsulta-video";
import { TeleconsultaNotes } from "@/components/teleconsulta-notes";
import { getAppointmentById } from "@/services/appointment-service";
import { getPatientById } from "@/services/patient-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getSessionRecordByAppointment } from "@/services/session-recording-service";
import { upsertSessionRecord } from "@/services/session-recording-service";
import { getLatestAiInsight } from "@/services/ai-insight-service";
import { getCurrentUserProfile } from "@/services/user-service";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}
function age(dob?: string | null) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365));
}

export default async function TeleconsultaPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const profile = await getCurrentUserProfile();

  const [appointment, sessionRecord] = await Promise.all([
    getAppointmentById(appointmentId),
    getSessionRecordByAppointment(appointmentId),
  ]);

  if (!appointment) notFound();

  const patient = await getPatientById(appointment.patient_id);
  if (!patient) notFound();

  const [previousAppointments, latestInsight] = await Promise.all([
    getAppointmentsByPatient(patient.id),
    getLatestAiInsight(patient.id),
  ]);

  const pastSessions = previousAppointments.filter((a) => a.id !== appointmentId);

  // Room name: axiel + patient first name (slugified) + date — no hyphens so Jitsi
  // doesn't split into separate words ("Axiel Maria 20260521")
  function slugName(str: string) {
    return str.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
      .replace(/[^a-z0-9]/g, "")                          // only alphanumeric
      .slice(0, 12);
  }
  const dateCompact = new Date(appointment.starts_at).toISOString().slice(0, 10).replace(/-/g, "");
  const patientSlug = slugName(patient.full_name.split(" ")[0]);
  const roomName = `axiel${patientSlug}${dateCompact}`;

  // Practitioner display name for Jitsi pre-fill
  const practitionerName = profile?.full_name ?? "Praticante";

  async function saveNotesAction(apptId: string, notes: string, observations: string[]) {
    "use server";
    const currentProfile = await getCurrentUserProfile();
    if (!currentProfile?.clinic_id) return;
    await upsertSessionRecord({
      clinic_id: currentProfile.clinic_id,
      appointment_id: apptId,
      patient_id: appointment!.patient_id,
      notes,
      key_observations: observations,
    });
  }

  const patientAge = age(patient.date_of_birth);
  const initials = patient.full_name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-[#0E1117] overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[.07] shrink-0 bg-[#0B0F17]">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <span className="text-[15px] font-medium tracking-[-0.03em] text-white/80 select-none mr-2">
            AXI<span className="text-[#0F6E56]">EL</span>
          </span>

          {/* Divider */}
          <div className="w-px h-4 bg-white/[.10]" />

          {/* Patient */}
          <div className="w-7 h-7 rounded-full bg-[#0F6E56]/20 flex items-center justify-center text-[10px] font-medium text-[#0F6E56] shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-[13px] font-medium text-white leading-tight">
              {patient.full_name}
              {patientAge && <span className="text-white/40 font-normal ml-1">· {patientAge}a</span>}
            </p>
            <p className="text-[11px] text-white/40">
              {formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}
              {appointment.duration_minutes ? ` · ${appointment.duration_minutes} min` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Session number badge */}
          <span className="text-[11px] text-white/40 bg-white/[.05] border border-white/[.08] px-3 py-1.5 rounded-lg">
            Sessão #{previousAppointments.length}
          </span>

          {/* Patient profile link */}
          <Link
            href={`/patients/${patient.id}`}
            target="_blank"
            className="text-[11px] text-white/50 hover:text-white/80 border border-white/[.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 1H1.5a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V8M7 1h4m0 0v4m0-4L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Prontuário completo
          </Link>

          {/* Exit */}
          <Link
            href={`/patients/${patient.id}`}
            className="text-[11px] font-medium text-white/60 hover:text-white border border-white/[.10] hover:border-white/25 px-3 py-1.5 rounded-lg transition"
          >
            Sair da consulta
          </Link>
        </div>
      </header>

      {/* ── Main split ── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Video ── */}
        <div className="flex-1 min-w-0 p-4">
          <TeleconsultaVideo
            roomName={roomName}
            patientName={patient.full_name.split(" ")[0]}
            displayName={practitionerName}
          />
        </div>

        {/* ── RIGHT: Prontuário ── */}
        <aside className="w-[360px] shrink-0 border-l border-white/[.07] bg-[#0B0F17] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Notes (live) */}
            <TeleconsultaNotes
              appointmentId={appointmentId}
              patientId={patient.id}
              clinicId={profile?.clinic_id ?? ""}
              initialNotes={sessionRecord?.notes ?? ""}
              initialObservations={sessionRecord?.key_observations ?? []}
              saveAction={saveNotesAction}
            />

            {/* Divider */}
            <div className="border-t border-white/[.07]" />

            {/* Latest AI Insight */}
            {latestInsight?.output?.structured_summary && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
                  Último insight AI
                </p>
                <div className="bg-[#0F6E56]/[.10] border border-[#0F6E56]/25 rounded-[10px] p-[12px]">
                  {latestInsight.output.structured_summary.overview && (
                    <p className="text-[12px] text-[#9FE1CB] leading-relaxed line-clamp-4">
                      {latestInsight.output.structured_summary.overview}
                    </p>
                  )}
                  {latestInsight.output.structured_summary.current_status && (
                    <p className="text-[11px] text-[#9FE1CB]/70 leading-relaxed mt-2 line-clamp-2">
                      {latestInsight.output.structured_summary.current_status}
                    </p>
                  )}
                  <p className="text-[9px] text-[#0F6E56]/60 mt-2">
                    {latestInsight.review_status === "final" ? "Revisado" : "Rascunho"} · {formatDate(latestInsight.created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Previous sessions */}
            {pastSessions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
                  Sessões anteriores ({pastSessions.length})
                </p>
                <div className="space-y-[6px]">
                  {pastSessions.slice(0, 5).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 py-[8px] px-[10px] bg-white/[.03] rounded-[8px] border border-white/[.06]">
                      <div className="w-[22px] h-[22px] rounded-full bg-white/[.07] flex items-center justify-center text-[9px] font-medium text-white/40 shrink-0">
                        {pastSessions.length - i}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-white/70">{formatDate(s.starts_at)}</p>
                        {s.notes && (
                          <p className="text-[10px] text-white/35 truncate mt-[1px]">{s.notes}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-white/30 shrink-0">{formatTime(s.starts_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patient contact */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
                Contato
              </p>
              <div className="bg-white/[.03] border border-white/[.06] rounded-[10px] p-[12px] space-y-[6px]">
                {patient.phone && (
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M10.5 8.5c0 .2-.05.39-.15.58-.1.18-.24.35-.41.5-.28.26-.59.38-.92.38-.24 0-.49-.06-.77-.18a7.6 7.6 0 01-.77-.46 13 13 0 01-.74-.65 12.8 12.8 0 01-.65-.74 7.4 7.4 0 01-.45-.76A2.14 2.14 0 015.5 6.5c0-.23.06-.46.17-.67.11-.22.28-.42.5-.59L6.7 4.7c.17-.17.37-.26.56-.26.22 0 .43.1.59.3l1.02 1.35c.16.2.24.42.24.62 0 .26-.08.5-.24.72l-.31.46c0 .06-.01.11-.01.16 0 .1.03.2.08.32.15.33.36.63.62.92.26.28.55.52.89.7.12.06.23.09.34.09.05 0 .1 0 .15-.01l.47-.31c.22-.17.46-.25.7-.25.2 0 .42.08.62.25l1.36 1.02c.2.17.3.37.3.6z" stroke="#9E9C97" strokeWidth="1"/>
                    </svg>
                    <a href={`tel:${patient.phone}`} className="text-[12px] text-white/60 hover:text-white/90 transition">{patient.phone}</a>
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="2.5" width="10" height="7" rx="1" stroke="#9E9C97" strokeWidth="1"/>
                      <path d="M1 4l5 3 5-3" stroke="#9E9C97" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[12px] text-white/60">{patient.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
                Acesso rápido
              </p>
              <div className="grid grid-cols-2 gap-[6px]">
                {[
                  { href: `/patients/${patient.id}/intake`, label: "Intake" },
                  { href: `/patients/${patient.id}/insights`, label: "AI Insights" },
                  { href: `/patients/${patient.id}/evolution`, label: "Evolução" },
                  { href: `/patients/${patient.id}/forms/new`, label: "Formulário" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    className="text-[11px] text-white/50 hover:text-white/80 border border-white/[.07] hover:border-white/20 rounded-[8px] px-[10px] py-[7px] text-center transition"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}
