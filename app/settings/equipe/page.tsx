import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getTeamMembers, getPendingInvites, isManager } from "@/services/team-service";
import { EquipeClient } from "./equipe-client";

export default async function EquipePage() {
  const t = await getTranslations("settings");
  const [clinic, profile] = await Promise.all([getCurrentClinic(), getCurrentUserProfile()]);
  if (!clinic || !profile) redirect("/dashboard");

  const [members, invites] = await Promise.all([
    getTeamMembers(clinic.id),
    isManager(profile.role) ? getPendingInvites(clinic.id) : Promise.resolve([]),
  ]);

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

      <EquipeClient
        members={members}
        invites={invites}
        currentUserId={profile.id}
        currentUserRole={profile.role}
      />
    </Shell>
  );
}
