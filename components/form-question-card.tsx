"use client";

import { X } from "lucide-react";
import { QUESTION_TYPES, type FormQuestionType } from "@/modules/forms/question-types";
import { ButtonSecondary } from "@/components/button";

export type EditableQuestion = {
  id: string;
  label: string;
  question_type: FormQuestionType;
  is_required: boolean;
  options: string;
};

export function FormQuestionCard({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: EditableQuestion;
  index: number;
  onChange: (question: EditableQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-axiel-line bg-white dark:bg-[#111827] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-axiel-text-primary">Question {index + 1}</p>
        <ButtonSecondary type="button" className="px-3 py-2 text-sm" onClick={onRemove} aria-label="Remove question">
          <X className="h-4 w-4" />
        </ButtonSecondary>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="text-sm font-medium text-axiel-text-secondary">Question</span>
          <input
            name="question_label"
            className="mt-2 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
            value={question.label}
            onChange={(event) => onChange({ ...question, label: event.target.value })}
            placeholder="Write a simple question"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-axiel-text-secondary">Type</span>
          <select
            name="question_type"
            className="mt-2 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
            value={question.question_type}
            onChange={(event) => onChange({ ...question, question_type: event.target.value as FormQuestionType })}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
      </div>

      {question.question_type === "multiple_choice" && (
        <label className="mt-4 block">
          <span className="text-sm font-medium text-axiel-text-secondary">Options</span>
          <input
            className="mt-2 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
            value={question.options}
            onChange={(event) => onChange({ ...question, options: event.target.value })}
            placeholder="Option A, Option B, Option C"
          />
        </label>
      )}

      <label className="mt-4 flex items-center gap-3 text-sm text-axiel-text-secondary">
        <input
          name="question_required"
          type="checkbox"
          checked={question.is_required}
          onChange={(event) => onChange({ ...question, is_required: event.target.checked })}
          className="h-4 w-4 rounded border-axiel-line"
        />
        Required
      </label>
    </div>
  );
}
