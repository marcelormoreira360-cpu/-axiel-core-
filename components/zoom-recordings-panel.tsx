"use client";

import { useState, useTransition } from "react";
import { Video, Download, RefreshCw, ExternalLink } from "lucide-react";
import { syncZoomRecordingsAction } from "@/app/schedule/[id]/session/actions";
import type { ZoomRecording } from "@/services/zoom-service";

const FILE_TYPE_LABELS: Record<string, string> = {
  MP4:        "Vídeo",
  M4A:        "Áudio",
  TRANSCRIPT: "Transcrição",
  CHAT:       "Chat",
  TIMELINE:   "Timeline",
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const min  = Math.floor(diff / 60000);
  const sec  = Math.floor((diff % 60000) / 1000);
  return `${min}m ${sec}s`;
}

interface Props {
  appointmentId: string;
  zoomMeetingId: string;
  clinicId: string;
  patientId: string | null;
  recordings: ZoomRecording[];
}

export function ZoomRecordingsPanel({
  appointmentId,
  zoomMeetingId,
  clinicId,
  patientId,
  recordings: initialRecordings,
}: Props) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      setSyncMsg(null);
      const result = await syncZoomRecordingsAction(
        appointmentId,
        zoomMeetingId,
        clinicId,
        patientId,
      );
      if (result.error) {
        setSyncMsg(`Erro: ${result.error}`);
      } else if (result.synced === 0) {
        setSyncMsg("Nenhuma gravação disponível ainda. Tente novamente em alguns minutos.");
      } else {
        setSyncMsg(`${result.synced} gravação(ões) sincronizada(s).`);
        // Refresh by reloading recordings from updated state
        window.location.reload();
      }
    });
  }

  return (
    <div className="rounded-[12px] border border-black/[.07] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/[.05] bg-[#FAFAF8]">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[#0F1A2E]" />
          <p className="text-[13px] font-semibold text-[#0F1A2E]">Gravações Zoom</p>
          {recordings.length > 0 && (
            <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-medium text-[#0F6E56]">
              {recordings.length}
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-[7px] border border-black/[.10] px-3 py-1.5 text-[11px] font-medium text-[#6B6A66] hover:bg-[#F4F3EF] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      <div className="px-5 py-4">
        {syncMsg && (
          <p className={`text-[12px] mb-3 ${syncMsg.startsWith("Erro") ? "text-red-500" : "text-[#0F6E56]"}`}>
            {syncMsg}
          </p>
        )}

        {recordings.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-[#A09E98]">
              Nenhuma gravação disponível. A gravação aparece alguns minutos após o término da consulta.
            </p>
            <p className="text-[11px] text-[#D3D1C7] mt-1">
              Clique em &quot;Sincronizar&quot; para buscar na Zoom.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between rounded-[8px] border border-black/[.07] bg-[#FAFAF8] px-4 py-3"
              >
                <div>
                  <p className="text-[12px] font-medium text-[#0F1A2E]">
                    {FILE_TYPE_LABELS[rec.file_type ?? ""] ?? rec.file_type ?? "Arquivo"}
                  </p>
                  <p className="text-[11px] text-[#A09E98]">
                    {formatDuration(rec.recording_start, rec.recording_end)}
                    {rec.file_size && ` · ${(rec.file_size / 1024 / 1024).toFixed(1)} MB`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rec.play_url && (
                    <a
                      href={rec.play_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-[6px] bg-[#0F1A2E] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-black transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Assistir
                    </a>
                  )}
                  {rec.download_url && (
                    <a
                      href={rec.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-[6px] border border-black/[.10] px-3 py-1.5 text-[11px] font-medium text-[#6B6A66] hover:bg-[#F4F3EF] transition"
                    >
                      <Download className="h-3 w-3" />
                      Baixar
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
