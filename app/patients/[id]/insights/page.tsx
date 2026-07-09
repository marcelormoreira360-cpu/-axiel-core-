import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function describeChannel(t: Translator, label: string, status: DeliveryStatus, err?: string): string {
  switch (status) {
    case "sent": return t("channelSent", { label });
    case "skipped_no_contact": return t("channelSkipped", { label, contact: label === "E-mail" ? t("contactEmail") : t("contactPhone") });
    case "failed": return err ? t("channelFailedWithError", { label, error: err }) : t("channelFailed", { label });
    default: return t("channelNoReport", { label });
  }
}

export default async function PatientInsightsPage({ params, searchParams }: Props) {
  const t = await getTranslations("insights.patientPage");
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
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">{patient.full_name}</p>
        </div>
      </div>
      {/* Resultado do envio do relatório ao paciente */}
      {deliveryResult && (() => {
        const allSent = deliveryResult.email === "sent" || deliveryResult.whatsapp === "sent";
        const anyFailed = deliveryResult.email === "failed" || deliveryResult.whatsapp === "failed";
        const tone = anyFailed
          ? "bg-[#FDECEC] dark:bg-[#B42318]/[.18] border-[#F5B5B5] dark:border-[#B42318]/40 text-[#8A1F1F] dark:text-[#F2B8B5]"
          : allSent
            ? "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border-[#9FE1CB] dark:border-[#0F6E56]/40 text-[#085041] dark:text-[#9FE1CB]"
            : "bg-[#FBF3E0] dark:bg-[#C77D17]/[.15] border-[#EBD9A8] dark:border-[#C77D17]/30 text-[#7A5A12] dark:text-[#E8B04B]";
        return (
          <div className={`mb-4 border rounded-[10px] px-[15px] py-[11px] ${tone}`}>
            <p className="text-[12px] font-medium mb-[3px]">{t("deliveryTitle")}</p>
            <p className="text-[11px] leading-[1.6]">{describeChannel(t, "E-mail", deliveryResult.email, deliveryResult.emailError)}</p>
            <p className="text-[11px] leading-[1.6]">{describeChannel(t, "WhatsApp", deliveryResult.whatsapp, deliveryResult.whatsappError)}</p>
          </div>
        );
      })()}

      {/* Sugestão de follow-up pós-aprovação */}
      {approved === "1" && suggestFollowup === "1" && (
        <div className="mb-4 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border border-[#9FE1CB] dark:border-[#0F6E56]/40 rounded-[10px] px-[15px] py-[11px] flex items-center gap-[10px]">
          <svg className="w-4 h-4 text-[#0F6E56] dark:text-[#9FE1CB] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p className="flex-1 text-[12px] text-[#085041] dark:text-[#9FE1CB]">{t("followupPrompt")}</p>
          <Link
            href={`/follow-ups?patient_id=${id}`}
            className="shrink-0 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-[10px] py-[4px] rounded-[6px] transition"
          >
            {t("createFollowup")}
          </Link>
        </div>
      )}

      <AiInsightPanel patient={patient} insight={insight} validationEvents={validationEvents} error={error ? decodeURIComponent(error) : undefined} />
    </Shell>
  );
}
