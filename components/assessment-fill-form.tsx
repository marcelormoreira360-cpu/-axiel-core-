"use client";

import { useState, useMemo, useTransition } from "react";
import type { TemplateWithStructure, AssessmentQuestion } from "@/lib/types";

const DEFAULT_SCALE_LABELS = [
  "Nunca ou quase nunca",
  "Ocasionalmente, efeito leve",
  "Ocasionalmente, efeito severo",
  "Frequentemente, efeito leve",
  "Frequentemente, efeito severo",
];

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: AssessmentQuestion;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const steps = Array.from(
    { length: question.max_score - question.min_score + 1 },
    (_, i) => i + question.min_score
  );
  return (
    <div className="flex items-center gap-[4px]">
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            "w-9 h-9 rounded-[6px] text-[12px] font-medium border transition shrink-0",
            value === n
              ? n >= 3
                ? "bg-[#FF6B4A] border-[#FF6B4A] text-white"
                : n >= 1
                ? "bg-[#0F6E56] border-[#0F6E56] text-white"
                : "bg-[#0F1A2E] border-[#0F1A2E] text-white"
              : "border-black/[.10] text-[#6B6A66] hover:border-[#0F6E56] hover:text-[#0F6E56]",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function AssessmentFillForm({
  template,
  patientId,
  action,
}: {
  template: TemplateWithStructure;
  patientId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [notes, setNotes] = useState("");

  function setAnswer(qid: string, value: number | string | null) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  const { sectionScores, totalScore, maxPossible, percentage } = useMemo(() => {
    let total = 0;
    let maxP = 0;
    const sScores: Record<string, { score: number; max: number }> = {};
    for (const section of template.assessment_sections) {
      let sScore = 0;
      let sMax = 0;
      for (const q of section.assessment_questions) {
        if (q.question_type !== "text") {
          const v = answers[q.id];
          if (typeof v === "number") {
            sScore += v;
            total += v;
          }
          sMax += q.max_score;
          maxP += q.max_score;
        }
      }
      sScores[section.id] = { score: sScore, max: sMax };
    }
    const pct = maxP > 0 ? Math.round((total / maxP) * 100) : 0;
    return { sectionScores: sScores, totalScore: total, maxPossible: maxP, percentage: pct };
  }, [answers, template]);

  function submit(formData: FormData) {
    formData.set("patient_id", patientId);
    formData.set("template_json", JSON.stringify(template));
    formData.set("notes", notes);
    for (const [qid, val] of Object.entries(answers)) {
      if (val !== null && val !== undefined) {
        formData.set(`q_${qid}`, String(val));
      }
    }
    startTransition(async () => {
      await action(formData);
    });
  }

  const scaleLabels = template.scale_labels ?? DEFAULT_SCALE_LABELS;

  return (
    <form action={submit} className="space-y-[18px]">
      {/* Instructions */}
      {template.instructions && (
        <div className="bg-[#F4F3EF] rounded-[12px] px-[16px] py-[12px]">
          <p className="text-[12px] font-medium text-[#0F1A2E] mb-[8px]">{template.instructions}</p>
          <div className="space-y-[3px]">
            {scaleLabels.map((label, i) => (
              <p key={i} className="text-[11px] text-[#6B6A66]">
                <span className="font-medium text-[#0F1A2E]">{i}</span> — {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {template.assessment_sections.map((section) => {
        const ss = sectionScores[section.id] ?? { score: 0, max: 0 };
        return (
          <div
            key={section.id}
            className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-center justify-between px-[16px] py-[10px] bg-[#0F1A2E]">
              <p className="text-[11px] font-medium tracking-[.08em] uppercase text-white/80">
                {section.title}
              </p>
              <div className="flex items-center gap-[6px]">
                <span className="text-[11px] font-semibold text-white">{ss.score}</span>
                <span className="text-[10px] text-white/40">/ {ss.max}</span>
              </div>
            </div>

            {/* Questions */}
            <div className="divide-y divide-black/[.04]">
              {section.assessment_questions.map((q) => (
                <div key={q.id} className="px-[16px] py-[12px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <p className="text-[12px] text-[#0F1A2E] flex-1">{q.text}</p>
                    <div className="shrink-0">
                      {q.question_type === "scale" && (
                        <ScaleInput
                          question={q}
                          value={
                            typeof answers[q.id] === "number"
                              ? (answers[q.id] as number)
                              : null
                          }
                          onChange={(v) => setAnswer(q.id, v)}
                        />
                      )}
                      {q.question_type === "yes_no" && (
                        <div className="flex gap-[4px]">
                          {[
                            { label: "Não", value: 0 },
                            { label: "Sim", value: 1 },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAnswer(q.id, opt.value)}
                              className={[
                                "px-[10px] py-[6px] rounded-[6px] text-[11px] font-medium border transition",
                                answers[q.id] === opt.value
                                  ? "bg-[#0F6E56] border-[#0F6E56] text-white"
                                  : "border-black/[.10] text-[#6B6A66] hover:border-[#0F6E56]",
                              ].join(" ")}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {q.question_type === "number" && (
                        <input
                          type="number"
                          min={q.min_score}
                          max={q.max_score}
                          value={
                            typeof answers[q.id] === "number"
                              ? String(answers[q.id])
                              : ""
                          }
                          onChange={(e) =>
                            setAnswer(q.id, e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-20 px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[12px] text-center outline-none focus:border-[#0F6E56] transition"
                        />
                      )}
                      {q.question_type === "text" && (
                        <input
                          type="text"
                          value={
                            typeof answers[q.id] === "string" ? String(answers[q.id]) : ""
                          }
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          className="w-40 px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[12px] outline-none focus:border-[#0F6E56] transition"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Grand total */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[11px] font-medium tracking-[.08em] uppercase text-white/50">
            Total geral
          </p>
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[28px] font-semibold text-white tracking-[-0.04em]">
              {totalScore}
            </span>
            <span className="text-[13px] text-white/40">/ {maxPossible}</span>
            <span className="ml-[8px] text-[14px] font-semibold text-[#0F6E56]">
              {percentage}%
            </span>
          </div>
        </div>
        <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0F6E56] transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
          Observações
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Observações adicionais sobre este preenchimento (opcional)."
          className="w-full resize-none rounded-[8px] border border-black/[.10] px-[10px] py-[8px] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[10px] py-[11px] transition"
      >
        {isPending ? "Salvando…" : "Salvar resultados"}
      </button>
    </form>
  );
}
