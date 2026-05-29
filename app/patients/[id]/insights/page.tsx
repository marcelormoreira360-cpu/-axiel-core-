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
  searchParams: Promise<{ error?: string; generated?: string; approved?: string; suggest_followup?: string }>;
};

export default async function PatientInsightsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, approved, suggest_followup: suggestFollowup } = await searchParams;
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
      {/* Sugestão de follow-up pós-aprovação */}
      {approved === "1" && suggestFollowup === "1" && (
        <div className="mb-4 bg-[#E1F5EE] border border-[#9FE1CB] rounded-[10px] px-[15px] py-[11px] flex items-center gap-[10px]">
          <svg className="w-4 h-4 text-[#0F6E56] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p className="flex-1 text-[12px] text-[#085041]">Insight aprovado. Deseja criar um follow-up para este paciente?</p>
          <Link
            href={`/follow-ups?patient_id=${id}`}
            className="shrink-0 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-[10px] py-[4px] rounded-[6px] transition"
          >
            Criar follow-up
          </Link>
        </div>
      )}

      <AiInsightPanel patient={patient} insight={insight} validationEvents={validationEvents} error={error ? decodeURIComponent(error) : undefined} />
    </Shell>
  );
}
