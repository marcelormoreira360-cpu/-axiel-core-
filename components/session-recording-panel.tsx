"use client";

import { useMemo, useRef, useState, useActionState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Mic, MicOff, Plus, Sparkles, Video, X } from "lucide-react";
import type { Appointment, SessionRecord } from "@/lib/types";
import { saveSessionRecord, suggestSoapAction, type SaveSessionState } from "@/app/schedule/[id]/session/actions";
import { formatTime } from "@/modules/schedule/date-utils";
import { SessionInsightGenerator } from "@/components/session-insight-generator";

type RecordingState = "idle" | "recording" | "transcribing";
type NoteMode = "livre" | "soap";

type Props = {
  appointment: Appointment;
  record: SessionRecord | null;
  saved?: boolean;
};

type VitalKey = "dor" | "energia" | "humor" | "sono";

const VITALS_CONFIG: { key: VitalKey; color: string }[] = [
  { key: "dor",     color: "#E05252" },
  { key: "energia", color: "#0F6E56" },
  { key: "humor",   color: "#7B5EA7" },
  { key: "sono",    color: "#2A7BC1" },
];

const SOAP_FIELDS: { key: "subjective" | "objective" | "assessment_note" | "plan"; short: string }[] = [
  { key: "subjective",      short: "S" },
  { key: "objective",       short: "O" },
  { key: "assessment_note", short: "A" },
  { key: "plan",            short: "P" },
];

