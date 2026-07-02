"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Zap, Building2, Star, ArrowRight } from "lucide-react";
import { AXIEL_PLANS, formatPlanPrice, type CurrencyCode, type PlanConfig } from "@/modules/billing/plan-config";
import { track } from "@/lib/analytics";

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter:      <Zap className="h-4 w-4" />,
  professional: <Star className="h-4 w-4" />,
  scale:        <ArrowRight className="h-4 w-4" />,
  enterprise:   <Building2 className="h-4 w-4" />,
};

// ─── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, currency, appUrl }: { plan: PlanConfig; currency: CurrencyCode; appUrl: string }) {
  const t = useTranslations("pricing");
  const isEnterprise = plan.slug === "enterprise";
  const enabledFeatureKeys = Object.entries(plan.features)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const price = formatPlanPrice(plan, currency);
  const suffix = currency === "BRL" ? t("perMonthBRL") : currency === "USD" ? t("perMonthUSD") : t("perMonthEUR");

  return (
    <div className={[
      "relative flex flex-col rounded-[20px] border p-[28px] transition",
      plan.recommended
        ? "border-[#0F6E56] bg-white shadow-[0_0_0_3px_rgba(15,110,86,0.12)]"
        : "border-black/[.08] bg-white",
    ].join(" ")}>

      {plan.recommended && (
        <div className="absolute -top-[13px] left-1/2 -translate-x-1/2">
          <span className="bg-[#0F6E56] text-white text-[9px] font-bold uppercase tracking-[.12em] px-[12px] py-[4px] rounded-full shadow-sm">
            {t("mostPopular")}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[20px]">
        <div className={[
          "w-[34px] h-[34px] rounded-[9px] flex items-center justify-center",
          plan.recommended ? "bg-[#0F6E56] text-white" : "bg-[#F4F3EF] text-[#6B6A66]",
        ].join(" ")}>
          {PLAN_ICONS[plan.slug]}
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#0F1A2E] leading-tight">{plan.name}</p>
          <p className="text-[11px] text-[#A09E98] leading-tight mt-[1px]">{t(`planDesc.${plan.slug}`)}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-[24px]">
        {isEnterprise ? (
          <p className="text-[28px] font-bold tracking-[-0.03em] text-[#0F1A2E]">{t("custom")}</p>
        ) : (
          <div className="flex items-end gap-[4px]">
            <p className="text-[36px] font-bold tracking-[-0.04em] text-[#0F1A2E] leading-none">{price}</p>
            <p className="text-[12px] text-[#A09E98] mb-[5px]">{suffix}</p>
          </div>
        )}
        <p className="text-[10px] text-[#C5C3BC] mt-[4px]">{t("billedMonthly")}</p>
      </div>

      {/* Limits badges */}
      {!isEnterprise && (
        <div className="flex flex-wrap gap-[5px] mb-[20px]">
          {plan.limits.patients !== null ? (
            <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[8px] py-[3px] rounded-full">
              {t("upToPatients", { count: plan.limits.patients })}
            </span>
          ) : (
            <span className="text-[9px] font-medium bg-[#E1F5EE] text-[#0F6E56] px-[8px] py-[3px] rounded-full">
              {t("unlimitedPatients")}
            </span>
          )}
          {plan.limits.users !== null ? (
            <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[8px] py-[3px] rounded-full">
              {t("usersCount", { count: plan.limits.users })}
            </span>
          ) : (
            <span className="text-[9px] font-medium bg-[#E1F5EE] text-[#0F6E56] px-[8px] py-[3px] rounded-full">
              {t("unlimitedUsers")}
            </span>
          )}
        </div>
      )}

      {/* Features */}
      <ul className="flex flex-col gap-[9px] flex-1 mb-[24px]">
        {enabledFeatureKeys.map((k) => (
          <li key={k} className="flex items-start gap-[8px]">
            <Check className="h-[13px] w-[13px] text-[#0F6E56] shrink-0 mt-[1px]" />
            <span className="text-[11px] text-[#4A4A44] leading-snug">{t(`features.${k}`)}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isEnterprise ? (
        <a
          href={`mailto:contato@axielcore.com?subject=${encodeURIComponent(t("enterpriseMailSubject"))}`}
          onClick={() => track("plan_selected", { plan: plan.slug, currency, source: "pricing" })}
          className="block text-center py-[11px] rounded-[10px] text-[12px] font-semibold text-[#0F1A2E] bg-[#F4F3EF] hover:bg-[#ECEAE4] transition"
        >
          {t("talkToSales")}
        </a>
      ) : (
        <a
          href={`${appUrl}/auth/login?plan=${plan.slug}`}
          onClick={() => track("plan_selected", { plan: plan.slug, currency, source: "pricing" })}
          className={[
            "block text-center py-[11px] rounded-[10px] text-[12px] font-semibold transition",
            plan.recommended
              ? "bg-[#0F6E56] text-white hover:bg-[#0A5842]"
              : "bg-[#0F1A2E] text-white hover:bg-[#1a2d47]",
          ].join(" ")}
        >
          {t("startTrial")}
        </a>
      )}
    </div>
  );
}

// ─── Comparison Table ──────────────────────────────────────────────────────────

const ALL_FEATURES = [
  { key: "leads",                group: "Core" },
  { key: "schedule",             group: "Core" },
  { key: "forms",                group: "Core" },
  { key: "patient_snapshot",     group: "Core" },
  { key: "ai_insights",          group: "IA" },
  { key: "audio_transcription",  group: "IA" },
  { key: "advanced_reports",     group: "IA" },
  { key: "patient_portal",       group: "Paciente" },
  { key: "membership",           group: "Monetização" },
  { key: "product_support",      group: "Monetização" },
  { key: "stripe_checkout",      group: "Monetização" },
  { key: "follow_up_automation", group: "Automação" },
  { key: "whatsapp_automation",  group: "Automação" },
  { key: "advanced_permissions", group: "Equipe" },
  { key: "multi_clinic",         group: "Enterprise" },
  { key: "white_label",          group: "Enterprise" },
];

function ComparisonTable() {
  const t = useTranslations("pricing");
  const plans = Object.values(AXIEL_PLANS);
  let lastGroup = "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-black/[.06]">
            <th className="py-[12px] pr-[24px] text-[12px] font-semibold text-[#A09E98] uppercase tracking-[.08em] w-[40%]">
              {t("comparisonColFeature")}
            </th>
            {plans.map((p) => (
              <th key={p.slug} className="py-[12px] px-[12px] text-[12px] font-semibold text-[#0F1A2E] text-center">
                {p.name}
                {p.recommended && <span className="ml-[4px] text-[9px] text-[#0F6E56]">★</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_FEATURES.map(({ key, group }) => {
            const showGroup = group !== lastGroup;
            lastGroup = group;
            return (
              <>
                {showGroup && (
                  <tr key={`group-${group}`}>
                    <td colSpan={5} className="pt-[16px] pb-[4px] text-[9px] font-bold uppercase tracking-[.12em] text-[#C5C3BC]">
                      {t(`groups.${group}`)}
                    </td>
                  </tr>
                )}
                <tr key={key} className="border-b border-black/[.04] hover:bg-[#FAFAF8]">
                  <td className="py-[10px] pr-[24px] text-[12px] text-[#4A4A44]">
                    {t(`features.${key}`)}
                  </td>
                  {plans.map((p) => (
                    <td key={p.slug} className="py-[10px] px-[12px] text-center">
                      {p.features[key as keyof typeof p.features] ? (
                        <Check className="h-[14px] w-[14px] text-[#0F6E56] mx-auto" />
                      ) : (
                        <span className="block w-[14px] h-[2px] bg-black/[.10] mx-auto rounded" />
                      )}
                    </td>
                  ))}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const t = useTranslations("pricing");
  const [open, setOpen] = useState<number | null>(null);
  const FAQS = Array.from({ length: 5 }, (_, i) => ({ q: t(`faqQ${i + 1}`), a: t(`faqA${i + 1}`) }));
  return (
    <div className="divide-y divide-black/[.06]">
      {FAQS.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between py-[16px] text-left gap-4"
          >
            <span className="text-[13px] font-medium text-[#0F1A2E]">{item.q}</span>
            <span className="text-[#A09E98] shrink-0 text-[16px] leading-none">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <p className="pb-[16px] text-[12px] text-[#6B6A66] leading-relaxed">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function PricingClient({ appUrl }: { appUrl: string }) {
  const t = useTranslations("pricing");
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const plans = Object.values(AXIEL_PLANS);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="border-b border-black/[.06] bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-[56px] flex items-center justify-between">
          <span className="text-[16px] font-bold tracking-[-0.03em] text-[#0F1A2E]">AXIEL</span>
          <a
            href={`${appUrl}/auth/login`}
            className="text-[12px] font-semibold text-white bg-[#0F1A2E] hover:bg-[#1a2d47] px-[16px] py-[7px] rounded-[8px] transition"
          >
            {t("navLogin")}
          </a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-[72px]">

        {/* Hero */}
        <div className="text-center mb-[56px]">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#0F6E56] mb-[12px]">
            {t("heroEyebrow")}
          </p>
          <h1 className="text-[40px] sm:text-[52px] font-bold tracking-[-0.035em] text-[#0F1A2E] leading-[1.1] mb-[16px]">
            {t("heroTitleLine1")}<br className="hidden sm:block" /> {t("heroTitleLine2")}
          </h1>
          <p className="text-[15px] text-[#6B6A66] max-w-xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>

          {/* Trial badge */}
          <div className="inline-flex items-center gap-[6px] mt-[20px] bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-[14px] py-[6px]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#0F6E56]" />
            <span className="text-[11px] font-semibold text-[#0F6E56]">{t("heroTrialBadge")}</span>
          </div>
        </div>

        {/* Currency switcher */}
        <div className="flex justify-center mb-[40px]">
          <div className="inline-flex bg-white border border-black/[.07] rounded-[10px] p-[3px] gap-[2px]">
            {(["BRL", "USD", "EUR"] as CurrencyCode[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={[
                  "px-[14px] py-[6px] rounded-[7px] text-[11px] font-semibold transition",
                  currency === c
                    ? "bg-[#0F1A2E] text-white"
                    : "text-[#6B6A66] hover:text-[#0F1A2E]",
                ].join(" ")}
              >
                {t(`currencyLabels.${c}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-4 mb-[80px]">
          {plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} currency={currency} appUrl={appUrl} />
          ))}
        </div>

        {/* Add-ons */}
        <div className="mb-[80px]">
          <div className="text-center mb-[32px]">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#A09E98] mb-[6px]">{t("addonsEyebrow")}</p>
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#0F1A2E]">
              {t("addonsTitle")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[12px]">
            {[
              { name: t("addonExtraUser"),     br: "R$ 29–49/mês",    us: "US$ 10–20/mo",  eu: "€10–15/mo"  },
              { name: t("addonPatientBlock"),  br: "R$ 49–99/mês",    us: "US$ 20–40/mo",  eu: "€20–35/mo"  },
              { name: t("addonWhatsapp"),      br: "R$ 79–149/mês",   us: "US$ 29–79/mo",  eu: "€29–69/mo"  },
              { name: t("addonAiReports"),     br: "R$ 97–197/mês",   us: "US$ 39–99/mo",  eu: "€39–89/mo"  },
              { name: t("addonWhiteLabel"),    br: "R$ 500–1.500/mês",us: "US$ 300–1.500/mo", eu: "€300–1.200/mo" },
              { name: t("addonOnboarding"),    br: "R$ 997 (único)",  us: "US$ 500 (once)",eu: "€500 (once)" },
            ].map((addon) => (
              <div key={addon.name} className="bg-white border border-black/[.07] rounded-[14px] p-[16px] flex items-center justify-between gap-4">
                <p className="text-[12px] font-semibold text-[#0F1A2E]">{addon.name}</p>
                <p className="text-[11px] text-[#6B6A66] shrink-0 text-right">
                  {currency === "USD" ? addon.us : currency === "EUR" ? addon.eu : addon.br}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#A09E98] text-center mt-[16px]">
            {t("addonsContactNote")}<a href="mailto:contato@axielcore.com" className="underline">contato@axielcore.com</a>
          </p>
        </div>

        {/* Comparison table */}
        <div className="mb-[80px]">
          <div className="text-center mb-[32px]">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#A09E98] mb-[6px]">{t("comparisonEyebrow")}</p>
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#0F1A2E]">{t("comparisonTitle")}</h2>
          </div>
          <div className="bg-white border border-black/[.07] rounded-[16px] p-[24px]">
            <ComparisonTable />
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-[80px]">
          <div className="text-center mb-[32px]">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#A09E98] mb-[6px]">{t("faqEyebrow")}</p>
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#0F1A2E]">{t("faqTitle")}</h2>
          </div>
          <div className="bg-white border border-black/[.07] rounded-[16px] px-[24px]">
            <FAQ />
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center bg-[#0F1A2E] rounded-[24px] p-[48px]">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#0F6E56] mb-[12px]">{t("ctaEyebrow")}</p>
          <h2 className="text-[28px] font-bold tracking-[-0.025em] text-white mb-[8px]">
            {t("ctaTitle")}
          </h2>
          <p className="text-[13px] text-white/50 mb-[28px]">
            {t("ctaSubtitle")}
          </p>
          <a
            href={`${appUrl}/auth/login`}
            className="inline-block bg-[#0F6E56] hover:bg-[#0A5842] text-white text-[13px] font-semibold px-[28px] py-[12px] rounded-[10px] transition"
          >
            {t("ctaButton")}
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-black/[.06] mt-[48px] py-[24px]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-[#A09E98]">{t("footerRights", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-[20px] text-[11px] text-[#A09E98]">
            <a href="/termos" className="hover:text-[#6B6A66] transition">{t("footerTerms")}</a>
            <a href="/privacidade" className="hover:text-[#6B6A66] transition">{t("footerPrivacy")}</a>
            <a href="mailto:contato@axielcore.com" className="hover:text-[#6B6A66] transition">{t("footerContact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
