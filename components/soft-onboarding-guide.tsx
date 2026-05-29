"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Link2,
  UserPlus,
  Users,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { OnboardingChecklistResult } from "@/app/api/onboarding/checklist/route";

const STORAGE_KEY = "axiel-soft-onboarding-dismissed";

type StepKey = keyof OnboardingChecklistResult["steps"];

interface Step {
  key: StepKey;
  label: string;
  title: string;
  hint: string;
  href: string;
  action: string;
  icon: React.ElementType;
  optional?: boolean;
}

const STEPS: Step[] = [
  {
    key: "session_types",
    label: "Passo 1",
    title: "Criar tipos de sessão",
    hint: "Defina seus serviços com duração e preço.",
    href: "/settings/session-types",
    action: "Configurar",
    icon: Zap,
  },
  {
    key: "patients",
    label: "Passo 2",
    title: "Adicionar primeiro paciente",
    hint: "Cadastre um paciente para começar a agendar.",
    href: "/patients/new",
    action: "Adicionar",
    icon: UserPlus,
  },
  {
    key: "appointments",
    label: "Passo 3",
    title: "Agendar primeira sessão",
    hint: "Marque uma consulta na agenda.",
    href: "/schedule/new",
    action: "Agendar",
    icon: CalendarPlus,
  },
  {
    key: "forms",
    label: "Passo 4",
    title: "Criar formulário de anamnese",
    hint: "Envie um formulário de triagem para seus pacientes.",
    href: "/forms/new",
    action: "Criar",
    icon: ClipboardList,
  },
  {
    key: "booking",
    label: "Passo 5",
    title: "Definir horários de atendimento",
    hint: "Configure sua disponibilidade semanal para agendamento online.",
    href: "/settings",
    action: "Configurar",
    icon: Link2,
  },
  {
    key: "team",
    label: "Passo 6",
    title: "Convidar profissional",
    hint: "Adicione um colega de equipe à clínica.",
    href: "/settings/equipe",
    action: "Convidar",
    icon: Users,
    optional: true,
  },
];

export function SoftOnboardingGuide() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [checklist, setChecklist] = useState<OnboardingChecklistResult | null>(null);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (dismissed === "true") return;
    setIsVisible(true);

    fetch("/api/onboarding/checklist")
      .then((r) => r.ok ? r.json() : null)
      .then((data: OnboardingChecklistResult | null) => {
        if (data) setChecklist(data);
      })
      .catch(() => null);
  }, []);

  // Auto-refresh when user navigates (they may have just completed a step)
  useEffect(() => {
    if (!isVisible) return;
    fetch("/api/onboarding/checklist")
      .then((r) => r.ok ? r.json() : null)
      .then((data: OnboardingChecklistResult | null) => {
        if (data) setChecklist(data);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
  }

  if (!isVisible || pathname.startsWith("/onboarding")) return null;

  const steps = checklist?.steps ?? null;
  const completed = checklist?.completed ?? 0;
  const total = checklist?.total ?? STEPS.length;
  const allDone = completed === total;
  const requiredDone = steps
    ? STEPS.filter((s) => !s.optional).every((s) => steps[s.key])
    : false;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[calc(100vw-40px)] max-w-[340px] rounded-[14px] border border-black/[.08] bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-[18px] pb-0">
        <div className="flex items-start gap-[10px] min-w-0">
          <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-[#E1F5EE]">
            <CheckCircle2 className="h-4 w-4 text-[#0F6E56]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[#0F1A2E] leading-tight">
              {allDone ? "Configuração completa! 🎉" : "Configure sua clínica"}
            </h2>
            <p className="text-[11px] text-[#A09E98] mt-[1px]">
              {allDone
                ? "Você está pronto para atender pacientes."
                : requiredDone
                ? "Principais passos concluídos — opcional restante."
                : `${completed} de ${total} passos concluídos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="rounded-full w-7 h-7 flex items-center justify-center text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition"
            aria-label={isExpanded ? "Recolher" : "Expandir"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full w-7 h-7 flex items-center justify-center text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition"
            aria-label="Fechar guia"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-[18px] pt-[10px]">
        <div className="h-[5px] rounded-full bg-[#F4F3EF] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-[#0F6E56]" : "bg-[#0F6E56]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[9px] font-medium text-[#A09E98] mt-[4px] text-right">
          {pct}%
        </p>
      </div>

      {/* Steps */}
      {isExpanded && (
        <div className="px-[12px] pb-[4px] space-y-[4px] mt-[4px]">
          {STEPS.map((step) => {
            const done = steps ? steps[step.key] : false;
            return (
              <Link
                key={step.key}
                href={step.href}
                className={[
                  "group flex items-center justify-between gap-[10px] rounded-[10px] px-[10px] py-[9px] transition",
                  done
                    ? "bg-[#F4F3EF] opacity-60 pointer-events-none"
                    : "bg-[#F4F3EF] hover:bg-white hover:border hover:border-black/[.08]",
                ].join(" ")}
                aria-disabled={done}
                tabIndex={done ? -1 : undefined}
              >
                <div className="flex items-center gap-[9px] min-w-0">
                  <div
                    className={[
                      "w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] transition",
                      done
                        ? "bg-[#E1F5EE] text-[#0F6E56]"
                        : "bg-white text-[#0F6E56] shadow-sm",
                    ].join(" ")}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-[5px]">
                      <p className={`text-[12px] font-semibold truncate ${done ? "line-through text-[#A09E98]" : "text-[#0F1A2E]"}`}>
                        {step.title}
                      </p>
                      {step.optional && !done && (
                        <span className="shrink-0 text-[9px] font-medium text-[#A09E98] bg-white border border-black/[.07] rounded-full px-[6px] py-[1px]">
                          opcional
                        </span>
                      )}
                    </div>
                    {!done && (
                      <p className="text-[10px] text-[#A09E98] truncate">{step.hint}</p>
                    )}
                  </div>
                </div>
                {!done && (
                  <span className="shrink-0 rounded-full bg-white px-[9px] py-[4px] text-[10px] font-semibold text-[#6B6A66] border border-black/[.07] transition group-hover:bg-[#0F1A2E] group-hover:text-white group-hover:border-transparent">
                    {step.action}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <div className="px-[12px] pb-[12px] mt-[4px]">
        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-[8px] py-[7px] text-[11px] font-medium text-[#A09E98] hover:bg-[#F4F3EF] hover:text-[#0F1A2E] transition"
        >
          {allDone ? "Fechar guia" : "Dispensar por agora"}
        </button>
      </div>
    </aside>
  );
}
