"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react";
import type { TemplateWithStructure } from "@/lib/types";
import { updateFormAction } from "@/app/forms/[id]/edit/actions";

type QuestionDraft = {
  tempId: string;
  dbId?: string;       // present if loaded from DB
  text: string;
  type: "scale" | "yes_no" | "text" | "number";
  maxScore: number;
  minScore: number;
};

type SectionDraft = {
  tempId: string;
  dbId?: string;       // present if loaded from DB
  title: string;
  questions: QuestionDraft[];
};

const TYPE_KEYS = ["scale", "yes_no", "text", "number"] as const;

function uid() {
  return Math.random().toString(36).slice(2);
}

function fromTemplate(template: TemplateWithStructure): SectionDraft[] {
  return template.assessment_sections.map((s) => ({
    tempId: uid(),
    dbId: s.id,
    title: s.title,
    questions: s.assessment_questions.map((q) => ({
      tempId: uid(),
      dbId: q.id,
      text: q.text,
      type: q.question_type as QuestionDraft["type"],
      maxScore: q.max_score,
      minScore: q.min_score,
    })),
  }));
}

export function AssessmentFormEditor({ template }: { template: TemplateWithStructure }) {
  const t = useTranslations("forms.builder");
  const tEditor = useTranslations("forms.editor");
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [instructions, setInstructions] = useState(template.instructions ?? "");
  const [sendOnFirst, setSendOnFirst] = useState(template.send_on_first_appointment);
  const [reassessDays, setReassessDays] = useState(template.reassessment_interval_days ?? 0);
  const [sections, setSections] = useState<SectionDraft[]>(() => fromTemplate(template));
  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);

  function addSection() {
    setSections((prev) => [...prev, { tempId: uid(), title: "", questions: [] }]);
  }

  function removeSection(tempId: string) {
    setSections((prev) => {
      const sec = prev.find((s) => s.tempId === tempId);
      if (sec?.dbId) {
        setDeletedSectionIds((ids) => [...ids, sec.dbId!]);
        // mark all its existing questions as deleted too
        const qIds = sec.questions.filter((q) => q.dbId).map((q) => q.dbId!);
        if (qIds.length > 0) setDeletedQuestionIds((ids) => [...ids, ...qIds]);
      }
      return prev.filter((s) => s.tempId !== tempId);
    });
  }

  function updateSectionTitle(tempId: string, title: string) {
    setSections((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, title } : s)));
  }

  function addQuestion(tempId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.tempId === tempId
          ? { ...s, questions: [...s.questions, { tempId: uid(), text: "", type: "scale", maxScore: 4, minScore: 0 }] }
          : s
      )
    );
  }

  function removeQuestion(sectionTempId: string, qTempId: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.tempId !== sectionTempId) return s;
        const q = s.questions.find((q) => q.tempId === qTempId);
        if (q?.dbId) setDeletedQuestionIds((ids) => [...ids, q.dbId!]);
        return { ...s, questions: s.questions.filter((q) => q.tempId !== qTempId) };
      })
    );
  }

  function updateQuestion(sectionTempId: string, qTempId: string, patch: Partial<QuestionDraft>) {
    setSections((prev) =>
      prev.map((s) =>
        s.tempId === sectionTempId
          ? { ...s, questions: s.questions.map((q) => (q.tempId === qTempId ? { ...q, ...patch } : q)) }
          : s
      )
    );
  }

  function moveUp(sectionTempId: string, idx: number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.tempId !== sectionTempId || idx === 0) return s;
        const qs = [...s.questions];
        [qs[idx - 1], qs[idx]] = [qs[idx], qs[idx - 1]];
        return { ...s, questions: qs };
      })
    );
  }

  function moveDown(sectionTempId: string, idx: number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.tempId !== sectionTempId || idx >= s.questions.length - 1) return s;
        const qs = [...s.questions];
        [qs[idx], qs[idx + 1]] = [qs[idx + 1], qs[idx]];
        return { ...s, questions: qs };
      })
    );
  }

  function moveSectionUp(idx: number) {
    if (idx === 0) return;
    setSections((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveSectionDown(idx: number) {
    setSections((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  function submit(formData: FormData) {
    formData.set("template_id", template.id);
    formData.set("name", name);
    formData.set("description", description);
    formData.set("instructions", instructions);
    formData.set(
      "sections",
      JSON.stringify(
        sections.map((s, si) => ({
          dbId: s.dbId ?? null,
          title: s.title,
          order_index: si,
          questions: s.questions.map((q, qi) => ({
            dbId: q.dbId ?? null,
            text: q.text,
            type: q.type,
            maxScore: q.maxScore,
            minScore: q.minScore,
            order_index: qi,
          })),
        }))
      )
    );
    formData.set("send_on_first_appointment", sendOnFirst ? "true" : "false");
    formData.set("reassessment_interval_days", String(reassessDays || 0));
    formData.set("deleted_section_ids", JSON.stringify(deletedSectionIds));
    formData.set("deleted_question_ids", JSON.stringify(deletedQuestionIds));
    startTransition(async () => {
      await updateFormAction(formData);
    });
  }

  return (
    <form action={submit} className="space-y-[18px]">
      {/* Metadata */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] space-y-[12px]">
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("name")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("description")}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholderShort")}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("instructionsLabelShort")}</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition resize-none"
          />
        </div>
        <label className="flex items-start gap-[8px] cursor-pointer select-none pt-[2px]">
          <input
            type="checkbox"
            checked={sendOnFirst}
            onChange={(e) => setSendOnFirst(e.target.checked)}
            className="mt-[2px] accent-[#0F6E56]"
          />
          <span>
            <span className="text-[13px] font-medium text-[#0F1A2E] block">{t("sendOnFirst")}</span>
            <span className="text-[11px] text-[#A09E98] block">{t("sendOnFirstHint")}</span>
          </span>
        </label>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("reassessLabel")}</label>
          <input
            type="number"
            min={0}
            value={reassessDays}
            onChange={(e) => setReassessDays(Math.max(0, parseInt(e.target.value || "0", 10)))}
            className="w-[120px] px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
          <p className="text-[11px] text-[#A09E98] mt-[4px]">{t("reassessHint")}</p>
        </div>
      </div>

      {/* All sections (existing + new) */}
      {sections.length > 0 && (
        <div className="space-y-[8px]">
          <p className="text-[11px] font-medium text-[#6B6A66]">{tEditor("sectionsTitle")}</p>
          {sections.map((section, si) => (
            <div key={section.tempId} className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
              <div className="flex items-center gap-[8px] px-[14px] py-[10px] border-b border-black/[.06] bg-[#FAFAF8]">
                {/* Section reorder */}
                <div className="flex flex-col gap-[1px] shrink-0">
                  <button
                    type="button"
                    onClick={() => moveSectionUp(si)}
                    disabled={si === 0}
                    className="h-4 w-4 flex items-center justify-center rounded text-[#D3D1C7] hover:text-[#0F1A2E] disabled:opacity-20"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSectionDown(si)}
                    disabled={si === sections.length - 1}
                    className="h-4 w-4 flex items-center justify-center rounded text-[#D3D1C7] hover:text-[#0F1A2E] disabled:opacity-20"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSectionTitle(section.tempId, e.target.value)}
                  placeholder={t("sectionPlaceholder")}
                  className="flex-1 px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[12px] font-medium text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition uppercase"
                />
                {section.dbId && (
                  <span className="text-[9px] font-medium text-[#A09E98] shrink-0 bg-[#F4F3EF] rounded px-[5px] py-[2px]">
                    {tEditor("existing")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeSection(section.tempId)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 transition shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <div className="px-[14px] py-[10px] space-y-[6px]">
                {section.questions.map((q, qi) => (
                  <div key={q.tempId} className="flex items-start gap-[6px] bg-[#FAFAF8] rounded-[8px] px-[10px] py-[8px]">
                    <GripVertical className="h-3.5 w-3.5 text-[#D3D1C7] mt-[7px] shrink-0" />
                    <div className="flex-1 space-y-[5px]">
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(section.tempId, q.tempId, { text: e.target.value })}
                        placeholder={t("questionPlaceholder")}
                        className="w-full px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                      />
                      <div className="flex items-center gap-[8px]">
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(section.tempId, q.tempId, {
                              type: e.target.value as QuestionDraft["type"],
                              maxScore: e.target.value === "yes_no" ? 1 : 4,
                            })
                          }
                          className="px-[8px] py-[4px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] outline-none bg-white"
                        >
                          {TYPE_KEYS.map((val) => (
                            <option key={val} value={val}>{t(`typeLabels.${val}`)}</option>
                          ))}
                        </select>
                        {(q.type === "scale" || q.type === "number") && (
                          <div className="flex items-center gap-[4px]">
                            <span className="text-[10px] text-[#A09E98]">{t("maxScoreShort")}</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={q.maxScore}
                              onChange={(e) => updateQuestion(section.tempId, q.tempId, { maxScore: Number(e.target.value) })}
                              className="w-14 px-[6px] py-[3px] rounded-[6px] border border-black/[.10] text-[11px] text-center outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-[2px] mt-[2px] shrink-0">
                      <button
                        type="button"
                        onClick={() => moveUp(section.tempId, qi)}
                        disabled={qi === 0}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(section.tempId, qi)}
                        disabled={qi === section.questions.length - 1}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(section.tempId, q.tempId)}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addQuestion(section.tempId)}
                  className="flex items-center gap-[5px] text-[11px] text-[#0F6E56] hover:text-[#085041] transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("addQuestion")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-dashed border-black/[.15] rounded-[10px] px-[14px] py-[10px] w-full justify-center hover:border-[#0F6E56] hover:text-[#0F6E56] transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("addSectionNew")}
      </button>

      <div className="flex items-center justify-end bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[12px]">
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] px-[16px] py-[8px] transition"
        >
          {isPending ? t("saving") : tEditor("saveChanges")}
        </button>
      </div>
    </form>
  );
}
