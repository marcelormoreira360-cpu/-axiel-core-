import Link from "next/link";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";

const WEBHOOK_URL = "https://axiel-core-6ikl.vercel.app/api/voice/webhook";

export default async function VoiceSettingsPage() {
  const t = await getTranslations("settings.voice");
  return (
    <Shell>
      <div className="mb-7">
        <BackLink fallbackHref="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          <span className="rounded-full bg-axiel-gold/15 px-3 py-1 text-xs font-semibold text-axiel-gold">{t("badge")}</span>
        </div>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-5 max-w-2xl">
        {/* How it works */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">{t("howTitle")}</h2>
          <p className="mb-5 text-sm text-black/50">{t("howDesc")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: "1", title: t("howStep1Title"), desc: t("howStep1Desc") },
              { icon: "2", title: t("howStep2Title"), desc: t("howStep2Desc") },
              { icon: "3", title: t("howStep3Title"), desc: t("howStep3Desc") },
            ].map((step) => (
              <div key={step.icon} className="rounded-xl bg-axiel-soft p-4">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white">{step.icon}</div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs text-black/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Languages */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">{t("langTitle")}</h2>
          <p className="mb-4 text-sm text-black/50">{t("langDesc")}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { lang: t("langPtBr"), voice: "Polly.Camila-Neural", code: "pt-BR" },
              { lang: t("langPtPt"), voice: "Polly.Ines-Neural", code: "pt-PT" },
              { lang: t("langEnUs"), voice: "Polly.Joanna-Neural", code: "en-US" },
            ].map((item) => (
              <div key={item.code} className="rounded-lg border border-black/[.07] p-3">
                <p className="text-sm font-medium">{item.lang}</p>
                <p className="mt-0.5 font-mono text-xs text-black/40">{item.voice}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Activation */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">{t("activateTitle")}</h2>
          <p className="mb-5 text-sm text-black/50">{t("activateDesc")}</p>

          <ol className="flex flex-col gap-5">
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white mt-0.5">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t("aStep1Title")}</p>
                <p className="mb-2 text-xs text-black/45">{t.rich("aStep1Desc", { b: (c) => <strong>{c}</strong> })}</p>
                <a
                  href="https://console.twilio.com/us1/develop/phone-numbers/search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-axiel-ink hover:underline"
                >
                  {t("buyNumber")} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white mt-0.5">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t("aStep2Title")}</p>
                <p className="mb-2 text-xs text-black/45">
                  {t.rich("aStep2Desc", { b: (c) => <strong>{c}</strong> })}
                </p>
                <VoiceWebhookCopy url={WEBHOOK_URL} />
              </div>
            </li>
          </ol>

          <div className="mt-5 rounded-xl border border-black/[.07] bg-black/[.02] p-4">
            <p className="text-xs font-semibold text-black/60">{t("afterTitle")}</p>
            <p className="mt-1 text-xs text-black/45">
              {t.rich("afterDesc", { a: (c) => <Link href="/settings/whatsapp" className="text-axiel-ink hover:underline">{c}</Link> })}
            </p>
          </div>
        </Card>

        {/* Current config reminder */}
        <Card className="p-5 bg-axiel-soft">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-axiel-ink/60" />
            <div>
              <p className="text-sm font-medium">{t("personaTitle")}</p>
              <p className="mt-1 text-xs text-black/50">
                {t.rich("personaDesc", { a: (c) => <Link href="/settings/whatsapp" className="text-axiel-ink hover:underline">{c}</Link> })}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

// Client component for copy button
function VoiceWebhookCopy({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/[.04] px-3 py-2 font-mono text-xs text-black/70">
      <span className="flex-1 break-all">{url}</span>
    </div>
  );
}
