"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";

interface PortalMessage {
  id: string;
  direction: "clinic_to_patient" | "patient_to_clinic";
  body: string;
  read_at: string | null;
  created_by: string | null;
  created_at: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

interface ClinicChatProps {
  patientId: string;
  patientName: string;
}

export function ClinicChat({ patientId, patientName }: ClinicChatProps) {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/messages/${patientId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* silent */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchMessages();
    pollingRef.current = setInterval(() => fetchMessages(true), 30_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const optimistic: PortalMessage = {
      id: `opt-${Date.now()}`,
      direction: "clinic_to_patient",
      body: text,
      read_at: null,
      created_by: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch(`/api/messages/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao enviar mensagem.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
        return;
      }

      const { message: real } = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
    } catch {
      setError("Erro de conexão.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group by date
  const grouped: { date: string; msgs: PortalMessage[] }[] = [];
  for (const msg of messages) {
    const label = formatDateGroup(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: label, msgs: [msg] });
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-black/[.07] p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-black/30">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div className="w-10 h-10 rounded-full bg-[#0F6E56]/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-[#0F6E56]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F1A2E]">Nenhuma mensagem ainda</p>
              <p className="text-xs text-black/40 mt-0.5">
                Inicie a conversa — o paciente verá no portal
              </p>
            </div>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-black/[.06]" />
                <span className="text-[10px] text-black/30 font-medium">{date}</span>
                <div className="flex-1 h-px bg-black/[.06]" />
              </div>

              {msgs.map((msg) => {
                const isClinic = msg.direction === "clinic_to_patient";
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-1.5 ${isClinic ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        isClinic
                          ? "rounded-br-md bg-[#0F1A2E] text-white"
                          : "rounded-bl-md bg-black/[.05] text-[#0F1A2E]",
                      ].join(" ")}
                    >
                      {!isClinic && (
                        <p className="text-[10px] font-semibold text-[#0F6E56] mb-0.5">
                          {patientName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <p
                        className={[
                          "text-[10px] mt-1 text-right",
                          isClinic ? "text-white/50" : "text-black/30",
                        ].join(" ")}
                      >
                        {formatTime(msg.created_at)}
                        {isClinic && msg.read_at && (
                          <span className="ml-1 text-[#0F6E56]">✓✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 px-1 pt-1">{error}</p>
      )}

      {/* Input */}
      <div className="pt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Mensagem para ${patientName}…`}
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-xl border border-black/[.10] px-3 py-2.5 text-sm text-[#0F1A2E] placeholder:text-black/30 focus:outline-none focus:border-black/25 leading-relaxed bg-white"
          style={{ minHeight: "42px", maxHeight: "120px" }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 h-[42px] w-[42px] rounded-xl flex items-center justify-center bg-[#0F1A2E] transition hover:bg-black disabled:opacity-40"
          aria-label="Enviar"
        >
          {sending
            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
            : <Send className="h-4 w-4 text-white" />
          }
        </button>
      </div>

      <p className="text-[10px] text-black/25 text-center pt-2">
        Enter para enviar · Shift+Enter para nova linha · atualiza a cada 30s
      </p>
    </div>
  );
}
