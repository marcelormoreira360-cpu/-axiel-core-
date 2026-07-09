"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Appointment } from "@/lib/types";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
import {
  formatTime,
  getMonthGrid,
  isSameDay,
} from "@/modules/schedule/date-utils";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// ─── Month view ───────────────────────────────────────────────────────────────

export function MonthView({
  appointments,
  navDate,
  onDayClick,
}: {
  appointments: Appointment[];
  navDate: Date;
  onDayClick: (date: Date) => void;
}) {
  const t            = useTranslations("schedule.calendar");
  const locale       = useLocale();
  const today        = new Date();
  const cells        = useMemo(() => getMonthGrid(navDate), [navDate]);
  const currentMonth = navDate.getMonth();

  return (
    <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-black/[.07] dark:border-white/[.07]">
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="py-[8px] text-center text-[9px] font-medium tracking-[.08em] uppercase text-[#A09E98] border-r border-black/[.05] dark:border-white/[.05] last:border-r-0"
          >
            {t(`weekdays.${key}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const dayAppts       = getAppointmentsForDay(appointments, date);
          const isToday        = isSameDay(date, today);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isLastRow      = i >= cells.length - 7;

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDayClick(date)}
              className={[
                "flex flex-col items-start p-[8px] min-h-[88px] border-r border-black/[.05] dark:border-white/[.05] last:border-r-0 text-left transition hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]",
                !isLastRow ? "border-b border-black/[.05] dark:border-white/[.05]" : "",
                isToday ? "bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12]" : "",
                !isCurrentMonth ? "opacity-35" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full mb-[4px]",
                  isToday ? "bg-[#0F6E56] text-white" : "text-[#0F1A2E] dark:text-[#E8E6E2]",
                ].join(" ")}
              >
                {date.getDate()}
              </span>
              {dayAppts.slice(0, 3).map((appt) => (
                <span
                  key={appt.id}
                  className="text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] rounded-[3px] px-[4px] py-[1px] mb-[2px] truncate w-full"
                >
                  {formatTime(appt.starts_at, locale)}{" "}
                  {appt.patients?.full_name?.split(" ")[0]}
                </span>
              ))}
              {dayAppts.length > 3 && (
                <span className="text-[9px] text-[#A09E98]">
                  +{dayAppts.length - 3} mais
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
