import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getInvitationByToken } from "@/services/assessment-invitation-service";
import { PublicAssessmentForm } from "@/components/public-assessment-form";
import { PublicCaptureForm } from "@/components/public-capture-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "Questionário | AXIEL Core",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ chain?: string }>;
};

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { chain } = await searchParams;
  const chainTokens = (chain ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const t = await getTranslations("publicForm");
  const data = await getInvitationByToken(token);

  if (data.status !== "ok") {
    // Mensagem específica: já respondido x expirado x inválido.
    const view =
      data.status === "completed"
        ? { icon: "✅", title: t("completedTitle"), desc: t("completedDesc") }
        : data.status === "expired"
          ? { icon: "⏰", title: t("expiredTitle"), desc: t("expiredDesc") }
          : { icon: "🔗", title: t("invalidTitle"), desc: t("invalidDesc") };
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-black/[.07] rounded-[16px] px-[24px] py-[32px] max-w-[400px] w-full text-center">
          <p className="text-[32px] mb-[12px]">{view.icon}</p>
          <h1 className="text-[18px] font-medium text-[#0F1A2E] mb-[8px]">{view.title}</h1>
          <p className="text-[13px] text-[#A09E98]">{view.desc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-[32px] px-[16px]">
      <div className="max-w-[640px] mx-auto">
        <div className="flex justify-end mb-[10px]">
          <LanguageSwitcher />
        </div>
        {/* Header */}
        <div className="mb-[24px]">
          <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[4px]">
            {t("eyebrow")}
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">
            {data.template.name}
          </h1>
          <p className="text-[13px] text-[#A09E98] mt-[2px]">
            {data.isPublic
              ? t("capture.publicIntro")
              : t("greeting", { name: data.patientName ?? "" })}
          </p>
        </div>

        {data.isPublic ? (
          <PublicCaptureForm template={data.template} token={token} />
        ) : (
          <PublicAssessmentForm
            template={data.template}
            token={token}
            chain={chainTokens}
          />
        )}

        <p className="text-center text-[11px] text-[#D3D1C7] mt-[32px]">
          {t("secureFooter")}
        </p>
      </div>
    </div>
  );
}
