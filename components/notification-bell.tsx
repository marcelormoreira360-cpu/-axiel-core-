"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BrainCircuit, Shield, CalendarClock, UserRoundSearch, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface NotificationCounts {
  insights: number;      // AI insights aguardando review
  lgpd: number;          // Solicitações LGPD pendentes
  followups: number;     // Follow-ups vencidos
  leads: number;         // Novos leads não revisados
  forms: number;         // Formulários enviados não respondidos
}

type NotifKey = keyof NotificationCounts;

const ITEMS: Array<{
  key: NotifKey;
  href: string;
  label: (n: number) => string;
  dot: string;
  Icon: React.ElementType;
}> = [
  { key: "insights",  href: "/ai-insights",    label: (n) => `${n} insight${n > 1 ? "s" : ""} aguardando review`,                            dot: "bg-[#0F6E56]",  Icon: BrainCircuit },
  { key: "lgpd",      href: "/settings/lgpd",  label: (n) => `${n} solicitaç${n > 1 ? "ões" : "ão"} LGPD pendente${n > 1 ? "s" : ""}`,       dot: "bg-red-500",    Icon: Shield },
  { key: "followups", href: "/patients",       label: (n) => `${n} follow-up${n > 1 ? "s" : ""} vencido${n > 1 ? "s" : ""}`,                 dot: "bg-amber-400",  Icon: CalendarClock },
  { key: "leads",     href: "/leads",          label: (n) => `${n} novo${n > 1 ? "s" : ""} lead${n > 1 ? "s" : ""} sem revisão`,              dot: "bg-indigo-400", Icon: UserRoundSearch },
  { key: "forms",     href: "/forms",          label: (n) => `${n} formulário${n > 1 ? "s" : ""} aguardando resposta`,                        dot: "bg-sky-400",    Icon: ClipboardCheck },
];

const EMPTY: NotificationCounts = { insights: 0, lgpd: 0, followups: 0, leads: 0, forms: 0 };

export function NotificationBell() {
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const total = counts.insights + counts.lgpd + counts.followups + counts.leads + counts.forms;
  const badgeLabel = total >= 10 ? "9+" : String(total);

  const fetchCounts = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();

      const [insightsRes, lgpdRes, followupsRes, leadsRes, formsRes] = await Promise.all([
        supabase.from("ai_insights").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
        supabase.from("data_deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_at", now),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new_lead"),
        supabase.from("assessment_invitations").select("id", { count: "exact", head: true }).is("completed_at", null),
      ]);

      setCounts({
        insights: insightsRes.count ?? 0,
        lgpd: lgpdRes.count ?? 0,
        followups: followupsRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        forms: formsRes.count ?? 0,
      });
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("notification-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_insights" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "data_deletion_requests" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_invitations" }, fetchCounts)
      .subscribe();

    const id = setInterval(fetchCounts, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [fetchCounts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-black/[.06] dark:hover:bg-white/[.08] transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-[15px] h-[15px] text-[#0F1A2E] dark:text-[#E8E6E2]" strokeWidth={1.8} />
        {total > 0 && (
          <span className="absolute -top-[3px] -right-[3px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-[3px] leading-none pointer-events-none">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-[#0B0F17] border border-black/[.07] dark:border-white/[.08] rounded-[12px] shadow-lg overflow-hidden min-w-[240px]">
          <div className="px-[14px] py-[10px] border-b border-black/[.05] dark:border-white/[.06]">
            <p className="text-[11px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">Notificações</p>
            {total > 0 && (
              <p className="text-[10px] text-[#A09E98] mt-[1px]">
                {total} ite{total === 1 ? "m" : "ns"} requer{total === 1 ? "" : "em"} atenção
              </p>
            )}
          </div>
          <div className="py-[6px]">
            {total === 0 ? (
              <p className="px-[14px] py-[10px] text-[12px] text-[#A09E98] dark:text-[#6B6A66]">Tudo em ordem por aqui ✓</p>
            ) : (
              ITEMS.filter((item) => counts[item.key] > 0).map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-[10px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] px-[14px] py-[9px] transition-colors"
                >
                  <div className={`w-[6px] h-[6px] rounded-full shrink-0 ${item.dot}`} />
                  <item.Icon className="w-[13px] h-[13px] text-[#6B6A66] dark:text-[#A09E98] shrink-0" />
                  <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] leading-tight">
                    {item.label(counts[item.key])}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
