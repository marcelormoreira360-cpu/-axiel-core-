import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AppRole } from "@/lib/types";
import type { FinanceRole } from "@/lib/finance-permissions";

// Módulo Financeiro (ERP) — Fase 6.2. Atribuição de papel financeiro por usuário.
// Leitura/escrita via servidor (admin client), gated por requireFinanceApprove.

export type TeamFinanceMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  finance_role: FinanceRole | null;
};

export async function listTeamFinanceRoles(clinicId: string): Promise<TeamFinanceMember[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, finance_role")
    .eq("clinic_id", clinicId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeamFinanceMember[];
}

/** Define (ou limpa, com null) o papel financeiro de um usuário da clínica. */
export async function setUserFinanceRole(
  userId: string,
  clinicId: string,
  financeRole: FinanceRole | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ finance_role: financeRole })
    .eq("id", userId)
    .eq("clinic_id", clinicId); // escopo à clínica — nunca mexe em usuário de outra
  if (error) throw error;
}
