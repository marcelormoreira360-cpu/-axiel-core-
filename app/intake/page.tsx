import { redirect } from "next/navigation";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { IntakeFormBuilder } from "@/components/intake-form-builder";
import { LimitedList } from "@/components/limited-list";
import { getCurrentUserProfile } from "@/services/user-service";
import { createIntakeFormWithQuestions, getActiveIntakeForm, getIntakeForms } from "@/services/intake-service";
import type { IntakeQuestionType } from "@/lib/types";

export default async function IntakePage() {
  const profile = await getCurrentUserProfile();
  const [forms, activeForm] = await Promise.all([getIntakeForms(profile?.clinic_id ?? undefined), getActiveIntakeForm(profile?.clinic_id ?? undefined)]);

  async function createIntakeAction(formData: FormData) {
    "use server";

    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic before creating intake forms.");

    const labels = formData.getAll("question_label").map(String);
    const types = formData.getAll("question_type").map(String) as IntakeQuestionType[];
    const required = formData.getAll("question_required").map(String);

    await createIntakeFormWithQuestions({
      clinic_id: profile.clinic_id,
      name: String(formData.get("name") ?? "Patient Intake"),
      description: String(formData.get("description") ?? "").trim() || null,
      questions: labels.map((label, index) => ({
        label,
        question_type: types[index] ?? "short_text",
        is_required: required[index] === "true",
      })),
    });

    redirect("/intake");
  }

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">PATIENT INTAKE</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Intake forms</h1>
        <p className="mt-3 max-w-2xl text-black/55">Crie perguntas simples uma vez. Use-as com todos os pacientes desta clínica.</p>
      </header>

      <section className="mb-6">
        <Card className="bg-axiel-ink text-white max-w-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/55">Formulário ativo</p>
            <ClipboardList className="h-5 w-5 text-white/40" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{activeForm?.name ?? "Nenhum formulário ainda"}</p>
          <p className="mt-1 text-sm text-white/45">{activeForm ? `${activeForm.intake_questions.length} perguntas` : "Crie seu primeiro formulário abaixo"}</p>
        </Card>
      </section>

      {!profile?.clinic_id ? (
        <Card>This user needs to be assigned to a clinic before creating intake forms.</Card>
      ) : (
        <IntakeFormBuilder action={createIntakeAction} />
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Saved forms</h2>
        {forms.length === 0 ? (
          <EmptyState icon={<FilePlus2 className="h-7 w-7" />} title="No intake forms yet" text="Create your first intake form so every patient starts with a clear first step." href="/intake" action="Create intake form" />
        ) : (
          <LimitedList
            items={forms}
            className="grid gap-3"
            detailsLabel={`View ${Math.max(forms.length - 5, 0)} more forms`}
            renderItem={(form) => (
              <Card key={form.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{form.name}</h3>
                  <p className="mt-1 text-sm text-black/50">{form.description ?? "No description"}</p>
                </div>
                <span className="rounded-full bg-axiel-soft px-3 py-1 text-xs font-medium">{form.is_active ? "Active" : "Inactive"}</span>
              </Card>
            )}
          />
        )}
      </section>
    </Shell>
  );
}
