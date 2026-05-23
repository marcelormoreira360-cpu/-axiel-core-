import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { getAiValidationEvents, getLatestAiInsight } from "@/services/ai-insight-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; generated?: string }>;
};

export default async function PatientInsightsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const clinic = await getCurrentClinic();
  const patient = await getPatientById(id, clinic?.id); // A-06
  if (!patient) notFound();

  const insight = await getLatestAiInsight(id);
  const validationEvents = insight ? await getAiValidationEvents(insight.id) : [];

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[20px]">
        <Link
          href={`/patients/${patient.id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">AI Insights</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">{patient.full_name}</p>
        </div>
      </div>
      <AiInsightPanel patient={patient} insight={insight} validationEvents={validationEvents} error={error ? decodeURIComponent(error) : undefined} />
    </Shell>
  );
}
