"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { X, User, FileText, CalendarDays, Video } from "lucide-react";
import type { ScheduleSession } from "@/components/session-card";
import { formatTime } from "@/modules/schedule/date-utils";

const STATUS_OPTS = [
  { value: "confirmed",  labelKey: "actionConfirm",  cls: "border-[#2D8CFF]/30 text-[#2563EB] hover:bg-[#EFF6FF]" },
  { value: "completed",  labelKey: "actionComplete", cls: "border-[#0F6E56]/30 text-[#0F6E56] hover:bg-[#E1F5EE]" },
  { value: "cancelled",  labelKey: "actionCancel",   cls: "border-red-200 text-red-500 hover:bg-red-50" },
] as const;

const STATUS_BADGE_CLS: Record<string, string> = {
  scheduled: "bg-[#F4F3EF] dark:bg-white/[.06] text-[#6B6A66] dark:text-[#9E9C97]",
  confirmed: "bg-[#EFF6FF] text-[#2563EB]",
  completed: "bg-[#E1F5EE] text-[#0F6E56]",
  cancelled: "bg-red-50 text-red-500",
  no_show:   "bg-amber-50 text-amber-600",
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function SessionDrawer({
  session,
  onClose,
  updateStatusAction,
}: {
  session: ScheduleSession | null;
  onClose: () => void;
  updateStatusAction?: (id: string, status: string) => Promise<void>;
}) {
  const t = useTranslations("schedule.drawer");
  const tStatus = useTranslations("common.appointmentStatus");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  if (!session) return null;

  const patientName = session.patients?.full_name ?? t("patientFallback");
  const sessionCount = session.previousSessions.length + 1;
  const currentStatus = optimisticStatus ?? session.status ?? "scheduled";
  const badgeCls = STATUS_BADGE_CLS[currentStatus] ?? STATUS_BADGE_CLS.scheduled;

  function handleStatusChange(newStatus: string) {
    if (!updateStatusAction) return;
    setOptimisticStatus(newStatus);
    startTransition(async () => {
      await updateStatusAction(session!.id, newStatus);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1A2E]/20 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <aside className="relative w-full max-w-[380px] h-full bg-white dark:bg-[#111827] border-l border-black/[.07] dark:border-white/[.07] shadow-xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[16px] border-b border-black/[.07] dark:border-white/[.07]">
          <div className="flex items-start justify-between gap-3 mb-[14px]">
            <p className="text-[10px] font-medium tracking-[.10em] uppercase text-[#A09E98]">{t("title")}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Patient */}
          <div className="flex items-center gap-[12px]">
            <div className="w-11 h-11 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[14px] font-medium text-[#0F6E56] shrink-0">
              {initials(patientName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[16px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] tracking-[-0.02em]">{patientName}</p>
                <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ${badgeCls}`}>
                  {tStatus(currentStatus)}
                </span>
              </div>
              <p className="text-[12px] text-[#A09E98] mt-[1px]">
                {t("meta", { count: sessionCount, time: formatTime(session.starts_at, locale), minutes: session.duration_minutes })}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-[20px] py-[16px] space-y-[12px]">
          {/* Notes preview */}
          {session.notes && (
            <div className="bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.06] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[4px]">{t("noteTitle")}</p>
              <p className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] leading-relaxed line-clamp-3">{session.notes}</p>
            </div>
          )}

          {/* Previous sessions */}
          {session.previousSessions.length > 0 && (
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[8px]">{t("prevSessions")}</p>
              <div className="space-y-[6px]">
                {session.previousSessions.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">
                      {new Date(item.starts_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[11px] text-[#A09E98]">{t("minutes", { count: item.duration_minutes })}</span>
                  </div>
                ))}
                {session.previousSessions.length > 4 && (
                  <p className="text-[10px] text-[#D3D1C7]">{t("morePrev", { count: session.previousSessions.length - 4 })}</p>
                )}
              </div>
            </div>
          )}

          {session.previousSessions.length === 0 && (
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[11px] text-[#D3D1C7]">{t("firstSession")}</p>
            </div>
          )}

          {/* AI insight */}
          {session.snapshot?.latest_insight_summary && session.snapshot.latest_insight_status !== "Not ready" && (
            <div className="bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12] border border-[#0F6E56]/15 rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#0F6E56] mb-[4px]">{t("latestInsight")}</p>
              <p className="text-[11px] text-[#085041] dark:text-[#9FE1CB] leading-relaxed line-clamp-4">
                {session.snapshot.latest_insight_summary}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-[20px] pb-[20px] pt-[4px] space-y-[8px] border-t border-black/[.07] dark:border-white/[.07]">

          {/* Status change buttons */}
          {updateStatusAction && currentStatus !== "completed" && (
            <div className="flex gap-[6px] flex-wrap">
              {STATUS_OPTS.filter((o) => o.value !== currentStatus).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isPending}
                  className={`flex-1 min-w-[80px] text-[11px] font-medium border rounded-[7px] px-[8px] py-[7px] transition disabled:opacity-50 ${opt.cls}`}
                >
                  {isPending ? "…" : t(opt.labelKey)}
                </button>
              ))}
            </div>
          )}
          {currentStatus === "completed" && (
            <div className="flex items-center justify-center gap-[6px] bg-[#E1F5EE] rounded-[8px] py-[8px]">
              <svg className="w-3.5 h-3.5 text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-[12px] font-medium text-[#0F6E56]">{t("completed")}</span>
            </div>
          )}

          {/* Teleconsulta — generic video_url or Daily.co room */}
          {session.video_url || session.zoom_join_url ? (
            <a
              href={session.video_url ?? session.zoom_join_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#2A7BC1] hover:bg-[#1e6aad] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              {t("joinTelehealth")}
            </a>
          ) : (
            <Link
              href={`/schedule/${session.id}/telehealth`}
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#2A7BC1] border border-[#2A7BC1]/30 hover:bg-[#EAF3FB] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              {t("startTelehealth")}
            </Link>
          )}

          <Link
            href={`/schedule/${session.id}/session`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("registerSession")}
          </Link>
          <Link
            href={`/patients/${session.patient_id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <User className="h-3.5 w-3.5" />
            {t("viewProfile")}
          </Link>
          <Link
            href="/follow-ups"
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.08] dark:border-white/[.08] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {t("createFollowup")}
          </Link>
        </div>
      </aside>
    </div>
  );
}
