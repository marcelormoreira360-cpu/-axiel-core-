import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";

// Restringe o módulo Financeiro/Faturamento a dono/gestor/admin.
// Colaboradores comuns (profissional, recepção, visualizador) não acessam.
export async function requireFinanceAccess(): Promise<void> {
  const profile = await getCurrentUserProfile();
  if (!profile || !isManager(profile.role)) {
    redirect("/dashboard");
  }
}

// Versão para route handlers de API: retorna true/false em vez de redirecionar.
// Use para gatear endpoints que expõem dados financeiros (relatórios/PDF).
export async function isFinanceApiAllowed(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return !!profile && isManager(profile.role);
}
