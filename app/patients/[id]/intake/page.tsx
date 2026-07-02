import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { PatientIntakeForm } from "@/components/patient-intake-form";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getActiveIntakeForm, getPatientIntakeResponses, savePatientIntakeResponses } from "@/services/intake-service";

export default async function PatientIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ti = await getTranslations("intake");
  const clinic = await getCurrentClinic();
  const profile = await getCurrentUserProfile();
  const canEditForm = ["clinic_owner", "clinic_manager", "admin"].includes(profile?.role ?? "");
  const patient = await getPatientById(id, clinic?.id); // A-06
  const activeForm = patient ? await getActiveIntakeForm(patient.clinic_id) : null;
  const existingResponses = patient ? await getPatientIntakeResponses(patient.id) : [];

  async function saveResponsesAction(formData: FormData) {
    "use server";

    const patient = await getPatientById(id);
    if (!patient) throw new Error("Patient not found.");

    const formId = String(formData.get("form_id") ?? "");
    const questionIds = formData.getAll("question_id").map(String);

    await savePatientIntakeResponses({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      form_id: formId,
      responses: questionIds.map((questionId) => ({
        question_id: questionId,
        answer: String(formData.get(`answer_${questionId}`) ?? "").trim() || null,
      })),
    });

    redirect(`/patients/${patient.id}`);
  }

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <BackLink fallbackHref={patient ? `/patients/${patient.id}` : "/patients"} className="inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/65">
          <ArrowLeft className="h-4 w-4" /> {ti("back")}
        </BackLink>
        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{ti("fillTitle")}</h1>
            <p className="mt-3 text-black/55">{patient?.full_name ?? ti("patientFallback")}</p>
          </div>
          {canEditForm && activeForm && (
            <Link
              href={`/intake/${activeForm.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/65 hover:bg-axiel-soft dark:hover:bg-white/[.06] transition"
            >
              <Pencil className="h-3.5 w-3.5" /> {ti("editQuestions")}
            </Link>
          )}
        </div>
      </header>

      {!patient ? (
        <Card>{ti("patientFallback")}</Card>
      ) : !activeForm ? (
        <Card>
          <h2 className="text-xl font-semibold">{ti("fillNoForm")}</h2>
          <p className="mt-2 text-black/55">{ti("fillNoFormText")}</p>
          <Link href="/intake" className="mt-5 inline-flex rounded-lg bg-axiel-blue px-5 py-3 text-sm font-semibold text-white shadow-md">{ti("fillCreate")}</Link>
        </Card>
      ) : (
        <PatientIntakeForm form={activeForm} existingResponses={existingResponses} action={saveResponsesAction} />
      )}
    </Shell>
  );
}
