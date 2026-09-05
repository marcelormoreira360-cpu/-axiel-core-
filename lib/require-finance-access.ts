import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/services/user-service";
import { financeCapabilities, type FinanceRole, type FinanceCaps } from "@/lib/finance-permissions";

// Gate do módulo Financeiro/Faturamento (ERP Fase 6.2: permissões por cargo).
// Capacidades resolvidas de role (geral) + finance_role (papel financeiro).

/** Capacidades financeiras do usuário atual (para condicionar UI de edição). */
export async function getFinanceCaps(): Promise<FinanceCaps> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { canView: false, canEdit: false, canExport: false, canApprove: false };
  return financeCapabilities(profile.role, (profile.finance_role ?? null) as FinanceRole | null);
}

/** Acesso de LEITURA ao financeiro (dashboards). Redireciona se não puder ver. */
export async function requireFinanceAccess(): Promise<void> {
  const caps = await getFinanceCaps();
  if (!caps.canView) redirect("/dashboard");
}

/** Acesso de ESCRITA (criar/editar/excluir/pagar). Redireciona se só puder ver. */
export async function requireFinanceEdit(): Promise<void> {
  const caps = await getFinanceCaps();
  if (!caps.canEdit) redirect("/financeiro");
}

/** Gate de gestão de permissões financeiras (atribuir papéis). */
export async function requireFinanceApprove(): Promise<void> {
  const caps = await getFinanceCaps();
  if (!caps.canApprove) redirect("/financeiro");
}

// Versão para route handlers de API: retorna true/false em vez de redirecionar.
// Use para gatear endpoints que expõem dados financeiros (relatórios/PDF/export).
export async function isFinanceApiAllowed(): Promise<boolean> {
  const caps = await getFinanceCaps();
  return caps.canView;
}
