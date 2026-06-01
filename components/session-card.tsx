"use client";

import { useTranslations } from "next-intl";
import type { Appointment } from "@/lib/types";
import { formatTime } from "@/modules/schedule/date-utils";
import type { PatientSnapshotData } from "@/components/patient-snapshot";
import { Video } from "lucide-react";

export type ScheduleSession = Appointment & {
  latestInsightStatus: "review" | "final";
  snapshot: PatientSnapshotData;
  previousSessions: Appointment[];
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function SessionCard({
  session,
  onOpen,
}: {
  session: ScheduleSession;
  onOpen: (session: ScheduleSession) => void;
}) {
  const t = useTranslations("schedule.card");
  const patientName = session.patients?.full_name ?? t("patientFallback");
  const sessionCount = session.previousSessions.length + 1;
  const hasFinalInsight = session.latestInsightStatus === "final";

  return (
    <button type="button" onClick={() => onOpen(session)} className="block w-full text-left group">
      <div className="bg-white border border-black/[.08] rounded-[10px] px-[13px] py-[11px] hover:border-[#0F6E56]/30 hover:bg-[#F0FAF6] transition">
        <div className="flex items-center gap-[10px]">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[11px] font-medium text-[#0F6E56] shrink-0">
            {initials(patientName)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px]">
              <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{patientName}</p>
              <span className="text-[10px] text-[#A09E98] shrink-0">{t("sessionNum", { count: sessionCount })}</span>
            </div>
            <p className="text-[11px] text-[#A09E98] mt-[1px]">{t("meta", { time: formatTime(session.starts_at), minutes: session.duration_minutes })}</p>
          </div>

          {/* Insight badge */}
          <span className={[
            "text-[10px] px-[7px] py-[2px] rounded-full shrink-0",
            hasFinalInsight
              ? "bg-[#E1F5EE] text-[#085041]"
              : "bg-[#FAEEDA] text-[#633806]",
          ].join(" ")}>
            {hasFinalInsight ? t("insight") : t("pending")}
          </span>
        </div>

        {/* Video link badge */}
        {(session.video_url || session.zoom_join_url) && (
          <div className="mt-[7px] pl-[38px]">
            <a
              href={session.video_url ?? session.zoom_join_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-[4px] text-[10px] font-medium text-[#2A7BC1] bg-[#EAF3FB] hover:bg-[#d6eaf8] rounded-full px-[8px] py-[3px] transition"
            >
              <Video className="h-2.5 w-2.5" />
              {t("telehealth")}
            </a>
          </div>
        )}

        {session.notes && (
          <p className="text-[11px] text-[#6B6A66] mt-[6px] line-clamp-1 pl-[38px]">{session.notes}</p>
        )}
      </div>
    </button>
  );
}
