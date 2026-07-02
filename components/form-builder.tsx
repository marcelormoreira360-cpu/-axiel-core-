"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { Card } from "@/components/card";
import { FORM_CATEGORIES } from "@/modules/forms/question-types";
import type { EditableQuestion } from "@/components/form-question-card";
import { FormQuestionCard } from "@/components/form-question-card";

function newQuestion(index: number): EditableQuestion {
  return {
    id: `question-${Date.now()}-${index}`,
    label: "",
    question_type: "short_text",
    is_required: false,
    options: "",
  };
}

export function FormBuilder({ action }: { action?: (formData: FormData) => void | Promise<void> }) {
  const [questions, setQuestions] = useState<EditableQuestion[]>([
    { ...newQuestion(1), label: "What brings you in today?", question_type: "long_text", is_required: true },
    { ...newQuestion(2), label: "How are you feeling today?", question_type: "scale_1_10" },
  ]);

  const visibleQuestions = useMemo(() => questions.slice(0, 5), [questions]);

  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-axiel-text-primary">Form details</h2>
          <p className="mt-1 text-sm text-axiel-text-secondary">Keep it short and easy to complete.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-sm font-medium text-axiel-text-secondary">Form name</span>
            <input
              name="name"
              className="mt-2 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
              defaultValue="Initial Patient Intake"
              placeholder="Form name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-axiel-text-secondary">Category</span>
            <select
              name="category"
              className="mt-2 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
              defaultValue="Initial Assessment"
            >
              {FORM_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-axiel-text-secondary">Short description</span>
          <textarea
            name="description"
            className="mt-2 min-h-24 w-full rounded-xl border border-axiel-line bg-white dark:bg-[#111827] px-4 py-3 outline-none focus:border-axiel-primary"
            placeholder="Describe when this form should be used."
          />
        </label>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-semibold text-axiel-text-primary">Questions</h2>
            <p className="mt-1 text-sm text-axiel-text-secondary">Show up to 5 questions here. Add more later in View details.</p>
          </div>
          <ButtonSecondary type="button" onClick={() => setQuestions((current) => [...current, newQuestion(current.length + 1)])}>
            <Plus className="mr-2 h-4 w-4" /> Add question
          </ButtonSecondary>
        </div>

        {visibleQuestions.map((question, index) => (
          <FormQuestionCard
            key={question.id}
            question={question}
            index={index}
            onChange={(nextQuestion) => setQuestions((current) => current.map((item) => (item.id === question.id ? nextQuestion : item)))}
            onRemove={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
          />
        ))}

        {questions.length > 5 && (
          <details className="rounded-2xl border border-axiel-line bg-white dark:bg-[#111827] p-5">
            <summary className="cursor-pointer text-sm font-medium text-axiel-text-primary">View details</summary>
            <p className="mt-3 text-sm text-axiel-text-secondary">{questions.length - 5} extra questions are hidden to keep this page calm.</p>
          </details>
        )}
      </section>

      <input type="hidden" name="questions_json" value={JSON.stringify(questions)} />

      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        <ButtonSecondary type="button">Save draft</ButtonSecondary>
        <ButtonPrimary type="submit">Create Form</ButtonPrimary>
      </div>
    </form>
  );
}