export function SessionRecordingPanel({ appointment, record, saved }: Props) {
  const t = useTranslations("session.panel");
  const locale = useLocale();
  const initialMode: NoteMode = record?.soap_mode ? "soap" : "livre";

  const [saveState, saveAction] = useActionState<SaveSessionState, FormData>(saveSessionRecord, null);
  const [mode, setMode] = useState<NoteMode>(initialMode);
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [soap, setSoap] = useState({
    subjective:      record?.subjective ?? "",
    objective:       record?.objective ?? "",
    assessment_note: record?.assessment_note ?? "",
    plan:            record?.plan ?? "",
  });
  const [draft, setDraft] = useState("");
  const [observations, setObservations] = useState<string[]>(record?.key_observations ?? []);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [soapSuggesting, startSoapSuggestion] = useTransition();
  const [soapSuggestError, setSoapSuggestError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSOAPField, setActiveSOAPField] = useState<"subjective" | "objective" | "assessment_note" | "plan">("subjective");
  const [vitals, setVitals] = useState<Record<VitalKey, number | null>>({
    dor:     (record?.vitals?.dor    ?? null) as number | null,
    energia: (record?.vitals?.energia ?? null) as number | null,
    humor:   (record?.vitals?.humor  ?? null) as number | null,
    sono:    (record?.vitals?.sono   ?? null) as number | null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const soapRefs = useRef<Partial<Record<string, HTMLTextAreaElement | null>>>({});

  const patientName = appointment.patients?.full_name ?? t("patientFallback");
  const observationsValue = useMemo(() => JSON.stringify(observations), [observations]);

  const sessionDate = new Date(appointment.starts_at).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function handleSuggestSoap() {
    setSoapSuggestError(null);
    startSoapSuggestion(async () => {
      const draftNotes = [
        soap.subjective, soap.objective, soap.assessment_note, soap.plan, notes,
      ].filter(Boolean).join("\n").trim();

      const result = await suggestSoapAction(appointment.patient_id, draftNotes);
      if (result.error || !result.suggestion) {
        setSoapSuggestError(result.error ?? t("suggestError"));
        return;
      }
      // Merge: only fill empty fields (don't overwrite user content)
      setSoap((prev) => ({
        subjective:      prev.subjective.trim()      || result.suggestion!.subjective,
        objective:       prev.objective.trim()       || result.suggestion!.objective,
        assessment_note: prev.assessment_note.trim() || result.suggestion!.assessment_note,
        plan:            prev.plan.trim()            || result.suggestion!.plan,
      }));
    });
  }

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // L-04: Safari does not support audio/webm — detect and fall back to audio/mp4
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
      setRecordingError(t("micError"));
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

      if (!res.ok) throw new Error(data.error ?? t("transcribeError"));

      const transcribed: string = data.text ?? "";

      if (mode === "soap") {
        // Append to the active SOAP field
        setSoap((prev) => {
          const current = prev[activeSOAPField];
          const separator = current.trim() ? "\n\n" : "";
          return { ...prev, [activeSOAPField]: current + separator + transcribed };
        });
        setTimeout(() => {
          const ref = soapRefs.current[activeSOAPField];
          if (ref) { ref.focus(); ref.setSelectionRange(9999, 9999); }
        }, 50);
      } else {
        setNotes((prev) => {
          const separator = prev.trim() ? "\n\n" : "";
          return prev + separator + transcribed;
        });
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(9999, 9999);
          }
        }, 50);
      }
    } catch (err: unknown) {
      setRecordingError(err instanceof Error ? err.message : t("transcribeError"));
    } finally {
      setRecordingState("idle");
    }
  }

  return (
    <form action={saveAction} className="space-y-[18px]">
      <input type="hidden" name="appointment_id" value={appointment.id} />
      <input type="hidden" name="patient_id" value={appointment.patient_id} />
      <input type="hidden" name="clinic_id" value={appointment.clinic_id} />
      <input type="hidden" name="key_observations" value={observationsValue} />
      <input type="hidden" name="soap_mode" value={mode === "soap" ? "1" : "0"} />
      {/* Vitals hidden inputs */}
      {VITALS_CONFIG.map(({ key }) => (
        <input key={key} type="hidden" name={`vitals_${key}`} value={vitals[key] ?? ""} />
      ))}

      {/* Header */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40 mb-[4px]">
            {saved ? t("saved") : t("inProgress")}
          </p>
          <h1 className="text-[20px] font-semibold tracking-[-0.03em] text-white leading-tight">
            {patientName}
          </h1>
          <p className="text-[12px] text-white/40 mt-[2px] capitalize">
            {t("meta", { date: sessionDate, time: formatTime(appointment.starts_at, locale), minutes: appointment.duration_minutes })}
          </p>
        </div>
        <div className="flex items-center gap-[8px] shrink-0">
          {(appointment.video_url || appointment.zoom_join_url) && (
            <a
              href={appointment.video_url ?? appointment.zoom_join_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#2A7BC1] hover:bg-[#1e6aad] transition px-[14px] py-[9px] rounded-[8px] border border-white/[.10]"
            >
              <Video className="h-3.5 w-3.5" />
              {t("enter")}
            </a>
          )}
          <button
            type="submit"
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[16px] py-[9px] rounded-[8px] border border-white/[.10]"
          >
            <Check className="h-3.5 w-3.5" />
            {t("save")}
          </button>
        </div>
      </div>

      {saved && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-[10px] px-[14px] py-[10px]">
          <p className="text-[12px] text-[#085041] font-medium">{t("savedSuccess")}</p>
        </div>
      )}

      {saveState?.error && (
        <div className="bg-[#FEE2E2] border border-red-200 rounded-[10px] px-[14px] py-[10px]">
          <p className="text-[12px] text-red-700 font-medium">⚠️ {saveState.error}</p>
        </div>
      )}

      <div className="grid gap-[18px] xl:grid-cols-[1.2fr_0.8fr]">
        {/* Notes + audio */}
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          {/* Mode switcher */}
          <div className="flex items-center justify-between mb-[12px]">
            <div className="flex rounded-[8px] border border-black/[.08] overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setMode("livre")}
                className={`px-3 py-1.5 transition font-medium ${
                  mode === "livre"
                    ? "bg-[#0F1A2E] text-white"
                    : "text-[#6B6A66] hover:bg-[#F4F3EF]"
                }`}
              >
                {t("modeLivre")}
              </button>
              <button
                type="button"
                onClick={() => setMode("soap")}
                className={`px-3 py-1.5 transition font-medium ${
                  mode === "soap"
                    ? "bg-[#0F1A2E] text-white"
                    : "text-[#6B6A66] hover:bg-[#F4F3EF]"
                }`}
              >
                SOAP
              </button>
            </div>
            {mode === "livre" && (
              <span className="text-[10px] text-[#D3D1C7]">{t("chars", { count: notes.length })}</span>
            )}
          </div>

          {/* Livre mode */}
          {mode === "livre" && (
            <textarea
              ref={textareaRef}
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("freePlaceholder")}
              rows={18}
              className="w-full resize-none rounded-[8px] bg-[#FAFAF8] border border-transparent px-[12px] py-[10px] text-[13px] text-[#0F1A2E] leading-relaxed placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56]/30 focus:bg-white transition"
            />
          )}

          {/* SOAP mode */}
          {mode === "soap" && (
            <div className="space-y-[10px]">
              {/* SOAP tab selector for audio target */}
              <div className="flex gap-1.5 flex-wrap">
                {SOAP_FIELDS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveSOAPField(f.key)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition ${
                      activeSOAPField === f.key
                        ? "bg-[#0F1A2E] text-white"
                        : "bg-[#F4F3EF] text-[#6B6A66] hover:bg-[#E8E6E2]"
                    }`}
                  >
                    {f.short}
                  </button>
                ))}
                <span className="text-[10px] text-[#A09E98] self-center ml-1">
                  {t("audioTarget")} <strong>{SOAP_FIELDS.find(f => f.key === activeSOAPField)?.short}</strong>
                </span>
              </div>

              {/* AI Suggest button */}
              <div className="flex items-center gap-[8px]">
                <button
                  type="button"
                  onClick={handleSuggestSoap}
                  disabled={soapSuggesting}
                  className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] disabled:opacity-50 disabled:cursor-not-allowed px-[10px] py-[6px] rounded-[7px] transition"
                >
                  {soapSuggesting ? (
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {soapSuggesting ? t("suggesting") : t("suggest")}
                </button>
                {soapSuggestError && (
                  <span className="text-[10px] text-red-500">{soapSuggestError}</span>
                )}
                {!soapSuggestError && !soapSuggesting && (
                  <span className="text-[10px] text-[#A09E98]">{t("suggestHint")}</span>
                )}
              </div>

              {SOAP_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] font-semibold text-[#6B6A66] uppercase tracking-[.05em] mb-1 block">
                    {t(`soap.${f.key}.label`)}
                  </label>
                  <textarea
                    ref={(el) => { soapRefs.current[f.key] = el; }}
                    name={f.key}
                    value={soap[f.key]}
                    onChange={(e) => setSoap((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    onFocus={() => setActiveSOAPField(f.key)}
                    placeholder={t(`soap.${f.key}.placeholder`)}
                    rows={4}
                    className="w-full resize-none rounded-[8px] bg-[#FAFAF8] border border-transparent px-[12px] py-[10px] text-[13px] text-[#0F1A2E] leading-relaxed placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56]/30 focus:bg-white transition"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Hidden fields for SOAP when in livre mode (preserve values) */}
          {mode === "livre" && (
            <>
              <input type="hidden" name="subjective" value={soap.subjective} />
              <input type="hidden" name="objective" value={soap.objective} />
              <input type="hidden" name="assessment_note" value={soap.assessment_note} />
              <input type="hidden" name="plan" value={soap.plan} />
            </>
          )}
          {/* Hidden notes field when in SOAP mode */}
          {mode === "soap" && (
            <input type="hidden" name="notes" value={notes} />
          )}

          {/* Audio recorder bar */}
          <div className="mt-[10px] flex items-center gap-[8px]">
            {recordingState === "idle" && (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:border-[#0F6E56] hover:text-[#0F6E56] rounded-[8px] px-[12px] py-[7px] transition"
              >
                <Mic className="h-3.5 w-3.5" />
                {t("record")}
              </button>
            )}

            {recordingState === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-[8px] px-[12px] py-[7px] transition animate-pulse"
              >
                <MicOff className="h-3.5 w-3.5" />
                {t("stop", { time: formatElapsed(elapsedSeconds) })}
              </button>
            )}

            {recordingState === "transcribing" && (
              <div className="flex items-center gap-[6px] text-[12px] text-[#A09E98] border border-black/[.08] rounded-[8px] px-[12px] py-[7px]">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
                {t("transcribing")}
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
              {t("keyObs")}
            </label>

            <div className="flex gap-[6px] mb-[10px]">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addObservation(); }
                }}
                placeholder={t("obsPlaceholder")}
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
                <p className="text-[12px] text-[#D3D1C7] px-[2px]">{t("noObs")}</p>
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
              <p className="text-[10px] text-[#D3D1C7] mt-[8px]">{t("obsCount", { count: observations.length })}</p>
            )}
          </div>

          {/* Vitais relatados pelo paciente */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <div className="flex items-center justify-between mb-[12px]">
              <label className="text-[11px] font-medium text-[#6B6A66]">
                {t("vitalsTitle")}
              </label>
              <span className="text-[10px] text-[#D3D1C7]">{t("scale")}</span>
            </div>
            <div className="space-y-[10px]">
              {VITALS_CONFIG.map(({ key, color }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-[5px]">
                    <span className="text-[11px] font-medium text-[#0F1A2E]">{t(`vitals.${key}.label`)}</span>
                    <div className="flex items-center gap-[4px] text-[9px] text-[#A09E98]">
                      <span>{t(`vitals.${key}.low`)}</span>
                      <span className="mx-[2px]">·</span>
                      <span>{t(`vitals.${key}.high`)}</span>
                    </div>
                  </div>
                  <div className="flex gap-[5px]">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const selected = vitals[key] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setVitals((prev) => ({
                            ...prev,
                            [key]: prev[key] === val ? null : val,
                          }))}
                          className="flex-1 h-[30px] rounded-[6px] text-[12px] font-semibold transition border"
                          style={{
                            backgroundColor: selected ? color : "#F4F3EF",
                            color: selected ? "#fff" : "#6B6A66",
                            borderColor: selected ? color : "transparent",
                          }}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insight generator */}
          <SessionInsightGenerator
            patientId={appointment.patient_id}
            saved={!!saved}
          />

          {/* Session info */}
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <p className="text-[11px] font-medium text-[#6B6A66] mb-[8px]">{t("details")}</p>
            <div className="space-y-[6px]">
              {appointment.notes && (
                <div>
                  <p className="text-[10px] text-[#A09E98] mb-[2px]">{t("prevNote")}</p>
                  <p className="text-[12px] text-[#0F1A2E]">{appointment.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#A09E98]">{t("duration")}</span>
                <span className="text-[11px] font-medium text-[#0F1A2E]">{t("minutes", { count: appointment.duration_minutes })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#A09E98]">{t("start")}</span>
                <span className="text-[11px] font-medium text-[#0F1A2E]">{formatTime(appointment.starts_at, locale)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
