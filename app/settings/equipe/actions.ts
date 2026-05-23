"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  inviteTeamMember,
  updateMemberRole,
  removeTeamMember,
  revokeInvite,
  isManager,
  INVITABLE_ROLES,
} from "@/services/team-service";
import type { AppRole } from "@/lib/types";

export async function inviteMemberAction(formData: FormData): Promise<{ error?: string }> {
  const [clinic, profile] = await Promise.all([getCurrentClinic(), getCurrentUserProfile()]);
  if (!clinic || !profile) return { error: "Sem permissão." };
  if (!isManager(profile.role)) return { error: "Apenas gestores podem convidar membros." };

  const email = (formData.get("email") as string ?? "").trim().toLowerCase();
  const role  = formData.get("role") as AppRole;

  if (!email) return { error: "E-mail obrigatório." };
  if (!INVITABLE_ROLES.includes(role)) return { error: "Cargo inválido." };

  try {
    await inviteTeamMember(clinic.id, clinic.name, email, role, profile.id);
    revalidatePath("/settings/equipe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao enviar convite." };
  }
}

export async function updateRoleAction(
  userId: string,
  role: AppRole,
): Promise<{ error?: string }> {
  const [clinic, profile] = await Promise.all([getCurrentClinic(), getCurrentUserProfile()]);
  if (!profile || !isManager(profile.role)) return { error: "Sem permissão." };
  if (!clinic) return { error: "Clínica não encontrada." };
  if (userId === profile.id) return { error: "Não é possível alterar o próprio cargo." };

  try {
    await updateMemberRole(userId, role, clinic.id); // B-03: pass clinicId
    revalidatePath("/settings/equipe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao alterar cargo." };
  }
}

export async function removeMemberAction(userId: string): Promise<{ error?: string }> {
  const [clinic, profile] = await Promise.all([getCurrentClinic(), getCurrentUserProfile()]);
  if (!profile || !isManager(profile.role)) return { error: "Sem permissão." };
  if (!clinic) return { error: "Clínica não encontrada." };
  if (userId === profile.id) return { error: "Não é possível remover a si mesmo." };

  try {
    await removeTeamMember(userId, clinic.id); // B-03: pass clinicId
    revalidatePath("/settings/equipe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover membro." };
  }
}

export async function revokeInviteAction(inviteId: string): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile || !isManager(profile.role)) return { error: "Sem permissão." };

  try {
    await revokeInvite(inviteId);
    revalidatePath("/settings/equipe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao revogar convite." };
  }
}
