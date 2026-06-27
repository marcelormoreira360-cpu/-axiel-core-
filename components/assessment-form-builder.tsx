"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { createFormAction } from "@/app/forms/new/actions";
import { SortableList } from "@/components/sortable-list";

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

const TYPE_KEYS = ["scale", "yes_no", "text", "number"] as const;

function uid() {
  return Math.random().toString(36).slice(2);
}

export function AssessmentFormBuilder({ clinicId }: { clinicId: string }) {
  const t = useTranslations("forms.builder");
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(t("defaultInstructions"));
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

  function reorderSections(next: SectionDraft[]) {
    setSections(next);
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

  function reorderQuestions(sid: string, next: QuestionDraft[]) {
    setSections((prev) => prev.map((s) => (s.id === sid ? { ...s, questions: next } : s)));
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
            {t("nameRequired")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
            {t("description")}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">
            {t("instructionsLabel")}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
          />
        </div>
      </div>

      {/* Seções (arraste pela alça para reordenar) */}
      <SortableList
        items={sections}
        getId={(s) => s.id}
        onReorder={reorderSections}
        className="space-y-[18px]"
        render={(section, { setNodeRef, style, handleProps, isDragging }) => {
          const si = sections.findIndex((s) => s.id === section.id);
          return (
            <div ref={setNodeRef} style={style} className={`bg-white border border-black/[.07] rounded-[12px] overflow-hidden ${isDragging ? "shadow-md" : ""}`}>
              {/* Section header */}
              <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-black/[.06] bg-[#FAFAF8]">
                <button type="button" {...handleProps}
                  className="shrink-0 cursor-grab active:cursor-grabbing text-[#C4C2BC] hover:text-[#6B6A66] touch-none p-0.5" title={t("drag")} aria-label={t("drag")}>
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] shrink-0">
                  {t("section", { n: si + 1 })}
                </span>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                  placeholder={t("sectionPlaceholder")}
                  className="flex-1 px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[12px] font-medium text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition uppercase"
                />
                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 hover:bg-red-50 transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Questions (arraste pela alça para reordenar) */}
              <div className="px-[16px] py-[12px] space-y-[8px]">
                <SortableList
                  items={section.questions}
                  getId={(q) => q.id}
                  onReorder={(next) => reorderQuestions(section.id, next)}
                  className="space-y-[8px]"
                  render={(q, qBag) => (
                    <div ref={qBag.setNodeRef} style={qBag.style} className={`flex items-start gap-[8px] bg-[#FAFAF8] rounded-[8px] px-[10px] py-[9px] ${qBag.isDragging ? "shadow-md" : ""}`}>
                      <button type="button" {...qBag.handleProps}
                        className="mt-[6px] shrink-0 cursor-grab active:cursor-grabbing text-[#D3D1C7] hover:text-[#6B6A66] touch-none" title={t("drag")} aria-label={t("drag")}>
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex-1 space-y-[6px]">
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => updateQuestion(section.id, q.id, { text: e.target.value })}
                          placeholder={t("questionPlaceholder")}
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
                            {TYPE_KEYS.map((val) => (
                              <option key={val} value={val}>
                                {t(`typeLabels.${val}`)}
                              </option>
                            ))}
                          </select>
                          {(q.type === "scale" || q.type === "number") && (
                            <div className="flex items-center gap-[4px]">
                              <span className="text-[10px] text-[#A09E98]">{t("maxScore")}</span>
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
                      <button
                        type="button"
                        onClick={() => removeQuestion(section.id, q.id)}
                        className="shrink-0 mt-[2px] w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                />

                <button
                  type="button"
                  onClick={() => addQuestion(section.id)}
                  className="flex items-center gap-[6px] text-[11px] text-[#0F6E56] hover:text-[#085041] transition mt-[4px]"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("addQuestion")}
                </button>
              </div>
            </div>
          );
        }}
      />

      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-dashed border-black/[.15] rounded-[10px] px-[14px] py-[10px] w-full justify-center hover:border-[#0F6E56] hover:text-[#0F6E56] transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("addSection")}
      </button>

      {/* Summary + save */}
      <div className="flex items-center justify-between bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[12px]">
        <p className="text-[12px] text-[#A09E98]">
          {t("summarySections", { count: sections.length })} · {t("summaryQuestions", { count: totalQuestions })}
        </p>
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] px-[16px] py-[8px] transition"
        >
          {isPending ? t("saving") : t("create")}
        </button>
      </div>
    </form>
  );
}
