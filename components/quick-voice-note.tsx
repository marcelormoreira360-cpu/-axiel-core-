"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Square, Loader2, Check, X, Pencil } from "lucide-react";
import { appendPatientNoteAction } from "@/app/patients/[id]/quick-note/actions";

type RecordingState = "idle" | "recording" | "transcribing" | "review" | "saving" | "saved";

type Props = {
  patientId: string;
  existingNotes: string;
};

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function QuickVoiceNote({ patientId, existingNotes }: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState(existingNotes);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeBlob(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microfone não disponível. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setState("transcribing");
  }

  async function transcribeBlob(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na transcrição.");
      setTranscript(data.text ?? "");
      setState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao transcrever.");
      setState("idle");
    }
  }

  async function saveNote() {
    const text = transcript.trim();
    if (!text) return;
    setState("saving");
    const result = await appendPatientNoteAction(patientId, text);
    if (result.ok) {
      // Optimistically append to local notes display
      const dateLabel = new Date().toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
      const newEntry = `[${dateLabel}] ${text}`;
      setNotes((prev) => (prev?.trim() ? `${prev.trim()}\n\n${newEntry}` : newEntry));
      setTranscript("");
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } else {
      setError(result.error ?? "Erro ao salvar.");
      setState("review");
    }
  }

  function cancelReview() {
    setTranscript("");
    setState("idle");
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-[#A09E98] uppercase tracking-[.06em]">
          Observações
        </p>

        {/* Action area — right side */}
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Mic className="w-3.5 h-3.5" />
            Gravar nota
          </button>
        )}

        {state === "recording" && (
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[11px] font-mono text-red-500">{formatElapsed(elapsed)}</span>
            <button
              onClick={stopRecording}
              className="flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 transition"
            >
              <Square className="w-3 h-3 fill-current" />
              Parar
            </button>
          </div>
        )}

        {state === "transcribing" && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#A09E98]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Transcrevendo…
          </div>
        )}

        {state === "saved" && (
          <div className="flex items-center gap-1 text-[11px] text-[#0F6E56]">
            <Check className="w-3.5 h-3.5" />
            Salvo
          </div>
        )}
      </div>

      {/* Review pane */}
      {state === "review" && (
        <div className="mb-3 space-y-2">
          <div className="flex items-start gap-1.5">
            <Pencil className="w-3.5 h-3.5 text-[#A09E98] mt-0.5 shrink-0" />
            <p className="text-[11px] text-[#A09E98]">Revise e edite antes de salvar:</p>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            className="w-full text-[13px] text-[#0F1A2E] bg-[#F9F8F6] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] resize-none focus:outline-none focus:ring-1 focus:ring-[#0F6E56]/40"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={cancelReview}
              className="flex items-center gap-1 text-[11px] text-[#A09E98] hover:text-[#6B6A66] transition"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              onClick={saveNote}
              disabled={!transcript.trim()}
              className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 disabled:cursor-not-allowed transition px-[10px] py-[5px] rounded-[6px]"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar nota
            </button>
          </div>
        </div>
      )}

      {state === "saving" && (
        <div className="mb-3 flex items-center gap-1.5 text-[11px] text-[#A09E98]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Salvando…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-[7px] px-[10px] py-[7px]">
          <MicOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Existing notes */}
      {notes ? (
        <p className="text-[13px] text-[#6B6A66] leading-relaxed whitespace-pre-wrap">{notes}</p>
      ) : (
        state === "idle" && (
          <p className="text-[12px] text-[#C4C2BC] italic">
            Nenhuma observação registrada. Grave uma nota de voz para começar.
          </p>
        )
      )}
    </div>
  );
}
