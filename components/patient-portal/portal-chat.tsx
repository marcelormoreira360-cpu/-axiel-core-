"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Send, Loader2, MessageCircle } from "lucide-react";

interface PortalMessage {
  id: string;
  direction: "clinic_to_patient" | "patient_to_clinic";
  body: string;
  read_at: string | null;
  created_at: string;
}

interface PortalChatProps {
  rawToken: string;
  brandColor: string;
  patientName: string;
}

type ChatT = (k: string) => string;

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(iso: string, locale: string, t: ChatT) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return t("today");
  if (d.toDateString() === yesterday.toDateString()) return t("yesterday");
  return d.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

export function PortalChat({ rawToken, brandColor, patientName }: PortalChatProps) {
  const t = useTranslations("portal.chat");
  const locale = useLocale();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/p/messages?token=${encodeURIComponent(rawToken)}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* silent */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [rawToken]);

  // Initial load + 30s polling
  useEffect(() => {
    fetchMessages();

    pollingRef.current = setInterval(() => {
      fetchMessages(true);
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // Optimistic update
    const optimistic: PortalMessage = {
      id: `opt-${Date.now()}`,
      direction: "patient_to_clinic",
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch("/api/p/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("errSend"));
        // Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
        return;
      }

      // Replace optimistic with real message
      const { message: real } = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
    } catch {
      setError(t("errConn"));
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

  // Group messages by date
  const grouped: { date: string; msgs: PortalMessage[] }[] = [];
  for (const msg of messages) {
    const label = formatDateGroup(msg.created_at, locale, t);
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: label, msgs: [msg] });
    }
  }

  const clinic = patientName; // we use patientName as display reference; clinic is "them"

  return (
    <div className="flex flex-col h-[420px]">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-black/30">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}18` }}>
              <MessageCircle className="h-5 w-5" style={{ color: brandColor }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F1A2E]">{t("emptyTitle")}</p>
              <p className="text-xs text-black/40 mt-0.5">{t("emptyDesc")}</p>
            </div>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-black/[.06]" />
                <span className="text-[10px] text-black/30 font-medium">{date}</span>
                <div className="flex-1 h-px bg-black/[.06]" />
              </div>

              {msgs.map((msg) => {
                const isPatient = msg.direction === "patient_to_clinic";
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-1.5 ${isPatient ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        isPatient
                          ? "rounded-br-md text-white"
                          : "rounded-bl-md bg-black/[.05] text-[#0F1A2E]",
                      ].join(" ")}
                      style={isPatient ? { backgroundColor: brandColor } : undefined}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <p
                        className={[
                          "text-[10px] mt-1 text-right",
                          isPatient ? "text-white/60" : "text-black/30",
                        ].join(" ")}
                      >
                        {formatTime(msg.created_at, locale)}
                        {isPatient && msg.read_at && (
                          <span className="ml-1">✓✓</span>
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
        <p className="text-xs text-red-500 px-1 pb-1">{error}</p>
      )}

      {/* Input area */}
      <div className="border-t border-black/[.07] pt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-xl border border-black/[.10] px-3 py-2.5 text-sm text-[#0F1A2E] placeholder:text-black/30 focus:outline-none focus:border-black/25 leading-relaxed"
          style={{ minHeight: "42px", maxHeight: "120px" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 h-[42px] w-[42px] rounded-xl flex items-center justify-center transition disabled:opacity-40"
          style={{ backgroundColor: brandColor }}
          aria-label={t("sendAria")}
        >
          {sending
            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
            : <Send className="h-4 w-4 text-white" />
          }
        </button>
      </div>
    </div>
  );
}
