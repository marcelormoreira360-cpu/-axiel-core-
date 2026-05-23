export type DbProduct = {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  description: string | null;
  price_cents: number;
  cost_cents: number | null;
  currency: string;
  sku: string | null;
  inventory_quantity: number;
  is_active: boolean;
  safety_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPatientProduct = {
  id: string;
  clinic_id: string;
  patient_id: string;
  product_id: string | null;
  product_name: string;
  reason: string | null;
  notes: string | null;
  status: "active" | "paused" | "completed" | "canceled";
  review_date: string | null;
  created_at: string;
};

export async function getProducts(): Promise<DbProduct[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbProduct[];
}

export async function createProduct(input: {
  clinic_id: string;
  name: string;
  category: string;
  description?: string | null;
  price_cents: number;
  cost_cents?: number | null;
  currency?: string;
  sku?: string | null;
  inventory_quantity?: number;
  safety_notes?: string | null;
}): Promise<DbProduct> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...input,
      currency: input.currency ?? "BRL",
      inventory_quantity: input.inventory_quantity ?? 0,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as DbProduct;
}

export async function toggleProductActive(id: string, is_active: boolean): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active })
    .eq("id", id);

  if (error) throw error;
}

export async function getPatientProducts(patientId: string): Promise<DbPatientProduct[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_products")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbPatientProduct[];
}

export async function addPatientProduct(input: {
  clinic_id: string;
  patient_id: string;
  product_id?: string | null;
  product_name: string;
  reason?: string | null;
  notes?: string | null;
  review_date?: string | null;
}): Promise<DbPatientProduct> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patient_products")
    .insert({
      ...input,
      status: "active",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as DbPatientProduct;
}

export async function updatePatientProductStatus(
  id: string,
  status: DbPatientProduct["status"],
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_products")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}
