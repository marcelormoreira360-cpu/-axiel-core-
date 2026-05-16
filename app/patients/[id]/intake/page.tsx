import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { PatientIntakeForm } from "@/components/patient-intake-form";
import { getPatientById } from "@/services/patient-service";
import { getActiveIntakeForm, getPatientIntakeResponses, savePatientIntakeResponses } from "@/services/intake-service";

export default async function PatientIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatientById(id);
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
        <Link href={patient ? `/patients/${patient.id}` : "/patients"} className="inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/65">
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">Patient intake</h1>
        <p className="mt-3 text-black/55">{patient?.full_name ?? "Patient"}</p>
      </header>

      {!patient ? (
        <Card>Patient not found.</Card>
      ) : !activeForm ? (
        <Card>
          <h2 className="text-xl font-semibold">No active intake form</h2>
          <p className="mt-2 text-black/55">Create an intake form first, then return to this patient.</p>
          <Link href="/intake" className="mt-5 inline-flex rounded-lg bg-axiel-blue px-5 py-3 text-sm font-semibold text-white shadow-md">Create intake form</Link>
        </Card>
      ) : (
        <PatientIntakeForm form={activeForm} existingResponses={existingResponses} action={saveResponsesAction} />
      )}
    </Shell>
  );
}
