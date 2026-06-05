"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { refreshDashboardData } from "@/app/dashboard/actions";
import { sessionsDelta, revenueDelta } from "@/modules/dashboard/dashboard-kpis-utils";
import type { DashboardKPIs } from "@/modules/dashboard/dashboard-kpis";
import { useFormatMoney } from "@/components/currency-provider";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clinicId: string;
  initialKpis: DashboardKPIs;
  initialTodayCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DeltaIcon({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  if (current > previous) return <ArrowUp className="w-[10px] h-[10px] text-[#0F6E56]" />;
  if (current < previous) return <ArrowDown className="w-[10px] h-[10px] text-[#DC2626]" />;
  return <Minus className="w-[10px] h-[10px] text-[#A09E98]" />;
}

function deltaColor(current: number, previous: number) {
  if (previous === 0) return "text-[#A09E98]";
  if (current > previous) return "text-[#0F6E56]";
  if (current < previous) return "text-[#DC2626]";
  return "text-[#A09E98]";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardRealtimeKpis({ clinicId, initialKpis, initialTodayCount }: Props) {
  const money = useFormatMoney();
  const t = useTranslations("dashboard.kpis");
  const locale = useLocale();
  const [kpis, setKpis] = useState<DashboardKPIs>(initialKpis);
  const [todayCount, setTodayCount] = useState(initialTodayCount);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce rapid bursts (e.g. batch inserts) — wait 1.5s after the last event
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await refreshDashboardData(clinicId);
          setKpis(data.kpis);
          setTodayCount(data.todayCount);
          setLastUpdated(new Date());
        } catch {
          // Silent — stale data is acceptable; don't interrupt the user
        }
      });
    }, 1500);
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Subscribe to appointment changes for this clinic
    const channel = supabase
      .channel(`dashboard-kpis-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_payments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[14px]">
      {/* ── Sessões hoje ── */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[14px] py-[13px]">
        <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("today")}</p>
        <p className={`text-[22px] font-semibold tracking-[-0.03em] leading-none transition-opacity ${isPending ? "opacity-50" : ""} ${todayCount > 0 ? "text-[#0F6E56]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
          {todayCount}
        </p>
        <p className="text-[10px] text-[#A09E98] mt-[4px]">
          {t("todayCount", { count: todayCount })}
        </p>
      </div>

      {/* ── Sessões do mês ── */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[14px] py-[13px]">
        <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("month")}</p>
        <p className={`text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E] dark:text-[#E8E6E2] transition-opacity ${isPending ? "opacity-50" : ""}`}>
          {kpis.sessionsThisMonth}
        </p>
        <div className="flex items-center gap-[3px] mt-[4px]">
          <DeltaIcon current={kpis.sessionsThisMonth} previous={kpis.sessionsLastMonth} />
          <p className={`text-[10px] ${deltaColor(kpis.sessionsThisMonth, kpis.sessionsLastMonth)}`}>
            {sessionsDelta(kpis.sessionsThisMonth, kpis.sessionsLastMonth)}
          </p>
        </div>
      </div>

      {/* ── Receita do mês ── */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[14px] py-[13px]">
        <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("revenue")}</p>
        <p className={`text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E] dark:text-[#E8E6E2] transition-opacity ${isPending ? "opacity-50" : ""}`}>
          {money(kpis.revenueThisMonth)}
        </p>
        <div className="flex items-center gap-[3px] mt-[4px]">
          <DeltaIcon current={kpis.revenueThisMonth} previous={kpis.revenueLastMonth} />
          <p className={`text-[10px] ${deltaColor(kpis.revenueThisMonth, kpis.revenueLastMonth)}`}>
            {revenueDelta(kpis.revenueThisMonth, kpis.revenueLastMonth)}
          </p>
        </div>
      </div>

      {/* ── Taxa de retorno ── */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[14px] py-[13px]">
        <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("returnRate")}</p>
        <p className={`text-[22px] font-semibold tracking-[-0.03em] leading-none transition-opacity ${isPending ? "opacity-50" : ""} ${kpis.returnRate >= 60 ? "text-[#0F6E56]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
          {kpis.returnRate}%
        </p>
        <p className="text-[10px] text-[#A09E98] mt-[4px]">
          {t("returnBase", { count: kpis.returnRateBase })}
        </p>
      </div>

      {/* ── Last updated indicator ── */}
      {lastUpdated && (
        <div className="col-span-2 lg:col-span-4 flex justify-end">
          <span className="text-[10px] text-[#A09E98]">
            {t("updatedAt", { time: lastUpdated.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) })}
          </span>
        </div>
      )}
    </div>
  );
}
