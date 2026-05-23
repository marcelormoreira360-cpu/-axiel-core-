import { Building2, Users, Brain, Dumbbell, Heart, Leaf, Sparkles, CheckCircle2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { ClinicEditForm } from "@/components/clinic-edit-form";
import { getClinicsForUser, updateClinic, getCurrentClinic } from "@/services/clinic-service";
import { getUsersForCurrentScope } from "@/services/user-service";
import { roleLabels } from "@/modules/auth/roles";
import type { ClinicProfile } from "@/lib/types";

const PROFILES: {
  id: ClinicProfile;
  label: string;
  examples: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "integrativa",
    label: "Integrativa / Funcional",
    examples: "Medicina funcional · Acupuntura · Longevidade",
    icon: <Leaf className="h-4 w-4" />,
  },
  {
    id: "fisioterapia",
    label: "Fisioterapia / Reabilitação",
    examples: "Fisioterapia · Quiropraxia · Osteopatia",
    icon: <Dumbbell className="h-4 w-4" />,
  },
  {
    id: "saude_mental",
    label: "Saúde Mental",
    examples: "Psicologia · Terapia · Coaching terapêutico",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "nutricao",
    label: "Nutrição",
    examples: "Nutrição clínica · Nutrição esportiva",
    icon: <Heart className="h-4 w-4" />,
  },
  {
    id: "wellness",
    label: "Wellness / Bem-estar",
    examples: "Wellness center · Estética · Biohacking",
    icon: <Sparkles className="h-4 w-4" />,
  },
];

export default async function ClinicsPage() {
  const [clinics, users, myClinic] = await Promise.all([
    getClinicsForUser(),
    getUsersForCurrentScope(),
    getCurrentClinic(),
  ]);

  async function updateClinicAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!id || !name || !slug) throw new Error("Campos obrigatórios.");
    await updateClinic(id, { name, slug });
    revalidatePath("/clinics");
    revalidatePath("/settings");
  }

  async function updateClinicProfileAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const clinic_profile = String(formData.get("clinic_profile") ?? "");
    if (!id || !clinic_profile) return;
    await updateClinic(id, { clinic_profile });
    revalidatePath("/clinics");
    revalidatePath("/dashboard");
  }

  return (
    <Shell>
      <header className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Configuração da clínica</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">Nome, URL de agendamento e perfil de prática.</p>
      </header>

      {/* ── Minha clínica — nome e slug ── */}
      {myClinic && (
        <div className="space-y-[14px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              Nome e URL
            </p>
            <Card className="p-[16px]">
              <ClinicEditForm
                id={myClinic.id}
                name={myClinic.name}
                slug={myClinic.slug}
                updateAction={updateClinicAction}
              />
            </Card>
          </div>

          {/* ── Perfil da clínica ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              Perfil de prática
            </p>
            <Card className="p-[16px]">
              <p className="text-[13px] text-[#0F1A2E] font-medium mb-[4px]">Tipo de clínica</p>
              <p className="text-[12px] text-[#A09E98] mb-[14px]">
                Define os tipos de sessão padrão, terminologia e formulários sugeridos pelo AXIEL.
              </p>
              <div className="grid gap-[8px] sm:grid-cols-2">
                {PROFILES.map((profile) => {
                  const isActive = (myClinic.clinic_profile ?? "integrativa") === profile.id;
                  return (
                    <form key={profile.id} action={updateClinicProfileAction}>
                      <input type="hidden" name="id" value={myClinic.id} />
                      <input type="hidden" name="clinic_profile" value={profile.id} />
                      <button
                        type="submit"
                        className={[
                          "w-full text-left rounded-[10px] border px-[14px] py-[12px] transition flex items-start gap-[10px]",
                          isActive
                            ? "border-[#0F6E56] bg-[#E1F5EE]"
                            : "border-black/[.07] bg-white hover:border-black/[.15] hover:bg-[#FAFAF8]",
                        ].join(" ")}
                      >
                        <div className={[
                          "w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 mt-[1px]",
                          isActive ? "bg-[#0F6E56] text-white" : "bg-[#F4F3EF] text-[#6B6A66]",
                        ].join(" ")}>
                          {profile.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={[
                            "text-[12px] font-semibold",
                            isActive ? "text-[#085041]" : "text-[#0F1A2E]",
                          ].join(" ")}>
                            {profile.label}
                          </p>
                          <p className={[
                            "text-[11px] mt-[1px] leading-relaxed",
                            isActive ? "text-[#0F6E56]" : "text-[#A09E98]",
                          ].join(" ")}>
                            {profile.examples}
                          </p>
                        </div>
                        {isActive && (
                          <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0 mt-[1px]" />
                        )}
                      </button>
                    </form>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Outras clínicas (admins) ── */}
      {clinics.filter((c) => c.id !== myClinic?.id).length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
            Outras clínicas
          </p>
          <div className="grid gap-3">
            {clinics.filter((c) => c.id !== myClinic?.id).slice(0, 5).map((clinic) => (
              <Card key={clinic.id}>
                <h2 className="font-semibold text-[14px]">{clinic.name}</h2>
                <p className="mt-1 text-[12px] text-black/50">/{clinic.slug} · {clinic.status}</p>
              </Card>
            ))}
            {clinics.filter((c) => c.id !== myClinic?.id).length > 5 && (
              <LimitedList
                items={clinics.filter((c) => c.id !== myClinic?.id).slice(5)}
                detailsLabel={`Ver mais ${clinics.length - 5} clínicas`}
                renderItem={(clinic) => (
                  <Card key={clinic.id}>
                    <h2 className="font-semibold text-[14px]">{clinic.name}</h2>
                    <p className="mt-1 text-[12px] text-black/50">/{clinic.slug} · {clinic.status}</p>
                  </Card>
                )}
              />
            )}
          </div>
        </div>
      )}

      {clinics.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="Nenhuma clínica conectada"
          text="Conclua o onboarding para criar sua clínica e desbloquear o workspace."
          href="/onboarding"
          action="Iniciar onboarding"
        />
      )}

      {/* ── Equipe ── */}
      <div className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
          Equipe
        </p>
        <div className="grid gap-3">
          {users.slice(0, 5).map((user) => (
            <Card key={user.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E]">
                  {user.full_name || user.email || "Sem nome"}
                </p>
                <p className="mt-[2px] text-[12px] text-black/50">{user.email ?? "Sem e-mail"}</p>
              </div>
              <span className="rounded-full bg-[#F4F3EF] px-3 py-1 text-[11px] font-medium text-[#6B6A66]">
                {roleLabels[user.role]}
              </span>
            </Card>
          ))}
          {users.length > 5 && (
            <LimitedList
              items={users.slice(5)}
              detailsLabel={`Ver mais ${users.length - 5} membros`}
              renderItem={(user) => (
                <Card key={user.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1A2E]">
                      {user.full_name || user.email || "Sem nome"}
                    </p>
                    <p className="mt-[2px] text-[12px] text-black/50">{user.email ?? "Sem e-mail"}</p>
                  </div>
                  <span className="rounded-full bg-[#F4F3EF] px-3 py-1 text-[11px] font-medium text-[#6B6A66]">
                    {roleLabels[user.role]}
                  </span>
                </Card>
              )}
            />
          )}
          {users.length === 0 && (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="Nenhum membro na equipe"
              text="Convide o primeiro profissional quando a clínica estiver pronta."
              href="/settings/equipe"
              action="Convidar equipe"
            />
          )}
        </div>
      </div>
    </Shell>
  );
}
