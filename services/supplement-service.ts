/**
 * supplement-service.ts — Feature de Suplementos (MVP).
 *
 * Catálogo por clínica + recomendação por paciente (+ itens).
 * RLS multi-tenant por clinic_id (tabelas da migration 088). Itens herdam o
 * escopo via recommendation_id. Padrão: client de usuário (server) via dynamic
 * import; escopo de clínica garantido por RLS + filtros explícitos.
 *
 * Compliance/IA: nada vai ao paciente sem aprovação humana — `status` só vira
 * 'approved' por ação explícita do profissional (approveSupplementRecommendation).
 */

// ── Tipos ──────────────────────────────────────────────────────────────────
export type SupplementSource =
  | "manipulacao_br"
  | "dfh"
  | "pure_encapsulations"
  | "fullscript"
  | "outro";

export type SupplementCountry = "BR" | "US";

export type SupplementCatalogItem = {
  id: string;
  clinic_id: string;
  name: string;
  source: SupplementSource;
  country: SupplementCountry;
  sku: string | null;
  buy_url: string | null;
  default_dosage: string | null;
  form: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplementRecommendationStatus = "draft" | "reviewed" | "approved" | "sent";
export type SupplementOutputType = "br_formula" | "us_link";

export type SupplementRecommendationItem = {
  id: string;
  recommendation_id: string;
  catalog_id: string | null;
  name: string;
  dosage: string | null;
  timing: string | null;
  duration: string | null;
  rationale: string | null;
  buy_url: string | null;
  source_country: string | null;
  sort_order: number;
  created_at: string;
};

export type PatientSupplementRecommendation = {
  id: string;
  clinic_id: string;
  patient_id: string;
  report_id: string | null;
  status: SupplementRecommendationStatus;
  output_type: SupplementOutputType;
  source_of_suggestion: "ai" | "manual";
  rationale_summary: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items: SupplementRecommendationItem[];
};

function sortItems(items: SupplementRecommendationItem[]): SupplementRecommendationItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

// ── Catálogo ─────────────────────────────────────────────────────────────────
export async function getSupplementCatalog(
  clinicId: string,
  opts?: { activeOnly?: boolean },
): Promise<SupplementCatalogItem[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("supplement_catalog")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });
  if (opts?.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SupplementCatalogItem[];
}

export async function createSupplementCatalogItem(input: {
  clinic_id: string;
  name: string;
  source: SupplementSource;
  country: SupplementCountry;
  sku?: string | null;
  buy_url?: string | null;
  default_dosage?: string | null;
  form?: string | null;
  notes?: string | null;
}): Promise<SupplementCatalogItem> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("supplement_catalog")
    .insert({
      clinic_id:      input.clinic_id,
      name:           input.name,
      source:         input.source,
      country:        input.country,
      sku:            input.sku ?? null,
      buy_url:        input.buy_url ?? null,
      default_dosage: input.default_dosage ?? null,
      form:           input.form ?? null,
      notes:          input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupplementCatalogItem;
}

export async function updateSupplementCatalogItem(
  id: string,
  patch: Partial<Pick<SupplementCatalogItem, "name" | "source" | "country" | "sku" | "buy_url" | "default_dosage" | "form" | "notes" | "active">>,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("supplement_catalog")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSupplementCatalogItem(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("supplement_catalog").delete().eq("id", id);
  if (error) throw error;
}

// ── Recomendações por paciente ───────────────────────────────────────────────
export async function getPatientSupplementRecommendations(
  patientId: string,
): Promise<PatientSupplementRecommendation[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_supplement_recommendations")
    .select("*, patient_supplement_recommendation_items(*)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    items: sortItems((r.patient_supplement_recommendation_items as SupplementRecommendationItem[]) ?? []),
  })) as PatientSupplementRecommendation[];
}

/** Recomendação aprovada mais recente — usada no relatório Neuro ID 360 (Doc 3). */
export async function getApprovedSupplementRecommendation(
  patientId: string,
): Promise<PatientSupplementRecommendation | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_supplement_recommendations")
    .select("*, patient_supplement_recommendation_items(*)")
    .eq("patient_id", patientId)
    .in("status", ["approved", "sent"])
    .order("approved_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    items: sortItems((data.patient_supplement_recommendation_items as SupplementRecommendationItem[]) ?? []),
  } as PatientSupplementRecommendation;
}

export async function createSupplementRecommendation(input: {
  clinic_id: string;
  patient_id: string;
  output_type: SupplementOutputType;
  rationale_summary?: string | null;
  created_by?: string | null;
}): Promise<PatientSupplementRecommendation> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_supplement_recommendations")
    .insert({
      clinic_id:            input.clinic_id,
      patient_id:           input.patient_id,
      output_type:          input.output_type,
      rationale_summary:    input.rationale_summary ?? null,
      source_of_suggestion: "manual",
      status:               "draft",
      created_by:           input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, items: [] } as PatientSupplementRecommendation;
}

export async function addSupplementRecommendationItem(input: {
  recommendation_id: string;
  catalog_id?: string | null;
  name: string;
  dosage?: string | null;
  timing?: string | null;
  duration?: string | null;
  rationale?: string | null;
  buy_url?: string | null;
  source_country?: string | null;
  sort_order?: number;
}): Promise<SupplementRecommendationItem> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_supplement_recommendation_items")
    .insert({
      recommendation_id: input.recommendation_id,
      catalog_id:        input.catalog_id ?? null,
      name:              input.name,
      dosage:            input.dosage ?? null,
      timing:            input.timing ?? null,
      duration:          input.duration ?? null,
      rationale:         input.rationale ?? null,
      buy_url:           input.buy_url ?? null,
      source_country:    input.source_country ?? null,
      sort_order:        input.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupplementRecommendationItem;
}

export async function deleteSupplementRecommendationItem(itemId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_supplement_recommendation_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteSupplementRecommendation(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_supplement_recommendations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Aprovação humana obrigatória (gate). Marca approved + carimba reviewer/approved_at.
 * Nenhuma saída vai ao paciente antes deste passo.
 */
export async function approveSupplementRecommendation(
  id: string,
  reviewerId: string | null,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_supplement_recommendations")
    .update({
      status:      "approved",
      reviewed_by: reviewerId,
      approved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setSupplementRecommendationStatus(
  id: string,
  status: SupplementRecommendationStatus,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_supplement_recommendations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
