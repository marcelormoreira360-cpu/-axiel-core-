import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getInvitationByToken } from "@/services/assessment-invitation-service";
import { PublicAssessmentForm } from "@/components/public-assessment-form";
import { PublicCaptureForm } from "@/components/public-capture-form";
import enPublic from "@/messages/en/publicForm.json";
import ptPublic from "@/messages/pt-BR/publicForm.json";

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
  const data = await getInvitationByToken(token);

  if (data.status !== "ok") {
    // Mensagem específica: já respondido x expirado x inválido. Sem template aqui,
    // então usa o idioma do ambiente (cookie/Accept-Language).
    const t = await getTranslations("publicForm");
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

  // IDIOMA FIXO PELO FORMULÁRIO: cada link/QR abre no idioma do próprio template
  // (o QR em PT sempre em português, o EN sempre em inglês), independente do
  // idioma do celular/cookie. Sem seletor de idioma para não desalinhar a interface
  // das perguntas.
  const tplLocale = (data.template as { locale?: string }).locale;
  const formLocale = tplLocale === "en" ? "en" : "pt-BR";
  const m = formLocale === "en" ? enPublic : ptPublic;
  const intro = data.isPublic
    ? m.capture.publicIntro
    : m.greeting.replace("{name}", data.patientName ?? "");

  return (
    <NextIntlClientProvider locale={formLocale} messages={{ publicForm: m }}>
      <div className="min-h-screen bg-[#FAFAF8] py-[32px] px-[16px]">
        <div className="max-w-[640px] mx-auto">
          {/* Header */}
          <div className="mb-[24px]">
            <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[4px]">
              {m.eyebrow}
            </p>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">
              {data.template.name}
            </h1>
            <p className="text-[13px] text-[#A09E98] mt-[2px]">{intro}</p>
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
            {m.secureFooter}
          </p>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
