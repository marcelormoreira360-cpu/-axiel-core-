export async function attachProductToPatient(input: {
  clinicId: string;
  patientId: string;
  productId: string;
  reason: string;
  nextStep: string;
  reviewDate?: string;
}) {
  return {
    id: crypto.randomUUID(),
    status: "active",
    ...input,
  };
}

export async function createProductRefillReminder(input: {
  clinicId: string;
  patientId: string;
  productId: string;
  dueAt: string;
  message: string;
}) {
  return {
    id: crypto.randomUUID(),
    status: "pending",
    ...input,
  };
}
