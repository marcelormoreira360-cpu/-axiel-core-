import { randomBytes, createHash } from "crypto";

// =============================================================================
// AXIEL Growth → AXIEL Core — serviço de integração (handoff de lead quente).
// - Integration Keys por clínica (hash SHA-256; a chave bruta nunca é guardada).
// - Resolução de clínica pela chave (admin client, sem sessão — usado no webhook).
// - Upsert idempotente de lead a partir do payload do Growth.
// =============================================================================

const KEY_PROVIDER = "axiel_growth";

export type GrowthLeadPayload = {
  growth_lead_id?: string;
  growth_tenant_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  score?: number;
  stage?: string;          // captured|cold|warm|hot|scheduled|patient
  interest?: string;
  interest_area?: string;  // fechado e não clínico: energy|sleep|stress|performance|general
  // `pain` (queixa clínica em texto livre) foi REMOVIDO: o Growth parou de enviar
  // (migration 0023, parecer Lex 2026-07-14) e o Core deixa de aceitá-lo aqui,
  // fechando o vazamento de PHI também na borda do hand-off (defense-in-depth).
  source_platform?: string;
  consent?: { granted?: boolean; text?: string; at?: string };
};

// Área de interesse fechada aceita do Growth (espelha o CHECK da migration 131).
// Qualquer valor fora da lista é descartado (vira null) — nunca persistimos texto
// livre não clínico arbitrário vindo do payload.
const INTEREST_AREAS = ["energy", "sleep", "stress", "performance", "general"] as const;
type InterestArea = (typeof INTEREST_AREAS)[number];

const INTEREST_AREA_LABELS_PT: Record<InterestArea, string> = {
  energy: "Energia",
  sleep: "Sono",
  stress: "Estresse",
  performance: "Performance",
  general: "Geral",
};

function sanitizeInterestArea(value?: string): InterestArea | null {
  const v = (value ?? "").trim().toLowerCase();
  return (INTEREST_AREAS as readonly string[]).includes(v) ? (v as InterestArea) : null;
}

export type IntegrationKeyRow = {
  id: string;
  label: string | null;
  key_prefix: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// Growth stage → Core lead_stage enum
function mapStage(growthStage?: string): "new_lead" | "scheduled" | "converted_to_patient" {
  switch ((growthStage ?? "").toLowerCase()) {
    case "scheduled": return "scheduled";
    case "patient":   return "converted_to_patient";
    default:          return "new_lead"; // captured|cold|warm|hot
  }
}

// ─── Gestão de chaves (UI — usa server client via admin para simplicidade) ────

export async function generateIntegrationKey(
  clinicId: string,
  label: string | null,
  createdBy: string | null
): Promise<{ rawKey: string; row: IntegrationKeyRow }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  const rawKey = `axg_${randomBytes(24).toString("hex")}`;
  const key_prefix = rawKey.slice(0, 12); // ex.: "axg_1a2b3c4d"
  const key_hash = hashKey(rawKey);

  const { data, error } = await supabase
    .from("clinic_integration_keys")
    .insert({
      clinic_id: clinicId,
      provider: KEY_PROVIDER,
      label,
      key_hash,
      key_prefix,
      created_by: createdBy,
    })
    .select("id, label, key_prefix, is_active, last_used_at, created_at")
    .single();
  if (error) throw error;

  return { rawKey, row: data as IntegrationKeyRow };
}

export async function listIntegrationKeys(clinicId: string): Promise<IntegrationKeyRow[]> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinic_integration_keys")
    .select("id, label, key_prefix, is_active, last_used_at, created_at")
    .eq("clinic_id", clinicId)
    .eq("provider", KEY_PROVIDER)
    .order("created_at", { ascending: false });
  return (data as IntegrationKeyRow[]) ?? [];
}

export async function revokeIntegrationKey(clinicId: string, keyId: string): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("clinic_integration_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("clinic_id", clinicId);
}

// ─── Webhook: resolver clínica pela chave (sem sessão) ────────────────────────

export async function resolveClinicByKey(
  rawKey: string
): Promise<{ clinicId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith("axg_")) return null;
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("clinic_integration_keys")
    .select("id, clinic_id")
    .eq("key_hash", hashKey(rawKey))
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;

  // best-effort: marca último uso (não bloqueia)
  supabase
    .from("clinic_integration_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {}, () => {});

  return { clinicId: data.clinic_id as string, keyId: data.id as string };
}

// ─── Upsert idempotente do lead vindo do Growth ───────────────────────────────

export async function upsertGrowthLead(
  clinicId: string,
  payload: GrowthLeadPayload
): Promise<{ leadId: string; created: boolean }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  const fullName = (payload.name ?? "").trim() || `Lead Growth ${(payload.phone ?? "").slice(-4)}`;
  const phone = (payload.phone ?? "").trim() || null;
  const email = (payload.email ?? "").trim() || null;
  const stage = mapStage(payload.stage);
  const score = Math.max(0, Math.min(100, Math.round(payload.score ?? 0)));
  const interestArea = sanitizeInterestArea(payload.interest_area);

  const warming_context = {
    growth_stage: payload.stage ?? null,
    interest: payload.interest ?? null,
    interest_area: interestArea,
    source_platform: payload.source_platform ?? null,
    score_at_handoff: score,
    consent: payload.consent ?? null,
  };

  const notesParts = [
    "Lead recebido do AXIEL Growth.",
    interestArea ? `Área de interesse: ${INTEREST_AREA_LABELS_PT[interestArea]}` : null,
    payload.interest ? `Interesse: ${payload.interest}` : null,
    payload.source_platform ? `Plataforma: ${payload.source_platform}` : null,
    `Score no handoff: ${score}`,
  ].filter(Boolean);
  const notes = notesParts.join("\n");

  const baseRow = {
    clinic_id: clinicId,
    full_name: fullName,
    email,
    phone,
    source: "axiel_growth" as const,
    stage,
    score,
    interest_area: interestArea,
    notes,
    warming_context,
    updated_at: new Date().toISOString(),
  };

  // 1) Idempotência por growth_lead_id
  if (payload.growth_lead_id) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("growth_lead_id", payload.growth_lead_id)
      .maybeSingle();
    if (existing) {
      await supabase.from("leads").update(baseRow).eq("id", existing.id);
      return { leadId: existing.id as string, created: false };
    }
  }

  // 2) Dedup por telefone/email na mesma clínica (evita lead duplicado).
  //    Consultas separadas com .eq() — sem interpolar valor em filtro .or()
  //    (evita injeção de sintaxe PostgREST a partir do payload).
  let dupId: string | null = null;
  if (phone) {
    const { data } = await supabase
      .from("leads").select("id").eq("clinic_id", clinicId).eq("phone", phone).limit(1).maybeSingle();
    dupId = (data?.id as string) ?? null;
  }
  if (!dupId && email) {
    const { data } = await supabase
      .from("leads").select("id").eq("clinic_id", clinicId).eq("email", email).limit(1).maybeSingle();
    dupId = (data?.id as string) ?? null;
  }
  if (dupId) {
    await supabase
      .from("leads")
      .update({ ...baseRow, growth_lead_id: payload.growth_lead_id ?? null })
      .eq("id", dupId);
    return { leadId: dupId, created: false };
  }

  // 3) Novo lead
  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({ ...baseRow, growth_lead_id: payload.growth_lead_id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return { leadId: inserted.id as string, created: true };
}
