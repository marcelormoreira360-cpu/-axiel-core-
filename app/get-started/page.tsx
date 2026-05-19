import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Building2, CalendarPlus, ClipboardList, UserPlus, UsersRound, CheckCircle2 } from "lucide-react";

const steps = [
  {
    key: "clinicProfile" as const,
    href: "/clinics",
    title: "Perfil da clínica",
    text: "Configure o nome, contato e tipo da sua clínica.",
    icon: Building2,
  },
  {
    key: "hasPatient" as const,
    href: "/patients/new",
    title: "Primeiro paciente",
    text: "Crie um cadastro de paciente.",
    icon: UserPlus,
  },
  {
    key: "hasLead" as const,
    href: "/leads/new",
    title: "Primeiro lead",
    text: "Inicie o pipeline de captação de pacientes.",
    icon: UsersRound,
  },
  {
    key: "hasSession" as const,
    href: "/schedule/new",
    title: "Primeira sessão",
    text: "Agende uma sessão no calendário.",
    icon: CalendarPlus,
  },
  {
    key: "hasIntake" as const,
    href: "/intake",
    title: "Formulário de intake",
    text: "Personalize as perguntas iniciais para novos pacientes.",
    icon: ClipboardList,
  },
] as const;

type StepKey = (typeof steps)[number]["key"];

async function getCompletionStatus(clinicId: string): Promise<Record<StepKey, boolean>> {
  const supabase = await createSupabaseServerClient();

  const [patients, sessions, leads, forms] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("intake_forms").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
  ]);

  return {
    clinicProfile: true,
    hasPatient: (patients.count ?? 0) > 0,
    hasLead: (leads.count ?? 0) > 0,
    hasSession: (sessions.count ?? 0) > 0,
    hasIntake: (forms.count ?? 0) > 0,
  };
}

export default async function GetStartedPage() {
  const clinic = await getCurrentClinic();
  const status = clinic
    ? await getCompletionStatus(clinic.id)
    : { clinicProfile: false, hasPatient: false, hasLead: false, hasSession: false, hasIntake: false };

  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Configuração</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Começar em minutos</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          Siga estes passos uma vez. Depois, a rotina fica em Home, Pacientes, Leads e Agenda.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-black/60">
            {completedCount} de {totalCount} passos concluídos
          </span>
          {allDone && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Tudo pronto!
            </span>
          )}
        </div>
        <div className="h-2 bg-black/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-axiel-ink rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 max-w-2xl">
        {steps.map((step, index) => {
          const done = status[step.key];
          const Icon = step.icon;
          return (
            <Link key={step.href} href={step.href}>
              <div
                className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${
                  done
                    ? "bg-white border-black/8 opacity-55"
                    : "bg-white border-axiel-line hover:-translate-y-0.5 hover:shadow-sm"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    done ? "bg-emerald-50" : "bg-axiel-cream"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Icon className="w-5 h-5 text-axiel-ink" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold ${
                      done ? "line-through text-black/35" : "text-axiel-ink"
                    }`}
                  >
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-black/50">{step.text}</p>
                </div>
                {!done && (
                  <span className="flex-shrink-0 text-xs font-medium text-axiel-ink/50">→</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
