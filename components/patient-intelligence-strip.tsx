/**
 * patient-intelligence-strip.tsx
 *
 * Compact intelligence bar shown on the patient profile page.
 * Displays engagement score (ring + number), churn risk badge,
 * and key stats. Pure server component — data passed from page.
 */

import { useTranslations } from "next-intl";
import type { PatientEngagement } from "@/services/patient-intelligence-service";
import type { PatientJourneyStage, JourneyStageTone } from "@/modules/patient-journey/stage";

interface Props {
  engagement: PatientEngagement;
  /** Etapa da jornada derivada (opcional — não quebra chamadas existentes). */
  journey?: PatientJourneyStage;
}

const JOURNEY_TONE_CLASSES: Record<JourneyStageTone, string> = {
  neutral:   "bg-[#F4F3EF] text-[#6B6A66]",
  active:    "bg-[#E1F5EE] text-[#085041]",
  attention: "bg-[#FFF8E7] text-[#633806]",
  risk:      "bg-[#FEE2E2] text-[#991B1B]",
};

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;

  const color =
    score >= 70 ? "#0F6E56"
    : score >= 45 ? "#F5A623"
    : "#EF4444";

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="#F4F3EF" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

export function PatientIntelligenceStrip({ engagement, journey }: Props) {
  const t = useTranslations("patientPanels.intelligenceStrip");
  const {
    score,
    churnRisk,
    label,
    badgeClasses,
    daysSinceLastSession,
    sessionsLast90Days,
    attendanceRate,
  } = engagement;

  const RISK_DOT: Record<string, string> = {
    none:   "bg-[#0F6E56]",
    low:    "bg-amber-400",
    medium: "bg-orange-400",
    high:   "bg-red-500",
  };

  return (
    <div className="bg-white border border-t-0 border-black/[.07] px-[22px] py-[14px] flex items-center gap-[18px] flex-wrap">

      {/* Journey stage + next best action (derived, zero extra queries) */}
      {journey && (
        <>
          <div className="flex items-center gap-[8px] min-w-0">
            <span className="text-[10px] text-[#A09E98] tracking-[.05em] uppercase shrink-0">{t("journey.label")}</span>
            <span className={`text-[11px] font-medium px-[8px] py-[3px] rounded-full shrink-0 ${JOURNEY_TONE_CLASSES[journey.tone]}`}>
              {t(`journey.stage.${journey.stage}`)}
            </span>
            <span className="text-[11px] text-[#6B6A66] truncate">
              → {t(`journey.next.${journey.stage}`)}
            </span>
          </div>
          <div className="w-px h-8 bg-black/[.07] shrink-0 hidden sm:block" />
        </>
      )}

      {/* Engagement score ring */}
      <div className="flex items-center gap-[10px]">
        <ScoreRing score={score} />
        <div>
          <p className="text-[10px] text-[#A09E98] tracking-[.05em] uppercase">{t("engagement")}</p>
          <p className="text-[12px] font-medium text-[#0F1A2E]">{score}/100</p>
        </div>
      </div>

      <div className="w-px h-8 bg-black/[.07] shrink-0 hidden sm:block" />

      {/* Churn risk badge */}
      <div className="flex items-center gap-[7px]">
        <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${RISK_DOT[churnRisk]}`} />
        <span className={`text-[11px] font-medium px-[8px] py-[3px] rounded-full ${badgeClasses}`}>
          {label}
        </span>
      </div>

      <div className="w-px h-8 bg-black/[.07] shrink-0 hidden sm:block" />

      {/* Key stats */}
      <div className="flex items-center gap-[20px] flex-wrap">
        <div className="text-center">
          <p className="text-[10px] text-[#A09E98] tracking-[.04em]">{t("lastSession")}</p>
          <p className="text-[12px] font-medium text-[#0F1A2E]">
            {daysSinceLastSession === null
              ? "—"
              : daysSinceLastSession === 0
              ? t("today")
              : daysSinceLastSession === 1
              ? t("yesterday")
              : t("daysAgo", { days: daysSinceLastSession })}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-[#A09E98] tracking-[.04em]">{t("days90")}</p>
          <p className="text-[12px] font-medium text-[#0F1A2E]">
            {t("sessions", { count: sessionsLast90Days })}
          </p>
        </div>

        {attendanceRate !== null && (
          <div className="text-center">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em]">{t("attendance")}</p>
            <p className="text-[12px] font-medium text-[#0F1A2E]">
              {Math.round(attendanceRate * 100)}%
            </p>
          </div>
        )}
      </div>

      {/* Churn alert (only for medium/high risk) */}
      {(churnRisk === "medium" || churnRisk === "high") && (
        <>
          <div className="w-px h-8 bg-black/[.07] shrink-0 hidden sm:block" />
          <p className={[
            "text-[11px] italic",
            churnRisk === "high" ? "text-red-500" : "text-orange-500",
          ].join(" ")}>
            {churnRisk === "high"
              ? t("churnHigh")
              : t("churnMedium")}
          </p>
        </>
      )}
    </div>
  );
}
