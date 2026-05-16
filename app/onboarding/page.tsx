import { OnboardingFlow } from "@/components/onboarding-flow";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] py-[40px] px-[16px]">
      <div className="max-w-[640px] mx-auto mb-[32px] text-center">
        <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#A09E98] mb-[8px]">
          Configuração inicial
        </p>
        <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[#0F1A2E]">
          Bem-vindo ao AXIEL
        </h1>
        <p className="text-[14px] text-[#A09E98] mt-[6px] leading-relaxed">
          4 passos simples. O sistema se configura automaticamente para o seu perfil.
        </p>
      </div>
      <OnboardingFlow />
    </div>
  );
}
