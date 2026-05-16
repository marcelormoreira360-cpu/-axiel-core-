import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { getAiValidationEvents, getLatestAiInsight } from "@/services/ai-insight-service";
import { getPatientById } from "@/services/patient-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; generated?: string }>;
};

export default async function PatientInsightsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const insight = await getLatestAiInsight(id);
  const validationEvents = insight ? await getAiValidationEvents(insight.id) : [];

  return (
    <Shell>
      <div className="mb-5 pt-4">
        <Link href={`/patients/${patient.id}`} className="inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/65">
          <ArrowLeft className="h-4 w-4" /> Back to patient
        </Link>
      </div>
      <AiInsightPanel patient={patient} insight={insight} validationEvents={validationEvents} error={error ? decodeURIComponent(error) : undefined} />
    </Shell>
  );
}
