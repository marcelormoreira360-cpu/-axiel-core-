"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface NotificationCounts {
  insights: number;
  lgpd: number;
}

export function NotificationBell() {
  const [counts, setCounts] = useState<NotificationCounts>({ insights: 0, lgpd: 0 });
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const total = counts.insights + counts.lgpd;
  const badgeLabel = total >= 10 ? "9+" : String(total);

  async function fetchCounts() {
    try {
      const supabase = createSupabaseBrowserClient();
      const [insightsRes, lgpdRes] = await Promise.all([
        supabase
          .from("ai_insights")
          .select("id", { count: "exact", head: true })
          .eq("review_status", "pending"),
        supabase
          .from("data_deletion_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setCounts({
        insights: insightsRes.count ?? 0,
        lgpd: lgpdRes.count ?? 0,
      });
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
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
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-[#0B0F17] border border-black/[.07] dark:border-white/[.08] rounded-[12px] shadow-lg p-2 min-w-[220px]">
          {total === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[#A09E98] dark:text-[#6B6A66]">
              Nenhuma notificação pendente
            </p>
          ) : (
            <>
              {counts.insights > 0 && (
                <Link
                  href="/ai-insights"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] rounded-[8px] px-3 py-2 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] shrink-0" />
                  {counts.insights} insight{counts.insights > 1 ? "s" : ""} aguardando review
                </Link>
              )}
              {counts.lgpd > 0 && (
                <Link
                  href="/settings/lgpd"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] rounded-[8px] px-3 py-2 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {counts.lgpd} solicitaç{counts.lgpd > 1 ? "ões" : "ão"} LGPD pendente{counts.lgpd > 1 ? "s" : ""}
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
