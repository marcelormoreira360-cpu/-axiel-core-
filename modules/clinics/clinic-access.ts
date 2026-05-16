export function hasClinicAccess(userClinicIds: string[], clinicId: string) {
  return userClinicIds.includes(clinicId);
}

export function buildClinicScopedPath(clinicSlug: string, path: string) {
  return `/clinics/${clinicSlug}${path.startsWith("/") ? path : `/${path}`}`;
}
