import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { Resend } from "resend";
import { DEFAULT_FROM_EMAIL } from "@/lib/constants";

// ── Hotmart webhook payload types ────────────────────────────────

export type HotmartEventType =
  | "PURCHASE_COMPLETE"
  | "PURCHASE_APPROVED"
  | "PURCHASE_CANCELLED"
  | "PURCHASE_REFUNDED"
  | "PURCHASE_CHARGEBACK"
  | "SUBSCRIPTION_CANCELLATION";

export type HotmartWebhookPayload = {
  event: HotmartEventType;
  id: string;
  creation_date: number;
  data: {
    product?: { id?: number | string; name?: string };
    offer?: { code?: string };
    purchase?: {
      transaction?: string;
      status?: string;
      price?: { value?: number; currency_value?: string };
      payment?: { type?: string };
    };
    buyer?: {
      email?: string;
      name?: string;
      phone?: string;
      checkout_phone?: string;
    };
    subscription?: { subscriber?: { code?: string } };
  };
};

// ── Clinic settings helpers ───────────────────────────────────────

export async function getHotmartToken(clinicId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return typeof settings.hotmart_hottok === "string" ? settings.hotmart_hottok : null;
}

export async function saveHotmartToken(clinicId: string, hottok: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const current = (existing?.settings ?? {}) as Record<string, unknown>;
  const updated = { ...current, hotmart_hottok: hottok };

  await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: updated }, { onConflict: "clinic_id" });
}

// ── Main webhook processor ────────────────────────────────────────

export async function processHotmartWebhook(
  clinicId: string,
  payload: HotmartWebhookPayload,
): Promise<{ ok: boolean; action: string }> {
  const supabase = createSupabaseAdminClient();

  const buyer = payload.data.buyer;
  const product = payload.data.product;
  const purchase = payload.data.purchase;
  const offer = payload.data.offer;
  const event = payload.event;

  if (!buyer?.email) return { ok: false, action: "no_buyer_email" };

  const buyerEmail = buyer.email.toLowerCase().trim();
  const buyerName = buyer.name?.trim() ?? "";
  const buyerPhone = normalizePhone(buyer.checkout_phone ?? buyer.phone ?? "");
  const productName = product?.name ?? "Produto Hotmart";
  const transactionId = purchase?.transaction ?? payload.id;
  const priceCents = purchase?.price?.value ? Math.round(purchase.price.value * 100) : null;
  const currency = purchase?.price?.currency_value ?? "BRL";

  // 1. Find or create patient / lead
  const { patientId, isNew } = await findOrCreateContact(
    supabase, clinicId, buyerEmail, buyerName, buyerPhone,
  );

  // 2. Store purchase record
  const status = event === "PURCHASE_COMPLETE" || event === "PURCHASE_APPROVED"
    ? "completed"
    : event === "PURCHASE_CANCELLED" ? "cancelled"
    : event === "PURCHASE_REFUNDED" ? "refunded"
    : event === "PURCHASE_CHARGEBACK" ? "chargeback"
    : "other";

  await supabase.from("hotmart_purchases").upsert({
    clinic_id: clinicId,
    patient_id: patientId,
    transaction_id: transactionId,
    product_id: String(product?.id ?? ""),
    product_name: productName,
    offer_code: offer?.code ?? null,
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    buyer_phone: buyerPhone,
    status,
    price_cents: priceCents,
    currency,
    event_type: event,
    payload: payload as unknown as Record<string, unknown>,
  }, { onConflict: "transaction_id" });

  // 3. Send notifications on new completed purchase
  if ((event === "PURCHASE_COMPLETE" || event === "PURCHASE_APPROVED") && isNew) {
    await sendPurchaseWelcome(supabase, clinicId, buyerName, buyerEmail, buyerPhone, productName);
  }

  return { ok: true, action: `${status}_${isNew ? "new_contact" : "existing_contact"}` };
}

// ── Helpers ───────────────────────────────────────────────────────

async function findOrCreateContact(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
  email: string,
  name: string,
  phone: string | null,
): Promise<{ patientId: string; isNew: boolean }> {
  // Check existing patient
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("email", email)
    .maybeSingle();

  if (patient) return { patientId: patient.id, isNew: false };

  // Check existing lead and convert
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("email", email)
    .maybeSingle();

  if (lead) {
    // Promote lead to patient
    const { data: newPatient } = await supabase
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: name, email, phone, status: "active", source: "hotmart" })
      .select("id")
      .single();
    if (newPatient) {
      await supabase.from("leads").update({ status: "converted" }).eq("id", lead.id);
      return { patientId: newPatient.id, isNew: true };
    }
  }

  // Create new patient directly
  const { data: created } = await supabase
    .from("patients")
    .insert({ clinic_id: clinicId, full_name: name, email, phone, status: "active", source: "hotmart" })
    .select("id")
    .single();

  return { patientId: created!.id, isNew: true };
}

