"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle, Search, Loader2, RefreshCw } from "lucide-react";
import type { InboxConversation } from "@/app/api/inbox/route";

function truncate(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface InboxClientProps {
  initialConversations: InboxConversation[];
}

export function InboxClient({ initialConversations }: InboxClientProps) {
  const t = useTranslations("clinicChat.inbox");
  const locale = useLocale();
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      /* silent */
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(() => fetchConversations(), 30_000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.patientName.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);

    if (mins < 1)   return t("now");
    if (mins < 60)  return t("minutesShort", { n: mins });
    if (hours < 24) return t("hoursShort", { n: hours });
    if (days < 7)   return t("daysShort", { n: days });
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F1A2E] flex items-center gap-2">
            {t("title")}
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-[#0F6E56] text-white text-[10px] font-bold px-1.5">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-xs text-black/40 mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => fetchConversations(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-black/[.10] dark:border-white/[.10] px-3 py-1.5 text-xs text-black/50 hover:bg-black/[.04] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-xl border border-black/[.10] dark:border-white/[.10] pl-9 pr-3 py-2.5 text-sm text-[#0F1A2E] placeholder:text-black/30 focus:outline-none focus:border-black/25 bg-white"
        />
      </div>

      {/* Conversation list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[#0F6E56]/10 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F1A2E]">
              {search ? t("emptySearchTitle") : t("emptyTitle")}
            </p>
            <p className="text-xs text-black/40 mt-0.5">
              {search ? t("emptySearchHint") : t("emptyHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conv) => (
            <Link
              key={conv.patientId}
              href={`/patients/${conv.patientId}/messages`}
              className="group flex items-start gap-3 rounded-2xl border border-transparent p-4 transition hover:bg-white hover:border-black/[.07] hover:shadow-sm"
            >
              {/* Avatar */}
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#0F6E56]/10 flex items-center justify-center">
                <span className="text-[13px] font-semibold text-[#0F6E56]">
                  {conv.patientName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[13px] truncate ${conv.unreadCount > 0 ? "font-semibold text-[#0F1A2E]" : "font-medium text-[#0F1A2E]"}`}>
                    {conv.patientName}
                  </span>
                  <span className="shrink-0 text-[11px] text-black/35">
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-[12px] truncate ${conv.unreadCount > 0 ? "text-[#0F1A2E]" : "text-black/45"}`}>
                    {conv.lastDirection === "clinic_to_patient" && (
                      <span className="text-black/30">{t("you")}{" "}</span>
                    )}
                    {truncate(conv.lastMessage)}
                  </p>

                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 flex items-center justify-center h-[18px] min-w-[18px] rounded-full bg-[#0F6E56] text-white text-[10px] font-bold px-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] text-black/25 mt-6">
        {t("autoRefresh")}
      </p>
    </div>
  );
}
