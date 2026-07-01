"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EquipeClient } from "./equipe-client";
import { PractitionersList, type PractitionerRow } from "@/app/settings/practitioners/practitioners-list";
import type { TeamMember, TeamInvite } from "@/services/team-service";
import type { AppRole } from "@/lib/types";

type Tab = "access" | "profiles";

/**
 * Unifica "Equipe" (acesso: contas, cargos, convites) e "Profissionais"
 * (perfil público: nome de exibição, especialidade, bio, agenda pública) numa
 * tela só com duas abas. Antes eram dois cards separados no hub, o que dava
 * sensação de duplicidade — são as mesmas pessoas, facetas diferentes.
 */
export function EquipeTabsClient({
  members,
  invites,
  currentUserId,
  currentUserRole,
  practitioners,
  initialTab = "access",
}: {
  members: TeamMember[];
  invites: TeamInvite[];
  currentUserId: string;
  currentUserRole: AppRole;
  practitioners: PractitionerRow[];
  initialTab?: Tab;
}) {
  const t = useTranslations("settings.equipe");
  const tp = useTranslations("settings.practitioners");
  const [tab, setTab] = useState<Tab>(initialTab);

  function TabButton({ id, label }: { id: Tab; label: string }) {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`px-[2px] pb-[10px] text-[13px] font-medium transition border-b-2 -mb-px ${
          active
            ? "text-[#0F1A2E] border-[#0F6E56]"
            : "text-[#A09E98] border-transparent hover:text-[#0F1A2E]"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-5 border-b border-black/[.07] mb-5">
        <TabButton id="access" label={t("tabAccess")} />
        <TabButton id="profiles" label={t("tabProfiles")} />
      </div>

      {tab === "access" ? (
        <EquipeClient
          members={members}
          invites={invites}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-[#A09E98] leading-relaxed">{tp("subtitle")}</p>
          <PractitionersList practitioners={practitioners} />
        </div>
      )}
    </div>
  );
}
