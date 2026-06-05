type ProductRow = {
  id: string;
  name: string;
  price_cents: number | null;
  currency: string | null;
  is_active: boolean;
};

export type ProductOrderStatus = "draft" | "pending" | "paid" | "delivered" | "canceled";
export type ProductOrderPaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export type ProductOrder = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  created_by: string | null;
  status: ProductOrderStatus;
  payment_status: ProductOrderPaymentStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  asaas_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductOrderItem = {
  id: string;
  order_id: string;
  clinic_id: string;
  product_id: string | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export type OrderItemInput = { product_id: string; quantity: number };

export type ProductOrderWithExtras = ProductOrder & {
  patient_name: string | null;
  items: ProductOrderItem[];
};

// ── Criar pedido ──────────────────────────────────────────────────────────────
// Lê os produtos (escopados à clínica + ativos), faz snapshot de nome/preço,
// calcula totais e insere product_orders + product_order_items. Status pending/unpaid.
export async function createProductOrder(input: {
  clinicId: string;
  patientId: string | null;
  items: OrderItemInput[];
  taxCents?: number;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<ProductOrder> {
  if (!input.items.length) throw new Error("O pedido precisa de ao menos um item.");

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const productIds = [...new Set(input.items.map((i) => i.product_id))];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, currency, is_active")
    .eq("clinic_id", input.clinicId)
    .in("id", productIds);
  if (prodErr) throw prodErr;

  const byId = new Map((products ?? []).map((p) => [p.id, p as ProductRow]));

  const itemsToInsert = input.items.map((i) => {
    const p = byId.get(i.product_id);
    if (!p) throw new Error("Produto não encontrado ou de outra clínica.");
    if (!p.is_active) throw new Error(`Produto inativo: ${p.name}`);
    const qty = Math.max(1, Math.floor(i.quantity));
    const unit = p.price_cents ?? 0;
    return {
      product_id: i.product_id,
      name: p.name,
      unit_price_cents: unit,
      quantity: qty,
      line_total_cents: unit * qty,
    };
  });

  const subtotal = itemsToInsert.reduce((s, it) => s + it.line_total_cents, 0);
  const tax = input.taxCents ?? 0;
  const total = subtotal + tax;
  const currency = (products?.[0]?.currency as string | null) ?? "BRL";

  const { data: order, error: orderErr } = await supabase
    .from("product_orders")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      created_by: input.createdBy ?? null,
      status: "pending",
      payment_status: "unpaid",
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      currency,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (orderErr) throw orderErr;

  const { error: itemsErr } = await supabase.from("product_order_items").insert(
    itemsToInsert.map((it) => ({ ...it, order_id: (order as ProductOrder).id, clinic_id: input.clinicId })),
  );
  if (itemsErr) throw itemsErr;

  return order as ProductOrder;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
export async function getProductOrders(clinicId: string): Promise<(ProductOrder & { patient_name: string | null })[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_orders")
    .select("*, patients(full_name)")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    return { ...row, patient_name: (patient as { full_name?: string } | null)?.full_name ?? null } as ProductOrder & { patient_name: string | null };
  });
}

export async function getProductOrderById(clinicId: string, orderId: string): Promise<ProductOrderWithExtras | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("product_orders")
    .select("*, patients(full_name)")
    .eq("clinic_id", clinicId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const { data: items } = await supabase
    .from("product_order_items")
    .select("*")
    .eq("order_id", orderId);
  const patient = Array.isArray(order.patients) ? order.patients[0] : order.patients;
  return {
    ...(order as ProductOrder),
    patient_name: (patient as { full_name?: string } | null)?.full_name ?? null,
    items: (items ?? []) as ProductOrderItem[],
  };
}

// ── Baixa de pagamento (chamado pelos webhooks) ───────────────────────────────
// Marca o pedido como pago e dá baixa no estoque dos itens. Idempotente: se já
// estava pago, não repete (evita decrementar estoque 2x em reentrega de webhook).
export async function markProductOrderPaid(
  orderId: string,
  opts?: { stripePaymentIntentId?: string | null },
): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  const { data: order } = await supabase
    .from("product_orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.payment_status === "paid") return;

  await supabase
    .from("product_orders")
    .update({
      payment_status: "paid",
      status: "paid",
      ...(opts?.stripePaymentIntentId ? { stripe_payment_intent_id: opts.stripePaymentIntentId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  // Baixa de estoque por item (read-modify-write; volume baixo)
  const { data: items } = await supabase
    .from("product_order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id) continue;
    const { data: prod } = await supabase
      .from("products")
      .select("inventory_quantity")
      .eq("id", it.product_id)
      .maybeSingle();
    if (prod && typeof prod.inventory_quantity === "number") {
      const next = Math.max(0, prod.inventory_quantity - it.quantity);
      await supabase.from("products").update({ inventory_quantity: next }).eq("id", it.product_id);
    }
  }
}

// ── Fulfillment ───────────────────────────────────────────────────────────────
export async function markOrderDelivered(clinicId: string, orderId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("product_orders")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .eq("payment_status", "paid"); // só entrega pedido pago
  if (error) throw error;
}

// ── Cancelar ──────────────────────────────────────────────────────────────────
export async function cancelProductOrder(clinicId: string, orderId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("product_orders")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .neq("status", "paid"); // não cancela pedido já pago
  if (error) throw error;
}
