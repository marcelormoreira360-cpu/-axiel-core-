"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  upsertRepasseRule,
  deleteRepasseRule,
  calculateMonthRepasse,
  markRepasseAsPaid,
} from "@/services/repasse-service";

export async function saveRepasseRuleAction(formData: FormData): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const userId     = formData.get("user_id") as string;
  const pctStr     = formData.get("percentage") as string;
  const percentage = parseFloat(pctStr);

  if (!userId) return { error: "Selecione o profissional." };
  if (isNaN(percentage) || percentage < 0 || percentage > 100)
    return { error: "Percentual inválido (0–100)." };

  try {
    await upsertRepasseRule(clinic.id, userId, percentage);
    revalidatePath("/financeiro/repasse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function deleteRepasseRuleAction(ruleId: string): Promise<{ error?: string }> {
  try {
    await deleteRepasseRule(ruleId);
    revalidatePath("/financeiro/repasse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover." };
  }
}

export async function calculateRepasseAction(periodMonth: string): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  try {
    await calculateMonthRepasse(clinic.id, periodMonth);
    revalidatePath("/financeiro/repasse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao calcular repasse." };
  }
}

export async function markRepassePaidAction(
  ledgerId: string,
  notes?: string,
): Promise<{ error?: string }> {
  try {
    await markRepasseAsPaid(ledgerId, notes);
    revalidatePath("/financeiro/repasse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao marcar como pago." };
  }
}
