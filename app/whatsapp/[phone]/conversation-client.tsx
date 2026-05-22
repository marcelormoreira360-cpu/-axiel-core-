"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WaConversation } from "@/services/whatsapp-conversation-service";
import { toggleBotAction, sendManualReplyAction } from "@/app/whatsapp/actions";

interface Props {
  conversation: WaConversation;
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  const isManual = content.startsWith("[MANUAL]");
  const text = content.replace(/^\[MANUAL\]\s?/, "");

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-[6px]`}>
      <div
        className={[
          "max-w-[75%] rounded-[12px] px-[12px] py-[9px] text-[13px] leading-relaxed",
          isUser
            ? "bg-white border border-black/[.07] text-[#0F1A2E] rounded-tl-[3px]"
            : isManual
            ? "bg-amber-500 text-white rounded-tr-[3px]"
            : "bg-[#0F6E56] text-white rounded-tr-[3px]",
        ].join(" ")}
      >
        {isManual && (
          <span className="text-[9px] font-semibold uppercase tracking-wider block mb-[3px] opacity-80">
            Enviado manualmente
          </span>
        )}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export function WhatsAppConversationClient({ conversation }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  function handleToggleBot() {
    startTransition(async () => {
      await toggleBotAction(conversation.id, conversation.bot_disabled);
      router.refresh();
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || isPending) return;
    setSendError("");
    const text = message;
    setMessage("");
    startTransition(async () => {
      const res = await sendManualReplyAction(conversation.phone, text);
      if (!res.ok) {
        setSendError(res.error ?? "Erro ao enviar.");
        setMessage(text); // restore
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[12px]">

      {/* Status bar + actions */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[11px] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-[8px]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${conversation.bot_disabled ? "bg-amber-400" : "bg-[#0F6E56]"}`}
          />
          <span className="text-[12px] font-medium text-[#0F1A2E]">
            {conversation.bot_disabled
              ? `Atendimento humano${conversation.handled_by_name ? ` — ${conversation.handled_by_name}` : ""}`
              : "Bot respondendo automaticamente"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleBot}
          disabled={isPending}
          className={[
            "flex items-center gap-[6px] text-[11px] font-medium border rounded-[7px] px-[12px] py-[6px] transition disabled:opacity-50",
            conversation.bot_disabled
              ? "border-[#0F6E56]/30 text-[#0F6E56] hover:bg-[#E1F5EE]"
              : "border-amber-200 text-amber-600 hover:bg-amber-50",
          ].join(" ")}
        >
          {conversation.bot_disabled ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              Reativar bot
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Assumir atendimento
            </>
          )}
        </button>
      </div>

      {/* Chat window */}
      <div className="bg-[#F9F8F5] border border-black/[.07] rounded-[12px] p-[14px] min-h-[360px] max-h-[520px] overflow-y-auto">
        {conversation.messages.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] text-center mt-[40px]">
            Sem mensagens ainda.
          </p>
        ) : (
          <>
            {conversation.messages.map((msg, i) => (
              <Bubble key={i} role={msg.role} content={msg.content} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Manual reply form */}
      <form onSubmit={handleSend} className="bg-white border border-black/[.07] rounded-[12px] p-[12px]">
        <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[8px]">
          Resposta manual
          {!conversation.bot_disabled && (
            <span className="ml-2 normal-case font-normal">
              (bot continuará respondendo — assuma o atendimento para parar o bot)
            </span>
          )}
        </p>
        <div className="flex gap-[8px]">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Digite sua mensagem..."
            className="flex-1 text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!message.trim() || isPending}
            className="flex items-center gap-[5px] text-[12px] font-medium text-white bg-[#25D366] hover:bg-[#1aad52] disabled:opacity-40 rounded-[8px] px-[14px] py-[8px] transition self-end"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {isPending ? "…" : "Enviar"}
          </button>
        </div>
        {sendError && (
          <p className="text-[11px] text-red-500 mt-[6px]">{sendError}</p>
        )}
        <p className="text-[10px] text-[#D3D1C7] mt-[6px]">Enter para enviar · Shift+Enter para nova linha</p>
      </form>

    </div>
  );
}
