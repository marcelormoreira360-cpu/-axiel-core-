import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getTeamMembers, getPendingInvites, isManager } from "@/services/team-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PractitionerRow } from "@/app/settings/practitioners/practitioners-list";
import { EquipeTabsClient } from "./equipe-tabs-client";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function EquipePage({ searchParams }: Props) {
  const t = await getTranslations("settings");
  const { tab } = await searchParams;
  const [clinic, profile] = await Promise.all([getCurrentClinic(), getCurrentUserProfile()]);
  if (!clinic || !profile) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();

  const [members, invites, cuRows] = await Promise.all([
    getTeamMembers(clinic.id),
    isManager(profile.role) ? getPendingInvites(clinic.id) : Promise.resolve([]),
    supabase
      .from("clinic_users")
      .select("user_id, display_name, specialty, bio, is_bookable")
      .eq("clinic_id", clinic.id)
      .eq("status", "active")
      .order("created_at"),
  ]);

  // Perfis públicos dos profissionais (aba "Perfil público").
  const cu = cuRows.data ?? [];
  const userIds = cu.map((r) => r.user_id);
  const { data: userRows } = userIds.length
    ? await supabase.from("users").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const userMap = new Map((userRows ?? []).map((u) => [u.id, u]));
  const practitioners: PractitionerRow[] = cu.map((r) => {
    const u = userMap.get(r.user_id);
    return {
      user_id: r.user_id,
      display_name: r.display_name ?? null,
      specialty: r.specialty ?? null,
      bio: r.bio ?? null,
      is_bookable: r.is_bookable,
      full_name: u?.full_name ?? null,
      email: u?.email ?? null,
    };
  });

  const initialTab = tab === "perfil" || tab === "profiles" ? "profiles" : "access";

  return (
    <Shell>
      <div className="mb-7">
        <BackLink fallbackHref="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("hub.items.equipe.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          {t("equipe.subtitle")}
        </p>
      </div>

      <EquipeTabsClient
        members={members}
        invites={invites}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        practitioners={practitioners}
        initialTab={initialTab}
      />
    </Shell>
  );
}
