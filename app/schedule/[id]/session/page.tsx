import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video } from "lucide-react";
import { Shell } from "@/components/shell";
import { SessionRecordingPanel } from "@/components/session-recording-panel";
import { ZoomRecordingsPanel } from "@/components/zoom-recordings-panel";
import { ZoomSessionBanner } from "@/components/zoom-session-banner";
import { getAppointmentById } from "@/services/appointment-service";
import { getSessionRecordByAppointment } from "@/services/session-recording-service";
import { getZoomRecordingsByAppointment } from "@/services/zoom-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function SessionRecordingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const [record, recordings] = await Promise.all([
    getSessionRecordByAppointment(id),
    getZoomRecordingsByAppointment(id),
  ]);

  const patientName =
    (Array.isArray(appointment.patients)
      ? appointment.patients[0]
      : appointment.patients)?.full_name ?? "Paciente";

  // Determine teleconsulta action
  const hasZoom = !!appointment.zoom_join_url;
  const teleconsultaHref = hasZoom
    ? appointment.zoom_start_url ?? appointment.zoom_join_url!
    : `/schedule/${id}/telehealth`;
  const teleconsultaLabel = hasZoom ? "Entrar no Zoom" : "Iniciar teleconsulta";

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center gap-[10px] mb-[20px] flex-wrap">
        <Link
          href="/schedule"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Registro de sessão</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {patientName} · Notas e observações da consulta
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
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] rounded-[8px] px-[12px] py-[7px] transition"
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

      <SessionRecordingPanel
        appointment={appointment}
        record={record}
        saved={saved === "1"}
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
    </Shell>
  );
}
