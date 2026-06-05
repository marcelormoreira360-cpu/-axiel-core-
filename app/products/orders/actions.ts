"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { createProductOrder, cancelProductOrder, markOrderDelivered, type OrderItemInput } from "@/services/product-order-service";

// Cria um pedido de produtos. Recebe os itens como JSON no campo "items"
// (ex.: [{"product_id":"...","quantity":2}]).
export async function createProductOrderAction(
  formData: FormData,
): Promise<{ orderId?: string; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const patientId = (formData.get("patient_id") as string | null) || null;
  const notes = (formData.get("notes") as string | null) || null;
  const taxStr = (formData.get("tax_reais") as string | null) || "";
  const taxCents = taxStr ? Math.round(parseFloat(taxStr.replace(",", ".")) * 100) : 0;

  let items: OrderItemInput[];
  try {
    items = JSON.parse((formData.get("items") as string) ?? "[]") as OrderItemInput[];
  } catch {
    return { error: "Itens inválidos." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Adicione ao menos um produto." };
  }

  try {
    const order = await createProductOrder({
      clinicId: clinic.id,
      patientId,
      items,
      taxCents: isNaN(taxCents) ? 0 : taxCents,
      notes,
      createdBy: user?.id ?? null,
    });
    revalidatePath("/products/orders");
    return { orderId: order.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar pedido." };
  }
}

export async function cancelProductOrderAction(
  orderId: string,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };
  try {
    await cancelProductOrder(clinic.id, orderId);
    revalidatePath("/products/orders");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cancelar pedido." };
  }
}

export async function markOrderDeliveredAction(
  orderId: string,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };
  try {
    await markOrderDelivered(clinic.id, orderId);
    revalidatePath("/products/orders");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao marcar entregue." };
  }
}
