"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock,
  Dumbbell, Leaf, Sparkles, UserPlus, Heart
} from "lucide-react";
import { completeOnboardingAction } from "@/app/onboarding/actions";

const STEPS = ["Perfil", "Nome", "Horários", "Equipe"];

type Profile = {
  id: string;
  label: string;
  description: string;
  examples: string;
  icon: React.ReactNode;
};

const PROFILES: Profile[] = [
  {
    id: "integrativa",
    label: "Integrativa / Funcional",
    description: "Medicina funcional, integrativa e terapias complementares",
    examples: "Medicina funcional · Acupuntura · Medicina integrativa · Longevidade",
    icon: <Leaf className="h-5 w-5" />,
  },
  {
    id: "fisioterapia",
    label: "Fisioterapia / Reabilitação",
    description: "Reabilitação física, terapias manuais e movimento",
    examples: "Fisioterapia · Quiropraxia · Osteopatia · Massoterapia",
    icon: <Dumbbell className="h-5 w-5" />,
  },
  {
    id: "saude_mental",
    label: "Saúde Mental",
    description: "Acompanhamento psicológico e terapêutico",
    examples: "Psicologia · Terapia · Burnout · Estresse · Coaching terapêutico",
    icon: <Brain className="h-5 w-5" />,
  },
  {
    id: "nutricao",
    label: "Nutrição",
    description: "Nutrição clínica, esportiva e comportamental",
    examples: "Nutrição clínica · Nutrição esportiva · Comportamento alimentar",
    icon: <Heart className="h-5 w-5" />,
  },
  {
    id: "wellness",
    label: "Wellness / Bem-estar",
    description: "Centros de bem-estar, estética e qualidade de vida",
    examples: "Wellness center · Estética avançada · Spa clínico · Biohacking",
    icon: <Sparkles className="h-5 w-5" />,
  },
];

