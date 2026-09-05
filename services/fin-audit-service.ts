import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Módulo Financeiro (ERP) — Fase 6.3. Auditoria (read-only).
// Lê o log append-only fin_audit, gravado pelos serviços do razão e de contas a
// pagar desde a Fase 1/3 (quem/quando/o quê). Só leitura — nunca escreve aqui.

export type FinAuditRow = {
  id: string;
  entity: string;        // 'fin_entry' | 'fin_payable'
  entityId: string | null;
  action: string;        // 'create' | 'delete' | 'pay'
  changedByName: string | null;
  amountCents: number | null;
  createdAt: string;
};

/**
 * Extrai o valor (cents) do diff jsonb de forma tolerante — o razão grava
 * snake_case (amount_cents) e as contas a pagar gravam camelCase (amountCents).
 */
export function extractAuditAmountCents(diff: unknown): number | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  const raw = d.amount_cents ?? d.amountCents;
  return typeof raw === "number" ? raw : null;
}

export async function listFinAudit(clinicId: string, opts: { limit?: number } = {}): Promise<FinAuditRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fin_audit")
    .select("id, entity, entity_id, action, changed_by, diff, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    entity: string;
    entity_id: string | null;
    action: string;
    changed_by: string | null;
    diff: unknown;
    created_at: string;
  }[];

  const names = await namesFor(clinicId, rows.map((r) => r.changed_by).filter(Boolean) as string[]);
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    action: r.action,
    changedByName: r.changed_by ? names.get(r.changed_by) ?? null : null,
    amountCents: extractAuditAmountCents(r.diff),
    createdAt: r.created_at,
  }));
}

async function namesFor(clinicId: string, userIds: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds)];
  if (uniq.length === 0) return new Map();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .in("id", uniq);
  return new Map((data ?? []).map((u) => [u.id as string, (u.full_name as string) || "—"]));
}
