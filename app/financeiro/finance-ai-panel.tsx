"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, TrendingUp, Zap } from "lucide-react";
import { generateFinanceInsightAction } from "./actions";
import type { FinanceAIInsight } from "@/services/ai-finance-insight-service";

interface Props {
  initial: FinanceAIInsight | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 1) return `há ${h}h`;
  if (m >= 1) return `há ${m}min`;
  return "agora mesmo";
}

export function FinanceAIPanel({ initial }: Props) {
  const [insight, setInsight] = useState<FinanceAIInsight | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateFinanceInsightAction();
      if (result.error) {
        setError(result.error);
      } else if (result.insight) {
        setInsight(result.insight);
      }
    });
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.05]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-[14px] w-[14px] text-[#0F6E56]" />
          <p className="text-[12px] font-medium text-[#0F1A2E]">Análise IA</p>
          {insight && (
            <span className="text-[10px] text-[#A09E98]">· {timeAgo(insight.generated_at)}</span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#0F6E56] hover:text-[#0a5a44] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-[11px] w-[11px] ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Analisando..." : insight ? "Atualizar" : "Gerar análise"}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
          {error}
        </div>
      )}

      {!insight && !isPending && (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E1F5EE]">
            <Sparkles className="h-5 w-5 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">Análise financeira inteligente</p>
            <p className="text-[11px] text-[#A09E98] mt-0.5 max-w-[220px]">
              A IA analisa seus dados e entrega alertas, oportunidades e sugestões de ação.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="rounded-lg bg-[#0B1F3A] px-4 py-1.5 text-[11px] font-medium text-white hover:bg-black transition disabled:opacity-50"
          >
            Gerar análise agora
          </button>
        </div>
      )}

      {isPending && !insight && (
        <div className="flex flex-col items-center gap-3 px-4 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0F6E56] border-t-transparent" />
          <p className="text-[11px] text-[#A09E98]">Analisando dados financeiros...</p>
        </div>
      )}

      {insight && (
        <div className="divide-y divide-black/[.04]">
          {/* Summary */}
          <div className="px-4 py-3">
            <p className="text-[11px] text-[#6B6A66] leading-relaxed">{insight.summary}</p>
          </div>

          {/* Alerts */}
          {insight.alerts.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-[11px] w-[11px] text-amber-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-amber-500">Alertas</p>
              </div>
              <ul className="space-y-1">
                {insight.alerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    <p className="text-[11px] text-[#6B6A66] leading-relaxed">{a}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {insight.opportunities.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-[11px] w-[11px] text-[#0F6E56]" />
                <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#0F6E56]">Oportunidades</p>
              </div>
              <ul className="space-y-1">
                {insight.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#0F6E56]" />
                    <p className="text-[11px] text-[#6B6A66] leading-relaxed">{o}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {insight.suggestions.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-[11px] w-[11px] text-[#0B1F3A]" />
                <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#0B1F3A]">Ações recomendadas</p>
              </div>
              <ol className="space-y-1">
                {insight.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#F4F3EF] text-[9px] font-bold text-[#0F1A2E]">
                      {i + 1}
                    </span>
                    <p className="text-[11px] text-[#6B6A66] leading-relaxed">{s}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Projection */}
          {insight.projection && (
            <div className="px-4 py-3 bg-[#FAFAF8]">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-[11px] w-[11px] text-[#0B1F3A]" />
                <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#0B1F3A]">Projeção</p>
              </div>
              <p className="text-[11px] text-[#6B6A66] leading-relaxed">{insight.projection}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
