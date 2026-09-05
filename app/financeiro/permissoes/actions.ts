"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceApprove } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { setUserFinanceRole } from "@/services/fin-permissions-service";
import { FINANCE_ROLES, type FinanceRole } from "@/lib/finance-permissions";

export async function setFinanceRoleAction(userId: string, value: string) {
  await requireFinanceApprove();
  const clinic = await getCurrentClinic();
  if (!clinic) return;
  const financeRole: FinanceRole | null = FINANCE_ROLES.includes(value as FinanceRole)
    ? (value as FinanceRole)
    : null;
  await setUserFinanceRole(userId, clinic.id, financeRole);
  revalidatePath("/financeiro/permissoes");
}
