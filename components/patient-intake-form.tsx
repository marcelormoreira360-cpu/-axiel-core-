import type { IntakeFormWithQuestions, IntakeResponse } from "@/lib/types";
import { anatomyMapSrc } from "@/modules/intake/anatomy-maps";
import { BodyMapField } from "@/components/body-map-input";

type Props = {
  form: IntakeFormWithQuestions;
  existingResponses?: IntakeResponse[];
  action: (formData: FormData) => Promise<void>;
};

function getExistingAnswer(questionId: string, responses: IntakeResponse[]) {
  return responses.find((response) => response.question_id === questionId)?.answer ?? "";
}

export function PatientIntakeForm({ form, existingResponses = [], action }: Props) {
  return (
    <form action={action} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md md:p-8">
      <div className="mb-8">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold dark:text-[#9FE1CB]">FORMULÁRIO DE INTAKE</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{form.name}</h2>
        {form.description && <p className="mt-2 text-black/55">{form.description}</p>}
      </div>

      <input type="hidden" name="form_id" value={form.id} />

      <div className="space-y-5">
        {form.intake_questions.map((question) => {
          const baseClass = "mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-4 text-base outline-none placeholder:text-black/30 focus:border-black/30 dark:focus:border-white/30";
          const value = getExistingAnswer(question.id, existingResponses);

          return (
            <div key={question.id}>
              <label className="text-sm font-semibold text-black/65">
                {question.label} {question.is_required && <span className="text-axiel-gold dark:text-[#9FE1CB]">*</span>}
              </label>
              <input type="hidden" name="question_id" value={question.id} />

              {question.question_type === "body_map" ? (
                <div className="mt-2">
                  <BodyMapField
                    name={`answer_${question.id}`}
                    src={anatomyMapSrc(question.placeholder)}
                    defaultValue={value}
                  />
                </div>
              ) : question.question_type === "long_text" ? (
                <textarea name={`answer_${question.id}`} rows={5} defaultValue={value} required={question.is_required} className={`${baseClass} resize-none`} />
              ) : question.question_type === "yes_no" ? (
                <select name={`answer_${question.id}`} defaultValue={value} required={question.is_required} className={baseClass}>
                  <option value="">Selecione</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              ) : (
                <input
                  name={`answer_${question.id}`}
                  type={question.question_type === "number" ? "number" : question.question_type === "date" ? "date" : "text"}
                  defaultValue={value}
                  required={question.is_required}
                  className={baseClass}
                />
              )}
            </div>
          );
        })}
      </div>

      <button type="submit" className="mt-8 min-h-14 w-full rounded-lg bg-axiel-blue px-6 py-4 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5">
        Salvar respostas
      </button>
    </form>
  );
}
