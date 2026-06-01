"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Appointment } from "@/lib/types";

interface Props {
  appointments: Appointment[];
  date?: Date;
}

const STATUS_CONFIG: Record<
  string,
  { dot: string; bg: string; text: string }
> = {
  scheduled:  { dot: "bg-[#A09E98]", bg: "bg-[#F4F3EF]",        text: "text-[#6B6A66]" },
  confirmed:  { dot: "bg-[#2D8CFF]", bg: "bg-[#2D8CFF]/[.10]",  text: "text-[#2563EB]" },
  completed:  { dot: "bg-[#0F6E56]", bg: "bg-[#E1F5EE]",        text: "text-[#0F6E56]" },
  cancelled:  { dot: "bg-[#DC2626]", bg: "bg-[#DC2626]/[.08]",  text: "text-[#DC2626]" },
  no_show:    { dot: "bg-amber-400",  bg: "bg-amber-50",          text: "text-amber-600" },
};

function fmt(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#E1F5EE] text-[#0F6E56]",
  "bg-[#EFF6FF] text-[#2563EB]",
  "bg-[#FEF3C7] text-amber-700",
  "bg-[#F3E8FF] text-purple-700",
  "bg-[#FCE7F3] text-pink-700",
];

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function TodayAgenda({ appointments, date }: Props) {
  const t = useTranslations("dashboard.agenda");
  const tStatus = useTranslations("common.appointmentStatus");
  const locale = useLocale();
  const target = date ?? new Date();
  const targetStr = target.toDateString();

  const todayAppts = appointments
    .filter((a) => new Date(a.starts_at).toDateString() === targetStr)
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

  const completed = todayAppts.filter((a) => a.status === "completed").length;
  const total = todayAppts.length;

  const dateLabel = target.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-[16px] pt-[15px] pb-[12px] border-b border-black/[.05] dark:border-white/[.06]">
        <div>
          <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">
            {t("title")}
          </p>
          <p className="text-[10px] text-[#A09E98] mt-[1px] capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[10px] font-medium text-[#A09E98]">
              {completed}/{total}
            </span>
          )}
          <Link
            href="/schedule"
            className="text-[11px] font-medium text-[#0F6E56] hover:underline"
          >
            {t("viewSchedule")}
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-[2px] bg-[#F4F3EF] dark:bg-white/[.06] mx-[16px]">
          <div
            className="h-full bg-[#0F6E56] transition-all duration-500 rounded-full"
            style={{ width: `${Math.round((completed / total) * 100)}%` }}
          />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/[.04] dark:divide-white/[.04]">
        {todayAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[40px] px-[20px] text-center">
            <div className="w-10 h-10 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
            <Link
              href="/schedule/new"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline mt-[10px]"
            >
              {t("createSession")}
            </Link>
          </div>
        ) : (
          todayAppts.map((appt) => {
            const patientName =
              (Array.isArray(appt.patients)
                ? appt.patients[0]
                : appt.patients)?.full_name ?? t("patientFallback");
            const sessionType =
              (Array.isArray(appt.session_types)
                ? appt.session_types[0]
                : appt.session_types)?.name ?? null;
            const status = appt.status ?? "scheduled";
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;

            return (
              <Link
                key={appt.id}
                href={`/schedule/${appt.id}/session`}
                className="flex items-center gap-[10px] px-[14px] py-[11px] hover:bg-[#FAFAF8] dark:hover:bg-white/[.03] transition group"
              >
                {/* Time */}
                <span className="text-[11px] font-medium text-[#A09E98] min-w-[38px] shrink-0">
                  {fmt(appt.starts_at, locale)}
                </span>

                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${avatarColor(patientName)}`}
                >
                  {initials(patientName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">
                    {patientName}
                  </p>
                  {sessionType && (
                    <p className="text-[10px] text-[#A09E98] truncate mt-[1px]">
                      {sessionType} · {t("minutes", { count: appt.duration_minutes })}
                    </p>
                  )}
                  {!sessionType && (
                    <p className="text-[10px] text-[#A09E98]">
                      {t("minutes", { count: appt.duration_minutes })}
                    </p>
                  )}
                </div>

                {/* Status */}
                <span
                  className={`text-[10px] font-medium px-[8px] py-[3px] rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}
                >
                  {tStatus(status)}
                </span>

                {/* Arrow */}
                <svg
                  className="w-3 h-3 text-[#D3D1C7] group-hover:text-[#A09E98] transition shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      {todayAppts.length > 0 && (
        <div className="border-t border-black/[.04] dark:border-white/[.04] px-[14px] py-[10px]">
          <Link
            href="/schedule/new"
            className="flex items-center gap-[6px] text-[11px] font-medium text-[#0F6E56] hover:underline"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("newSession")}
          </Link>
        </div>
      )}
    </div>
  );
}
