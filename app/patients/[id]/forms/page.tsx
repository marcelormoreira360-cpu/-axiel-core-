import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { ButtonSecondary } from "@/components/button";
import { listPatientFormSubmissions } from "@/services/form-service";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default async function PatientFormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submissions = await listPatientFormSubmissions(id);

  return (
    <Shell>
      <div className="min-h-screen bg-axiel-background p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <header>
            <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">PATIENT FORMS</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-axiel-text-primary">Forms</h1>
            <p className="mt-3 text-axiel-text-secondary">Simple answers and short summaries for this patient.</p>
          </header>

          <section className="space-y-4">
            {submissions.slice(0, 5).map((submission) => (
              <Card key={submission.id} className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-axiel-text-primary">{submission.form_name}</h2>
                  <p className="mt-1 text-sm text-axiel-text-secondary">{formatDate(submission.completed_at)} · {submission.summary}</p>
                </div>
                <ButtonSecondary>View answers</ButtonSecondary>
              </Card>
            ))}
          </section>

          <details className="rounded-2xl border border-axiel-line bg-white p-5">
            <summary className="cursor-pointer text-sm font-medium text-axiel-text-primary">View details</summary>
            <p className="mt-3 text-sm text-axiel-text-secondary">Older forms and full answers stay hidden until needed.</p>
          </details>

          <Link href={`/patients/${id}`} className="text-sm font-medium text-axiel-primary">Back to patient</Link>
        </div>
      </div>
    </Shell>
  );
}
