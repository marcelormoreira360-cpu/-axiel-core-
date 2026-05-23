import { formatPlanPrice, type CurrencyCode, type PlanConfig } from "@/modules/billing/plan-config";

const FEATURE_LABELS: Record<string, string> = {
  leads:                "CRM de leads",
  schedule:             "Agenda completa",
  forms:                "Formulários de anamnese",
  patient_snapshot:     "Snapshot do paciente",
  ai_insights:          "Insights com IA",
  patient_portal:       "Portal do paciente",
  product_support:      "Venda de produtos",
  membership:           "Pacotes e assinaturas",
  stripe_checkout:      "Checkout Stripe p/ pacientes",
  follow_up_automation: "Automação de follow-up",
  whatsapp_automation:  "WhatsApp automático",
  audio_transcription:  "Transcrição por voz (IA)",
  advanced_reports:     "Relatórios avançados",
  multi_clinic:         "Múltiplas unidades",
  advanced_permissions: "Permissões avançadas",
  white_label:          "White-label",
};

type Props = {
  plan: PlanConfig;
  current?: boolean;
  currency?: CurrencyCode;
};

export function BillingPlanCard({ plan, current = false, currency = "BRL" }: Props) {
  const enabledFeatures = Object.entries(plan.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => FEATURE_LABELS[key] ?? key.replaceAll("_", " "));

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
            Recomendado
          </span>
        </div>
      )}

      {/* Current badge */}
      {current && (
        <div className="absolute -top-[10px] right-[14px]">
          <span className="bg-[#E1F5EE] text-[#0F6E56] text-[9px] font-bold uppercase tracking-wider px-[10px] py-[3px] rounded-full border border-[#0F6E56]/20 whitespace-nowrap">
            Plano atual
          </span>
        </div>
      )}

      {/* Plan name + description */}
      <div className="mb-[14px]">
        <p className="text-[15px] font-semibold text-[#0F1A2E]">{plan.name}</p>
        <p className="text-[11px] text-[#A09E98] mt-[2px] leading-snug">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-[16px]">
        <p className="text-[26px] font-bold tracking-[-0.03em] text-[#0F1A2E] leading-none">
          {priceLabel}
        </p>
        {!isEnterprise && (
          <p className="text-[10px] text-[#A09E98] mt-[3px]">/mês · cobrado mensalmente</p>
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
            até {plan.limits.patients.toLocaleString("pt-BR")} pacientes
          </span>
        ) : (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            pacientes ilimitados
          </span>
        )}
        {plan.limits.users !== null ? (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {plan.limits.users} usuários
          </span>
        ) : (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            usuários ilimitados
          </span>
        )}
        {plan.limits.locations !== null && (
          <span className="text-[9px] font-medium bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[3px] rounded-full">
            {plan.limits.locations === 1 ? "1 unidade" : `${plan.limits.locations} unidades`}
          </span>
        )}
      </div>

      {/* CTA */}
      {current ? (
        <div className="text-center py-[9px] rounded-[8px] text-[12px] font-medium text-[#0F6E56] bg-[#E1F5EE] border border-[#0F6E56]/20">
          Plano atual
        </div>
      ) : isEnterprise ? (
        <a
          href="mailto:contato@axiel.com.br?subject=Enterprise"
          className="block text-center py-[9px] rounded-[8px] text-[12px] font-medium text-[#0F1A2E] bg-white border border-black/[.10] hover:bg-[#F4F3EF] transition"
        >
          Falar com vendas
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
            Assinar {plan.name}
          </button>
        </form>
      )}
    </div>
  );
}
