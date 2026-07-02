"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Send, Plus, ChevronRight } from "lucide-react";
import type { AssessmentProgress } from "@/services/assessment-progress-service";
import { resendAssessmentAction } from "@/app/patients/[id]/assessments/actions";

function ProgressRow({ item, patientId }: { item: AssessmentProgress; patientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const delta = item.deltaPct;
  const Arrow = delta == null || delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp;

  function resend() {
    setMsg(null);
    startTransition(async () => {
      const res = await resendAssessmentAction(patientId, item.template_id);
      setMsg(res.error ?? "Enviado!");
    });
  }

  return (
    <div className="rounded-[10px] border border-black/[.06] bg-[#FAFAF8] px-[12px] py-[10px]">
      <div className="flex items-start justify-between gap-2 mb-[6px]">
        {item.latest_response_id ? (
          <Link
            href={`/patients/${patientId}/forms/${item.latest_response_id}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0F1A2E] hover:text-[#0F6E56] dark:hover:text-[#9FE1CB] transition group/q"
          >
            {item.template_name}
            <ChevronRight className="h-3 w-3 text-[#C4C2BC] group-hover/q:text-[#0F6E56] transition" />
          </Link>
        ) : (
          <p className="text-[13px] font-medium text-[#0F1A2E]">{item.template_name}</p>
        )}
        {delta != null && item.count > 1 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B6A66] shrink-0">
            <Arrow className="h-3.5 w-3.5" />
            {delta > 0 ? "+" : ""}{delta} pts
          </span>
        )}
      </div>

      {/* Grau de disfunção (última resposta) */}
      {item.grade && (
        <div className="flex items-center flex-wrap gap-[6px] mb-[8px]">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-[8px] py-[2px]"
            style={{ color: item.grade.color, backgroundColor: `${item.grade.color}1A` }}
          >
            {item.grade.label}
            {item.latestTotal != null && <span className="opacity-70">· {item.latestTotal} pts</span>}
          </span>
          {item.flaggedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#C0392B] dark:text-[#F2B8B5] bg-[#C0392B]/10 rounded-full px-[8px] py-[2px]">
              {item.flaggedCount} {item.flaggedCount === 1 ? "item no máximo" : "itens no máximo"}
            </span>
          )}
        </div>
      )}

      {/* Seções em destaque (maior pontuação primeiro) */}
      {item.sectionGrades.length > 0 && (
        <div className="flex flex-wrap gap-[4px] mb-[8px]">
          {item.sectionGrades.slice(0, 4).map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[9px] rounded px-[6px] py-[2px] border"
              style={
                s.band
                  ? { color: s.band.color, borderColor: `${s.band.color}40`, backgroundColor: `${s.band.color}0D` }
                  : { color: "#6B6A66", borderColor: "rgba(0,0,0,.08)" }
              }
              title={s.band?.label ?? undefined}
            >
              {s.title} {s.score}{s.max ? `/${s.max}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-[4px]">
        <p className="text-[11px] text-[#A09E98]">
          {item.count > 1
            ? `${item.baseline}% → ${item.latest}% · ${item.count} respostas`
            : item.count === 1
              ? `${item.latest}% · 1 resposta`
              : "sem respostas"}
        </p>
        <button
          onClick={resend}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] border border-[#0F6E56]/20 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 hover:bg-[#d0f0e6] dark:hover:bg-[#0F6E56]/30 disabled:opacity-50 rounded-md px-2 py-1 transition"
        >
          <Send className="h-3 w-3" /> {isPending ? "…" : "Reavaliar"}
        </button>
      </div>
      {msg && <p className="text-[9px] text-[#6B6A66] mt-1 text-right">{msg}</p>}
    </div>
  );
}

export function PatientAssessmentProgressPanel({
  patientId,
  progress,
}: {
  patientId: string;
  progress: AssessmentProgress[];
}) {
  return (
    <div className="space-y-[10px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#0F1A2E]">Questionários</p>
          <p className="text-[11px] text-[#A09E98]">
            {progress.length === 0
              ? "Nenhum questionário respondido ainda."
              : `${progress.length} ${progress.length === 1 ? "questionário" : "questionários"}`}
          </p>
        </div>
        <Link
          href={`/patients/${patientId}/forms/new`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[10px] py-[5px] rounded-[6px] shrink-0"
        >
          <Plus className="h-3 w-3" /> Preencher
        </Link>
      </div>
      {progress.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
          {progress.map((item) => (
            <ProgressRow key={item.template_id} item={item} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  );
}
