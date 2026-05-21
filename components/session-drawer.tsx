"use client";

import Link from "next/link";
import { X, User, FileText, CalendarDays, Video } from "lucide-react";
import type { ScheduleSession } from "@/components/session-card";
import { formatTime } from "@/modules/schedule/date-utils";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function SessionDrawer({
  session,
  onClose,
}: {
  session: ScheduleSession | null;
  onClose: () => void;
}) {
  if (!session) return null;

  const patientName = session.patients?.full_name ?? "Paciente";
  const sessionCount = session.previousSessions.length + 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1A2E]/20 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <aside className="relative w-full max-w-[380px] h-full bg-white border-l border-black/[.07] shadow-xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[16px] border-b border-black/[.07]">
          <div className="flex items-start justify-between gap-3 mb-[14px]">
            <p className="text-[10px] font-medium tracking-[.10em] uppercase text-[#A09E98]">Sessão de hoje</p>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Patient */}
          <div className="flex items-center gap-[12px]">
            <div className="w-11 h-11 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[14px] font-medium text-[#0F6E56] shrink-0">
              {initials(patientName)}
            </div>
            <div>
              <p className="text-[16px] font-semibold text-[#0F1A2E] tracking-[-0.02em]">{patientName}</p>
              <p className="text-[12px] text-[#A09E98] mt-[1px]">
                Sessão {sessionCount} · {formatTime(session.starts_at)} · {session.duration_minutes} min
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-[20px] py-[16px] space-y-[12px]">
          {/* Notes preview */}
          {session.notes && (
            <div className="bg-[#FAFAF8] border border-black/[.06] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[4px]">Nota da sessão</p>
              <p className="text-[12px] text-[#0F1A2E] leading-relaxed line-clamp-3">{session.notes}</p>
            </div>
          )}

          {/* Previous sessions */}
          {session.previousSessions.length > 0 && (
            <div className="bg-white border border-black/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[8px]">Sessões anteriores</p>
              <div className="space-y-[6px]">
                {session.previousSessions.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[11px] text-[#6B6A66]">
                      {new Date(item.starts_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[11px] text-[#A09E98]">{item.duration_minutes} min</span>
                  </div>
                ))}
                {session.previousSessions.length > 4 && (
                  <p className="text-[10px] text-[#D3D1C7]">+{session.previousSessions.length - 4} anteriores</p>
                )}
              </div>
            </div>
          )}

          {session.previousSessions.length === 0 && (
            <div className="bg-white border border-black/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[11px] text-[#D3D1C7]">Primeira sessão deste paciente.</p>
            </div>
          )}

          {/* AI insight */}
          {session.snapshot?.latest_insight_summary && session.snapshot.latest_insight_status !== "Not ready" && (
            <div className="bg-[#F0FAF6] border border-[#0F6E56]/15 rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#0F6E56] mb-[4px]">Último insight</p>
              <p className="text-[11px] text-[#085041] leading-relaxed line-clamp-4">
                {session.snapshot.latest_insight_summary}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-[20px] pb-[20px] pt-[4px] space-y-[8px] border-t border-black/[.07]">
          {/* Teleconsulta — generic video_url or Daily.co room */}
          {session.video_url || session.zoom_join_url ? (
            <a
              href={session.video_url ?? session.zoom_join_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#2A7BC1] hover:bg-[#1e6aad] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              Entrar na teleconsulta
            </a>
          ) : (
            <Link
              href={`/schedule/${session.id}/telehealth`}
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#2A7BC1] border border-[#2A7BC1]/30 hover:bg-[#EAF3FB] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              Iniciar teleconsulta (Daily.co)
            </Link>
          )}

          <Link
            href={`/schedule/${session.id}/session`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <FileText className="h-3.5 w-3.5" />
            Registrar sessão
          </Link>
          <Link
            href={`/patients/${session.patient_id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#0F1A2E] border border-black/[.10] hover:bg-[#F4F3EF] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <User className="h-3.5 w-3.5" />
            Ver perfil do paciente
          </Link>
          <Link
            href="/follow-ups"
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Criar follow-up
          </Link>
        </div>
      </aside>
    </div>
  );
}
