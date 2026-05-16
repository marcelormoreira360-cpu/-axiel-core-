import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toAppError } from "@/lib/errors";
import type { AuditEvent } from "@/modules/security/audit-events";

export async function writeAuditLog(input: {
  clinicId: string | null;
  action: AuditEvent | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
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
