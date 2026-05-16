import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import {
  getAssessmentResponse,
  getTemplateWithStructure,
  getAssessmentAnswers,
} from "@/services/assessment-service";

type Props = {
  params: Promise<{ id: string; responseId: string }>;
};

export default async function ViewResponsePage({ params }: Props) {
  const { id: patientId, responseId } = await params;
  const [response, answers] = await Promise.all([
    getAssessmentResponse(responseId),
    getAssessmentAnswers(responseId),
  ]);
  if (!response) notFound();

  const template = await getTemplateWithStructure(response.template_id);
  if (!template) notFound();

  const answersMap = Object.fromEntries(answers.map((a) => [a.question_id, a]));
  const pct = response.score_percentage ?? 0;
  const sectionScores = response.section_scores ?? {};

  const filledDate = new Date(response.filled_at).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <Link
          href={`/patients/${patientId}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {template.name}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">Preenchido em {filledDate}</p>
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px] mb-[18px]">
        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">
            Pontuação total
          </p>
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[32px] font-semibold text-white tracking-[-0.04em]">
              {response.total_score ?? 0}
            </span>
            <span className="text-[14px] text-white/40">/ {response.max_possible_score ?? 0}</span>
            <span className="ml-[10px] text-[18px] font-semibold text-[#0F6E56]">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[#0F6E56]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Section summary */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] mb-[18px]">
        <p className="text-[11px] font-medium text-[#6B6A66] mb-[10px]">Pontuação por seção</p>
        <div className="space-y-[6px]">
          {template.assessment_sections.map((section) => {
            const ss = sectionScores[section.id];
            if (!ss) return null;
            const sPct = ss.max > 0 ? Math.round((ss.score / ss.max) * 100) : 0;
            return (
              <div key={section.id} className="flex items-center gap-[10px]">
                <p className="text-[12px] text-[#0F1A2E] w-[140px] shrink-0 truncate">
                  {ss.title}
                </p>
                <div className="flex-1 h-[4px] bg-[#F4F3EF] rounded-full overflow-hidden">
                  <div
                    className={[
                      "h-full rounded-full",
                      sPct >= 70
                        ? "bg-[#FF6B4A]"
                        : sPct >= 40
                        ? "bg-[#F5A623]"
                        : "bg-[#0F6E56]",
                    ].join(" ")}
                    style={{ width: `${sPct}%` }}
                  />
                </div>
                <div className="flex items-baseline gap-[3px] shrink-0">
                  <span className="text-[12px] font-medium text-[#0F1A2E]">{ss.score}</span>
                  <span className="text-[10px] text-[#A09E98]">/{ss.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full answers */}
      <div className="space-y-[12px]">
        {template.assessment_sections.map((section) => (
          <div
            key={section.id}
            className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden"
          >
            <div className="flex items-center justify-between px-[16px] py-[10px] bg-[#F4F3EF]">
              <p className="text-[11px] font-medium tracking-[.06em] uppercase text-[#6B6A66]">
                {section.title}
              </p>
              {sectionScores[section.id] && (
                <span className="text-[11px] font-medium text-[#0F1A2E]">
                  {sectionScores[section.id].score} / {sectionScores[section.id].max}
                </span>
              )}
            </div>
            <div className="divide-y divide-black/[.04]">
              {section.assessment_questions.map((q) => {
                const ans = answersMap[q.id];
                const val = ans?.value_number ?? ans?.value_text ?? "—";
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between px-[16px] py-[10px] gap-[12px]"
                  >
                    <p className="text-[12px] text-[#6B6A66] flex-1">{q.text}</p>
                    <span
                      className={[
                        "text-[13px] font-semibold shrink-0 w-8 text-center",
                        typeof val === "number" && val >= 3
                          ? "text-[#FF6B4A]"
                          : typeof val === "number" && val >= 1
                          ? "text-[#0F6E56]"
                          : "text-[#0F1A2E]",
                      ].join(" ")}
                    >
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {response.notes && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] mt-[18px]">
          <p className="text-[11px] font-medium text-[#6B6A66] mb-[4px]">Observações</p>
          <p className="text-[12px] text-[#0F1A2E]">{response.notes}</p>
        </div>
      )}
    </Shell>
  );
}
