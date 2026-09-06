import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Bloqueio de horário pessoal/clínica (indisponibilidade). Tabela separada de
// appointments (migration 155): nunca entra em query de paciente. A app lê estes
// intervalos junto com appointments para conflito, disponibilidade e render da agenda.

export type TimeBlock = {
  id: string;
  clinic_id: string;
  practitioner_id: string | null;
  starts_at: string;
  duration_minutes: number;
  title: string | null;
  created_at: string;
};

export type BlockedInterval = {
  starts_at: string;
  duration_minutes: number;
  practitioner_id: string | null;
};

/**
 * Intervalos de bloqueio ativos numa janela [fromISO, toISO). Usado pelo motor de
 * conflito e pelo cálculo de disponibilidade. Filtra por practitioner quando pedido
 * (mantém bloqueios da clínica inteira, practitioner_id null, que valem para todos).
 */
export async function getBlockedIntervals(
  clinicId: string,
  fromISO: string,
  toISO: string,
  practitionerId?: string | null,
): Promise<BlockedInterval[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("time_blocks")
    .select("starts_at, duration_minutes, practitioner_id")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO);

  let rows = (data ?? []) as BlockedInterval[];
  if (practitionerId) {
    // Bloqueio da clínica inteira (null) sempre vale; específico só do mesmo profissional.
    rows = rows.filter((b) => b.practitioner_id === null || b.practitioner_id === practitionerId);
  }
  return rows;
}

/** Lista bloqueios ativos (para render da agenda) numa janela opcional. */
export async function listTimeBlocks(
  clinicId: string,
  opts: { fromISO?: string; toISO?: string } = {},
): Promise<TimeBlock[]> {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("time_blocks")
    .select("id, clinic_id, practitioner_id, starts_at, duration_minutes, title, created_at")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });
  if (opts.fromISO) q = q.gte("starts_at", opts.fromISO);
  if (opts.toISO) q = q.lt("starts_at", opts.toISO);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TimeBlock[];
}

export async function createTimeBlock(input: {
  clinic_id: string;
  starts_at: string;
  duration_minutes: number;
  title?: string | null;
  practitioner_id?: string | null;
  created_by?: string | null;
}): Promise<TimeBlock> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("time_blocks")
    .insert({
      clinic_id: input.clinic_id,
      starts_at: input.starts_at,
      duration_minutes: Math.min(1440, Math.max(1, Math.round(input.duration_minutes))),
      title: input.title?.trim() || null,
      practitioner_id: input.practitioner_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select("id, clinic_id, practitioner_id, starts_at, duration_minutes, title, created_at")
    .single();
  if (error) throw error;
  return data as TimeBlock;
}

/** Soft-delete escopado por clínica (defesa contra IDOR mesmo com admin client). */
export async function softDeleteTimeBlock(id: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("time_blocks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}
