"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Mic, MicOff, Plus, Sparkles, X } from "lucide-react";
import type { Appointment, SessionRecord } from "@/lib/types";
import { saveSessionRecord } from "@/app/schedule/[id]/session/actions";
import { formatTime } from "@/modules/schedule/date-utils";

type RecordingState = "idle" | "recording" | "transcribing";

type Props = {
  appointment: Appointment;
  record: SessionRecord | null;
  saved?: boolean;
};

export function SessionRecordingPanel({ appointment, record, saved }: Props) {
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [draft, setDraft] = useState("");
  const [observations, setObservations] = useState<string[]>(record?.key_observations ?? []);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const patientName = appointment.patients?.full_name ?? "Paciente";
  const observationsValue = useMemo(() => JSON.stringify(observations), [observations]);

  const sessionDate = new Date(appointment.starts_at).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function addObservation() {
    const clean = draft.trim();
    if (!clean) return;
    setObservations((prev) => [...prev, clean].slice(0, 12));
    setDraft("");
  }

  function removeObservation(i: number) {
    setObservations((prev) => prev.filter((_, idx) => idx !== i));
  }

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function startRecording() {
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setRecordingError("Microfone não disponível. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecordingState("transcribing");
  }

  async function transcribe(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Erro na transcrição");

      const transcribed: string = data.text ?? "";
      setNotes((prev) => {
        const separator = prev.trim() ? "\n\n" : "";
        return prev + separator + transcribed;
      });
      // Move cursor to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(9999, 9999);
        }
      }, 50);
    } catch (err: unknown) {
      setRecordingError(err instanceof Error ? err.message : "Erro na transcrição");
    } finally {
      setRecordingState("idle");
    }
  }

  return (
    <form action={saveSessionRecord} className="space-y-[18px]">
      <input type="hidden" name="appointment_id" value={appointment.id} />
      <input type="hidden" name="patient_id" value={appointment.patient_id} />
      <input type="hidden" name="clinic_id" value={appointment.clinic_id} />
      <input type="hidden" name="key_observations" value={observationsValue} />

      {/* Header */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40 mb-[4px]">
            {saved ? "Sessão salva" : "Em andamento"}
          </p>
          <h1 className="text-[20px] font-semibold tracking-[-0.03em] text-white leading-tight">
            {patientName}
          </h1>
          <p className="text-[12px] text-white/40 mt-[2px] capitalize">
            {sessionDate} · {formatTime(appointment.starts_at)} · {appointment.duration_minutes} min
          </p>
        </div>
        <button
          type="submit"
          className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[16px] py-[9px] rounded-[8px] border border-white/[.10] shrink-0"
        >
          <Check className="h-3.5 w-3.5" />
          Salvar sessão
        </button>
      </div>

      {saved && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-[10px] px-[14px] py-[10px]">
          <p className="text-[12px] text-[#085041] font-medium">Sessão salva com sucesso.</p>
        </div>
      )}

      <div className="grid gap-[18px] xl:grid-cols-[1.2fr_0.8fr]">
        {/* Notes + audio */}
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <div className="flex items-center justify-between mb-[10px]">
            <label className="text-[11px] font-medium text-[#6B6A66]">Notas da sessão</label>
            <span className="text-[10px] text-[#D3D1C7]">{notes.length} car.</span>
          </div>

          <textarea
            ref={textareaRef}
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escreva ou grave as notas da sessão..."
            rows={18}
            className="w-full resize-none rounded-[8px] bg-[#FAFAF8] border border-transparent px-[12px] py-[10px] text-[13px] text-[#0F1A2E] leading-relaxed placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56]/30 focus:bg-white transition"
          />

          {/* Audio recorder bar */}
          <div className="mt-[10px] flex items-center gap-[8px]">
            {recordingState === "idle" && (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:border-[#0F6E56] hover:text-[#0F6E56] rounded-[8px] px-[12px] py-[7px] transition"
              >
                <Mic className="h-3.5 w-3.5" />
                Gravar nota em voz
              </button>
            )}

            {recordingState === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-[8px] px-[12px] py-[7px] transition animate-pulse"
              >
                <MicOff className="h-3.5 w-3.5" />
                Parar · {formatElapsed(elapsedSeconds)}
              </button>
            )}

            {recordingState === "transcribing" && (
              <div className="flex items-center gap-[6px] text-[12px] text-[#A09E98] border border-black/[.08] rounded-[8px] px-[12px] py-[7px]">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
                Transcrevendo…
              </div>
            )}

            {recordingError && (
              <p className="text-[11px] text-red-500 flex-1">{recordingError}</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-[14px]">
          {/* Key observations */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[10px] block">
              Observações-chave
            </label>

            <div className="flex gap-[6px] mb-[10px]">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addObservation(); }
                }}
                placeholder="Ex: respiração calma..."
                className="flex-1 px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
              <button
                type="button"
                onClick={addObservation}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-[#0F1A2E] text-white hover:bg-[#1a2d4a] transition shrink-0 self-center"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-[5px]">
              {observations.length === 0 ? (
                <p className="text-[12px] text-[#D3D1C7] px-[2px]">Nenhuma observação ainda.</p>
              ) : (
                observations.map((item, i) => (
                  <div
                    key={`${item}-${i}`}
                    className="flex items-center justify-between gap-[8px] bg-[#F4F3EF] rounded-[8px] px-[10px] py-[7px]"
                  >
                    <span className="text-[12px] text-[#0F1A2E] flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeObservation(i)}
                      className="text-[#A09E98] hover:text-[#0F1A2E] transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {observations.length > 0 && (
              <p className="text-[10px] text-[#D3D1C7] mt-[8px]">{observations.length}/12 observações</p>
            )}
          </div>

          {/* AI insight placeholder */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <div className="flex items-center gap-[8px] mb-[10px]">
              <div className="w-7 h-7 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-[#A09E98]" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight</p>
                <p className="text-[10px] text-[#A09E98]">Em breve</p>
              </div>
            </div>
            <p className="text-[12px] text-[#A09E98] leading-relaxed bg-[#FAFAF8] rounded-[8px] px-[10px] py-[9px]">
              Após salvar, a IA vai resumir a sessão, identificar padrões e sugerir a próxima ação.
            </p>
          </div>

          {/* Session info */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <p className="text-[11px] font-medium text-[#6B6A66] mb-[8px]">Detalhes</p>
            <div className="space-y-[6px]">
              {appointment.notes && (
                <div>
                  <p className="text-[10px] text-[#A09E98] mb-[2px]">Nota prévia</p>
                  <p className="text-[12px] text-[#0F1A2E]">{appointment.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#A09E98]">Duração</span>
                <span className="text-[11px] font-medium text-[#0F1A2E]">{appointment.duration_minutes} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#A09E98]">Início</span>
                <span className="text-[11px] font-medium text-[#0F1A2E]">{formatTime(appointment.starts_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
