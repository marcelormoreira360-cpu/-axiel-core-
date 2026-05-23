import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UsageLimitCard } from "@/components/usage-limit-card";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getClinicPlanContext } from "@/services/billing-service";

async function getRealUsage(clinicId: string) {
  const supabase = await createSupabaseServerClient();

  const [users, patients, forms, insights, locations] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("intake_forms").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("ai_insights").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("clinic_locations").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
  ]);

  return {
    users:       users.count      ?? 0,
    patients:    patients.count   ?? 0,
    forms:       forms.count      ?? 0,
    ai_insights: insights.count   ?? 0,
    locations:   locations.count  ?? 0,
  };
}

export default async function UsageSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    : { data: null };

  const clinicId = profile?.clinic_id as string | null;

  const [usage, { plan }] = await Promise.all([
    clinicId ? getRealUsage(clinicId) : Promise.resolve({ users: 0, patients: 0, forms: 0, ai_insights: 0, locations: 0 }),
    clinicId ? getClinicPlanContext(clinicId) : Promise.resolve({ plan: { slug: "starter", limits: { users: 3, patients: 100, forms: 3, ai_insights: 0, locations: 1 } } as never }),
  ]);

  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 mt-2">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Uso e limites</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Acompanhe os limites do plano atual e o uso real da clínica.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <UsageLimitCard label="Usuários"    used={usage.users}       limit={plan.limits.users} />
        <UsageLimitCard label="Pacientes"   used={usage.patients}    limit={plan.limits.patients} />
        <UsageLimitCard label="Formulários" used={usage.forms}       limit={plan.limits.forms} />
        <UsageLimitCard label="Análises IA" used={usage.ai_insights} limit={plan.limits.ai_insights} />
        <UsageLimitCard label="Locais"      used={usage.locations}   limit={plan.limits.locations} />
      </section>

      {!clinicId && (
        <p className="text-sm text-black/40 text-center">
          Clínica não configurada. Complete o onboarding para ver os dados de uso.
        </p>
      )}
    </main>
  );
}
