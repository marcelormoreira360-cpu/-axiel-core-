import type { Patient } from "@/lib/types";

export function patientStatusLabel(patient: Patient) {
  const labels = {
    active: "Active care",
    inactive: "Needs follow-up",
    archived: "Archived",
  } as const;

  return labels[patient.status];
}
