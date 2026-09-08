/**
 * Acesso de suporte "quebra-vidro" (#6.2). Depois do #6.1, o suporte da plataforma tem
 * ZERO acesso clínico. Este serviço é a porta de emergência: cria um grant TEMPORÁRIO,
 * com MOTIVO obrigatório, e REGISTRA (audit_logs). Enquanto o grant estiver ativo, o
 * can_read_clinical_data (migration 163) concede leitura clínica àquele usuário para
 * aquela clínica; ao expirar, o acesso some sozinho.
 */

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 240; // teto de 4 horas por grant

// Papéis de plataforma que podem quebrar o vidro (espelha is_platform_staff no banco).
const PLATFORM_ROLES = ["admin", "platform_admin", "platform_support"];

export type BreakGlassGrant = {
  id: string;
  clinicId: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
};

export async function grantBreakGlass(input: {
  clinicId: string;
  reason: string;
  durationMinutes?: number;
}): Promise<BreakGlassGrant> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  // Só suporte da plataforma pode quebrar o vidro (a RLS de insert reforça isso no banco).
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!PLATFORM_ROLES.includes((profile?.role ?? "") as string)) {
    throw new Error("Break-glass é restrito ao suporte da plataforma.");
  }

  const reason = input.reason?.trim();
  if (!reason) throw new Error("Motivo é obrigatório para o break-glass.");

  const requested = Number.isFinite(input.durationMinutes as number)
    ? (input.durationMinutes as number)
    : DEFAULT_DURATION_MINUTES;
  const minutes = Math.min(Math.max(requested, 1), MAX_DURATION_MINUTES);
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("break_glass_grants")
    .insert({ clinic_id: input.clinicId, user_id: user.id, reason, expires_at: expiresAt })
    .select("id, clinic_id, reason, granted_at, expires_at")
    .single();
  if (error) throw error;

  // Accountability: quem quebrou o vidro, para qual clínica, por quê, até quando.
  const { writeAuditLog } = await import("@/services/audit-service");
  const { auditEvents } = await import("@/modules/security/audit-events");
  await writeAuditLog({
    clinicId: input.clinicId,
    action: auditEvents.breakGlassGranted,
    entityType: "break_glass_grant",
    entityId: data.id as string,
    metadata: { reason, expires_at: expiresAt, duration_minutes: minutes },
  });

  return {
    id: data.id as string,
    clinicId: data.clinic_id as string,
    reason: data.reason as string,
    grantedAt: data.granted_at as string,
    expiresAt: data.expires_at as string,
  };
}

/** Grants de quebra-vidro ATIVOS (não expirados) de uma clínica — transparência/UI. */
export async function getActiveBreakGlassGrants(clinicId: string): Promise<BreakGlassGrant[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("break_glass_grants")
    .select("id, clinic_id, reason, granted_at, expires_at")
    .eq("clinic_id", clinicId)
    .gt("expires_at", new Date().toISOString())
    .order("granted_at", { ascending: false });
  return (data ?? []).map((g) => ({
    id: g.id as string,
    clinicId: g.clinic_id as string,
    reason: g.reason as string,
    grantedAt: g.granted_at as string,
    expiresAt: g.expires_at as string,
  }));
}
