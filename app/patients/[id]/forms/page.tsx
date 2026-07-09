import Link from "next/link";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getPatientAssessmentResponses } from "@/services/assessment-service";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function timeAgo(iso: string, t: Translator): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("timeAgo.today");
  if (days === 1) return t("timeAgo.yesterday");
  if (days < 30) return t("timeAgo.days", { count: days });
  const months = Math.floor(days / 30);
  return t("timeAgo.months", { count: months });
}

function ScoreBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? "bg-red-50 dark:bg-red-500/10 text-red-500" : pct >= 40 ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#0F6E56] dark:text-[#9FE1CB]";
  return (
    <span className={`text-[10px] font-semibold px-[8px] py-[3px] rounded-full ${color}`}>
      {Math.round(pct)}%
    </span>
  );
}

export default async function PatientFormsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("forms.patientList");
  const { id } = await params;
  const responses = await getPatientAssessmentResponses(id);

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between mb-[20px]">
        <div className="flex items-center gap-[10px]">
          <BackLink
            fallbackHref={`/patients/${id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </BackLink>
          <div>
            <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
            <p className="text-[12px] text-[#A09E98] mt-[1px]">
              {t("count", { count: responses.length })}
            </p>
          </div>
        </div>
        <Link
          href={`/patients/${id}/forms/new`}
          className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[12px] py-[7px] rounded-[8px]"
        >
          <Plus className="h-3.5 w-3.5" /> {t("newForm")}
        </Link>
      </div>

      {/* Responses list */}
      {responses.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[14px] flex flex-col items-center justify-center py-[48px] px-[20px] text-center">
          <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
            <ClipboardList className="h-5 w-5 text-[#A09E98]" />
          </div>
          <p className="text-[13px] text-[#A09E98] mb-[4px]">{t("emptyTitle")}</p>
          <p className="text-[11px] text-[#D3D1C7] dark:text-white/25">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
          <div className="divide-y divide-black/[.04] dark:divide-white/[.06]">
            {responses.map((r) => {
              const templateName = (r as any).assessment_templates?.name ?? t("fallbackName");
              const pct = r.score_percentage ?? 0;
              return (
                <Link
                  key={r.id}
                  href={`/patients/${id}/forms/${r.id}`}
                  className="flex items-center gap-[12px] px-[16px] py-[13px] hover:bg-[#FAFAF8] dark:hover:bg-white/[.04] transition group"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4 text-[#A09E98]" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{templateName}</p>
                    <div className="flex items-center gap-[6px] mt-[2px]">
                      <span className="text-[10px] text-[#A09E98]">{timeAgo(r.filled_at, t)}</span>
                      {r.total_score !== null && (
                        <>
                          <span className="text-[#D3D1C7] dark:text-white/25">·</span>
                          <span className="text-[10px] text-[#A09E98]">
                            {t("points", { score: r.total_score, max: r.max_possible_score ?? 0 })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score badge */}
                  {r.score_percentage !== null && <ScoreBadge pct={pct} />}

                  {/* Arrow */}
                  <svg className="w-3 h-3 text-[#D3D1C7] dark:text-white/25 group-hover:text-[#A09E98] transition shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
