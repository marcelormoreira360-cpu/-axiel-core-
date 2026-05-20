import type { AppRole } from "@/lib/types";

// Pure role utilities — no server deps, safe to import from client components

export const ROLE_LABELS: Record<AppRole, string> = {
  admin:              "Admin",
  platform_admin:     "Admin da plataforma",
  platform_support:   "Suporte",
  clinic_owner:       "Proprietário",
  clinic_manager:     "Gestor",
  practitioner:       "Profissional de saúde",
  front_desk:         "Recepção",
  read_only_staff:    "Visualizador",
  staff:              "Equipe",
};

export const INVITABLE_ROLES: AppRole[] = [
  "clinic_manager",
  "practitioner",
  "front_desk",
  "read_only_staff",
];

export function isManager(role: AppRole): boolean {
  return role === "clinic_owner" || role === "clinic_manager" || role === "admin";
}

export function isPractitioner(role: AppRole): boolean {
  return role === "practitioner";
}
