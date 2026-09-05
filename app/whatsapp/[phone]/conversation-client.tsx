"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { WaConversation, WaMessage } from "@/services/whatsapp-conversation-service";
import type { ConversationChannel } from "@/lib/twilio-webhook-utils";
import { handoffStatus } from "@/lib/whatsapp-handoff";
import {
  pauseAiAction,
  resumeAiAction,
  sendManualReplyAction,
  sendManualMediaAction,
} from "@/app/whatsapp/actions";

interface Props {
  conversation: WaConversation;
  channel: ConversationChannel;
}

function MediaBlock({ media }: { media: NonNullable<WaMessage["media"]> }) {
  const t = useTranslations("whatsapp");
  if (!media.url) return null;

  if (media.kind === "image") {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="block mt-[6px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.name ?? ""}
          className="max-w-full max-h-[240px] rounded-[8px] object-cover"
        />
      </a>
    );
  }

  if (media.kind === "audio") {
    return <audio controls src={media.url} className="mt-[6px] w-[220px] max-w-full" />;
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      download={media.name ?? undefined}
      className="mt-[6px] flex items-center gap-[8px] bg-black/[.06] hover:bg-black/[.1] rounded-[8px] px-[10px] py-[8px] transition"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" /><path d="M14 2v6h6" />
      </svg>
      <span className="text-[12px] truncate max-w-[180px]">{media.name ?? t("composer.downloadFile")}</span>
    </a>
  );
}

