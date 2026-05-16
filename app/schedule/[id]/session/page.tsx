import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video } from "lucide-react";
import { Shell } from "@/components/shell";
import { SessionRecordingPanel } from "@/components/session-recording-panel";
import { getAppointmentById } from "@/services/appointment-service";
import { getSessionRecordByAppointment } from "@/services/session-recording-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function SessionRecordingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const record = await getSessionRecordByAppointment(id);

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center gap-[10px] mb-[24px] flex-wrap">
        <Link
          href="/schedule"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Registro de sessão</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">Notas e observações da consulta</p>
        </div>
        <Link
          href={`/schedule/${id}/telehealth`}
          className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] rounded-[8px] px-[12px] py-[7px] transition"
        >
          <Video className="h-3.5 w-3.5" />
          Iniciar teleconsulta
        </Link>
      </div>

      <SessionRecordingPanel
        appointment={appointment}
        record={record}
        saved={saved === "1"}
      />
    </Shell>
  );
}
