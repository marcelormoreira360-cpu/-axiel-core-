import type { AppRole } from "@/lib/types";
import { isManager } from "@/lib/team-utils";

// Papel financeiro (ERP Fase 6.2) e resolução de capacidades. Puro / sem deps de
// servidor — pode ser importado por client components (ex.: legenda da tela de
// permissões). O enforcement real fica no servidor (lib/require-finance-access).

export type FinanceRole = "cfo" | "controller" | "billing" | "pricing" | "cpa";

export const FINANCE_ROLES: FinanceRole[] = ["cfo", "controller", "billing", "pricing", "cpa"];

export type FinanceCaps = {
  canView: boolean;    // ver dashboards
  canEdit: boolean;    // criar/editar/excluir lançamentos e contas
  canExport: boolean;  // exportar PDF/CSV
  canApprove: boolean; // aprovar (reservado ao CFO/gestor)
};

// Papéis financeiros que podem ALTERAR lançamentos/contas.
const EDIT_ROLES: FinanceRole[] = ["cfo", "controller", "billing"];

/**
 * Resolve as capacidades financeiras efetivas a partir do papel geral (role) e
 * do papel financeiro opcional. Regras:
 *  - Gestor/dono/admin: acesso completo (a menos que finance_role o restrinja
 *    explicitamente a cpa/pricing — permite um gestor "somente leitura").
 *  - Não-gestor: só tem acesso se tiver um finance_role; o nível segue o papel.
 *  - Export acompanha a visão; aprovar é só de cfo (ou gestor sem restrição).
 */
export function financeCapabilities(role: AppRole, financeRole: FinanceRole | null): FinanceCaps {
  const manager = isManager(role);

  // Gestor explicitamente restringido a papel somente-leitura.
  if (manager && (financeRole === "cpa" || financeRole === "pricing")) {
    return { canView: true, canEdit: false, canExport: true, canApprove: false };
  }
  if (manager) {
    return { canView: true, canEdit: true, canExport: true, canApprove: true };
  }

  // Não-gestor: precisa de finance_role.
  if (!financeRole) {
    return { canView: false, canEdit: false, canExport: false, canApprove: false };
  }
  return {
    canView: true,
    canEdit: EDIT_ROLES.includes(financeRole),
    canExport: true,
    canApprove: financeRole === "cfo",
  };
}
