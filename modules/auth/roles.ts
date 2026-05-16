import type { AppRole } from "@/lib/types";

export const roleLabels: Record<AppRole, string> = {
  admin: "Platform Admin",
  platform_admin: "Platform Admin",
  platform_support: "Platform Support",
  clinic_owner: "Clinic Owner",
  clinic_manager: "Clinic Manager",
  practitioner: "Practitioner",
  front_desk: "Front Desk",
  read_only_staff: "Read-only Staff",
  staff: "Staff",
};

export const platformRoles: AppRole[] = ["admin", "platform_admin", "platform_support"];
export const clinicManagerRoles: AppRole[] = ["clinic_owner", "clinic_manager"];
export const clinicWriteRoles: AppRole[] = ["clinic_owner", "clinic_manager", "practitioner", "front_desk", "staff"];

export function canManagePlatform(role: AppRole | null | undefined) {
  return role === "admin" || role === "platform_admin";
}

export function canSupportPlatform(role: AppRole | null | undefined) {
  return role === "admin" || role === "platform_admin" || role === "platform_support";
}

export function canManageClinics(role: AppRole | null | undefined) {
  return canManagePlatform(role);
}

export function canManageClinicUsers(role: AppRole | null | undefined) {
  return canManagePlatform(role) || role === "clinic_owner" || role === "clinic_manager";
}

export function canWriteClinicData(role: AppRole | null | undefined) {
  return canManagePlatform(role) || clinicWriteRoles.includes(role as AppRole);
}

export function canDeleteRecords(role: AppRole | null | undefined) {
  return canManagePlatform(role) || role === "clinic_owner" || role === "clinic_manager";
}

export function canViewOnly(role: AppRole | null | undefined) {
  return role === "read_only_staff";
}
