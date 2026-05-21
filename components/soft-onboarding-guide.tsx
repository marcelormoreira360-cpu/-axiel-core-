"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, CheckCircle2, UsersRound, UserPlus, X } from "lucide-react";

const STORAGE_KEY = "axiel-soft-onboarding-dismissed";

const steps = [
  {
    label: "Passo 1",
    title: "Revise seu primeiro lead",
    href: "/leads",
    action: "Ver leads",
    icon: UsersRound,
  },
  {
    label: "Passo 2",
    title: "Cadastre o primeiro paciente",
    href: "/patients/new",
    action: "Adicionar",
    icon: UserPlus,
  },
  {
    label: "Passo 3",
    title: "Agende a primeira sessão",
    href: "/schedule/new",
    action: "Agendar",
    icon: CalendarPlus,
  },
];

export function SoftOnboardingGuide() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    setIsVisible(dismissed !== "true");
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
  }

  if (!isVisible || pathname.startsWith("/onboarding")) return null;

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[calc(100vw-40px)] max-w-[340px] rounded-[14px] border border-black/[.08] bg-white p-[20px] shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-[14px]">
        <div>
          <div className="inline-flex items-center gap-[5px] rounded-full bg-[#E1F5EE] px-[10px] py-[4px] text-[10px] font-semibold text-[#085041] mb-[8px]">
            <CheckCircle2 className="h-3 w-3" /> Início rápido
          </div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">
            3 passos para começar
          </h2>
          <p className="text-[11px] text-[#A09E98] mt-[2px]">Um guia calmo para o seu primeiro dia.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full w-7 h-7 flex items-center justify-center text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition"
          aria-label="Fechar guia"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-[6px]">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="group flex items-center justify-between gap-[10px] rounded-[10px] border border-transparent bg-[#F4F3EF] px-[12px] py-[10px] transition hover:border-black/[.08] hover:bg-white"
          >
            <div className="flex items-center gap-[10px] min-w-0">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[9px] bg-white text-[#0F6E56] shadow-sm">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#A09E98]">{step.label}</p>
                <p className="text-[12px] font-semibold text-[#0F1A2E] truncate">{step.title}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white px-[10px] py-[5px] text-[10px] font-semibold text-[#6B6A66] transition group-hover:bg-[#0F1A2E] group-hover:text-white">
              {step.action}
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-[12px] w-full rounded-[8px] py-[8px] text-[11px] font-medium text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition"
      >
        Dispensar guia
      </button>
    </aside>
  );
}
