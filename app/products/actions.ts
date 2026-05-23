"use server";

import { revalidatePath } from "next/cache";
import { toggleProductActive } from "@/services/product-service";

export async function toggleProductActiveAction(formData: FormData) {
  const id = formData.get("id") as string;
  const isActive = formData.get("is_active") === "true";

  if (!id) throw new Error("ID do produto é obrigatório.");

  await toggleProductActive(id, isActive);
  revalidatePath("/products");
}
