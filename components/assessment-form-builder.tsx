"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { createFormAction } from "@/app/forms/new/actions";

type QuestionDraft = {
  id: string;
  text: string;
  type: "scale" | "yes_no" | "text" | "number";
  maxScore: number;
  minScore: number;
};

type SectionDraft = {
  id: string;
  title: string;
  questions: QuestionDraft[];
};

const TYPE_LABELS: Record<string, string> = {
  scale: "Escala (0–4)",
  yes_no: "Sim / Não",
  text: "Texto livre",
  number: "Número",
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export function AssessmentFormBuilder({ clinicId }: { clinicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "Avalie cada sintoma com base no período dos últimos 30 dias."
  );
  const [sections, setSections] = useState<SectionDraft[]>([
    { id: uid(), title: "", questions: [] },
  ]);

  // suppress unused warning — clinicId is passed to the server action via formData
  void clinicId;

  function addSection() {
    setSections((prev) => [...prev, { id: uid(), title: "", questions: [] }]);
  }

  function removeSection(sid: string) {
    setSections((prev) => prev.filter((s) => s.id !== sid));
  }

  function moveSectionUp(idx: number) {
    if (idx === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveSectionDown(idx: number) {
    setSections((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function updateSectionTitle(sid: string, title: string) {
    setSections((prev) => prev.map((s) => (s.id === sid ? { ...s, title } : s)));
  }

  function addQuestion(sid: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              questions: [
                ...s.questions,
                { id: uid(), text: "", type: "scale", maxScore: 4, minScore: 0 },
              ],
            }
          : s
      )
    );
  }

  function removeQuestion(sid: string, qid: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid ? { ...s, questions: s.questions.filter((q) => q.id !== qid) } : s
      )
    );
  }

  function updateQuestion(sid: string, qid: string, patch: Partial<QuestionDraft>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
            }
          : s
      )
    );
  }

  function moveQuestionUp(sid: string, idx: number) {
    if (idx === 0) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s;
        const qs = [...s.questions];
        [qs[idx - 1], qs[idx]] = [qs[idx], qs[idx - 1]];
        return { ...s, questions: qs };
      })
    );
  }

  function moveQuestionDown(sid: string, idx: number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s;
        if (idx >= s.questions.length - 1) return s;
        const qs = [...s.questions];
        [qs[idx], qs[idx + 1]] = [qs[idx + 1], qs[idx]];
        return { ...s, questions: qs };
      })
    );
  }

  function submit(formData: FormData) {
    formData.set("name", name);
    formData.set("description", description);
    formData.set("instructions", instructions);
    const sectionsPayload = sections.map((s) => ({
      title: s.title,
      questions: s.questions.map((q) => ({
        text: q.text,
        type: q.type,
        maxScore: q.maxScore,
        minScore: q.minScore,
      })),
    }));
    formData.set("sections", JSON.stringify(sectionsPayload));
    startTransition(async () => {
      await createFormAction(formData);
    });
  }

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <form action={submit} className="space-y-[18px]">
      {/* Meta */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] space-y-[12px]">
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
            Nome do formulário *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Questionário de Rastreamento Metabólico"
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descrição do formulário"
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
            Instruções (exibidas ao preencher)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
          />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={section.id} className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-black/[.06] bg-[#FAFAF8]">
            <span className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] shrink-0">
              Seção {si + 1}
            </span>
            <input
              type="text"
              value={section.title}
              onChange={(e) => updateSectionTitle(section.id, e.target.value)}
              placeholder="Nome da seção (ex: CABEÇA)"
              className="flex-1 px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[12px] font-medium text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition uppercase"
            />
            <div className="flex items-center gap-[4px] shrink-0">
              <button
                type="button"
                onClick={() => moveSectionUp(si)}
                disabled={si === 0}
                className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] disabled:opacity-30 transition"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveSectionDown(si)}
                disabled={si === sections.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] disabled:opacity-30 transition"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 hover:bg-red-50 transition"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Questions */}
          <div className="px-[16px] py-[12px] space-y-[8px]">
            {section.questions.map((q, qi) => (
              <div
                key={q.id}
                className="flex items-start gap-[8px] bg-[#FAFAF8] rounded-[8px] px-[10px] py-[9px]"
              >
                <GripVertical className="h-3.5 w-3.5 text-[#D3D1C7] mt-[7px] shrink-0" />
                <div className="flex-1 space-y-[6px]">
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(section.id, q.id, { text: e.target.value })}
                    placeholder="Texto da pergunta"
                    className="w-full px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                  />
                  <div className="flex items-center gap-[8px]">
                    <select
                      value={q.type}
                      onChange={(e) =>
                        updateQuestion(section.id, q.id, {
                          type: e.target.value as QuestionDraft["type"],
                          maxScore:
                            e.target.value === "yes_no"
                              ? 1
                              : e.target.value === "scale"
                              ? 4
                              : 0,
                        })
                      }
                      className="px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
                    >
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {(q.type === "scale" || q.type === "number") && (
                      <div className="flex items-center gap-[4px]">
                        <span className="text-[10px] text-[#A09E98]">Pontuação máx:</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.maxScore}
                          onChange={(e) =>
                            updateQuestion(section.id, q.id, { maxScore: Number(e.target.value) })
                          }
                          className="w-14 px-[6px] py-[4px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] text-center"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-[2px] shrink-0 mt-[2px]">
                  <button
                    type="button"
                    onClick={() => moveQuestionUp(section.id, qi)}
                    disabled={qi === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestionDown(section.id, qi)}
                    disabled={qi === section.questions.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(section.id, q.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addQuestion(section.id)}
              className="flex items-center gap-[6px] text-[11px] text-[#0F6E56] hover:text-[#085041] transition mt-[4px]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-dashed border-black/[.15] rounded-[10px] px-[14px] py-[10px] w-full justify-center hover:border-[#0F6E56] hover:text-[#0F6E56] transition"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar seção
      </button>

      {/* Summary + save */}
      <div className="flex items-center justify-between bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[12px]">
        <p className="text-[12px] text-[#A09E98]">
          {sections.length} {sections.length === 1 ? "seção" : "seções"} ·{" "}
          {totalQuestions} {totalQuestions === 1 ? "pergunta" : "perguntas"}
        </p>
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] px-[16px] py-[8px] transition"
        >
          {isPending ? "Salvando…" : "Criar formulário"}
        </button>
      </div>
    </form>
  );
}
