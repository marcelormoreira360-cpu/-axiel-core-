"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { Card } from "@/components/card";
import { BodyMapField } from "@/components/body-map-field";
import type { FormQuestion } from "@/modules/forms/question-types";

function FieldForQuestion({ question }: { question: FormQuestion }) {
  if (question.question_type === "long_text") {
    return <textarea className="mt-4 min-h-32 w-full rounded-xl border border-axiel-line bg-white px-4 py-3 outline-none focus:border-axiel-primary" placeholder="Write a short answer" />;
  }

  if (question.question_type === "yes_no") {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="rounded-xl border border-axiel-line bg-white px-4 py-3 text-left hover:border-axiel-primary">Yes</button>
        <button type="button" className="rounded-xl border border-axiel-line bg-white px-4 py-3 text-left hover:border-axiel-primary">No</button>
      </div>
    );
  }

  if (question.question_type === "multiple_choice") {
    return (
      <div className="mt-4 grid gap-3">
        {(question.options ?? ["Option A", "Option B", "Option C"]).slice(0, 5).map((option) => (
          <button key={option} type="button" className="rounded-xl border border-axiel-line bg-white px-4 py-3 text-left hover:border-axiel-primary">{option}</button>
        ))}
      </div>
    );
  }

  if (question.question_type === "scale_1_10") {
    return (
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" className="rounded-xl border border-axiel-line bg-white px-3 py-3 text-sm hover:border-axiel-primary">{value}</button>
        ))}
      </div>
    );
  }

  if (question.question_type === "body_map") {
    return <div className="mt-4"><BodyMapField /></div>;
  }

  return <input className="mt-4 w-full rounded-xl border border-axiel-line bg-white px-4 py-3 outline-none focus:border-axiel-primary" placeholder="Write a short answer" />;
}

export function PatientFormView({ formName, questions }: { formName: string; questions: FormQuestion[] }) {
  const [step, setStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const question = questions[step];
  const progress = useMemo(() => Math.round(((step + 1) / Math.max(questions.length, 1)) * 100), [questions.length, step]);

  if (isDone) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-5 text-2xl font-semibold text-axiel-text-primary">Thank you.</h1>
        <p className="mt-3 text-axiel-text-secondary">Your clinic received your answers.</p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-axiel-text-secondary">{formName}</p>
        <div className="mt-3 h-2 rounded-full bg-axiel-background">
          <div className="h-2 rounded-full bg-axiel-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <p className="text-sm text-axiel-text-secondary">Question {step + 1} of {questions.length}</p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-axiel-text-primary">{question?.label ?? "How are you feeling today?"}</h1>

      {question ? <FieldForQuestion question={question} /> : null}

      <div className="mt-8 flex justify-between gap-3">
        <ButtonSecondary type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>Back</ButtonSecondary>
        <ButtonPrimary
          type="button"
          onClick={() => {
            if (step >= questions.length - 1) setIsDone(true);
            else setStep((current) => current + 1);
          }}
        >
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </ButtonPrimary>
      </div>
    </Card>
  );
}
