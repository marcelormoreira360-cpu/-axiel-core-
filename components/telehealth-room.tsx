"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Copy, Check, PhoneOff, Loader2,
  ClipboardList, AlertCircle, CheckCircle2, Clock, Sparkles
} from "lucide-react";
import type { Appointment } from "@/lib/types";
import { formatTime } from "@/modules/schedule/date-utils";

type RecordingState = "idle" | "recording" | "transcribing" | "summarizing";

type Summary = {
  resumo: string;
  decisoes: string[];
  pendencias: string[];
  proxima_sessao: string;
  notas_clinicas: string;
};

export function TelehealthRoom({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const patientName = appointment.patients?.full_name ?? "Paciente";

  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [patientLink, setPatientLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm"); // L-04: track actual mimeType for Safari compat
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);

  // Create room on mount
  useEffect(() => {
    async function createRoom() {
      try {
        const res = await fetch("/api/telehealth/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: appointment.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRoomUrl(data.url);
        // Patient link is the same room URL
        setPatientLink(data.url);
      } catch (err: unknown) {
        setRoomError(err instanceof Error ? err.message : "Erro ao criar sala");
      } finally {
        setLoadingRoom(false);
      }
    }
    createRoom();

    // Call duration timer
    callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appointment.id]);

  function formatDuration(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  }

  async function copyPatientLink() {
    if (!patientLink) return;
    await navigator.clipboard.writeText(patientLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function startRecording() {
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // L-04: Safari does not support audio/webm — fall back to audio/mp4
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await transcribeAndSummarize();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setRecordingError("Microfone não disponível. Verifique as permissões.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecordingState("transcribing");
  }

  async function transcribeAndSummarize() {
    try {
      // Step 1: Whisper transcription
      const mt = mimeTypeRef.current;
      const ext = mt.includes("mp4") ? "mp4" : mt.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(chunksRef.current, { type: mt });
      const fd = new FormData();
      fd.append("file", blob, `audio.${ext}`);

      const tRes = await fetch("/api/transcribe", { method: "POST", body: fd });
      const tData = await tRes.json();
      if (!tRes.ok) throw new Error(tData.error ?? "Erro na transcrição");

      const transcribedText: string = tData.text ?? "";
      setTranscript(transcribedText);

      // Step 2: GPT summary
      setRecordingState("summarizing");
      const sRes = await fetch("/api/telehealth/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcribedText, patientName }),
      });
      const sData = await sRes.json();
      if (!sRes.ok) throw new Error(sData.error ?? "Erro ao gerar resumo");

      setSummary(sData as Summary);
      setRecordingState("idle");
    } catch (err: unknown) {
      setRecordingError(err instanceof Error ? err.message : "Erro no processamento");
      setRecordingState("idle");
    }
  }

  const goToSession = useCallback(() => {
    router.push(`/schedule/${appointment.id}/session`);
  }, [router, appointment.id]);

  // Summary modal
  if (summary) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] py-[32px] px-[16px]">
        <div className="max-w-[680px] mx-auto space-y-[16px]">
          {/* Header */}
          <div className="bg-[#0F1A2E] rounded-[14px] px-[20px] py-[16px] flex items-center gap-[12px]">
            <div className="w-9 h-9 rounded-full bg-[#0F6E56] flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">Resumo da teleconsulta</p>
              <p className="text-[16px] font-semibold text-white">{patientName}</p>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[8px]">Resumo</p>
            <p className="text-[13px] text-[#0F1A2E] leading-relaxed">{summary.resumo}</p>
          </div>

          {/* Decisões + Pendências */}
          <div className="grid gap-[12px] sm:grid-cols-2">
            <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
              <div className="flex items-center gap-[6px] mb-[10px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56]" />
                <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98]">Decisões</p>
              </div>
              {summary.decisoes.length === 0 ? (
                <p className="text-[12px] text-[#D3D1C7]">Nenhuma decisão registrada.</p>
              ) : (
                <ul className="space-y-[6px]">
                  {summary.decisoes.map((d, i) => (
                    <li key={i} className="flex items-start gap-[6px]">
                      <span className="h-[5px] w-[5px] rounded-full bg-[#0F6E56] mt-[6px] shrink-0" />
                      <span className="text-[12px] text-[#0F1A2E]">{d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
              <div className="flex items-center gap-[6px] mb-[10px]">
                <Clock className="h-3.5 w-3.5 text-[#E8A100]" />
                <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98]">Pendências</p>
              </div>
              {summary.pendencias.length === 0 ? (
                <p className="text-[12px] text-[#D3D1C7]">Sem pendências.</p>
              ) : (
                <ul className="space-y-[6px]">
                  {summary.pendencias.map((p, i) => (
                    <li key={i} className="flex items-start gap-[6px]">
                      <span className="h-[5px] w-[5px] rounded-full bg-[#E8A100] mt-[6px] shrink-0" />
                      <span className="text-[12px] text-[#0F1A2E]">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Próxima sessão */}
          <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[12px]">
            <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#0F6E56] mb-[4px]">Próxima sessão</p>
            <p className="text-[13px] text-[#085041]">{summary.proxima_sessao}</p>
          </div>

          {/* Notas clínicas */}
          {summary.notas_clinicas && (
            <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
              <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[8px]">Notas clínicas</p>
              <p className="text-[12px] text-[#0F1A2E] leading-relaxed">{summary.notas_clinicas}</p>
            </div>
          )}

          {/* Transcrição completa (colapsável) */}
          {transcript && (
            <details className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
              <summary className="text-[11px] font-medium text-[#A09E98] cursor-pointer select-none">
                Ver transcrição completa
              </summary>
              <p className="text-[12px] text-[#6B6A66] leading-relaxed mt-[10px] whitespace-pre-wrap">{transcript}</p>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-[8px]">
            <button
              type="button"
              onClick={goToSession}
              className="flex-1 flex items-center justify-center gap-[6px] text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[10px] py-[12px] transition"
            >
              <ClipboardList className="h-4 w-4" />
              Ir para registro de sessão
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1A2E] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-white/[.06]">
        <div>
          <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">Teleconsulta</p>
          <p className="text-[15px] font-semibold text-white">{patientName}</p>
        </div>
        <div className="flex items-center gap-[10px]">
          <span className="text-[12px] font-mono text-white/40">{formatDuration(callSeconds)}</span>
          <span className="text-[11px] text-[#A09E98]">
            {formatTime(appointment.starts_at)} · {appointment.duration_minutes} min
          </span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {loadingRoom && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-white/40 animate-spin mx-auto mb-[12px]" />
              <p className="text-[13px] text-white/40">Criando sala segura…</p>
            </div>
          </div>
        )}

        {roomError && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white/5 border border-white/10 rounded-[12px] px-[24px] py-[20px] text-center max-w-[360px]">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-[10px]" />
              <p className="text-[14px] text-white mb-[6px]">Erro ao criar sala</p>
              <p className="text-[12px] text-white/40">{roomError}</p>
            </div>
          </div>
        )}

        {roomUrl && (
          <iframe
            src={roomUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture"
            className="w-full h-full min-h-[500px]"
            style={{ border: "none" }}
          />
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-[20px] py-[16px] border-t border-white/[.06] space-y-[12px]">
        {/* Patient link */}
        {patientLink && (
          <div className="flex items-center gap-[8px] bg-white/[.04] rounded-[10px] px-[12px] py-[9px]">
            <p className="text-[11px] text-white/40 shrink-0">Link do paciente:</p>
            <p className="text-[11px] text-white/60 font-mono flex-1 truncate">{patientLink}</p>
            <button
              type="button"
              onClick={copyPatientLink}
              className={[
                "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[8px] py-[4px] transition shrink-0",
                linkCopied
                  ? "bg-[#0F6E56]/20 text-[#0F6E56]"
                  : "bg-white/[.08] text-white/60 hover:bg-white/[.12]",
              ].join(" ")}
            >
              {linkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {linkCopied ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}

        {/* Recording controls */}
        <div className="flex items-center gap-[8px]">
          {recordingState === "idle" && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-[6px] text-[12px] font-medium text-white/70 border border-white/[.12] hover:border-white/30 rounded-[8px] px-[12px] py-[8px] transition"
            >
              <Mic className="h-3.5 w-3.5" />
              Gravar relato para resumo IA
            </button>
          )}

          {recordingState === "recording" && (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-[8px] px-[12px] py-[8px] transition animate-pulse"
            >
              <MicOff className="h-3.5 w-3.5" />
              Parar gravação · {formatDuration(elapsedSeconds)}
            </button>
          )}

          {(recordingState === "transcribing" || recordingState === "summarizing") && (
            <div className="flex items-center gap-[6px] text-[12px] text-white/40 border border-white/[.08] rounded-[8px] px-[12px] py-[8px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {recordingState === "transcribing" ? "Transcrevendo…" : "Gerando resumo IA…"}
            </div>
          )}

          {recordingError && (
            <p className="text-[11px] text-red-400 flex-1">{recordingError}</p>
          )}

          {/* End call */}
          <button
            type="button"
            onClick={goToSession}
            className="ml-auto flex items-center gap-[6px] text-[12px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-[8px] px-[14px] py-[8px] transition"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}
