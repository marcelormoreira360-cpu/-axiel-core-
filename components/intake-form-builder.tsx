"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { questionTypeOptions } from "@/modules/intake/question-types";
import type { IntakeQuestionType } from "@/lib/types";

type DraftQuestion = {
  id: string;
  label: string;
  question_type: IntakeQuestionType;
  is_required: boolean;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function IntakeFormBuilder({ action }: Props) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { id: crypto.randomUUID(), label: "What is your main reason for this visit?", question_type: "long_text", is_required: true },
    { id: crypto.randomUUID(), label: "What would you like to improve first?", question_type: "short_text", is_required: false },
  ]);

  function updateQuestion(id: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  function addQuestion() {
    setQuestions((current) => [...current, { id: crypto.randomUUID(), label: "", question_type: "short_text", is_required: false }]);
  }

  function removeQuestion(id: string) {
    setQuestions((current) => current.filter((question) => question.id !== id));
  }

  return (
    <form action={action} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-black/60">Form name</label>
          <input name="name" defaultValue="Patient Intake" required className="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-4 outline-none focus:border-black/30" />
        </div>
        <div>
          <label className="text-sm font-semibold text-black/60">Description</label>
          <input name="description" placeholder="Simple intake before the first session" className="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-4 outline-none placeholder:text-black/30 focus:border-black/30" />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Questions</h2>
          <button type="button" onClick={addQuestion} className="inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Add question
          </button>
        </div>

        {questions.map((question, index) => (
          <div key={question.id} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <input type="hidden" name="question_label" value={question.label} />
            <input type="hidden" name="question_type" value={question.question_type} />
            <input type="hidden" name="question_required" value={question.is_required ? "true" : "false"} />

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-black/45">Question {index + 1}</p>
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(question.id)} className="rounded-lg p-2 text-black/35 hover:bg-axiel-soft hover:text-black">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_110px]">
              <input
                value={question.label}
                onChange={(event) => updateQuestion(question.id, { label: event.target.value })}
                placeholder="Write a simple question"
                className="rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none placeholder:text-black/30 focus:border-black/30"
              />
              <select
                value={question.question_type}
                onChange={(event) => updateQuestion(question.id, { question_type: event.target.value as IntakeQuestionType })}
                className="rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:border-black/30"
              >
                {questionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label className="flex items-center justify-center gap-2 rounded-2xl border border-axiel-line bg-white px-3 py-3 text-sm text-black/60">
                <input
                  type="checkbox"
                  checked={question.is_required}
                  onChange={(event) => updateQuestion(question.id, { is_required: event.target.checked })}
                />
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="submit" className="mt-8 min-h-14 w-full rounded-lg bg-axiel-blue px-6 py-4 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5">
        Save intake form
      </button>
    </form>
  );
}
