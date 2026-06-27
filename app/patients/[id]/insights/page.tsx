import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { getAiValidationEvents, getLatestAiInsight } from "@/services/ai-insight-service";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; generated?: string; approved?: string; suggest_followup?: string; delivery?: string }>;
};

type DeliveryStatus = "sent" | "skipped_no_contact" | "failed" | "no_report";
type DeliveryResult = { email: DeliveryStatus; whatsapp: DeliveryStatus; emailError?: string; whatsappError?: string };

function describeChannel(label: string, status: DeliveryStatus, err?: string): string {
  switch (status) {
    case "sent": return `✓ ${label}: enviado`;
    case "skipped_no_contact": return `— ${label}: não enviado (paciente sem ${label === "E-mail" ? "e-mail" : "telefone"} cadastrado)`;
    case "failed": return `✗ ${label}: falhou${err ? ` (${err})` : ""}`;
    default: return `— ${label}: sem relatório`;
  }
}

export default async function PatientInsightsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, approved, suggest_followup: suggestFollowup, delivery } = await searchParams;

  let deliveryResult: DeliveryResult | null = null;
  if (delivery) {
    try { deliveryResult = JSON.parse(decodeURIComponent(delivery)) as DeliveryResult; } catch { deliveryResult = null; }
  }
  const clinic = await getCurrentClinic();
  const patient = await getPatientById(id, clinic?.id); // A-06
  if (!patient) notFound();

  const insight = await getLatestAiInsight(id);
  const validationEvents = insight ? await getAiValidationEvents(insight.id) : [];

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[20px]">
        <BackLink
          fallbackHref={`/patients/${patient.id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">AI Insights</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">{patient.full_name}</p>
        </div>
      </div>
      {/* Resultado do envio do relatório ao paciente */}
      {deliveryResult && (() => {
        const allSent = deliveryResult.email === "sent" || deliveryResult.whatsapp === "sent";
        const anyFailed = deliveryResult.email === "failed" || deliveryResult.whatsapp === "failed";
        const tone = anyFailed
          ? "bg-[#FDECEC] border-[#F5B5B5] text-[#8A1F1F]"
          : allSent
            ? "bg-[#E1F5EE] border-[#9FE1CB] text-[#085041]"
            : "bg-[#FBF3E0] border-[#EBD9A8] text-[#7A5A12]";
        return (
          <div className={`mb-4 border rounded-[10px] px-[15px] py-[11px] ${tone}`}>
            <p className="text-[12px] font-medium mb-[3px]">Envio do relatório ao paciente</p>
            <p className="text-[11px] leading-[1.6]">{describeChannel("E-mail", deliveryResult.email, deliveryResult.emailError)}</p>
            <p className="text-[11px] leading-[1.6]">{describeChannel("WhatsApp", deliveryResult.whatsapp, deliveryResult.whatsappError)}</p>
          </div>
        );
      })()}

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
