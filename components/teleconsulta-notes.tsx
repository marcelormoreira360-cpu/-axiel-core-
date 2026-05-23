"use client";

import { useState, useRef, useTransition } from "react";
import { Mic, MicOff } from "lucide-react";

type RecordingState = "idle" | "recording" | "transcribing";

interface TeleconsultaNotesProps {
  appointmentId: string;
  patientId: string;
  clinicId: string;
  initialNotes: string;
  initialObservations: string[];
  saveAction: (appointmentId: string, notes: string, observations: string[]) => Promise<void>;
}

export function TeleconsultaNotes({
  appointmentId,
  patientId,
  clinicId,
  initialNotes,
  initialObservations,
  saveAction,
}: TeleconsultaNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [observations, setObservations] = useState<string[]>(initialObservations);
  const [newObs, setNewObs] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm"); // L-04: track mimeType for Safari compat
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function triggerSave(nextNotes: string, nextObs: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await saveAction(appointmentId, nextNotes, nextObs);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 1200);
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    triggerSave(val, observations);
  }

  function addObservation() {
    const trimmed = newObs.trim();
    if (!trimmed) return;
    const next = [...observations, trimmed];
    setObservations(next);
    setNewObs("");
    triggerSave(notes, next);
  }

  function removeObservation(idx: number) {
    const next = observations.filter((_, i) => i !== idx);
    setObservations(next);
    triggerSave(notes, next);
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
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        await transcribeAudio(blob);
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

  async function transcribeAudio(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na transcrição");
      const transcribed: string = data.text ?? "";
      const nextNotes = notes.trim()
        ? notes + "\n\n" + transcribed
        : transcribed;
      setNotes(nextNotes);
      triggerSave(nextNotes, observations);
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
    <div className="flex flex-col gap-4">
      {/* Notes textarea */}
      <div>
        <div className="flex items-center justify-between mb-[6px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] dark:text-[#6B6A66]">
            Notas da sessão
          </p>
          <span className={`text-[10px] transition ${
            saveStatus === "saving" ? "text-[#A09E98]" :
            saveStatus === "saved"  ? "text-[#0F6E56]" : "text-transparent"
          }`}>
            {saveStatus === "saving" ? "Salvando…" : "Salvo ✓"}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Observe e anote durante a consulta…"
          rows={7}
          className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[10px] px-[13px] py-[10px] resize-none outline-none focus:border-[#0F6E56] transition placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66] leading-relaxed"
        />

        {/* Audio recorder */}
        <div className="mt-[8px] flex items-center gap-[8px]">
          {recordingState === "idle" && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-[5px] text-[11px] font-medium text-white/50 border border-white/[.12] hover:border-white/25 hover:text-white/80 rounded-[7px] px-[10px] py-[6px] transition"
            >
              <Mic className="h-3 w-3" />
              Gravar voz
            </button>
          )}

          {recordingState === "recording" && (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-[5px] text-[11px] font-medium text-white bg-red-500/80 hover:bg-red-500 rounded-[7px] px-[10px] py-[6px] transition animate-pulse"
            >
              <MicOff className="h-3 w-3" />
              Parar · {formatElapsed(elapsedSeconds)}
            </button>
          )}

          {recordingState === "transcribing" && (
            <div className="flex items-center gap-[6px] text-[11px] text-white/40 border border-white/[.08] rounded-[7px] px-[10px] py-[6px]">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
              Transcrevendo…
            </div>
          )}

          {recordingError && (
            <p className="text-[11px] text-red-400 flex-1">{recordingError}</p>
          )}
        </div>
      </div>

      {/* Key observations */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] dark:text-[#6B6A66] mb-[8px]">
          Observações-chave
        </p>
        <div className="flex flex-wrap gap-[6px] mb-[8px]">
          {observations.map((obs, i) => (
            <span
              key={i}
              className="flex items-center gap-[5px] text-[11px] text-[#0F6E56] bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border border-[#9FE1CB] dark:border-[#0F6E56]/30 rounded-full px-[10px] py-[3px]"
            >
              {obs}
              <button
                onClick={() => removeObservation(i)}
                className="text-[#0F6E56]/60 hover:text-[#0F6E56] transition ml-[1px]"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newObs}
            onChange={(e) => setNewObs(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addObservation(); } }}
            placeholder="Adicionar observação…"
            className="flex-1 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[6px] outline-none focus:border-[#0F6E56] transition placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66]"
          />
          <button
            onClick={addObservation}
            className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[12px] py-[6px] rounded-[8px]"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