async function sendPurchaseWelcome(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
  name: string,
  email: string,
  phone: string | null,
  productName: string,
) {
  const { data: clinic } = await supabase
    .from("clinics").select("name").eq("id", clinicId).single();
  const clinicName = clinic?.name ?? "nossa clínica";
  const first = name.split(" ")[0] || name;

  if (email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = DEFAULT_FROM_EMAIL;
    const html = `
      <p>Olá, ${first}!</p>
      <p>Parabéns pela sua compra de <strong>${productName}</strong> na <strong>${clinicName}</strong>!</p>
      <p>Em breve nossa equipe entrará em contato para dar os próximos passos.</p>
      <p>Ficamos felizes em tê-lo(a) com a gente! 🌿</p>
    `.trim();
    try {
      await resend.emails.send({
        from,
        to: email,
        subject: `Bem-vindo(a)! Sua compra de ${productName} foi confirmada`,
        html,
      });
    } catch { /* silent */ }
  }

  if (phone) {
    const msg =
      `Olá, ${first}! 🎉\n\n` +
      `Sua compra de *${productName}* foi confirmada!\n\n` +
      `Em breve a equipe da *${clinicName}* entrará em contato para dar os próximos passos. 🌿`;
    try {
      await sendWhatsAppText(phone, msg);
    } catch { /* silent */ }
  }
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Armazena só dígitos (padrão único de dedup — ver lib/phone.ts).
  // 10-11 dígitos = número local BR sem DDI → prefixa 55; mais que isso
  // já veio com código de país (compras dos EUA não viram +55 inválido).
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

// ── Recent purchases (for settings page) ─────────────────────────

export type HotmartPurchaseSummary = {
  id: string;
  transaction_id: string;
  product_name: string;
  buyer_name: string;
  buyer_email: string;
  status: string;
  price_cents: number | null;
  currency: string;
  created_at: string;
};

export async function listRecentHotmartPurchases(
  clinicId: string,
  limit = 20,
): Promise<HotmartPurchaseSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("hotmart_purchases")
    .select("id, transaction_id, product_name, buyer_name, buyer_email, status, price_cents, currency, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as HotmartPurchaseSummary[];
}

// ── Extended purchase type for management page ────────────────────

export type HotmartPurchaseFull = HotmartPurchaseSummary & {
  patient_id: string | null;
  buyer_phone: string | null;
  product_id: string | null;
  event_type: string | null;
  patients: { full_name: string } | null;
};

export type HotmartKPIs = {
  total_revenue_cents: number;
  total_purchases: number;
  completed: number;
  cancelled: number;
  refunded: number;
  chargeback: number;
};

export async function listHotmartPurchases(
  clinicId: string,
  opts: {
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ purchases: HotmartPurchaseFull[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  const limit  = opts.limit  ?? 50;
  const offset = opts.offset ?? 0;

  let q = supabase
    .from("hotmart_purchases")
    .select(
      "id, transaction_id, product_name, product_id, buyer_name, buyer_email, buyer_phone, patient_id, status, price_cents, currency, event_type, created_at, patients(full_name)",
      { count: "exact" },
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to)   q = q.lte("created_at", opts.to + "T23:59:59");
  if (opts.search) {
    const s = `%${opts.search}%`;
    q = q.or(`buyer_name.ilike.${s},buyer_email.ilike.${s},product_name.ilike.${s}`);
  }

  const { data, count } = await q;
  return {
    purchases: (data ?? []) as unknown as HotmartPurchaseFull[],
    total: count ?? 0,
  };
}

export async function getHotmartKPIs(clinicId: string): Promise<HotmartKPIs> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("hotmart_purchases")
    .select("status, price_cents")
    .eq("clinic_id", clinicId);

  const rows = data ?? [];
  return {
    total_revenue_cents: rows.filter((r) => r.status === "completed").reduce((s, r) => s + (r.price_cents ?? 0), 0),
    total_purchases: rows.length,
    completed:  rows.filter((r) => r.status === "completed").length,
    cancelled:  rows.filter((r) => r.status === "cancelled").length,
    refunded:   rows.filter((r) => r.status === "refunded").length,
    chargeback: rows.filter((r) => r.status === "chargeback").length,
  };
}
