"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentClinic } from "@/services/clinic-service";
import { addPatientProduct, updatePatientProductStatus } from "@/services/product-service";
import type { DbPatientProduct } from "@/services/product-service";

const AddPatientProductSchema = z.object({
  patient_id: z.string().uuid(),
  product_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
  product_name: z.string().min(1, "Nome do produto é obrigatório").max(200),
  reason: z.string().max(1000).optional(),
  review_date: z
    .string()
    .optional()
    .transform((v) => v || null),
});

export async function addPatientProductAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Nenhuma clínica disponível.");

  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  );

  const parsed = AddPatientProductSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados inválidos.";
    const patientId = raw.patient_id as string;
    redirect(`/patients/${patientId}/products?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;

  await addPatientProduct({
    clinic_id: clinic.id,
    patient_id: data.patient_id,
    product_id: data.product_id ?? null,
    product_name: data.product_name,
    reason: data.reason || null,
    review_date: data.review_date,
  });

  revalidatePath(`/patients/${data.patient_id}/products`);
}

export async function updatePatientProductStatusAction(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as DbPatientProduct["status"];
  const patientId = formData.get("patient_id") as string;

  if (!id || !status) throw new Error("Dados obrigatórios ausentes.");

  await updatePatientProductStatus(id, status);
  revalidatePath(`/patients/${patientId}/products`);
}
