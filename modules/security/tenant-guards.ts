export function assertClinicScope(clinicId: string | null | undefined): asserts clinicId is string {
  if (!clinicId) {
    throw new Error("Clinic scope is required for this action.");
  }
}

export function sameClinicOrThrow(leftClinicId: string, rightClinicId: string, message = "Records must belong to the same clinic.") {
  if (leftClinicId !== rightClinicId) {
    throw new Error(message);
  }
}
