"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
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
  dot: string;
  Icon: React.ElementType;
}> = [
  { key: "insights",  href: "/actions",        dot: "bg-[#0F6E56]",  Icon: BrainCircuit },
  { key: "lgpd",      href: "/settings/lgpd",  dot: "bg-red-500",    Icon: Shield },
  { key: "followups", href: "/patients",       dot: "bg-amber-400",  Icon: CalendarClock },
  { key: "leads",     href: "/leads",          dot: "bg-indigo-400", Icon: UserRoundSearch },
  { key: "forms",     href: "/forms",          dot: "bg-sky-400",    Icon: ClipboardCheck },
];

const EMPTY: NotificationCounts = { insights: 0, lgpd: 0, followups: 0, leads: 0, forms: 0 };

// Largura fixa do painel — usada para posicionar o dropdown dentro da viewport.
const MENU_WIDTH = 260;
const GAP = 8;

export function NotificationBell() {
  const t = useTranslations("nav.notifications");
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Posição calculada do painel (fixed, relativa à viewport) + direção de abertura.
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const total = counts.insights + counts.lgpd + counts.followups + counts.leads + counts.forms;
  const badgeLabel = total >= 10 ? "9+" : String(total);

  useEffect(() => setMounted(true), []);

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
    // Use a unique channel name per mount to avoid "cannot add callbacks after subscribe()"
    // which happens when React remounts the component and the previous channel is still subscribed.
    const channelName = `notification-bell-${Date.now()}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "ai_insights" }, fetchCounts)
        .on("postgres_changes", { event: "*", schema: "public", table: "data_deletion_requests" }, fetchCounts)
        .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, fetchCounts)
        .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchCounts)
        .on("postgres_changes", { event: "*", schema: "public", table: "assessment_invitations" }, fetchCounts)
        .subscribe();
    } catch {
      /* Realtime not available — polling via setInterval is the fallback */
    }

    const id = setInterval(fetchCounts, 60_000);

    return () => {
      if (channel) supabase.removeChannel(channel).catch(() => {});
      clearInterval(id);
    };
  }, [fetchCounts]);

  // Calcula a posição do painel ancorada no botão, mantendo-o dentro da viewport.
  // Abre para cima quando não há espaço abaixo (ex.: sino no rodapé da sidebar) e
  // alinha à esquerda do botão quando alinhar à direita jogaria o painel para fora
  // (ex.: sidebar estreita à esquerda da tela).
  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - r.bottom;
    const openUp = spaceBelow < 300 && r.top > spaceBelow;

    let left = r.right - MENU_WIDTH; // alinhado à direita do botão (padrão topbar)
    if (left < GAP) left = r.left;   // sem espaço à esquerda → alinha à esquerda do botão
    left = Math.max(GAP, Math.min(left, vw - MENU_WIDTH - GAP));

    setPos({ top: openUp ? r.top : r.bottom, left, openUp });
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) updatePosition();
      return next;
    });
  }

  // Reposiciona enquanto aberto (scroll/resize) para nunca ficar fora da tela.
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updatePosition]);

  // Fecha ao clicar fora (considerando o botão e o painel, que fica em portal).
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-black/[.06] dark:hover:bg-white/[.08] transition-colors"
        aria-label={t("aria")}
      >
        <Bell className="w-[15px] h-[15px] text-[#0F1A2E] dark:text-[#E8E6E2]" strokeWidth={1.8} />
        {total > 0 && (
          <span className="absolute -top-[3px] -right-[3px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-[3px] leading-none pointer-events-none">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: MENU_WIDTH,
            transform: pos.openUp ? `translateY(calc(-100% - ${GAP}px))` : `translateY(${GAP}px)`,
            zIndex: 100,
          }}
          className="bg-white dark:bg-[#0B0F17] border border-black/[.07] dark:border-white/[.08] rounded-[12px] shadow-lg overflow-hidden"
        >
          <div className="px-[14px] py-[10px] border-b border-black/[.05] dark:border-white/[.06]">
            <p className="text-[11px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</p>
            {total > 0 && (
              <p className="text-[10px] text-[#A09E98] mt-[1px]">
                {t("attention", { count: total })}
              </p>
            )}
          </div>
          <div className="py-[6px]">
            {total === 0 ? (
              <p className="px-[14px] py-[10px] text-[12px] text-[#A09E98] dark:text-[#6B6A66]">{t("allClear")}</p>
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
                    {t(item.key, { count: counts[item.key] })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
