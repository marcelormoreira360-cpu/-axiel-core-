import { getTranslations } from "next-intl/server";
import { formatPlanPrice, type CurrencyCode, type PlanConfig } from "@/modules/billing/plan-config";

const FEATURE_KEYS = new Set([
  "leads", "schedule", "forms", "patient_snapshot", "ai_insights", "patient_portal",
  "product_support", "membership", "stripe_checkout", "follow_up_automation",
  "whatsapp_automation", "audio_transcription", "advanced_reports", "multi_clinic",
  "advanced_permissions", "white_label",
]);

type Props = {
  plan: PlanConfig;
  current?: boolean;
  currency?: CurrencyCode;
};

export async function BillingPlanCard({ plan, current = false, currency = "BRL" }: Props) {
  const t = await getTranslations("pricing.billingCard");
  const tp = await getTranslations("pricing");
  const enabledFeatures = Object.entries(plan.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => (FEATURE_KEYS.has(key) ? t(`features.${key}`) : key.replaceAll("_", " ")));

  const isEnterprise = plan.slug === "enterprise";
  const priceLabel = formatPlanPrice(plan, currency);

  return (
    <div
      className={[
        "relative flex flex-col rounded-[14px] border p-[18px]",
        plan.recommended
          ? "border-[#0F6E56] bg-[#F0FAF6]"
          : "border-black/[.07] bg-white",
      ].join(" ")}
    >
      {/* Recommended badge */}
      {plan.recommended && (
        <div className="absolute -top-[10px] left-1/2 -translate-x-1/2">
          <span className="bg-[#0F6E56] text-white text-[9px] font-bold uppercase tracking-wider px-[10px] py-[3px] rounded-full whitespace-nowrap">
            {t("recommended")}
          </span>
        </div>
      )}

      {/* Current badge */}
      {current && (
        <div className="absolute -top-[10px] right-[14px]">
          <span className="bg-[#E1F5EE] text-[#0F6E56] text-[9px] font-bold uppercase tracking-wider px-[10px] py-[3px] rounded-full border border-[#0F6E56]/20 whitespace-nowrap">
            {t("current")}
          </span>
        </div>
      )}

      {/* Plan name + description */}
      <div className="mb-[14px]">
        <p className="text-[15px] font-semibold text-[#0F1A2E]">{plan.name}</p>
        <p className="text-[11px] text-[#A09E98] mt-[2px] leading-snug">{tp(`planDesc.${plan.slug}`)}</p>
      </div>

      {/* Price */}
      <div className="mb-[16px]">
        <p className="text-[26px] font-bold tracking-[-0.03em] text-[#0F1A2E] leading-none">
          {priceLabel}
        </p>
        {!isEnterprise && (
          <p className="text-[10px] text-[#A09E98] mt-[3px]">{t("perMonth")}</p>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-[6px] mb-[18px] flex-1">
        {enabledFeatures.map(f => (
          <li key={f} className="flex items-center gap-[7px] text-[11px] text-[#4A4A44]">
            <svg
              className="w-[13px] h-[13px] text-[#0F6E56] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {/* Limits badges */}
      <div className="mb-[16px] flex flex-wrap gap-[6px]">
        {plan.limits.patients !== null ? (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {t("upToPatients", { count: plan.limits.patients })}
          </span>
        ) : (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {t("unlimitedPatients")}
          </span>
        )}
        {plan.limits.users !== null ? (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {t("usersCount", { count: plan.limits.users })}
          </span>
        ) : (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {t("unlimitedUsers")}
          </span>
        )}
        {plan.limits.locations !== null && (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {plan.limits.locations === 1 ? t("oneLocation") : t("locationsCount", { count: plan.limits.locations })}
          </span>
        )}
      </div>

      {/* CTA */}
      {current ? (
        <div className="text-center py-[9px] rounded-[8px] text-[12px] font-medium text-[#0F6E56] bg-[#E1F5EE] border border-[#0F6E56]/20">
          {t("current")}
        </div>
      ) : isEnterprise ? (
        <a
          href="mailto:contato@axiel.com.br?subject=Enterprise"
          className="block text-center py-[9px] rounded-[8px] text-[12px] font-medium text-[#0F1A2E] bg-white border border-black/[.10] hover:bg-[#F4F3EF] transition"
        >
          {t("talkToSales")}
        </a>
      ) : (
        <form action="/api/stripe/checkout" method="POST">
          <input type="hidden" name="planCode" value={plan.slug} />
          <button
            type="submit"
            className={[
              "w-full py-[9px] rounded-[8px] text-[12px] font-medium transition",
              plan.recommended
                ? "bg-[#0F6E56] text-white hover:bg-[#0A5842]"
                : "bg-[#0F1A2E] text-white hover:bg-[#1a2d47]",
            ].join(" ")}
          >
            {t("subscribe", { plan: plan.name })}
          </button>
        </form>
      )}
    </div>
  );
}
