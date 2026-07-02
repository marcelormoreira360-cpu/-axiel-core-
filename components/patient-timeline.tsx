/**
 * patient-timeline.tsx
 *
 * Unified reverse-chronological event stream for a patient.
 * Shows all event types (appointments, notes, insights, forms, exams, prescriptions)
 * grouped by month.
 *
 * Pure server component — receives pre-built TimelineEvent[] from the page.
 */

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { TimelineEvent, TimelineEventType } from "@/services/patient-intelligence-service";

const TYPE_ICON: Record<TimelineEventType, string> = {
  appointment:  "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  session_note: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  insight:      "m12 3-1.912 5.813a2 2 0 01-1.275 1.275L3 12l5.813 1.912a2 2 0 011.275 1.275L12 21l1.912-5.813a2 2 0 011.275-1.275L21 12l-5.813-1.912a2 2 0 01-1.275-1.275L12 3Z",
  form:         "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  exam:         "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  prescription: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
};

function formatMonth(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function formatDay(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

interface Props {
  events: TimelineEvent[];
  /** Max events to show before collapsing (default 12) */
  limit?: number;
  /** Bloco de questionários renderizado DENTRO do card da Jornada (superfície única). */
  questionnaires?: React.ReactNode;
}

export function PatientTimeline({ events, limit = 12, questionnaires }: Props) {
  const t = useTranslations("patientPanels.timeline");
  const locale = useLocale();
  const visible = events.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[20px] space-y-[14px]">
        <p className="text-[12px] text-[#A09E98] text-center">{t("empty")}</p>
        {questionnaires && <div className="pt-[14px] border-t border-black/[.06]">{questionnaires}</div>}
      </div>
    );
  }

  // Group by month
  const groups: Map<string, TimelineEvent[]> = new Map();
  for (const ev of visible) {
    const month = formatMonth(ev.date, locale);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(ev);
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-black/[.06]">
        <div>
          <p className="text-[13px] font-medium text-[#0F1A2E]">{t("title")}</p>
          <p className="text-[11px] text-[#A09E98] mt-[1px]">
            {t("count", { count: events.length })}
          </p>
        </div>
        <div className="flex gap-[5px] flex-wrap">
          {(["appointment", "insight", "form", "exam"] as TimelineEventType[]).map((type) => (
            <span
              key={type}
              className="text-[10px] px-[7px] py-[2px] bg-[#F4F3EF] text-[#6B6A66] rounded-full"
            >
              {t(`types.${type}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="px-[16px] py-[14px] space-y-5">
        {Array.from(groups.entries()).map(([month, evts]) => (
          <div key={month}>
            {/* Month header */}
            <p className="text-[10px] font-semibold text-[#A09E98] tracking-[.06em] uppercase mb-3 capitalize">
              {month}
            </p>

            {/* Events */}
            <div className="relative">
              {/* Vertical guide line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-black/[.06] dark:bg-white/[.07]" />

              <div className="space-y-3">
                {evts.map((ev) => {
                  const iconPath = TYPE_ICON[ev.type];
                  const inner = (
                    <div className="flex gap-[12px] group">
                      {/* Dot */}
                      <div className="relative shrink-0 mt-[2px]">
                        <span className={`w-[15px] h-[15px] rounded-full flex items-center justify-center ${ev.dotColor}`}>
                          <svg
                            className="w-[8px] h-[8px] text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d={iconPath} />
                          </svg>
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-[2px]">
                        <div className="flex items-start justify-between gap-2">
                          <p className={[
                            "text-[12px] font-medium text-[#0F1A2E] leading-snug",
                            ev.href ? "group-hover:text-[#0F6E56] dark:group-hover:text-[#9FE1CB] transition-colors" : "",
                          ].join(" ")}>
                            {ev.title}
                          </p>
                          <span className="text-[10px] text-[#A09E98] shrink-0 tabular-nums">
                            {formatDay(ev.date, locale)}
                          </span>
                        </div>
                        {ev.subtitle && (
                          <p className="text-[11px] text-[#6B6A66] mt-[1px] line-clamp-1">{ev.subtitle}</p>
                        )}
                        {ev.badge && (
                          <span className="inline-block mt-[3px] text-[9px] px-[6px] py-[1px] bg-[#F4F3EF] text-[#6B6A66] rounded-full">
                            {ev.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  return ev.href ? (
                    <Link key={ev.id} href={ev.href} className="block hover:bg-[#FAFAF8] dark:hover:bg-white/[.04] -mx-2 px-2 py-[3px] rounded-lg transition">
                      {inner}
                    </Link>
                  ) : (
                    <div key={ev.id} className="-mx-2 px-2 py-[3px]">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {events.length > limit && (
          <p className="text-[11px] text-center text-[#A09E98] pt-1">
            {t("more", { count: events.length - limit })}
          </p>
        )}

        {/* Questionários — dentro do mesmo card da Jornada (superfície única) */}
        {questionnaires && (
          <div className="pt-[14px] border-t border-black/[.06]">{questionnaires}</div>
        )}
      </div>
    </div>
  );
}