function Bubble({ message }: { message: WaMessage }) {
  const t = useTranslations("whatsapp");
  const isUser = message.role === "user";
  const isManual = message.content.startsWith("[MANUAL]");
  const text = message.content.replace(/^\[MANUAL\]\s?/, "");

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-[6px]`}>
      <div
        className={[
          "max-w-[80%] sm:max-w-[75%] rounded-[12px] px-[12px] py-[9px] text-[13px] leading-relaxed",
          isUser
            ? "bg-white border border-black/[.07] text-[#0F1A2E] rounded-tl-[3px]"
            : isManual
            ? "bg-amber-500 text-white rounded-tr-[3px]"
            : "bg-[#0F6E56] text-white rounded-tr-[3px]",
        ].join(" ")}
      >
        {isManual && (
          <span className="text-[9px] font-semibold uppercase tracking-wider block mb-[3px] opacity-80">
            {t("composer.sentManually")}
          </span>
        )}
        {text && <p className="whitespace-pre-wrap">{text}</p>}
        {message.media && <MediaBlock media={message.media} />}
      </div>
    </div>
  );
}

export function WhatsAppConversationClient({ conversation, channel }: Props) {
  const router = useRouter();
  const t = useTranslations("whatsapp");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");

  // Anexo pendente (arquivo escolhido ou áudio gravado) aguardando envio.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gravação de áudio.
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  // WhatsApp aceita qualquer mídia; Instagram/Messenger só imagem; SMS nenhuma.
  const isWhatsapp = channel === "whatsapp";
  const canAttach = isWhatsapp || channel === "instagram" || channel === "messenger";
  const canAudio = isWhatsapp;
  const attachAccept = isWhatsapp
    ? "image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
    : "image/*";

  const status = handoffStatus({
    aiPaused: conversation.ai_paused,
    botDisabled: conversation.bot_disabled,
    lastHumanMessageAt: conversation.last_human_message_at,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  // Preview object URL do anexo pendente (libera quando troca/remove).
  useEffect(() => {
    if (!pendingFile) {
      setPendingUrl("");
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  // Ao desmontar (sair da conversa): fecha o timer e o microfone se ainda
  // estiver gravando — senão o mic fica ligado e o interval segue rodando.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* já parado */
        }
      }
      rec?.stream?.getTracks().forEach((tk) => tk.stop());
    };
  }, []);

  function handlePause() {
    startTransition(async () => {
      await pauseAiAction(conversation.id);
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      await resumeAiAction(conversation.id);
      router.refresh();
    });
  }

  function clearAttachment() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || recording) return;

    // Com anexo → envia mídia (legenda = texto digitado).
    if (pendingFile) {
      const file = pendingFile;
      const caption = message;
      const fd = new FormData();
      fd.set("phone", conversation.phone);
      fd.set("caption", caption);
      fd.set("file", file);
      setSendError("");
      setMessage("");
      startTransition(async () => {
        const res = await sendManualMediaAction(fd);
        if (!res.ok) {
          setSendError(res.error ?? "Erro ao enviar.");
          setMessage(caption);
        } else {
          clearAttachment();
          router.refresh();
        }
      });
      return;
    }

    // Sem anexo → texto.
    if (!message.trim()) return;
    const text = message;
    setSendError("");
    setMessage("");
    startTransition(async () => {
      const res = await sendManualReplyAction(conversation.phone, text);
      if (!res.ok) {
        setSendError(res.error ?? "Erro ao enviar.");
        setMessage(text);
      } else {
        router.refresh();
      }
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
  }

  async function startRecording() {
    setSendError("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSendError(t("composer.micUnsupported"));
      return;
    }
    try {
      // WhatsApp aceita mp4/aac e ogg/opus, mas NÃO webm. Se o navegador só grava
      // webm (Chrome desktop), bloqueia antes de gravar — evita enviar um áudio
      // que o WhatsApp recusa. Safari/iOS grava mp4 e funciona.
      const mime = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";
      if (!mime) {
        setSendError(t("composer.micUnsupported"));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/mp4";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type });
        setPendingFile(file);
        stream.getTracks().forEach((tk) => tk.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSecs(0);
      timerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      setSendError(t("composer.micUnsupported"));
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Passagem de bastão: estado da IA + controles */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[11px] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-[2px] min-w-0">
          <div className="flex items-center gap-[8px]">
            <span
              className={[
                "w-2 h-2 rounded-full shrink-0",
                status === "paused" ? "bg-red-400" : status === "with_team" ? "bg-amber-400" : "bg-[#0F6E56]",
              ].join(" ")}
            />
            <span className="text-[12px] font-medium text-[#0F1A2E]">
              {status === "paused"
                ? conversation.handled_by_name
                  ? t("handoff.pausedBy", { name: conversation.handled_by_name })
                  : t("handoff.status.paused")
                : status === "with_team"
                ? t("handoff.status.withTeam")
                : t("handoff.status.active")}
            </span>
          </div>
          <span className="text-[10px] text-[#A09E98] pl-[16px]">
            {status === "paused"
              ? t("handoff.hint.paused")
              : status === "with_team"
              ? t("handoff.hint.withTeam")
              : t("handoff.hint.active")}
          </span>
        </div>

        <div className="flex items-center gap-[8px]">
          {status !== "paused" && (
            <button
              type="button"
              onClick={handlePause}
              disabled={isPending}
              className="flex items-center gap-[6px] text-[11px] font-medium border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-[7px] px-[12px] py-[6px] transition disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              {t("handoff.pause")}
            </button>
          )}
          {status !== "active" && (
            <button
              type="button"
              onClick={handleResume}
              disabled={isPending}
              className="flex items-center gap-[6px] text-[11px] font-medium border border-[#0F6E56]/30 text-[#0F6E56] hover:bg-[#E1F5EE] rounded-[7px] px-[12px] py-[6px] transition disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              {t("handoff.resume")}
            </button>
          )}
        </div>
      </div>

      {/* Chat window */}
      <div className="bg-[#F9F8F5] border border-black/[.07] rounded-[12px] p-[14px] min-h-[300px] h-[52vh] sm:h-auto sm:min-h-[360px] sm:max-h-[520px] overflow-y-auto">
        {conversation.messages.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] text-center mt-[40px]">{t("composer.noMessages")}</p>
        ) : (
          <>
            {conversation.messages.map((msg, i) => (
              <Bubble key={i} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Manual reply form */}
      <form onSubmit={handleSend} className="bg-white border border-black/[.07] rounded-[12px] p-[12px]">
        <div className="flex items-center justify-between mb-[8px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">
            {t("composer.manualReply")}
            {status === "active" && (
              <span className="ml-2 normal-case font-normal">{t("handoff.manualHint")}</span>
            )}
          </p>
          {recording && (
            <span className="flex items-center gap-[6px] text-[11px] font-medium text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {t("composer.recording")} {fmtSecs(recordSecs)}
            </span>
          )}
        </div>

        {/* Preview do anexo pendente */}
        {pendingFile && (
          <div className="flex items-center gap-[10px] bg-[#F4F3EF] rounded-[8px] px-[10px] py-[8px] mb-[8px]">
            {pendingFile.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pendingUrl} alt="" className="w-10 h-10 rounded-[6px] object-cover shrink-0" />
            ) : pendingFile.type.startsWith("audio/") ? (
              <audio controls src={pendingUrl} className="h-8 max-w-[200px]" />
            ) : (
              <div className="w-10 h-10 rounded-[6px] bg-white flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" /><path d="M14 2v6h6" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#0F1A2E] truncate">{pendingFile.name}</p>
              <p className="text-[10px] text-[#A09E98]">{t("composer.attachmentReady")}</p>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              aria-label={t("composer.removeAttachment")}
              className="w-7 h-7 flex items-center justify-center rounded-full text-[#A09E98] hover:bg-black/[.06] transition shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-end gap-[8px]">
          {canAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={attachAccept}
                onChange={onPickFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending || recording}
                aria-label={t("composer.attach")}
                title={t("composer.attach")}
                className="w-10 h-10 flex items-center justify-center rounded-[8px] text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition disabled:opacity-40 shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
            </>
          )}
          {canAudio && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={isPending || !!pendingFile}
              aria-label={recording ? t("composer.stopRecording") : t("composer.recordAudio")}
              title={recording ? t("composer.stopRecording") : t("composer.recordAudio")}
              className={[
                "w-10 h-10 flex items-center justify-center rounded-[8px] transition disabled:opacity-40 shrink-0",
                recording ? "bg-red-500 text-white hover:bg-red-600" : "text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E]",
              ].join(" ")}
            >
              {recording ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={pendingFile ? t("composer.captionPlaceholder") : t("composer.placeholder")}
            className="flex-1 min-w-0 text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={(!message.trim() && !pendingFile) || isPending || recording}
            className="flex items-center gap-[5px] text-[12px] font-medium text-white bg-[#25D366] hover:bg-[#1aad52] disabled:opacity-40 rounded-[8px] px-[14px] py-[8px] transition self-end shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span className="hidden sm:inline">{isPending ? t("composer.sending") : t("composer.send")}</span>
          </button>
        </div>

        {(channel === "instagram" || channel === "messenger") && (
          <p className="text-[10px] text-[#A09E98] mt-[6px]">{t("composer.mediaImageOnlyMeta")}</p>
        )}
        {channel === "sms" && (
          <p className="text-[10px] text-[#A09E98] mt-[6px]">{t("composer.mediaOnlyWhatsapp")}</p>
        )}
        {sendError && <p className="text-[11px] text-red-500 mt-[6px]">{sendError}</p>}
        <p className="text-[10px] text-[#D3D1C7] mt-[6px]">{t("composer.enterHint")}</p>
      </form>
    </div>
  );
}
