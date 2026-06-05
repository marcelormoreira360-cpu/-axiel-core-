"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentClinic } from "@/services/clinic-service";
import { createProduct } from "@/services/product-service";
import { getClinicCurrency } from "@/services/finance-service";

const ProductSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(200),
  category: z
    .enum([
      "Suplementos",
      "Exames/Testes",
      "Dispositivos",
      "Kits",
      "Produtos Digitais",
      "Add-ons de Sessão",
      "Outro",
    ])
    .default("Outro"),
  description: z.string().max(2000).optional(),
  price_brl: z
    .string()
    .min(1, "Preço é obrigatório")
    .refine((v) => !isNaN(parseFloat(v.replace(",", "."))), "Preço inválido"),
  cost_brl: z.string().optional(),
  inventory_quantity: z.coerce.number().int().min(0).default(0),
  sku: z.string().max(100).optional(),
  safety_notes: z.string().max(2000).optional(),
});

function parseBRLtoCents(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const parsed = parseFloat(value.replace(",", "."));
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

export async function createProductAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Nenhuma clínica disponível para este usuário.");

  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  );

  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados inválidos.";
    redirect(`/products/new?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;
  const priceCents = parseBRLtoCents(data.price_brl);
  if (priceCents === null || priceCents < 0) {
    redirect(`/products/new?error=${encodeURIComponent("Preço inválido.")}`);
  }

  await createProduct({
    clinic_id: clinic.id,
    name: data.name,
    category: data.category,
    description: data.description || null,
    price_cents: priceCents,
    cost_cents: parseBRLtoCents(data.cost_brl),
    currency: await getClinicCurrency(clinic.id),
    sku: data.sku || null,
    inventory_quantity: data.inventory_quantity,
    safety_notes: data.safety_notes || null,
  });

  redirect("/products");
}
