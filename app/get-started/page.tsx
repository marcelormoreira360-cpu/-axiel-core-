import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Building2, CalendarPlus, ClipboardList, UserPlus, UsersRound, CheckCircle2 } from "lucide-react";

const steps = [
  { key: "clinicProfile" as const, href: "/clinics", icon: Building2 },
  { key: "hasPatient" as const, href: "/patients/new", icon: UserPlus },
  { key: "hasLead" as const, href: "/leads/new", icon: UsersRound },
  { key: "hasSession" as const, href: "/schedule/new", icon: CalendarPlus },
  { key: "hasForms" as const, href: "/forms", icon: ClipboardList },
] as const;

type StepKey = (typeof steps)[number]["key"];

async function getCompletionStatus(clinicId: string): Promise<Record<StepKey, boolean>> {
  const supabase = await createSupabaseServerClient();

  const [patients, sessions, leads, forms] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("assessment_templates").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("is_active", true),
  ]);

  return {
    clinicProfile: true,
    hasPatient: (patients.count ?? 0) > 0,
    hasLead: (leads.count ?? 0) > 0,
    hasSession: (sessions.count ?? 0) > 0,
    hasForms: (forms.count ?? 0) > 0,
  };
}

export default async function GetStartedPage() {
  const t = await getTranslations("onboarding.getStarted");
  const clinic = await getCurrentClinic();
  const status = clinic
    ? await getCompletionStatus(clinic.id)
    : { clinicProfile: false, hasPatient: false, hasLead: false, hasSession: false, hasForms: false };

  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">{t("eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          {t("subtitle")}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-black/60">
            {t("progress", { completed: completedCount, total: totalCount })}
          </span>
          {allDone && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {t("allDone")}
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
                    {index + 1}. {t(`steps.${step.key}.title`)}
                  </p>
                  <p className="mt-0.5 text-sm text-black/50">{t(`steps.${step.key}.text`)}</p>
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
