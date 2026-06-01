import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getInvitationByToken } from "@/services/assessment-invitation-service";
import { PublicAssessmentForm } from "@/components/public-assessment-form";

export const metadata: Metadata = {
  title: "Questionário | AXIEL Core",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function PublicFormPage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations("publicForm");
  const data = await getInvitationByToken(token);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-black/[.07] rounded-[16px] px-[24px] py-[32px] max-w-[400px] w-full text-center">
          <p className="text-[32px] mb-[12px]">⏰</p>
          <h1 className="text-[18px] font-medium text-[#0F1A2E] mb-[8px]">{t("invalidTitle")}</h1>
          <p className="text-[13px] text-[#A09E98]">
            {t("invalidDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-[32px] px-[16px]">
      <div className="max-w-[640px] mx-auto">
        {/* Header */}
        <div className="mb-[24px]">
          <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[4px]">
            {t("eyebrow")}
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">
            {data.template.name}
          </h1>
          <p className="text-[13px] text-[#A09E98] mt-[2px]">{t("greeting", { name: data.patientName })}</p>
        </div>

        <PublicAssessmentForm
          template={data.template}
          token={token}
        />

        <p className="text-center text-[11px] text-[#D3D1C7] mt-[32px]">
          {t("secureFooter")}
        </p>
      </div>
    </div>
  );
}
