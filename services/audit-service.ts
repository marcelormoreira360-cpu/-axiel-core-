import { toAppError } from "@/lib/errors";
import type { AuditEvent } from "@/modules/security/audit-events";

export type AuditLogRow = {
  id: string;
  clinic_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  users?: { full_name: string | null; email: string | null } | null;
};

export type CommunicationLogRow = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  channel: string;
  use_case: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  provider: string | null;
  created_at: string;
  patients?: { full_name: string | null } | null;
  users?: { full_name: string | null; email: string | null } | null;
};

export async function getAuditLogs(options: {
  clinicId?: string | null;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("audit_logs")
    .select("*, users(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.clinicId) query = query.eq("clinic_id", options.clinicId);
  if (options.action)   query = query.ilike("action", `%${options.action}%`);
  if (options.from)     query = query.gte("created_at", options.from);
  if (options.to)       query = query.lte("created_at", options.to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as AuditLogRow[], total: count ?? 0 };
}

export async function getCommunicationLogs(options: {
  clinicId?: string | null;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: CommunicationLogRow[]; total: number }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("communication_logs")
    .select("*, patients(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.clinicId) query = query.eq("clinic_id", options.clinicId);
  if (options.from)     query = query.gte("created_at", options.from);
  if (options.to)       query = query.lte("created_at", options.to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as CommunicationLogRow[], total: count ?? 0 };
}

export async function writeAuditLog(input: {
  clinicId: string | null;
  action: AuditEvent | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.rpc("write_audit_log", {
      target_clinic_id: input.clinicId,
      action_name: input.action,
      entity_name: input.entityType,
      target_entity_id: input.entityId ?? null,
      details: input.metadata ?? {},
    });

    if (error) throw error;
  } catch (error) {
    // Audit logging should never expose sensitive provider/database details to the user.
    // The operation continues, but the server logs a safe operational error for support.
    const safeError = toAppError(error, "Audit log could not be written.");
    console.error("Audit log failed", {
      kind: safeError.kind,
      message: safeError.safeMessage,
      action: input.action,
      entityType: input.entityType,
    });
  }
}
