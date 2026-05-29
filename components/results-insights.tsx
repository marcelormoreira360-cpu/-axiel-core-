"use client";

import { useEffect, useState } from "react";
import type { AiInsight } from "@/services/business-analytics-service";

const TYPE_STYLE = {
  highlight:   { bg: "bg-[#E1F5EE]", border: "border-[#9FE1CB]", dot: "bg-[#0F6E56]", text: "text-[#085041]" },
  opportunity: { bg: "bg-[#EEF2FF]", border: "border-[#C7D2FE]", dot: "bg-[#4F46E5]", text: "text-[#3730A3]" },
  warning:     { bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-400",  text: "text-amber-800" },
};

function InsightSkeleton() {
  return (
    <div className="rounded-[12px] border border-black/[.06] bg-[#F4F3EF] p-[14px] animate-pulse">
      <div className="flex items-start gap-[8px]">
        <div className="w-[7px] h-[7px] rounded-full mt-[5px] shrink-0 bg-black/[.08]" />
        <div className="flex-1 space-y-[6px]">
          <div className="h-[13px] rounded bg-black/[.07] w-3/4" />
          <div className="h-[11px] rounded bg-black/[.05] w-full" />
          <div className="h-[11px] rounded bg-black/[.05] w-5/6" />
        </div>
      </div>
    </div>
  );
}

export function ResultsInsights({ months }: { months: number }) {
  const [insights, setInsights] = useState<AiInsight[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/results/insights?months=${months}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { insights: AiInsight[] }) => {
        if (!cancelled) setInsights(data.insights ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [months]);

  return (
    <div className="space-y-[12px]">
      <div>
        <p className="text-[12px] font-medium text-[#0F1A2E]">Análise por IA</p>
        <p className="text-[11px] text-[#A09E98] mt-[2px]">
          Claude analisa seus dados e aponta o que fazer a seguir.
        </p>
      </div>

      {error ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
          <p className="text-[12px] text-[#A09E98]">
            Análise de IA indisponível — configure{" "}
            <code className="text-[11px] bg-[#F4F3EF] px-1 rounded">OPENAI_API_KEY</code>{" "}
            no Vercel para ativar.
          </p>
        </div>
      ) : insights === null ? (
        // Loading state — 4 skeletons
        <>
          {[0, 1, 2, 3].map((i) => <InsightSkeleton key={i} />)}
          <p className="text-[10px] text-[#A09E98] text-center">Analisando dados com IA…</p>
        </>
      ) : insights.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
          <p className="text-[12px] text-[#A09E98]">
            Nenhum insight gerado para este período.
          </p>
        </div>
      ) : (
        insights.map((insight, i) => {
          const s = TYPE_STYLE[insight.type] ?? TYPE_STYLE.highlight;
          return (
            <div key={i} className={`rounded-[12px] border p-[14px] ${s.bg} ${s.border}`}>
              <div className="flex items-start gap-[8px]">
                <div className={`w-[7px] h-[7px] rounded-full mt-[4px] shrink-0 ${s.dot}`} />
                <div>
                  <p className={`text-[12px] font-semibold ${s.text}`}>{insight.title}</p>
                  <p className={`text-[12px] mt-[4px] leading-relaxed ${s.text} opacity-80`}>
                    {insight.body}
                  </p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
