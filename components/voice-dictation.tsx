"use client";

/**
 * VoiceDictation — componente genérico de ditado por voz.
 *
 * Renderiza um textarea com botão de microfone embutido.
 * Ao clicar no mic, grava áudio, envia para /api/transcribe (Whisper)
 * e insere o texto transcrito no textarea (append, não substitui).
 *
 * É um componente uncontrolled: usa ref DOM para que funcione dentro
 * de qualquer <form action={serverAction}> sem precisar de useState pai.
 *
 * Uso:
 *   <VoiceDictation name="reviewer_notes" placeholder="Dite sua nota…" />
 */

import { useRef, useState } from "react";
import { Mic, MicOff, Square, Loader2, X } from "lucide-react";

type RecState = "idle" | "recording" | "transcribing";

interface Props {
  /** form field name — obrigatório para o <form> ler o valor */
  name: string;
  placeholder?: string;
  rows?: number;
  /** classes extras para o textarea (opcional) */
  textareaClassName?: string;
  defaultValue?: string;
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceDictation({ name, placeholder, rows = 3, textareaClassName, defaultValue }: Props) {
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeBlob(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microfone não disponível. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecState("transcribing");
  }

  async function transcribeBlob(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro na transcrição.");
      const text = (data.text ?? "").trim();
      if (text && textareaRef.current) {
        const current = textareaRef.current.value.trim();
        textareaRef.current.value = current ? `${current} ${text}` : text;
      }
      setRecState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao transcrever.");
      setRecState("idle");
    }
  }

  const defaultTextareaClass =
    "w-full rounded-[8px] border border-black/[.08] bg-[#F9F8F6] px-[10px] py-[8px] pr-[32px] text-[13px] text-[#0F1A2E] resize-none focus:outline-none focus:ring-1 focus:ring-[#0F6E56]/40";

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={textareaClassName ?? defaultTextareaClass}
      />

      {/* Mic control — canto superior direito do textarea */}
      <div className="absolute right-[7px] top-[6px] flex items-center gap-[3px]">
        {recState === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            title="Ditar nota de voz"
            className="flex items-center justify-center w-[20px] h-[20px] rounded text-[#C4C2BC] hover:text-[#0F6E56] hover:bg-[#E1F5EE] transition"
          >
            <Mic className="w-[12px] h-[12px]" />
          </button>
        )}

        {recState === "recording" && (
          <>
            <span className="text-[9px] font-mono text-red-500 leading-none">{formatElapsed(elapsed)}</span>
            <button
              type="button"
              onClick={stopRecording}
              title="Parar gravação"
              className="flex items-center justify-center w-[20px] h-[20px] rounded text-red-500 hover:bg-red-50 transition"
            >
              <Square className="w-[10px] h-[10px] fill-current" />
            </button>
          </>
        )}

        {recState === "transcribing" && (
          <Loader2 className="w-[13px] h-[13px] text-[#A09E98] animate-spin" />
        )}
      </div>

      {/* Erro de microfone */}
      {error && (
        <div className="mt-1 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-[7px] px-[8px] py-[5px]">
          <MicOff className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)}><X className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
}