const HOURS_OPTIONS = [
  { id: "weekdays", label: "Dias úteis", summary: "Seg–Sex, 9h–17h" },
  { id: "extended", label: "Estendido", summary: "Seg–Sex, 8h–18h" },
  { id: "flexible", label: "Flexível", summary: "Seg–Sáb, horário simples" },
];

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [clinicProfile, setClinicProfile] = useState("integrativa");
  const [clinicName, setClinicName] = useState("");
  const [hoursPreset, setHoursPreset] = useState("weekdays");
  const [staffEmail, setStaffEmail] = useState("");

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const selectedProfile = PROFILES.find((p) => p.id === clinicProfile)!;

  return (
    <div className="max-w-[640px] mx-auto space-y-[16px]">
      {/* Progress bar */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[16px]">
        <div className="flex items-center justify-between mb-[10px]">
          <span className="text-[11px] font-medium text-[#A09E98]">Passo {step + 1} de {STEPS.length}</span>
          <span className="text-[11px] font-medium text-[#A09E98]">{Math.round(progress)}%</span>
        </div>
        <div className="h-[4px] rounded-full bg-[#F4F3EF] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0F1A2E] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-[12px] grid grid-cols-4 gap-[6px]">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={[
                "rounded-full px-[10px] py-[5px] text-center text-[10px] font-medium transition",
                i <= step ? "bg-[#0F1A2E] text-white" : "bg-[#F4F3EF] text-[#A09E98]",
              ].join(" ")}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <form action={completeOnboardingAction}>
        <input type="hidden" name="clinic_name" value={clinicName || selectedProfile.label} readOnly />
        <input type="hidden" name="clinic_profile" value={clinicProfile} readOnly />
        <input type="hidden" name="hours_preset" value={hoursPreset} readOnly />
        <input type="hidden" name="staff_email" value={staffEmail} readOnly />

        {/* Step 0 — Profile */}
        {step === 0 && (
          <div className="space-y-[10px]">
            <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
              <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
                Primeiro passo
              </p>
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
                Qual é o perfil da sua clínica?
              </h1>
              <p className="text-[13px] text-[#A09E98] leading-relaxed">
                O AXIEL vai configurar os tipos de sessão, formulários e terminologia automaticamente para você.
              </p>
            </div>

            <div className="space-y-[8px]">
              {PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setClinicProfile(profile.id)}
                  className={[
                    "w-full text-left rounded-[12px] border px-[18px] py-[14px] transition flex items-start gap-[14px]",
                    clinicProfile === profile.id
                      ? "border-[#0F6E56] bg-[#E1F5EE]"
                      : "border-black/[.07] bg-white hover:border-black/[.15]",
                  ].join(" ")}
                >
                  <div className={[
                    "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 mt-[1px]",
                    clinicProfile === profile.id ? "bg-[#0F6E56] text-white" : "bg-[#F4F3EF] text-[#6B6A66]",
                  ].join(" ")}>
                    {profile.icon}
                  </div>
                  <div className="flex-1">
                    <p className={[
                      "text-[14px] font-semibold mb-[2px]",
                      clinicProfile === profile.id ? "text-[#085041]" : "text-[#0F1A2E]",
                    ].join(" ")}>
                      {profile.label}
                    </p>
                    <p className={[
                      "text-[12px] leading-relaxed",
                      clinicProfile === profile.id ? "text-[#0F6E56]" : "text-[#A09E98]",
                    ].join(" ")}>
                      {profile.examples}
                    </p>
                  </div>
                  {clinicProfile === profile.id && (
                    <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0 mt-[2px]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Clinic name */}
        {step === 1 && (
          <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
            <div className={[
              "w-10 h-10 rounded-[10px] flex items-center justify-center mb-[16px]",
              "bg-[#E1F5EE] text-[#0F6E56]",
            ].join(" ")}>
              {selectedProfile.icon}
            </div>
            <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
              Perfil: {selectedProfile.label}
            </p>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
              Como se chama sua clínica?
            </h1>
            <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
              Esse é o nome que vai aparecer para sua equipe dentro do AXIEL.
            </p>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder={`Ex: ${selectedProfile.label} Centro Clínico`}
              className="w-full px-[16px] py-[14px] rounded-[10px] border border-black/[.10] text-[18px] font-medium text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        )}

        {/* Step 2 — Hours */}
        {step === 2 && (
          <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
            <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
              Configuração de agenda
            </p>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
              Qual é o horário de funcionamento?
            </h1>
            <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
              Você pode ajustar detalhadamente depois nas Configurações.
            </p>
            <div className="space-y-[8px]">
              {HOURS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHoursPreset(opt.id)}
                  className={[
                    "w-full text-left rounded-[12px] border px-[18px] py-[14px] transition flex items-center justify-between",
                    hoursPreset === opt.id
                      ? "border-[#0F6E56] bg-[#E1F5EE]"
                      : "border-black/[.07] bg-[#FAFAF8] hover:border-black/[.15]",
                  ].join(" ")}
                >
                  <div>
                    <p className={[
                      "text-[14px] font-semibold",
                      hoursPreset === opt.id ? "text-[#085041]" : "text-[#0F1A2E]",
                    ].join(" ")}>
                      {opt.label}
                    </p>
                    <p className={[
                      "text-[12px] mt-[2px]",
                      hoursPreset === opt.id ? "text-[#0F6E56]" : "text-[#A09E98]",
                    ].join(" ")}>
                      {opt.summary}
                    </p>
                  </div>
                  {hoursPreset === opt.id && (
                    <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Team */}
        {step === 3 && (
          <div className="space-y-[12px]">
            <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
              <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
                <UserPlus className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
                Último passo (opcional)
              </p>
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
                Convidar um colega de equipe
              </h1>
              <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
                Pule essa etapa se preferir adicionar a equipe depois.
              </p>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="colega@suaclinica.com.br"
                className="w-full px-[16px] py-[14px] rounded-[10px] border border-black/[.10] text-[16px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>

            {/* Summary */}
            <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px] space-y-[10px]">
              <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">
                O AXIEL vai criar automaticamente
              </p>
              {[
                `Tipos de sessão para ${selectedProfile.label}`,
                "Formulário de anamnese personalizado",
                "Paciente e lead de demonstração",
                "Agenda com os horários selecionados",
              ].map((item) => (
                <div key={item} className="flex items-center gap-[8px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
                  <span className="text-[12px] text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-[16px] flex items-center justify-between bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[14px]">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] disabled:opacity-30 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] rounded-[8px] px-[16px] py-[9px] transition"
            >
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[9px] transition"
            >
              Criar minha clínica <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
