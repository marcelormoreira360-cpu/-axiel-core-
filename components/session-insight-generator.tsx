"use client";

import { useState, useTransition } from "react";
import { Sparkles, ExternalLink, RotateCcw, AlertCircle } from "lucide-react";
import Link from "next/link";
import { generateSessionInsightAction } from "@/app/schedule/[id]/session/actions";
import type { AiInsight } from "@/lib/types";

type State = "idle" | "generating" | "done" | "error";

interface Props {
  patientId: string;
  saved: boolean;
}

export function SessionInsightGenerator({ patientId, saved }: Props) {
  const [state, setState] = useState<State>("idle");
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function generate() {
    setState("generating");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await generateSessionInsightAction(patientId);
      if (result.error || !result.insight) {
        setErrorMsg(result.error ?? "Erro desconhecido.");
        setState("error");
      } else {
        setInsight(result.insight);
        setState("done");
      }
    });
  }

  const output = insight?.output;
  const overview = output?.structured_summary?.overview;
  const firstPattern = output?.patterns_and_correlations?.[0];
  const firstReviewPoint = output?.practitioner_review_points?.[0];

  // ── Idle: session not yet saved ──────────────────────────────────────────────
  if (!saved && state === "idle") {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-center gap-[8px] mb-[8px]">
          <div className="w-7 h-7 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-[#A09E98]" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight</p>
            <p className="text-[10px] text-[#A09E98]">Disponível após salvar</p>
          </div>
        </div>
        <p className="text-[12px] text-[#A09E98] leading-relaxed bg-[#FAFAF8] rounded-[8px] px-[10px] py-[9px]">
          Salve a sessão para gerar um insight automático com padrões, correlações e próximos passos sugeridos.
        </p>
      </div>
    );
  }

  // ── Idle: ready to generate ──────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-center gap-[8px] mb-[10px]">
          <div className="w-7 h-7 rounded-[8px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight</p>
            <p className="text-[10px] text-[#0F6E56]">Sessão salva — pronto para gerar</p>
          </div>
        </div>
        <p className="text-[12px] text-[#6B6A66] leading-relaxed mb-[12px]">
          A IA vai analisar as notas desta sessão, o histórico do paciente e os vitais para gerar padrões e sugestões clínicas.
        </p>
        <button
          type="button"
          onClick={generate}
          className="w-full flex items-center justify-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[9px] rounded-[8px]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Gerar AI Insight desta sessão
        </button>
      </div>
    );
  }

  // ── Generating ───────────────────────────────────────────────────────────────
  if (state === "generating") {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-center gap-[8px] mb-[10px]">
          <div className="w-7 h-7 rounded-[8px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight</p>
            <p className="text-[10px] text-[#0F6E56]">Gerando…</p>
          </div>
        </div>
        <p className="text-[12px] text-[#A09E98] bg-[#FAFAF8] rounded-[8px] px-[10px] py-[9px]">
          Analisando notas, histórico e vitais do paciente. Isso pode levar alguns segundos…
        </p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-center gap-[8px] mb-[8px]">
          <div className="w-7 h-7 rounded-[8px] bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight</p>
            <p className="text-[10px] text-red-400">Falha ao gerar</p>
          </div>
        </div>
        <p className="text-[11px] text-red-400 bg-red-50 rounded-[8px] px-[10px] py-[8px] mb-[10px]">
          {errorMsg}
        </p>
        <button
          type="button"
          onClick={generate}
          className="flex items-center gap-[5px] text-[11px] font-medium text-[#6B6A66] border border-black/[.10] hover:border-[#0F6E56] hover:text-[#0F6E56] rounded-[7px] px-[10px] py-[6px] transition"
        >
          <RotateCcw className="h-3 w-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Done: show insight ───────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-7 h-7 rounded-[8px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">AI Insight gerado</p>
            <p className="text-[10px] text-[#A09E98]">Pendente de revisão</p>
          </div>
        </div>
        <Link
          href={`/patients/${patientId}/insights`}
          target="_blank"
          className="flex items-center gap-[4px] text-[10px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
        >
          Ver completo
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Overview */}
      {overview && (
        <p className="text-[12px] text-[#0F1A2E] leading-relaxed bg-[#F0FAF6] rounded-[8px] px-[10px] py-[9px] mb-[8px]">
          {overview}
        </p>
      )}

      {/* First pattern */}
      {firstPattern && (
        <div className="mb-[8px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-[#A09E98] mb-[4px]">
            Padrão identificado
          </p>
          <div className="bg-[#FAFAF8] rounded-[8px] px-[10px] py-[8px]">
            <p className="text-[11px] font-medium text-[#0F1A2E] mb-[2px]">{firstPattern.title}</p>
            <p className="text-[11px] text-[#6B6A66] leading-relaxed line-clamp-2">{firstPattern.insight}</p>
          </div>
        </div>
      )}

      {/* First review point */}
      {firstReviewPoint && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-[#A09E98] mb-[4px]">
            Ponto de revisão
          </p>
          <p className="text-[11px] text-[#6B6A66] bg-[#FAFAF8] rounded-[8px] px-[10px] py-[8px] line-clamp-2">
            {firstReviewPoint}
          </p>
        </div>
      )}

      <p className="text-[9px] text-[#D3D1C7] mt-[10px]">
        Insights de IA — não constituem diagnóstico médico. Revisar antes de usar clinicamente.
      </p>
    </div>
  );
}
