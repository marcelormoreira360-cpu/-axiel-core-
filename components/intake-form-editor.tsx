"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, ChevronUp, ChevronDown, Trash2, Check, AlertCircle, Wand2 } from "lucide-react";
import type { IntakeFormWithQuestions, IntakeQuestionType } from "@/lib/types";
import { INTAKE_TEMPLATES } from "@/modules/intake/templates";
import { ANATOMY_MAP_KEYS } from "@/modules/intake/anatomy-maps";
import { updateIntakeFormAction, type IntakeEditState } from "@/app/intake/[id]/edit/actions";

const TYPE_KEYS: IntakeQuestionType[] = ["short_text", "long_text", "number", "date", "yes_no", "body_map"];

type QDraft = {
  tempId: string;
  dbId?: string;
  label: string;
  question_type: IntakeQuestionType;
  is_required: boolean;
  placeholder: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export function IntakeFormEditor({ form }: { form: IntakeFormWithQuestions }) {
  const t = useTranslations("intake");
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? "");
  const [questions, setQuestions] = useState<QDraft[]>(() =>
    form.intake_questions.map((q) => ({
      tempId: uid(),
      dbId: q.id,
      label: q.label,
      question_type: q.question_type,
      is_required: q.is_required,
      placeholder: q.placeholder ?? "",
    })),
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [state, setState] = useState<IntakeEditState>(null);

  function markDeleted(q: QDraft) {
    if (q.dbId) setDeletedIds((ids) => [...ids, q.dbId!]);
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { tempId: uid(), label: "", question_type: "long_text", is_required: false, placeholder: "" }]);
  }
  function removeQuestion(tempId: string) {
    setQuestions((prev) => {
      const q = prev.find((x) => x.tempId === tempId);
      if (q) markDeleted(q);
      return prev.filter((x) => x.tempId !== tempId);
    });
  }
  function update(tempId: string, patch: Partial<QDraft>) {
    setQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)));
  }
  function move(idx: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  function loadTemplate(key: string) {
    const tpl = INTAKE_TEMPLATES.find((x) => x.key === key);
    if (!tpl) return;
    // marca as perguntas existentes para exclusão e substitui pelo modelo
    setQuestions((prev) => {
      prev.forEach(markDeleted);
      return tpl.questions.map((q) => ({ tempId: uid(), label: q.label, question_type: q.question_type, is_required: q.is_required, placeholder: "" }));
    });
    if (!name.trim() || form.intake_questions.length === 0) setName(tpl.name);
  }

  function submit() {
    const fd = new FormData();
    fd.set("form_id", form.id);
    fd.set("name", name);
    fd.set("description", description);
    fd.set("deleted_question_ids", JSON.stringify(deletedIds));
    fd.set(
      "questions",
      JSON.stringify(
        questions.map((q, i) => ({
          dbId: q.dbId ?? null,
          label: q.label,
          question_type: q.question_type,
          is_required: q.is_required,
          placeholder: q.question_type === "body_map" ? q.placeholder : "",
          display_order: i,
        })),
      ),
    );
    startTransition(async () => {
      const res = await updateIntakeFormAction(fd);
      setState(res);
      if (res?.ok) setDeletedIds([]);
    });
  }

  return (
    <div className="space-y-[18px] max-w-3xl">
      {/* Metadata + modelo */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] space-y-[12px]">
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">{t("descLabel")}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descPlaceholder")}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div className="flex items-center gap-[8px] flex-wrap pt-[2px]">
          <span className="inline-flex items-center gap-[5px] text-[11px] font-medium text-[#6B6A66]">
            <Wand2 className="h-3.5 w-3.5 text-[#0F6E56]" /> {t("startFromTemplate")}:
          </span>
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) { loadTemplate(e.target.value); e.target.value = ""; } }}
            className="px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none bg-white"
          >
            <option value="">—</option>
            {INTAKE_TEMPLATES.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.name}</option>
            ))}
          </select>
          <span className="text-[10px] text-[#A09E98]">{t("templateHint")}</span>
        </div>
      </div>

      {/* Perguntas */}
      <div className="space-y-[8px]">
        <p className="text-[11px] font-medium text-[#6B6A66]">{t("questions")}</p>
        {questions.length === 0 && (
          <p className="text-[12px] text-[#A09E98] bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[12px]">{t("empty")}</p>
        )}
        {questions.map((q, i) => (
          <div key={q.tempId} className="flex items-start gap-[6px] bg-white border border-black/[.07] rounded-[10px] px-[12px] py-[10px]">
            <div className="flex-1 space-y-[6px]">
              <input
                type="text"
                value={q.label}
                onChange={(e) => update(q.tempId, { label: e.target.value })}
                placeholder={t("questionPlaceholder")}
                className="w-full px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
              <div className="flex items-center gap-[10px] flex-wrap">
                <select
                  value={q.question_type}
                  onChange={(e) => update(q.tempId, { question_type: e.target.value as IntakeQuestionType })}
                  className="px-[8px] py-[4px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] outline-none bg-white"
                >
                  {TYPE_KEYS.map((k) => (
                    <option key={k} value={k}>{t(`types.${k}`)}</option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-[5px] text-[11px] text-[#6B6A66] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.is_required}
                    onChange={(e) => update(q.tempId, { is_required: e.target.checked })}
                    className="accent-[#0F6E56]"
                  />
                  {t("required")}
                </label>
                {q.question_type === "body_map" && (
                  <select
                    value={q.placeholder}
                    onChange={(e) => update(q.tempId, { placeholder: e.target.value })}
                    className="px-[8px] py-[4px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] outline-none bg-white"
                  >
                    <option value="">{t("chooseMap")}</option>
                    {ANATOMY_MAP_KEYS.map((k) => (
                      <option key={k} value={k}>{t(`maps.${k}`)}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-[2px] mt-[2px] shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
              <button type="button" onClick={() => removeQuestion(q.tempId)} className="w-5 h-5 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-dashed border-black/[.15] rounded-[10px] px-[14px] py-[10px] w-full justify-center hover:border-[#0F6E56] hover:text-[#0F6E56] transition"
        >
          <Plus className="h-3.5 w-3.5" /> {t("addQuestion")}
        </button>
      </div>

      {/* Salvar */}
      <div className="flex items-center justify-end gap-3 bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[12px]">
        {state?.ok && <span className="text-[12px] text-[#0F6E56]">{t("saved")}</span>}
        {state?.error && <span className="inline-flex items-center gap-1 text-[12px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</span>}
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || isPending}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] px-[16px] py-[8px] transition"
        >
          <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
