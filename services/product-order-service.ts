export async function createProductOrder(input: {
  clinicId: string;
  patientId?: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
}) {
  return {
    id: crypto.randomUUID(),
    status: "pending",
    paymentStatus: "unpaid",
    totalCents: input.quantity * input.unitPriceCents,
  };
}
